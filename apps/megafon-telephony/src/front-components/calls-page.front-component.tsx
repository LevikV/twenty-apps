import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { SidePanelPages, openSidePanelPage, useUserId } from 'twenty-sdk/front-component';

import { CALLS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
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
const MAX_MEMBER_PAGES = 4;
/** Сколько страниц максимум догружаем для связей события (участники, цели, люди, компании). */
const MAX_PAGES = 5;

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
  personName: string;
  personPhone: string;
  companyName: string;
  audioUrl: string | null;
  /** Номер сопоставлен с контактом или компанией. */
  hasClient: boolean;
  /** В событии есть хотя бы одна цель: человек, компания или сделка. */
  hasTarget: boolean;
  /** Вторая сторона — наш сотрудник (звонок внутри). */
  isInternal: boolean;
};

type FilterKey = 'all' | 'noClient' | 'noTarget' | 'internal';

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
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [error, setError] = useState<string>('');

  const env = useMemo(() => readEnv(), []);
  const apiBase = (env.TWENTY_API_URL ?? '').replace(/\/+$/, '');
  const functionsBase = (env.TWENTY_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
  const token = env.TWENTY_APP_ACCESS_TOKEN ?? '';

  const api = useCallback(
    (path: string) =>
      fetch(`${apiBase}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
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
          `${apiBase}/rest/workspaceMembers?filter=${encodeURIComponent(`userId[eq]:${userId}`)}&limit=1&select=id,name,userEmail`,
          { headers },
        ),
        fetch(`${apiBase}/rest/workspaceMembers?limit=60&select=id,name,userEmail`, {
          headers,
        }),
        fetch(`${functionsBase}${ACCESS_PATH}`, { headers }),
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
        // 1. События сотрудника (страницами — у активных сотрудников больше 60).
        const collectedEventIds: string[] = [];
        const activeEventIds = cursor === null ? [] : eventIdsRef.current;

        if (cursor === null) {
          let after: string | null = null;

          for (let page = 0; page < MAX_MEMBER_PAGES; page += 1) {
            const params = new URLSearchParams({
              filter: `workspaceMemberId[eq]:${workspaceMemberId}`,
              limit: String(PAGE_SIZE),
              select: 'id,calendarEventId',
            });

            if (after) {
              params.set('starting_after', after);
            }

            const response = await api(`/rest/calendarEventParticipants?${params.toString()}`);
            const json = (await response.json()) as ApiList<{
              calendarEventId?: string | null;
            }>;

            (json.data?.calendarEventParticipants ?? []).forEach((participant) => {
              if (participant.calendarEventId) {
                collectedEventIds.push(participant.calendarEventId);
              }
            });

            if (!json.pageInfo?.hasNextPage || !json.pageInfo.endCursor) {
              break;
            }

            after = json.pageInfo.endCursor;
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

        // 2. Звонки по событиям сотрудника.
        const callParams = new URLSearchParams({
          limit: String(PAGE_SIZE),
          select: 'id,title,startedAt,endedAt,napravlenie,itog,audio,calendarEventId',
          filter: `calendarEventId[in]:[${activeEventIds.join(',')}]`,
        });

        if (cursor) {
          callParams.set('starting_after', cursor);
        }

        const callsResponse = await api(`/rest/callRecordings?${callParams.toString()}`);
        const callsJson = (await callsResponse.json()) as ApiList<{
          id: string;
          title?: string | null;
          startedAt?: string | null;
          endedAt?: string | null;
          napravlenie?: string | null;
          itog?: string | null;
          audio?: Array<{ fileId?: string; url?: string }> | null;
        }> & { data?: { callRecordings?: unknown } };

        const records = (callsJson.data?.callRecordings ?? []) as Array<{
          id: string;
          title?: string | null;
          startedAt?: string | null;
          endedAt?: string | null;
          napravlenie?: string | null;
          itog?: string | null;
          audio?: Array<{ fileId?: string; url?: string }> | null;
        }>;

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
        // Хелпер: догружаем все страницы выборки (REST отдаёт максимум 60 за раз).
        const fetchAll = async <T,>(
          path: string,
          base: Record<string, string>,
          key: string,
        ): Promise<T[]> => {
          const collected: T[] = [];
          let after: string | null = null;

          for (let page = 0; page < MAX_PAGES; page += 1) {
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

        const personByEvent: Record<string, string> = {};
        const internalByEvent: Record<string, string> = {};
        const phoneByEvent: Record<string, string> = {};
        const targetPersonByEvent: Record<string, string> = {};
        const targetCompanyByEvent: Record<string, string> = {};
        const dealTargetByEvent: Record<string, boolean> = {};

        if (callEventIds.length > 0) {
          const participants = await fetchAll<{
            calendarEventId?: string | null;
            personId?: string | null;
            workspaceMemberId?: string | null;
            displayName?: string | null;
            handle?: string | null;
          }>(
            '/rest/calendarEventParticipants',
            {
              filter: `calendarEventId[in]:[${callEventIds.join(',')}]`,
              select: 'id,calendarEventId,personId,workspaceMemberId,displayName,handle',
            },
            'calendarEventParticipants',
          );

          participants.forEach((participant) => {
            if (!participant.calendarEventId) {
              return;
            }

            if (participant.handle) {
              phoneByEvent[participant.calendarEventId] = normalizePhone(participant.handle);
            }

            if (participant.personId) {
              personByEvent[participant.calendarEventId] = participant.personId;
            } else if (
              participant.workspaceMemberId &&
              participant.workspaceMemberId !== workspaceMemberId &&
              participant.displayName
            ) {
              // вторая сторона — наш сотрудник: звонок внутренний
              internalByEvent[participant.calendarEventId] = participant.displayName;
            }
          });

          // Цели события: клиент может быть целью (компания без контакта), плюс сделки —
          // наши (Ремонт / Заправка / Тендер) и стандартная сделка.
          const targets = await fetchAll<{
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

            if (target.targetPersonId) {
              targetPersonByEvent[target.calendarEventId] = target.targetPersonId;
            }

            if (target.targetCompanyId) {
              targetCompanyByEvent[target.calendarEventId] = target.targetCompanyId;
            }

            if (
              target.targetOpportunityId ||
              target.nashaSdelkaRemontOborudovaniyaId ||
              target.nashaSdelkaZapravkaKartridzheyId ||
              target.nashaSdelkaTenderId
            ) {
              dealTargetByEvent[target.calendarEventId] = true;
            }
          });
        }

        const personIds = [
          ...new Set([...Object.values(personByEvent), ...Object.values(targetPersonByEvent)]),
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
          ...new Set([...Object.values(companyByPerson), ...Object.values(targetCompanyByEvent)]),
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

        const rows: CallRow[] = records.map((record) => {
          const eventId = (record as { calendarEventId?: string | null }).calendarEventId ?? '';
          const personId = personByEvent[eventId] ?? targetPersonByEvent[eventId] ?? '';
          const companyId = personId ? companyByPerson[personId] ?? '' : '';
          const targetCompanyId = eventId ? targetCompanyByEvent[eventId] ?? '' : '';
          const internalName = eventId ? internalByEvent[eventId] ?? '' : '';
          const hasTarget = Boolean(
            eventId &&
              (targetPersonByEvent[eventId] || targetCompanyId || dealTargetByEvent[eventId]),
          );

          return {
            id: record.id,
            startedAt: record.startedAt ?? null,
            endedAt: record.endedAt ?? null,
            title: record.title ?? null,
            direction: record.napravlenie ?? null,
            result: record.itog ?? null,
            personName: personId
              ? personNames[personId] ?? ''
              : internalName
                ? `Внутренний: ${internalName}`
                : '',
            personPhone:
              (personId ? personPhones[personId] : '') ||
              (eventId ? phoneByEvent[eventId] : '') ||
              phoneFromTitle(record.title ?? null),
            companyName:
              (companyId ? companyNames[companyId] ?? '' : '') ||
              (targetCompanyId ? companyNames[targetCompanyId] ?? '' : ''),
            audioUrl: record.audio?.[0]?.url ?? null,
            hasClient: Boolean(personId || targetCompanyId),
            hasTarget,
            isInternal: Boolean(internalName),
          };
        });

        // API не сортирует выборку, когда фильтр идёт по связи (`calendarEventId[in]:`),
        // поэтому порядок задаём сами: звонки — от новых к старым.
        rows.sort((left, right) => (right.startedAt ?? '').localeCompare(left.startedAt ?? ''));

        setCalls((current) => {
          const merged = cursor === null ? rows : [...current, ...rows];

          return [...merged].sort((left, right) =>
            (right.startedAt ?? '').localeCompare(left.startedAt ?? ''),
          );
        });
        setNextCursor(callsJson.pageInfo?.hasNextPage ? callsJson.pageInfo.endCursor ?? null : null);
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
      loadCalls(selectedId, null);
    }
  }, [selectedId, loadCalls]);

  const openCall = (recordId: string) => {
    openSidePanelPage({
      page: SidePanelPages.ViewRecord,
      recordId,
      objectNameSingular: 'callRecording',
    }).catch((openError) => setError(describeError(openError)));
  };

  // Фильтры контроля. Считаем по загруженным звонкам — список догружается кнопкой ниже.
  const filterCounts = useMemo(
    () => ({
      all: calls.length,
      noClient: calls.filter((call) => !call.hasClient).length,
      noTarget: calls.filter((call) => !call.hasTarget).length,
      internal: calls.filter((call) => call.isInternal).length,
    }),
    [calls],
  );

  const visibleCalls = useMemo(() => {
    switch (filter) {
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
    gridTemplateColumns: '110px 96px 130px minmax(0, 1.3fr) 60px 92px 46px',
    columnGap: '12px',
    rowGap: 0,
    alignItems: 'center',
    width: '100%',
    boxSizing: 'border-box',
  } as const;

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
        Нажмите на звонок — карточка откроется в панели справа. Счётчики — по загруженным звонкам,
        остальные догружаются кнопкой ниже.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {(
          [
            ['all', 'Все'],
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
        <span>Длит.</span>
        <span>Итог</span>
        <span>Запись</span>
      </div>

      {visibleCalls.length === 0 && !isLoadingCalls ? (
        <div style={{ opacity: 0.75 }}>Звонков не найдено</div>
      ) : null}

      {visibleCalls.map((call) => (
        <div
          key={call.id}
          onClick={() => openCall(call.id)}
          onMouseEnter={() => setHoveredId(call.id)}
          onMouseLeave={() => setHoveredId(null)}
          title="Открыть карточку звонка"
          style={{
            ...gridStyle,
            cursor: 'pointer',
            padding: '7px 10px',
            borderRadius: '4px',
            borderBottom: '1px solid rgba(128, 128, 128, 0.12)',
            background: hoveredId === call.id ? 'rgba(128, 128, 128, 0.14)' : 'transparent',
          }}
        >
          <span>{formatDateTime(call.startedAt)}</span>
          <span>{directionLabel(call.direction)}</span>
          <span>{call.personPhone || '—'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[call.personName, call.companyName].filter(Boolean).join(' / ') || '—'}
          </span>
          <span>{formatDuration(call.startedAt, call.endedAt)}</span>
          <span>{call.result ? RESULT_LABELS[call.result] ?? call.result : '—'}</span>
          <span>{call.audioUrl ? '🎧' : '—'}</span>
        </div>
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
