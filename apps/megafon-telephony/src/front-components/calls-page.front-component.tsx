import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { SidePanelPages, openSidePanelPage, useUserId } from 'twenty-sdk/front-component';

import { CALLS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER, CALL_PANEL_PROBE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  normalizeAccessRules,
  resolveMemberVisibility,
  type CallJournalAccessRules,
} from 'src/shared/megafon/call-journal-access-rules';

/**
 * Журнал звонков по сотрудникам.
 *
 * Права: сотрудник видит в фильтре только разрешённых ему людей (правила хранятся
 * в приложении, маршрут `call-journal-access`), по умолчанию — только себя.
 * Кому в настройках выставлен «полный доступ» — выбирает любого сотрудника.
 *
 * Данные: звонок связан с событием календаря, событие — с участниками. Поэтому
 * выборка идёт в несколько шагов: события сотрудника → звонки по событиям →
 * участники событий (клиент) → компании клиентов.
 */

const ACCESS_PATH = '/call-journal-access';
const PAGE_SIZE = 60;
const MAX_MEMBER_PAGES = 12;
/** Сколько последних событий сотрудника просматриваем, чтобы набрать звонки. */
const MAX_EVENT_SCAN = 720;
/** Сколько страниц максимум догружаем для связей события (участники, цели, люди, компании). */
const MAX_PAGES = 14;

type MemberRow = {
  id: string;
  name: string;
  email: string;
};

type CallRow = {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  title: string | null;
  direction: string | null;
  result: string | null;
  /** Колонка «Клиент»: участники события, кроме нашего сотрудника, чью запись смотрим. */
  clientText: string;
  personPhone: string;
  /** Колонка «Цель»: к чему отнесён звонок — человек, компания или сделка. */
  targetText: string;
  audioUrl: string | null;
  /** Номер сопоставлен с контактом или компанией. */
  hasClient: boolean;
  /** В «Клиенте» есть участник-контакт (физлицо). */
  hasContactClient: boolean;
  /** В «Клиенте» есть участник-компания. */
  hasCompanyClient: boolean;
  /** В событии есть хотя бы одна цель: человек, компания или сделка. */
  hasTarget: boolean;
  /** Вторая сторона — наш сотрудник (звонок внутри). */
  isInternal: boolean;
  /** Событие календаря звонка — к нему привязываем клиента и цель. */
  eventId: string;
  /** Привязки клиента (участники-контакт/компания) — для отвязки. */
  clientLinks: { id: string; label: string }[];
  /** Цели события — для отвязки. */
  targetLinks: { id: string; label: string }[];
};

/** Что сопоставляем из строки журнала: второго участника или цель звонка. */
type LinkDialogKind = 'client' | 'target';

/** Вид сущности для поиска: контакт, компания или сделка. */
type LinkKind = 'contact' | 'company' | 'opportunity' | 'remont' | 'zapravka' | 'tender';

type LinkDialogState = { call: CallRow; kind: LinkDialogKind };

type SearchItem = { id: string; title: string; subtitle: string };

/** Подписи видов цели (как в колонке «Цель»). */
const TARGET_KIND_LABELS: Record<LinkKind, string> = {
  contact: 'Контакт',
  company: 'Компания',
  opportunity: 'Заказ',
  remont: 'Ремонт',
  zapravka: 'Заправка',
  tender: 'Тендер',
};

/** Источники поиска для сопоставления: контакты, компании и сделки. */
const SEARCH_SOURCES: Record<
  LinkKind,
  { path: string; key: string; select: string }
> = {
  contact: { path: '/rest/people', key: 'people', select: 'id,name,phones' },
  company: { path: '/rest/companies', key: 'companies', select: 'id,name,telefony' },
  opportunity: { path: '/rest/opportunities', key: 'opportunities', select: 'id,name' },
  remont: { path: '/rest/remontOborudovaniyas', key: 'remontOborudovaniyas', select: 'id,name' },
  zapravka: { path: '/rest/zapravkaKartridzheys', key: 'zapravkaKartridzheys', select: 'id,name' },
  tender: { path: '/rest/tendery', key: 'tendery', select: 'id,name' },
};

type FilterKey = 'all' | 'contacts' | 'companies' | 'noClient' | 'noTarget' | 'internal';

type ApiList<T> = {
  data?: Record<string, T[] | undefined>;
  totalCount?: number;
  pageInfo?: { endCursor?: string | null; hasNextPage?: boolean };
  errors?: { message?: string }[];
};

const readEnv = () =>
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const fullName = (value?: { firstName?: string; lastName?: string } | null) =>
  `${value?.firstName ?? ''} ${value?.lastName ?? ''}`.trim();

const formatDateTime = (iso: string | null) => {
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (startedAt: string | null, endedAt: string | null) => {
  if (!startedAt || !endedAt) {
    return '—';
  }

  const seconds = Math.max(
    0,
    Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000),
  );

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const DIRECTION_LABELS: Record<string, string> = {
  INCOMING: 'входящий',
  OUTGOING: 'исходящий',
  MISSED: 'пропущенный',
};

const RESULT_LABELS: Record<string, string> = {
  ANSWERED: 'отвечен',
  MISSED: 'пропущен',
  NOANSWER: 'не отвечен',
};

const directionLabel = (value: string | null) => {
  if (!value) {
    return '—';
  }

  return DIRECTION_LABELS[value] ?? value.toLowerCase();
};

/** Единый вид номера: +7XXXXXXXXXX. */
const normalizePhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  return digits ? `+${digits}` : '';
};

const formatPhone = (
  phones?: {
    primaryPhoneNumber?: string | null;
    primaryPhoneCallingCode?: string | null;
  } | null,
) => {
  const number = phones?.primaryPhoneNumber ?? '';

  if (!number) {
    return '';
  }

  return normalizePhone(`${phones?.primaryPhoneCallingCode ?? ''}${number}`);
};

/** Номер из заголовка звонка («📞 Входящий: 9620542184») — когда клиент ещё не сопоставлен. */
const phoneFromTitle = (title: string | null) => {
  const match = title?.match(/\d[\d\s()-]{5,}\d/);

  return match ? normalizePhone(match[0]) : '';
};

const CallsPage = () => {
  const userId = useUserId();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [me, setMe] = useState<MemberRow | null>(null);
  const [rules, setRules] = useState<CallJournalAccessRules>({ full: [], rules: {} });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const eventIdsRef = useRef<string[]>([]);
  /** Наши рабочие и личные номера — по ним отличаем внутренний звонок от неразобранного. */
  const ownNumbersRef = useRef<Set<string> | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /** Чья панель открыта сейчас — строка подсвечивается (метка от панели звонка). */
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [error, setError] = useState<string>('');

  const env = useMemo(() => readEnv(), []);
  const apiBase = (env.TWENTY_API_URL ?? '').replace(/\/+$/, '');
  const functionsBase = (env.TWENTY_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
  const token = env.TWENTY_APP_ACCESS_TOKEN ?? '';

  const api = useCallback(
    (path: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      // path может быть как относительным (`/rest/...`), так и полным
      // (`<functionsBase>/название-функции`): подставлять адрес API вторым разом нельзя.
      const target = /^https?:\/\//i.test(path) ? path : `${apiBase}${path}`;
      // Мост песочницы не передаёт `cache`, поэтому кэш браузера обходим
      // уникальным параметром: на 304 мост отдаёт ответ с пустым телом.
      const url =
        method === 'GET'
          ? `${target}${target.includes('?') ? '&' : '?'}_ts=${Date.now()}`
          : target;

      return fetch(url, {
        ...init,
        cache: 'no-store',
        headers: {
          ...((init?.headers as Record<string, string>) ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    },
    [apiBase, token],
  );

  // Кто я и какие у меня права: сотрудник по пользователю + правила приложения.
  useEffect(() => {
    if (!userId) {
      setError('Не удалось определить пользователя');
      setIsLoading(false);

      return;
    }

    let isRelevant = true;

    const load = async () => {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [meResponse, membersResponse, rulesResponse] = await Promise.all([
        fetch(
          `${apiBase}/rest/workspaceMembers?filter=${encodeURIComponent(`userId[eq]:${userId}`)}&limit=1&select=id,name,userEmail&_ts=${Date.now()}`,
          { headers, cache: 'no-store' },
        ),
        fetch(`${apiBase}/rest/workspaceMembers?limit=60&select=id,name,userEmail&_ts=${Date.now()}`, {
          headers,
          cache: 'no-store',
        }),
        fetch(`${functionsBase}${ACCESS_PATH}?_ts=${Date.now()}`, {
          headers,
          cache: 'no-store',
        }),
      ]);

      const meJson = (await meResponse.json()) as ApiList<{
        id: string;
        userEmail?: string | null;
        name?: { firstName?: string; lastName?: string } | null;
      }>;
      const membersJson = (await membersResponse.json()) as ApiList<{
        id: string;
        userEmail?: string | null;
        name?: { firstName?: string; lastName?: string } | null;
      }>;
      const rulesJson = (await rulesResponse.json()) as { rules?: unknown };
      const meRow = meJson.data?.workspaceMembers?.[0];

      if (!meRow) {
        throw new Error('Ваша карточка сотрудника не найдена');
      }

      const rows = (membersJson.data?.workspaceMembers ?? []).map((member) => ({
        id: member.id,
        name: fullName(member.name) || member.userEmail || 'без имени',
        email: member.userEmail ?? '',
      }));

      if (isRelevant) {
        setMe({
          id: meRow.id,
          name: fullName(meRow.name) || meRow.userEmail || 'без имени',
          email: meRow.userEmail ?? '',
        });
        setMembers(rows);
        setRules(normalizeAccessRules(rulesJson.rules));
        setSelectedId(meRow.id);
        setIsLoading(false);
      }
    };

    load().catch((loadError) => {
      if (isRelevant) {
        setError(describeError(loadError));
        setIsLoading(false);
      }
    });

    return () => {
      isRelevant = false;
    };
  }, [apiBase, functionsBase, token, userId]);

  // Кому я могу показать звонки: себе всегда, плюс разрешённые мне люди.
  const selectableMembers = useMemo(() => {
    if (!me) {
      return [] as MemberRow[];
    }

    if (rules.full.includes(me.id)) {
      return members;
    }

    const allowed = new Set([me.id, ...(rules.rules[me.id] ?? [])]);

    return members.filter((member) => allowed.has(member.id));
  }, [me, members, rules]);

  const canChoose = selectableMembers.length > 1;

  const loadCalls = useCallback(
    async (workspaceMemberId: string, cursor: string | null) => {
      setIsLoadingCalls(true);
      setError('');

      try {
        // Хелпер: догружаем все страницы выборки (REST отдаёт максимум 60 за раз).
        const fetchAll = async <T,>(
          path: string,
          base: Record<string, string>,
          key: string,
          maxPages = MAX_PAGES,
        ): Promise<T[]> => {
          const collected: T[] = [];
          let after: string | null = null;

          for (let page = 0; page < maxPages; page += 1) {
            const params = new URLSearchParams({ ...base, limit: String(PAGE_SIZE) });

            if (after) {
              params.set('starting_after', after);
            }

            const response = await api(`${path}?${params.toString()}`);
            const json = (await response.json()) as ApiList<T>;

            collected.push(...(json.data?.[key] ?? []));

            if (!json.pageInfo?.hasNextPage || !json.pageInfo.endCursor) {
              break;
            }

            after = json.pageInfo.endCursor;
          }

          return collected;
        };

        // GraphQL-запрос: он умеет серверную сортировку и фильтр по связи одновременно.
        const graphqlQuery = async <T,>(
          query: string,
          variables: Record<string, unknown>,
        ): Promise<T> => {
          const response = await api('/graphql', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ query, variables }),
          });
          const json = (await response.json()) as {
            data?: T;
            errors?: { message?: string }[];
          };

          if (json.errors?.length) {
            throw new Error(json.errors.map((item) => item.message ?? '').join('; '));
          }

          return (json.data ?? {}) as T;
        };

        // Наши номера: рабочие (из должностей) и личные (из карточек сотрудников).
        // Внутренний звонок — только когда вторая сторона звонила с одного из них.
        if (!ownNumbersRef.current) {
          const ownNumbers = new Set<string>();

          try {
            const [positions, staff] = await Promise.all([
              fetchAll<{ workPhone?: { primaryPhoneNumber?: string | null } | null }>(
                '/rest/positions',
                { select: 'id,workPhone' },
                'positions',
              ),
              fetchAll<{ telefon?: { primaryPhoneNumber?: string | null } | null }>(
                '/rest/workspaceMembers',
                { select: 'id,telefon' },
                'workspaceMembers',
              ),
            ]);

            positions.forEach((position) => {
              const number = normalizePhone(position.workPhone?.primaryPhoneNumber ?? '');

              if (number) {
                ownNumbers.add(number);
              }
            });

            staff.forEach((member) => {
              const number = normalizePhone(member.telefon?.primaryPhoneNumber ?? '');

              if (number) {
                ownNumbers.add(number);
              }
            });
          } catch {
            // без списка номеров внутренние просто не определим — журнал не ломаем
          }

          ownNumbersRef.current = ownNumbers;
        }

        // 1. Свежие события сотрудника. GraphQL сортирует на сервере (REST при фильтре
        // по связи порядок игнорирует), поэтому берём только последние события —
        // перебирать все страницы не нужно, даже когда звонков тысячи.
        const collectedEventIds: string[] = [];
        const activeEventIds = cursor === null ? [] : eventIdsRef.current;

        if (cursor === null) {
          let after: string | null = null;

          for (let page = 0; page < MAX_MEMBER_PAGES; page += 1) {
            const data = await graphqlQuery<{
              calendarEventParticipants?: {
                edges: { node: { calendarEventId?: string | null } }[];
                pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
              };
            }>(
              `query JournalEvents($member: UUID!, $after: String) {
                 calendarEventParticipants(
                   filter: { workspaceMemberId: { eq: $member } }
                   orderBy: [{ createdAt: DescNullsLast }]
                   first: 60
                   after: $after
                 ) {
                   edges { node { calendarEventId } }
                   pageInfo { hasNextPage endCursor }
                 }
               }`,
              { member: workspaceMemberId, after },
            );

            const connection = data.calendarEventParticipants;

            (connection?.edges ?? []).forEach((edge) => {
              if (edge.node.calendarEventId) {
                collectedEventIds.push(edge.node.calendarEventId);
              }
            });

            if (collectedEventIds.length >= MAX_EVENT_SCAN) {
              break;
            }

            if (!connection?.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) {
              break;
            }

            after = connection.pageInfo.endCursor;
          }

          const unique = [...new Set(collectedEventIds)];

          eventIdsRef.current = unique;
          activeEventIds.push(...unique);
        }

        if (activeEventIds.length === 0) {
          setCalls([]);
          setNextCursor(null);
          setIsLoadingCalls(false);

          return;
        }

        // 2. Последние звонки по этим событиям — снова сортировка на сервере:
        // берём только свежие, а не «первые попавшиеся 60».
        const callData = await graphqlQuery<{
          callRecordings?: {
            edges: {
              node: {
                id: string;
                title?: string | null;
                startedAt?: string | null;
                endedAt?: string | null;
                napravlenie?: string | null;
                itog?: string | null;
                audio?: Array<{ fileId?: string; url?: string }> | null;
                calendarEventId?: string | null;
              };
            }[];
            pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
          };
        }>(
          `query JournalCalls($ids: [UUID!], $after: String) {
             callRecordings(
               filter: { calendarEventId: { in: $ids } }
               orderBy: [{ startedAt: DescNullsLast }]
               first: 60
               after: $after
             ) {
               edges {
                 node { id title startedAt endedAt napravlenie itog calendarEventId audio { url } }
               }
               pageInfo { hasNextPage endCursor }
             }
           }`,
          { ids: activeEventIds, after: cursor },
        );

        const records = (callData.callRecordings?.edges ?? []).map((edge) => edge.node);

        if (records.length === 0) {
          setCalls((current) => (cursor === null ? [] : current));
          setNextCursor(null);
          setIsLoadingCalls(false);

          return;
        }

        // 3. Клиенты: участники событий этих звонков.
        const callEventIds = [
          ...new Set(
            records
              .map((record) => {
                const raw = (record as { calendarEventId?: string | null }).calendarEventId;

                return raw ?? null;
              })
              .filter((value): value is string => Boolean(value)),
          ),
        ];
        const personIdsByEvent: Record<string, string[]> = {};
        const memberNamesByEvent: Record<string, string[]> = {};
        const phoneByEvent: Record<string, string> = {};
        const participantCompanyIdsByEvent: Record<string, string[]> = {};
        const targetPersonIdsByEvent: Record<string, string[]> = {};
        const targetCompanyIdsByEvent: Record<string, string[]> = {};
        const dealTargetsByEvent: Record<string, { label: string; id: string }[]> = {};
        /** Записи участников-клиентов и цели — с id, чтобы можно было отвязать. */
        const clientRowsByEvent: Record<
          string,
          { id: string; personId?: string; companyId?: string }[]
        > = {};
        const targetRowsByEvent: Record<
          string,
          { id: string; kind: LinkKind; refId: string }[]
        > = {};

        const pushUnique = (map: Record<string, string[]>, key: string, value: string) => {
          const current = map[key] ?? [];

          if (!current.includes(value)) {
            current.push(value);
            map[key] = current;
          }
        };

        const pushDealTarget = (key: string, label: string, id: string) => {
          const current = dealTargetsByEvent[key] ?? [];

          if (!current.some((deal) => deal.id === id)) {
            current.push({ label, id });
            dealTargetsByEvent[key] = current;
          }
        };

        const pushClientRow = (
          key: string,
          row: { id: string; personId?: string; companyId?: string },
        ) => {
          const current = clientRowsByEvent[key] ?? [];

          if (!current.some((item) => item.id === row.id)) {
            current.push(row);
            clientRowsByEvent[key] = current;
          }
        };

        const pushTargetRow = (key: string, row: { id: string; kind: LinkKind; refId: string }) => {
          const current = targetRowsByEvent[key] ?? [];

          if (!current.some((item) => item.id === row.id)) {
            current.push(row);
            targetRowsByEvent[key] = current;
          }
        };

        if (callEventIds.length > 0) {
          const participants = await fetchAll<{
            id?: string | null;
            calendarEventId?: string | null;
            personId?: string | null;
            workspaceMemberId?: string | null;
            companyId?: string | null;
            displayName?: string | null;
            handle?: string | null;
          }>(
            '/rest/calendarEventParticipants',
            {
              filter: `calendarEventId[in]:[${callEventIds.join(',')}]`,
              select: 'id,calendarEventId,personId,workspaceMemberId,companyId,displayName,handle',
            },
            'calendarEventParticipants',
          );

          participants.forEach((participant) => {
            if (!participant.calendarEventId) {
              return;
            }

            const eventId = participant.calendarEventId;

            if (participant.handle) {
              phoneByEvent[eventId] = normalizePhone(participant.handle);
            }

            if (participant.companyId) {
              // звонок с номера компании: компания — вторая сторона разговора
              pushUnique(participantCompanyIdsByEvent, eventId, participant.companyId);

              if (participant.id) {
                pushClientRow(eventId, { id: participant.id, companyId: participant.companyId });
              }
            }

            if (participant.personId) {
              pushUnique(personIdsByEvent, eventId, participant.personId);

              if (participant.id) {
                pushClientRow(eventId, { id: participant.id, personId: participant.personId });
              }
            } else if (
              participant.workspaceMemberId &&
              participant.workspaceMemberId !== workspaceMemberId &&
              participant.displayName
            ) {
              // вторая сторона — наш сотрудник: показываем коллегой
              pushUnique(memberNamesByEvent, eventId, participant.displayName);
            }
          });

          // Цели события: клиент может быть целью (компания без контакта), плюс сделки —
          // наши (Ремонт / Заправка / Тендер) и стандартная сделка.
          const targets = await fetchAll<{
            id?: string | null;
            calendarEventId?: string | null;
            targetPersonId?: string | null;
            targetCompanyId?: string | null;
            targetOpportunityId?: string | null;
            nashaSdelkaRemontOborudovaniyaId?: string | null;
            nashaSdelkaZapravkaKartridzheyId?: string | null;
            nashaSdelkaTenderId?: string | null;
          }>(
            '/rest/calendarEventTargets',
            {
              filter: `calendarEventId[in]:[${callEventIds.join(',')}]`,
              select:
                'id,calendarEventId,targetPersonId,targetCompanyId,targetOpportunityId,' +
                'nashaSdelkaRemontOborudovaniyaId,nashaSdelkaZapravkaKartridzheyId,nashaSdelkaTenderId',
            },
            'calendarEventTargets',
          );

          targets.forEach((target) => {
            if (!target.calendarEventId) {
              return;
            }

            const eventId = target.calendarEventId;

            if (target.targetPersonId) {
              pushUnique(targetPersonIdsByEvent, eventId, target.targetPersonId);

              if (target.id) {
                pushTargetRow(eventId, { id: target.id, kind: 'contact', refId: target.targetPersonId });
              }
            }

            if (target.targetCompanyId) {
              pushUnique(targetCompanyIdsByEvent, eventId, target.targetCompanyId);

              if (target.id) {
                pushTargetRow(eventId, { id: target.id, kind: 'company', refId: target.targetCompanyId });
              }
            }

            if (target.targetOpportunityId) {
              pushDealTarget(eventId, 'Сделка', target.targetOpportunityId);

              if (target.id) {
                pushTargetRow(eventId, { id: target.id, kind: 'opportunity', refId: target.targetOpportunityId });
              }
            }

            if (target.nashaSdelkaRemontOborudovaniyaId) {
              pushDealTarget(eventId, 'Ремонт', target.nashaSdelkaRemontOborudovaniyaId);

              if (target.id) {
                pushTargetRow(eventId, {
                  id: target.id,
                  kind: 'remont',
                  refId: target.nashaSdelkaRemontOborudovaniyaId,
                });
              }
            }

            if (target.nashaSdelkaZapravkaKartridzheyId) {
              pushDealTarget(eventId, 'Заправка', target.nashaSdelkaZapravkaKartridzheyId);

              if (target.id) {
                pushTargetRow(eventId, {
                  id: target.id,
                  kind: 'zapravka',
                  refId: target.nashaSdelkaZapravkaKartridzheyId,
                });
              }
            }

            if (target.nashaSdelkaTenderId) {
              pushDealTarget(eventId, 'Тендер', target.nashaSdelkaTenderId);

              if (target.id) {
                pushTargetRow(eventId, { id: target.id, kind: 'tender', refId: target.nashaSdelkaTenderId });
              }
            }
          });
        }

        const personIds = [
          ...new Set([
            ...Object.values(personIdsByEvent).flat(),
            ...Object.values(targetPersonIdsByEvent).flat(),
          ]),
        ];
        const personNames: Record<string, string> = {};
        const personPhones: Record<string, string> = {};
        const companyByPerson: Record<string, string> = {};

        if (personIds.length > 0) {
          const peopleParams = new URLSearchParams({
            filter: `id[in]:[${personIds.join(',')}]`,
            limit: String(PAGE_SIZE),
            select: 'id,name,companyId,phones',
          });
          const peopleResponse = await api(`/rest/people?${peopleParams.toString()}`);
          const peopleJson = (await peopleResponse.json()) as ApiList<{
            id: string;
            name?: { firstName?: string; lastName?: string } | null;
            companyId?: string | null;
            phones?: {
              primaryPhoneNumber?: string | null;
              primaryPhoneCallingCode?: string | null;
            } | null;
          }>;

          (peopleJson.data?.people ?? []).forEach((person) => {
            personNames[person.id] = fullName(person.name) || 'без имени';
            personPhones[person.id] = formatPhone(person.phones);

            if (person.companyId) {
              companyByPerson[person.id] = person.companyId;
            }
          });
        }

        const companyIds = [
          ...new Set([
            ...Object.values(participantCompanyIdsByEvent).flat(),
            ...Object.values(targetCompanyIdsByEvent).flat(),
          ]),
        ];
        const companyNames: Record<string, string> = {};

        if (companyIds.length > 0) {
          const companiesParams = new URLSearchParams({
            filter: `id[in]:[${companyIds.join(',')}]`,
            limit: String(PAGE_SIZE),
            select: 'id,name',
          });
          const companiesResponse = await api(`/rest/companies?${companiesParams.toString()}`);
          const companiesJson = (await companiesResponse.json()) as ApiList<{
            id: string;
            name?: string | null;
          }>;

          (companiesJson.data?.companies ?? []).forEach((company) => {
            companyNames[company.id] = company.name ?? 'без названия';
          });
        }

        // Названия сделок-целей: наши объекты (Ремонт / Заправка / Тендер) и стандартные сделки.
        const dealIdsByLabel: Record<string, string[]> = {};

        Object.values(dealTargetsByEvent).forEach((deals) => {
          deals.forEach((deal) => {
            pushUnique(dealIdsByLabel, deal.label, deal.id);
          });
        });

        const dealNames: Record<string, string> = {};
        const dealSources: { label: string; path: string; key: string }[] = [
          { label: 'Ремонт', path: '/rest/remontOborudovaniyas', key: 'remontOborudovaniyas' },
          { label: 'Заправка', path: '/rest/zapravkaKartridzheys', key: 'zapravkaKartridzheys' },
          { label: 'Тендер', path: '/rest/tendery', key: 'tendery' },
          { label: 'Сделка', path: '/rest/opportunities', key: 'opportunities' },
        ];

        for (const source of dealSources) {
          const ids = dealIdsByLabel[source.label] ?? [];

          if (ids.length === 0) {
            continue;
          }

          try {
            const deals = await fetchAll<{ id: string; name?: string | null }>(
              source.path,
              { filter: `id[in]:[${ids.join(',')}]`, select: 'id,name' },
              source.key,
            );

            deals.forEach((deal) => {
              dealNames[deal.id] = deal.name ?? '';
            });
          } catch {
            // нет прав на объект — покажем цель без названия, журнал не ломаем
          }
        }

        const rows: CallRow[] = records.map((record) => {
          const eventId = (record as { calendarEventId?: string | null }).calendarEventId ?? '';
          const personIds = eventId ? personIdsByEvent[eventId] ?? [] : [];
          const memberNames = eventId ? memberNamesByEvent[eventId] ?? [] : [];
          const targetPersonIds = eventId ? targetPersonIdsByEvent[eventId] ?? [] : [];
          const targetCompanyIds = eventId ? targetCompanyIdsByEvent[eventId] ?? [] : [];
          const dealTargets = eventId ? dealTargetsByEvent[eventId] ?? [] : [];

          const participantCompanyIds = eventId
            ? participantCompanyIdsByEvent[eventId] ?? []
            : [];
          const callNumber = phoneFromTitle(record.title ?? null);
          // Внутренний — только если вторая сторона звонила с нашего же номера: ВАТС нередко
          // добавляет второго сотрудника и в клиентские звонки (переадресация) — это не внутренний.
          const isOwnNumber = Boolean(callNumber) && Boolean(ownNumbersRef.current?.has(callNumber));

          // Колонка «Клиент» — только участники события, кроме нашего сотрудника, чью запись
          // смотрим: контакт, компания (номер компании) или коллега. Цели сюда не попадают.
          const clientParts = [
            ...personIds.map((id) => personNames[id] ?? '').filter(Boolean),
            ...participantCompanyIds.map((id) => companyNames[id] ?? '').filter(Boolean),
            ...(isOwnNumber ? memberNames.map((name) => `Коллега: ${name}`) : []),
          ];

          // Колонка «Цель» — к чему отнесён звонок: человек, компания или сделка.
          const targetParts = [
            ...targetPersonIds.map((id) => personNames[id] ?? '').filter(Boolean),
            ...targetCompanyIds.map((id) => companyNames[id] ?? '').filter(Boolean),
            ...dealTargets.map((deal) => {
              const name = dealNames[deal.id] ?? '';

              return name ? `${deal.label}: ${name}` : deal.label;
            }),
          ];

          return {
            id: record.id,
            startedAt: record.startedAt ?? null,
            endedAt: record.endedAt ?? null,
            title: record.title ?? null,
            direction: record.napravlenie ?? null,
            result: record.itog ?? null,
            clientText: [...new Set(clientParts)].join(' / '),
            targetText: [...new Set(targetParts)].join(' / '),
            personPhone:
              (personIds[0] ? personPhones[personIds[0]] : '') ||
              (eventId ? phoneByEvent[eventId] : '') ||
              phoneFromTitle(record.title ?? null),
            audioUrl: record.audio?.[0]?.url ?? null,
            hasClient: personIds.length > 0 || participantCompanyIds.length > 0,
            hasContactClient: personIds.length > 0,
            hasCompanyClient: participantCompanyIds.length > 0,
            hasTarget: targetParts.length > 0,
            isInternal: personIds.length === 0 && participantCompanyIds.length === 0 && isOwnNumber,
            eventId,
            clientLinks: (eventId ? clientRowsByEvent[eventId] ?? [] : []).map((row) => ({
              id: row.id,
              label: row.personId
                ? personNames[row.personId] ?? 'контакт'
                : companyNames[row.companyId ?? ''] ?? 'компания',
            })),
            targetLinks: (eventId ? targetRowsByEvent[eventId] ?? [] : []).map((row) => {
              const name =
                row.kind === 'contact'
                  ? personNames[row.refId] ?? ''
                  : row.kind === 'company'
                    ? companyNames[row.refId] ?? ''
                    : dealNames[row.refId] ?? '';

              return {
                id: row.id,
                label: name ? `${TARGET_KIND_LABELS[row.kind]}: ${name}` : TARGET_KIND_LABELS[row.kind],
              };
            }),
          };
        });

        // API не сортирует выборку, когда фильтр идёт по связи (`calendarEventId[in]:`),
        // поэтому порядок задаём сами: звонки — от новых к старым.
        rows.sort((left, right) => (right.startedAt ?? '').localeCompare(left.startedAt ?? ''));

        setCalls((current) => {
          const merged = cursor === null ? rows : [...current, ...rows];
          // страховка от дублей, если страница наложилась на предыдущую
          const seen = new Set<string>();
          const unique = merged.filter((row) =>
            seen.has(row.id) ? false : (seen.add(row.id), true),
          );

          return [...unique].sort((left, right) =>
            (right.startedAt ?? '').localeCompare(left.startedAt ?? ''),
          );
        });
        // Догрузка: пока сервер отдаёт следующую страницу — показываем кнопку.
        const callPageInfo = callData.callRecordings?.pageInfo;

        setNextCursor(
          callPageInfo?.hasNextPage && callPageInfo.endCursor ? callPageInfo.endCursor : null,
        );
      } catch (loadError) {
        setError(describeError(loadError));
      } finally {
        setIsLoadingCalls(false);
      }
    },
    [api],
  );

  useEffect(() => {
    if (selectedId) {
      setActiveCallId(null);
      loadCalls(selectedId, null);
    }
  }, [selectedId, loadCalls]);

  /**
   * Подсветка строки, чья панель открыта: ставим при клике. Узнать о закрытии
   * панели хост не даёт (общего состояния между компонентами нет), поэтому
   * подсветка снимается при выборе другого сотрудника или перезагрузке страницы.
   */
  /** Клик по строке: кнопки сопоставления помечают клик, чтобы он «не считался». */
  const openRow = (recordId: string) => {
    if (suppressRowClickRef.current) {
      suppressRowClickRef.current = false;

      return;
    }

    openCall(recordId);
  };

  /**
   * Разведка (этап 1): id компонента нашей боковой панели.
   *
   * В песочнице известен только universalIdentifier компонента, а панели нужен
   * его uuid — берём из метаданных (`frontComponents`) и кэшируем на время жизни
   * страницы. Запрос идёт тем же токеном приложения, что и остальные.
   */
  const panelComponentIdRef = useRef<string | null>(null);

  const resolvePanelComponentId = useCallback(async (): Promise<string> => {
    if (panelComponentIdRef.current) {
      return panelComponentIdRef.current;
    }

    const response = await api('/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ frontComponents { id name universalIdentifier } }',
      }),
    });

    const json = (await response.json()) as {
      data?: {
        frontComponents?: Array<{ id?: string; universalIdentifier?: string }>;
      };
      errors?: Array<{ message?: string }>;
    };

    const row = (json?.data?.frontComponents ?? []).find(
      (item) =>
        item.universalIdentifier ===
        CALL_PANEL_PROBE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
    );

    if (!row?.id) {
      throw new Error(
        `компонент панели не найден в метаданных${
          json?.errors?.[0]?.message ? `: ${json.errors[0].message}` : ''
        }`,
      );
    }

    panelComponentIdRef.current = row.id;

    return row.id;
  }, [api]);

  const openCall = (recordId: string) => {
    setActiveCallId(recordId);

    void (async () => {
      try {
        const panelComponentId = await resolvePanelComponentId();

        await openSidePanelPage({
          page: SidePanelPages.ViewFrontComponent,
          frontComponentId: panelComponentId,
          recordId,
          objectNameSingular: 'callRecording',
          pageTitle: 'Звонок',
          pageIcon: 'IconPhone',
        });

        return;
      } catch (panelError) {
        console.error(
          'call-journal: не удалось открыть свою панель звонка',
          panelError,
        );
        setError(`Панель звонка: ${describeError(panelError)}`);
      }

      // Резерв: пока идёт разведка, журнал не должен ломаться из-за панели.
      openSidePanelPage({
        page: SidePanelPages.ViewRecord,
        recordId,
        objectNameSingular: 'callRecording',
      }).catch((openError) => setError(describeError(openError)));
    })();
  };

  // ── ручное сопоставление: клиент (участник) и цель (цель события) ──────────
  const [dialog, setDialog] = useState<LinkDialogState | null>(null);
  const [searchKind, setSearchKind] = useState<LinkKind>('contact');
  const [searchText, setSearchText] = useState('');
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');
  /** Запись, которую пользователь уже «нажал отвязать» — ждём подтверждения. */
  const [pendingUnlink, setPendingUnlink] = useState<string | null>(null);
  /** Клик пришёл по кнопке сопоставления — карточку звонка не открываем. */
  const suppressRowClickRef = useRef(false);

  const markRowClickSuppressed = () => {
    suppressRowClickRef.current = true;

    try {
      setTimeout(() => {
        suppressRowClickRef.current = false;
      }, 300);
    } catch {
      // без таймера флаг снимется при следующем клике по строке
    }
  };

  const openLinkDialog = (call: CallRow, kind: LinkDialogKind) => {
    if (!call.eventId) {
      setError('У звонка нет события календаря — сопоставление недоступно');

      return;
    }

    setDialog({ call, kind });
    setSearchKind(kind === 'client' ? 'contact' : 'opportunity');
    setSearchText('');
    setSearchItems([]);
    setLinkError('');
  };

  const closeLinkDialog = () => {
    setDialog(null);
    setSearchItems([]);
    setLinkError('');
    setIsSearching(false);
    setPendingUnlink(null);
  };

  /** Поиск клиента или цели: контакты, компании и сделки. */
  const runSearch = async () => {
    if (!dialog) return;

    const text = searchText.trim();

    if (text.length < 2) {
      setLinkError('Введите хотя бы два символа');

      return;
    }

    setIsSearching(true);
    setLinkError('');

    try {
      const digits = text.replace(/\D/g, '');
      const source = SEARCH_SOURCES[searchKind];
      const conditions: string[] = [];

      if (searchKind === 'contact') {
        conditions.push(`name.firstName[ilike]:%${text}%`);
        conditions.push(`name.lastName[ilike]:%${text}%`);

        if (digits.length >= 4) {
          conditions.push(`phones.primaryPhoneNumber[ilike]:%${digits}%`);
          // дополнительные телефоны: для RAW_JSON доступен только `like`
          conditions.push(`phones.additionalPhones[like]:%${digits}%`);
        }
      } else if (searchKind === 'company') {
        conditions.push(`name[ilike]:%${text}%`);

        if (digits.length >= 4) {
          conditions.push(`telefony.primaryPhoneNumber[ilike]:%${digits}%`);
          conditions.push(`telefony.additionalPhones[like]:%${digits}%`);
        }
      } else {
        conditions.push(`name[ilike]:%${text}%`);
      }

      const filter = conditions.length > 1 ? `or(${conditions.join(',')})` : conditions[0];
      const params = new URLSearchParams({ filter, limit: '100', select: source.select });
      const response = await api(`${source.path}?${params.toString()}`);
      const json = (await response.json()) as ApiList<{
        id: string;
        name?: { firstName?: string; lastName?: string } | string | null;
        phones?: {
          primaryPhoneNumber?: string | null;
          primaryPhoneCallingCode?: string | null;
        } | null;
        telefony?: { primaryPhoneNumber?: string | null } | null;
      }>;
      const rows = json.data?.[source.key] ?? [];

      setSearchItems(
        rows.map((row) => ({
          id: row.id,
          title: typeof row.name === 'string' ? row.name : fullName(row.name) || 'без названия',
          subtitle:
            searchKind === 'contact'
              ? formatPhone(row.phones)
              : searchKind === 'company'
                ? formatPhone(row.telefony)
                : '',
        })),
      );
    } catch (searchError) {
      setLinkError(describeError(searchError));
    } finally {
      setIsSearching(false);
    }
  };

  /** Привязка выбранного клиента или цели. */
  const runLink = async (item: SearchItem) => {
    if (!dialog) return;

    setLinkBusy(true);
    setLinkError('');

    try {
      const body: Record<string, unknown> = {
        action: dialog.kind === 'client' ? 'linkClient' : 'linkTarget',
        eventId: dialog.call.eventId,
        callRecordingId: dialog.call.id,
        title: dialog.call.title ?? '',
        happensAt: dialog.call.startedAt ?? '',
      };

      if (dialog.kind === 'client') {
        if (searchKind === 'company') {
          body.companyId = item.id;
          body.displayName = item.title;
        } else {
          body.personId = item.id;
          body.displayName = item.title;
          body.handle = dialog.call.personPhone || '';
        }
      } else {
        body.kind = searchKind;
        body.targetId = item.id;
      }

      const response = await api(`${functionsBase}/call-journal-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };

      if (!json.ok) throw new Error(json.error || 'не удалось привязать');

      closeLinkDialog();

      if (selectedId) await loadCalls(selectedId, null);
    } catch (linkErr) {
      setLinkError(describeError(linkErr));
    } finally {
      setLinkBusy(false);
    }
  };

  /** Снятие привязки: участник-клиент или цель события. */
  const runUnlink = async (kind: LinkDialogKind, id: string) => {
    setLinkBusy(true);
    setLinkError('');

    try {
      const response = await api(`${functionsBase}/call-journal-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          kind === 'client'
            ? { action: 'unlinkClient', participantId: id }
            : { action: 'unlinkTarget', targetId: id },
        ),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };

      if (!json.ok) throw new Error(json.error || 'не удалось отвязать');

      closeLinkDialog();

      if (selectedId) await loadCalls(selectedId, null);
    } catch (linkErr) {
      setLinkError(describeError(linkErr));
    } finally {
      setLinkBusy(false);
    }
  };

  // Фильтры контроля. Считаем по загруженным звонкам — список догружается кнопкой ниже.
  // «Нет клиента» / «Нет цели» смотрим по своим колонкам: внутренние звонки сюда тоже попадают
  // (разговор с коллегой тоже бывает про сделку — её и надо проставить целью).
  const filterCounts = useMemo(
    () => ({
      all: calls.length,
      contacts: calls.filter((call) => call.hasContactClient).length,
      companies: calls.filter((call) => call.hasCompanyClient).length,
      noClient: calls.filter((call) => !call.hasClient).length,
      noTarget: calls.filter((call) => !call.hasTarget).length,
      internal: calls.filter((call) => call.isInternal).length,
    }),
    [calls],
  );

  const visibleCalls = useMemo(() => {
    switch (filter) {
      case 'contacts':
        return calls.filter((call) => call.hasContactClient);
      case 'companies':
        return calls.filter((call) => call.hasCompanyClient);
      case 'noClient':
        return calls.filter((call) => !call.hasClient);
      case 'noTarget':
        return calls.filter((call) => !call.hasTarget);
      case 'internal':
        return calls.filter((call) => call.isInternal);
      default:
        return calls;
    }
  }, [calls, filter]);

  if (isLoading) {
    return <div style={{ padding: '8px', fontSize: '13px' }}>Загружаем журнал…</div>;
  }

  if (error && !calls.length && !members.length) {
    return (
      <div style={{ padding: '8px', fontSize: '13px' }}>
        <div style={{ fontWeight: 600 }}>✗ {error}</div>
      </div>
    );
  }

  const selectedMember = selectableMembers.find((member) => member.id === selectedId);
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '100px 88px 120px minmax(0, 1.15fr) minmax(0, 1.05fr) 60px 88px 44px',
    columnGap: '12px',
    rowGap: 0,
    alignItems: 'center',
    width: '100%',
    boxSizing: 'border-box',
  } as const;

  /** Кнопка сопоставления в ячейке: «＋ клиент» / «✎» — не открывает карточку. */
  const linkButtonStyle = {
    flex: '0 0 auto',
    padding: '1px 7px',
    borderRadius: '999px',
    border: '1px dashed rgba(128, 128, 128, 0.5)',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '11.5px',
    lineHeight: '17px',
    whiteSpace: 'nowrap',
    opacity: 0.9,
  } as const;

  /** Уже привязанное значение: кликабельно, без рамки и карандаша. */
  const linkedValueStyle = {
    flex: '0 1 auto',
    minWidth: 0,
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    font: 'inherit',
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textDecoration: 'underline dotted',
    textUnderlineOffset: '3px',
  } as const;

  const dialogLinks = dialog
    ? dialog.kind === 'client'
      ? dialog.call.clientLinks
      : dialog.call.targetLinks
    : [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontSize: '13px',
        padding: '14px 18px 20px 18px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>Сотрудник:</span>

        {canChoose ? (
          <select
            value={selectedId ?? ''}
            onChange={(event) => setSelectedId(event.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(128, 128, 128, 0.4)',
              background: 'transparent',
              color: 'inherit',
              fontSize: '13px',
            }}
          >
            {selectableMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ opacity: 0.85 }}>
            {selectedMember?.name ?? me?.name ?? '—'} (показаны только ваши звонки)
          </span>
        )}

        {isLoadingCalls ? <span style={{ opacity: 0.7 }}>загружаем…</span> : null}
        {error ? <span style={{ opacity: 0.95 }}>✗ {error}</span> : null}
      </div>

      <div style={{ opacity: 0.6, fontSize: '12px' }}>
        Нажмите на звонок — карточка откроется в панели справа. Показаны все звонки сотрудника,
        счётчики фильтров — по ним же.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {(
          [
            ['all', 'Все'],
            ['contacts', 'Контакты'],
            ['companies', 'Компании'],
            ['noClient', 'Нет клиента'],
            ['noTarget', 'Нет цели'],
            ['internal', 'Внутренние'],
          ] as [FilterKey, string][]
        ).map(([key, label]) => {
          const isActive = filter === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              style={{
                padding: '4px 12px',
                borderRadius: '999px',
                border: `1px solid ${
                  isActive ? 'rgba(128, 128, 128, 0.75)' : 'rgba(128, 128, 128, 0.35)'
                }`,
                background: isActive ? 'rgba(128, 128, 128, 0.22)' : 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {label} ({filterCounts[key]})
            </button>
          );
        })}
      </div>

      <div
        style={{
          ...gridStyle,
          fontWeight: 600,
          opacity: 0.7,
          borderBottom: '1px solid rgba(128, 128, 128, 0.35)',
          padding: '0 10px 8px 10px',
        }}
      >
        <span>Время</span>
        <span>Направление</span>
        <span>Телефон</span>
        <span>Клиент</span>
        <span>Цель</span>
        <span>Длит.</span>
        <span>Итог</span>
        <span>Запись</span>
      </div>

      {visibleCalls.length === 0 && !isLoadingCalls ? (
        <div style={{ opacity: 0.75 }}>Звонков не найдено</div>
      ) : null}

      {visibleCalls.map((call) => (
        <Fragment key={call.id}>
        <div
          key={call.id}
          onClick={() => openRow(call.id)}
          onMouseEnter={() => setHoveredId(call.id)}
          onMouseLeave={() => setHoveredId(null)}
          title="Открыть карточку звонка"
          style={{
            ...gridStyle,
            cursor: 'pointer',
            padding: '7px 10px',
            borderRadius: '4px',
            borderBottom: '1px solid rgba(128, 128, 128, 0.12)',
            background:
              activeCallId === call.id
                ? 'rgba(128, 128, 128, 0.28)'
                : hoveredId === call.id
                  ? 'rgba(128, 128, 128, 0.14)'
                  : 'transparent',
            boxShadow:
              activeCallId === call.id
                ? 'inset 3px 0 0 rgba(128, 128, 128, 0.9)'
                : 'none',
          }}
        >
          <span>{formatDateTime(call.startedAt)}</span>
          <span>{directionLabel(call.direction)}</span>
          <span>{call.personPhone || '—'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            {call.clientText ? (
              <button
                type="button"
                title="Изменить клиента"
                onClick={(event) => {
                  markRowClickSuppressed();
                  event.stopPropagation();
                  openLinkDialog(call, 'client');
                }}
                style={linkedValueStyle}
              >
                {call.clientText}
              </button>
            ) : (
              <button
                type="button"
                title="Сопоставить клиента"
                onClick={(event) => {
                  markRowClickSuppressed();
                  event.stopPropagation();
                  openLinkDialog(call, 'client');
                }}
                style={linkButtonStyle}
              >
                ＋ клиент
              </button>
            )}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            {call.targetText ? (
              <button
                type="button"
                title="Изменить цель"
                onClick={(event) => {
                  markRowClickSuppressed();
                  event.stopPropagation();
                  openLinkDialog(call, 'target');
                }}
                style={linkedValueStyle}
              >
                {call.targetText}
              </button>
            ) : (
              <button
                type="button"
                title="Сопоставить цель"
                onClick={(event) => {
                  markRowClickSuppressed();
                  event.stopPropagation();
                  openLinkDialog(call, 'target');
                }}
                style={linkButtonStyle}
              >
                ＋ цель
              </button>
            )}
          </span>
          <span>{formatDuration(call.startedAt, call.endedAt)}</span>
          <span>{call.result ? RESULT_LABELS[call.result] ?? call.result : '—'}</span>
          <span>{call.audioUrl ? '🎧' : '—'}</span>
        </div>
        {dialog && dialog.call.id === call.id ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '13px',
              margin: '4px 0 8px 10px',
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(128, 128, 128, 0.45)',
              background: 'rgba(128, 128, 128, 0.08)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>
                {dialog.kind === 'client' ? 'Сопоставить клиента' : 'Сопоставить цель'}
              </span>
              <button type="button" onClick={closeLinkDialog} style={linkButtonStyle}>
                закрыть
              </button>
            </div>

            <div style={{ opacity: 0.65, fontSize: '12px' }}>
              {dialog.kind === 'client'
                ? 'Клиент — второй участник звонка: контакт или компания.'
                : 'Цель — к чему отнесён звонок: контакт, компания или сделка.'}
              {' '}
              {dialog.call.title ?? ''}
            </div>

            {/* Вид сущности: у клиента — контакт/компания, у цели — плюс сделки */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(dialog.kind === 'client'
                ? (['contact', 'company'] as LinkKind[])
                : (Object.keys(TARGET_KIND_LABELS) as LinkKind[])
              ).map((kind) => {
                const isActive = searchKind === kind;

                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setSearchKind(kind);
                      setSearchItems([]);
                    }}
                    style={{
                      padding: '3px 12px',
                      borderRadius: '999px',
                      border: `1px solid ${
                        isActive ? 'rgba(128, 128, 128, 0.75)' : 'rgba(128, 128, 128, 0.35)'
                      }`,
                      background: isActive ? 'rgba(128, 128, 128, 0.22)' : 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {TARGET_KIND_LABELS[kind]}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void runSearch();
                  }
                }}
                placeholder={
                  dialog.kind === 'client'
                    ? 'Имя контакта, название компании или номер телефона'
                    : 'Название: заказ, ремонт, заправка, тендер'
                }
                autoFocus
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(128, 128, 128, 0.45)',
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: '13px',
                }}
              />
              <button
                type="button"
                onClick={() => void runSearch()}
                disabled={isSearching}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid rgba(128, 128, 128, 0.45)',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: isSearching ? 'default' : 'pointer',
                  fontSize: '13px',
                }}
              >
                {isSearching ? 'Ищем…' : 'Найти'}
              </button>
            </div>

            {dialogLinks.length > 0 ? (
              <div style={{ borderTop: '1px solid rgba(128, 128, 128, 0.22)', paddingTop: '8px' }}>
                <div style={{ opacity: 0.7, fontSize: '12px', marginBottom: '4px' }}>Уже привязано</div>
                {dialogLinks.map((link) => (
                  <div
                    key={link.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '3px 0' }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {link.label}
                    </span>
                    <button
                      type="button"
                      disabled={linkBusy}
                      title="Связь удаляется безвозвратно"
                      onClick={() => {
                        if (pendingUnlink === link.id) {
                          void runUnlink(dialog.kind, link.id);
                        } else {
                          setPendingUnlink(link.id);
                        }
                      }}
                      style={{
                        padding: '2px 10px',
                        borderRadius: '6px',
                        border: `1px solid ${
                          pendingUnlink === link.id
                            ? 'rgba(220, 90, 90, 0.75)'
                            : 'rgba(128, 128, 128, 0.45)'
                        }`,
                        background: 'transparent',
                        color: pendingUnlink === link.id ? '#e0736f' : 'inherit',
                        cursor: linkBusy ? 'default' : 'pointer',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {pendingUnlink === link.id ? 'Точно? Да' : 'Отвязать'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                maxHeight: '280px',
                overflowY: 'auto',
              }}
            >
              {searchItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={linkBusy}
                  onClick={() => void runLink(item)}
                  style={{
                    textAlign: 'left',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(128, 128, 128, 0.3)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: linkBusy ? 'default' : 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {item.title}
                  {item.subtitle ? (
                    <span style={{ opacity: 0.65, marginLeft: '8px' }}>{item.subtitle}</span>
                  ) : null}
                </button>
              ))}

              {!isSearching && searchItems.length === 0 && searchText.trim() ? (
                <div style={{ opacity: 0.6, fontSize: '12.5px' }}>Ничего не найдено</div>
              ) : null}
            </div>

            {linkError ? <div style={{ opacity: 0.95, fontSize: '12.5px' }}>✗ {linkError}</div> : null}
          </div>
        ) : null}
        </Fragment>
      ))}

      {nextCursor ? (
        <button
          type="button"
          onClick={() => selectedId && loadCalls(selectedId, nextCursor)}
          disabled={isLoadingCalls}
          style={{
            alignSelf: 'flex-start',
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px solid rgba(128, 128, 128, 0.4)',
            background: 'transparent',
            color: 'inherit',
            cursor: isLoadingCalls ? 'default' : 'pointer',
            fontSize: '13px',
          }}
        >
          Показать ещё
        </button>
      ) : null}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: CALLS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'callsPage',
  description: 'Журнал звонков по сотрудникам',
  component: CallsPage,
});
