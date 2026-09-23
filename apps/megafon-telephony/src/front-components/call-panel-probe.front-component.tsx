import { useCallback, useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  SidePanelPages,
  openSidePanelPage,
  useRecordId,
} from 'twenty-sdk/front-component';

import { CALL_PANEL_PROBE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Боковая панель звонка (журнал «Звонки»).
 *
 * Открывается из строки журнала: страница боковой панели `ViewFrontComponent`
 * рендерит этот компонент, id записи звонка приходит через `useRecordId`.
 *
 * Что в панели:
 *  - клиент звонка — участники события (контакт / компания), привязка и отвязка;
 *  - цель звонка — цели события (контакт / компания / Заказ / Ремонт / Заправка / Тендер);
 *  - запись звонка (плеер);
 *  - переход в штатную карточку звонка (поверх панели, с возвратом).
 *
 * Привязка идёт служебным маршрутом приложения `POST /s/call-journal-link`
 * (тот же, что использовал журнал), поэтому права и запись в ленту — как раньше.
 *
 * Этап 3 (23.09.2026): перенос сопоставления клиента и цели из строки журнала
 * в панель. Расшифровка и открытые сделки — следующие этапы.
 */

/** Что сопоставляем: второго участника звонка или его цель. */
type SearchTarget = 'client' | 'target';

/** Вид сущности для поиска: контакт, компания или сделка. */
type LinkKind =
  | 'contact'
  | 'company'
  | 'opportunity'
  | 'remont'
  | 'zapravka'
  | 'tender';

type SearchItem = { id: string; title: string; subtitle: string };

type LinkRow = { id: string; label: string };

/** Расшифровка: сегмент — непрерывный фрагмент одного канала («Канал 0» / «Канал 1»). */
type TranscriptWord = {
  text?: string;
  start_timestamp?: { relative?: number } | null;
};

type TranscriptSegment = {
  words?: TranscriptWord[];
  participant?: { name?: string } | null;
};

type CallInfo = {
  id: string;
  title: string;
  startedAt: string | null;
  endedAt: string | null;
  direction: string | null;
  result: string | null;
  audioUrl: string | null;
  transcript: TranscriptSegment[];
  eventId: string;
  phone: string;
};

/** Подписи видов цели (как в колонке «Цель» журнала). */
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
  remont: {
    path: '/rest/remontOborudovaniyas',
    key: 'remontOborudovaniyas',
    select: 'id,name',
  },
  zapravka: {
    path: '/rest/zapravkaKartridzheys',
    key: 'zapravkaKartridzheys',
    select: 'id,name',
  },
  tender: { path: '/rest/tendery', key: 'tendery', select: 'id,name' },
};

/** Поля цели события по видам: контакт, компания и четыре сделки. */
const TARGET_FIELDS: { field: string; kind: LinkKind }[] = [
  { field: 'targetPersonId', kind: 'contact' },
  { field: 'targetCompanyId', kind: 'company' },
  { field: 'targetOpportunityId', kind: 'opportunity' },
  { field: 'nashaSdelkaRemontOborudovaniyaId', kind: 'remont' },
  { field: 'nashaSdelkaZapravkaKartridzheyId', kind: 'zapravka' },
  { field: 'nashaSdelkaTenderId', kind: 'tender' },
];

/** Сделки: объект и путь к нему. */
const DEAL_SOURCES: { kind: LinkKind; path: string; key: string }[] = [
  { kind: 'opportunity', path: '/rest/opportunities', key: 'opportunities' },
  {
    kind: 'remont',
    path: '/rest/remontOborudovaniyas',
    key: 'remontOborudovaniyas',
  },
  {
    kind: 'zapravka',
    path: '/rest/zapravkaKartridzheys',
    key: 'zapravkaKartridzheys',
  },
  { kind: 'tender', path: '/rest/tendery', key: 'tendery' },
];

const DIRECTION_LABELS: Record<string, string> = {
  IN: 'Входящий',
  OUT: 'Исходящий',
};

const RESULT_LABELS: Record<string, string> = {
  OTvEChEN: 'Отвечен',
  NEOTVECHEN: 'Пропущен',
};

const readEnv = (): Record<string, string | undefined> =>
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const describeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  return String(error);
};

const fullName = (value?: { firstName?: string; lastName?: string } | null) =>
  [value?.firstName, value?.lastName].filter(Boolean).join(' ').trim();

const formatPhone = (
  phones?: {
    primaryPhoneNumber?: string | null;
    primaryPhoneCallingCode?: string | null;
  } | null,
) => {
  const number = phones?.primaryPhoneNumber ?? '';

  if (!number) return '';

  return `${phones?.primaryPhoneCallingCode ?? ''}${number}`.trim();
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return '—';

  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const formatDuration = (startedAt: string | null, endedAt: string | null) => {
  if (!startedAt || !endedAt) return '';

  const seconds = Math.max(
    0,
    Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    ),
  );
  const minutes = Math.floor(seconds / 60);

  return `${minutes} мин ${String(seconds % 60).padStart(2, '0')} с`;
};

/** Таймкод расшифровки: секунды от начала записи → «мм:сс». */
const formatStamp = (seconds?: number): string => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '';

  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);

  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
};

const baseStyle = {
  background: 'transparent',
  border: '1px solid rgba(128, 128, 128, 0.5)',
  borderRadius: '6px',
  color: 'inherit',
  cursor: 'pointer',
  padding: '5px 10px',
};

const chipStyle = (isActive: boolean) => ({
  padding: '3px 10px',
  borderRadius: '999px',
  border: `1px solid ${
    isActive ? 'rgba(128, 128, 128, 0.75)' : 'rgba(128, 128, 128, 0.35)'
  }`,
  background: isActive ? 'rgba(128, 128, 128, 0.22)' : 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: isActive ? 600 : 400,
});

const inputStyle = {
  flex: 1,
  minWidth: 0,
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid rgba(128, 128, 128, 0.45)',
  background: 'transparent',
  color: 'inherit',
  fontSize: '13px',
};

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '6px',
  borderTop: '1px solid rgba(128, 128, 128, 0.22)',
  paddingTop: '10px',
};

const CallPanel = () => {
  const recordId = useRecordId();
  const env = useMemo(readEnv, []);

  const base = (env.TWENTY_API_URL ?? '').replace(/\/+$/, '');
  const functionsBase = (env.TWENTY_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
  const token = env.TWENTY_APP_ACCESS_TOKEN ?? '';

  const [call, setCall] = useState<CallInfo | null>(null);
  const [clientLinks, setClientLinks] = useState<LinkRow[]>([]);
  const [targetLinks, setTargetLinks] = useState<LinkRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchFor, setSearchFor] = useState<SearchTarget | null>(null);
  const [searchKind, setSearchKind] = useState<LinkKind>('contact');
  const [searchText, setSearchText] = useState('');
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchPerformed, setSearchPerformed] = useState(false);
  /** Расшифровка свёрнута, пока пользователь не раскрыл её. */
  const [showAllTranscript, setShowAllTranscript] = useState(false);
  const [pendingUnlink, setPendingUnlink] = useState<string | null>(null);

  const api = useCallback(
    (path: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      // path может быть как относительным (`/rest/...`), так и полным
      // (`<functionsBase>/название-функции`): подставлять адрес API вторым разом нельзя.
      const target = /^https?:\/\//i.test(path) ? path : `${base}${path}`;
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
    [base, token],
  );

  const list = useCallback(
    async <T,>(path: string, key: string): Promise<T[]> => {
      const response = await api(path);
      const json = (await response.json()) as {
        data?: Record<string, T[] | undefined>;
      };

      return json?.data?.[key] ?? [];
    },
    [api],
  );

  /** Имена по id: люди, компании и сделки — для подписей привязанного. */
  const loadNames = useCallback(
    async (params: {
      personIds: string[];
      companyIds: string[];
      deals: { kind: LinkKind; id: string }[];
    }): Promise<Map<string, string>> => {
      const names = new Map<string, string>();

      const loadFrom = async (path: string, key: string, ids: string[]) => {
        if (ids.length === 0) return;

        try {
          const rows = await list<{ id?: string; name?: unknown }>(
            `${path}?filter=${encodeURIComponent(
              `id[in]:[${ids.join(',')}]`,
            )}&limit=60&select=id,name`,
            key,
          );

          for (const row of rows) {
            if (!row.id) continue;
            names.set(
              String(row.id),
              typeof row.name === 'string'
                ? row.name
                : fullName(row.name as { firstName?: string; lastName?: string }) ||
                    'без названия',
            );
          }
        } catch {
          // недоступный объект не должен ломать панель
        }
      };

      await loadFrom('/rest/people', 'people', params.personIds);
      await loadFrom('/rest/companies', 'companies', params.companyIds);

      for (const deal of DEAL_SOURCES) {
        const ids = params.deals
          .filter((item) => item.kind === deal.kind)
          .map((item) => item.id);

        await loadFrom(deal.path, deal.key, ids);
      }

      return names;
    },
    [list],
  );

  const load = useCallback(async () => {
    if (!recordId) {
      setError('Не удалось определить звонок');
      setIsLoading(false);

      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api(
        `/rest/callRecordings/${recordId}?select=id,title,startedAt,endedAt,napravlenie,itog,audio,video,transcript,calendarEventId`,
      );
      const json = (await response.json()) as {
        data?: {
          callRecording?: {
            id?: string;
            title?: string | null;
            startedAt?: string | null;
            endedAt?: string | null;
            napravlenie?: string | null;
            itog?: string | null;
            audio?: Array<{ url?: string | null }> | null;
            video?: Array<{ url?: string | null }> | null;
            transcript?: unknown;
            calendarEventId?: string | null;
          } | null;
        };
      };
      const row = json?.data?.callRecording;

      if (!row) {
        setError('Звонок не найден');
        setIsLoading(false);

        return;
      }

      const eventId = String(row.calendarEventId ?? '');

      type ParticipantRow = {
        id?: string;
        personId?: string | null;
        companyId?: string | null;
        displayName?: string | null;
        handle?: string | null;
      };
      type TargetRow = { id?: string } & Record<string, unknown>;

      let participants: ParticipantRow[] = [];
      let targets: TargetRow[] = [];

      if (eventId) {
        const eventFilter = encodeURIComponent(`calendarEventId[eq]:"${eventId}"`);

        [participants, targets] = await Promise.all([
          list<ParticipantRow>(
            `/rest/calendarEventParticipants?filter=${eventFilter}&limit=60&select=id,personId,companyId,displayName,handle`,
            'calendarEventParticipants',
          ),
          list<TargetRow>(
            `/rest/calendarEventTargets?filter=${eventFilter}&limit=60&select=id,${TARGET_FIELDS.map(
              (item) => item.field,
            ).join(',')}`,
            'calendarEventTargets',
          ),
        ]);
      }

      const clientRows = participants.filter(
        (item) => item.personId || item.companyId,
      );
      const personIds = [
        ...new Set([
          ...clientRows.map((item) => String(item.personId ?? '')),
          ...targets.map((item) => String(item.targetPersonId ?? '')),
        ]),
      ].filter(Boolean);
      const companyIds = [
        ...new Set([
          ...clientRows.map((item) => String(item.companyId ?? '')),
          ...targets.map((item) => String(item.targetCompanyId ?? '')),
        ]),
      ].filter(Boolean);
      const deals = targets.flatMap((item) =>
        TARGET_FIELDS.filter((entry) => entry.field !== 'targetPersonId' &&
          entry.field !== 'targetCompanyId')
          .map((entry) => ({
            kind: entry.kind,
            id: String(item[entry.field] ?? ''),
          }))
          .filter((entry) => entry.id),
      );

      const names = await loadNames({ personIds, companyIds, deals });
      const phone =
        clientRows
          .map((item) => String(item.handle ?? ''))
          .find((value) => value !== '') ?? '';

      setCall({
        id: String(row.id ?? ''),
        title: String(row.title ?? 'Звонок'),
        startedAt: row.startedAt ?? null,
        endedAt: row.endedAt ?? null,
        direction: row.napravlenie ?? null,
        result: row.itog ?? null,
        audioUrl: row.audio?.[0]?.url ?? row.video?.[0]?.url ?? null,
        transcript: Array.isArray(row.transcript)
          ? (row.transcript as TranscriptSegment[])
          : [],
        eventId,
        phone,
      });

      setClientLinks(
        clientRows.map((item) => ({
          id: String(item.id ?? ''),
          label: item.personId
            ? names.get(String(item.personId)) || 'контакт'
            : names.get(String(item.companyId)) || 'компания',
        })),
      );

      setTargetLinks(
        targets.map((item) => {
          const matched = TARGET_FIELDS.find((entry) => {
            const value = item[entry.field];

            return value !== null && value !== undefined && String(value) !== '';
          });

          if (!matched) {
            return { id: String(item.id ?? ''), label: 'цель' };
          }

          const name = names.get(String(item[matched.field] ?? '')) || '';

          return {
            id: String(item.id ?? ''),
            label: name
              ? `${TARGET_KIND_LABELS[matched.kind]}: ${name}`
              : TARGET_KIND_LABELS[matched.kind],
          };
        }),
      );
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [recordId, api, list, loadNames]);

  useEffect(() => {
    void load();
  }, [load]);

  const openSearch = (target: SearchTarget) => {
    setSearchFor(target);
    setSearchKind(target === 'client' ? 'contact' : 'opportunity');
    setSearchText('');
    setSearchItems([]);
    setLinkError('');
    setNotice('');
    setSearchPerformed(false);
    setPendingUnlink(null);
  };

  const closeSearch = () => {
    setSearchFor(null);
    setSearchItems([]);
    setLinkError('');
    setIsSearching(false);
    setPendingUnlink(null);
  };

  /** Поиск: контакты, компании и сделки — как в журнале. */
  const runSearch = async () => {
    if (!searchFor) return;

    const text = searchText.trim();

    if (text.length < 2) {
      setLinkError('Введите хотя бы два символа');

      return;
    }

    setIsSearching(true);
    setLinkError('');
    setSearchPerformed(false);

    try {
      const digits = text.replace(/\D/g, '');
      const source = SEARCH_SOURCES[searchKind];
      const conditions: string[] = [];

      if (searchKind === 'contact') {
        conditions.push(`name.firstName[ilike]:%${text}%`);
        conditions.push(`name.lastName[ilike]:%${text}%`);

        if (digits.length >= 4) {
          conditions.push(`phones.primaryPhoneNumber[ilike]:%${digits}%`);
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

      const filter =
        conditions.length > 1 ? `or(${conditions.join(',')})` : conditions[0];
      const params = new URLSearchParams({
        filter,
        limit: '100',
        select: source.select,
      });
      const rows = await list<{
        id?: string;
        name?: { firstName?: string; lastName?: string } | string | null;
        phones?: { primaryPhoneNumber?: string | null } | null;
        telefony?: { primaryPhoneNumber?: string | null } | null;
      }>(`${source.path}?${params.toString()}`, source.key);

      setSearchItems(
        rows.map((row) => ({
          id: String(row.id ?? ''),
          title:
            typeof row.name === 'string'
              ? row.name
              : fullName(row.name) || 'без названия',
          subtitle:
            searchKind === 'contact'
              ? formatPhone(row.phones)
              : searchKind === 'company'
                ? formatPhone(row.telefony)
                : '',
        })),
      );
      setSearchPerformed(true);
    } catch (searchError) {
      setLinkError(describeError(searchError));
    } finally {
      setIsSearching(false);
    }
  };

  /** Привязка клиента или цели — служебным маршрутом приложения. */
  const runLink = async (item: SearchItem) => {
    if (!searchFor || !call) return;

    setLinkBusy(true);
    setLinkError('');

    try {
      const body: Record<string, unknown> = {
        action: searchFor === 'client' ? 'linkClient' : 'linkTarget',
        eventId: call.eventId,
        callRecordingId: call.id,
        title: call.title,
        happensAt: call.startedAt ?? '',
      };

      if (searchFor === 'client') {
        if (searchKind === 'company') {
          body.companyId = item.id;
          body.displayName = item.title;
        } else {
          body.personId = item.id;
          body.displayName = item.title;
          body.handle = call.phone;
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
      const json = (await response.json()) as {
        ok?: boolean;
        error?: string;
        created?: boolean;
      };

      if (!json.ok) throw new Error(json.error || 'не удалось привязать');

      setNotice(
        json.created === false
          ? `Уже привязано: ${item.title}`
          : `Привязано: ${item.title}`,
      );
      closeSearch();
      await load();
    } catch (linkErr) {
      setLinkError(describeError(linkErr));
    } finally {
      setLinkBusy(false);
    }
  };

  /** Отвязка: участник-клиент или цель события (удаление безвозвратно). */
  const runUnlink = async (target: SearchTarget, id: string) => {
    setLinkBusy(true);
    setLinkError('');

    try {
      const response = await api(`${functionsBase}/call-journal-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          target === 'client'
            ? { action: 'unlinkClient', participantId: id }
            : { action: 'unlinkTarget', targetId: id },
        ),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };

      if (!json.ok) throw new Error(json.error || 'не удалось отвязать');

      setNotice('Отвязано');
      setPendingUnlink(null);
      await load();
    } catch (linkErr) {
      setLinkError(describeError(linkErr));
    } finally {
      setLinkBusy(false);
    }
  };

  const openCallCard = useCallback(() => {
    if (!recordId) return;

    void openSidePanelPage({
      page: SidePanelPages.ViewRecord,
      objectNameSingular: 'callRecording',
      recordId,
    });
  }, [recordId]);

  const unlinkButton = (target: SearchTarget, row: LinkRow) => (
    <button
      type="button"
      disabled={linkBusy}
      title="Связь удаляется безвозвратно"
      onClick={() => {
        if (pendingUnlink === row.id) {
          void runUnlink(target, row.id);
        } else {
          setPendingUnlink(row.id);
        }
      }}
      style={{
        padding: '2px 10px',
        borderRadius: '6px',
        border: `1px solid ${
          pendingUnlink === row.id
            ? 'rgba(220, 90, 90, 0.75)'
            : 'rgba(128, 128, 128, 0.45)'
        }`,
        background: 'transparent',
        color: pendingUnlink === row.id ? '#e0736f' : 'inherit',
        cursor: linkBusy ? 'default' : 'pointer',
        fontSize: '12px',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {pendingUnlink === row.id ? 'Точно? Да' : 'Отвязать'}
    </button>
  );

  const searchPanel = (target: SearchTarget) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid rgba(128, 128, 128, 0.4)',
        background: 'rgba(128, 128, 128, 0.08)',
      }}
    >
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {(target === 'client'
          ? (['contact', 'company'] as LinkKind[])
          : (Object.keys(TARGET_KIND_LABELS) as LinkKind[])
        ).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => {
              setSearchKind(kind);
              setSearchItems([]);
            }}
            style={chipStyle(searchKind === kind)}
          >
            {TARGET_KIND_LABELS[kind]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
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
            target === 'client'
              ? 'Имя, название или номер телефона'
              : 'Название: заказ, ремонт, заправка, тендер'
          }
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={isSearching}
          style={{
            ...baseStyle,
            cursor: isSearching ? 'default' : 'pointer',
          }}
        >
          {isSearching ? 'Ищем…' : 'Найти'}
        </button>
      </div>

      {linkError ? (
        <div style={{ color: '#e0736f', fontSize: '12px' }}>{linkError}</div>
      ) : null}

      {!linkError && searchPerformed && !isSearching && searchItems.length === 0 ? (
        <div style={{ opacity: 0.75, fontSize: '12px' }}>Ничего не найдено</div>
      ) : null}

      {searchItems.length > 0 ? (
        <div style={{ opacity: 0.7, fontSize: '12px' }}>
          Найдено: {searchItems.length}
        </div>
      ) : null}

      {searchItems.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            maxHeight: '240px',
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
                padding: '6px 9px',
                borderRadius: '6px',
                border: '1px solid rgba(128, 128, 128, 0.3)',
                background: 'transparent',
                color: 'inherit',
                cursor: linkBusy ? 'default' : 'pointer',
                fontSize: '12.5px',
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.title}
              </div>
              {item.subtitle ? (
                <div style={{ opacity: 0.65, fontSize: '11.5px' }}>
                  {item.subtitle}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ opacity: 0.7, fontSize: '12px' }}>
          {searchText.length < 2 ? 'Начните вводить и нажмите «Найти»' : ''}
        </span>
        <button type="button" onClick={closeSearch} style={baseStyle}>
          закрыть
        </button>
      </div>
    </div>
  );

  /**
   * Расшифровка: сегменты идут в порядке разговора, каждый — непрерывный кусок
   * одного канала. Подписи оставляем как есть — «Канал 0» / «Канал 1» (решение
   * Алексея 23.09.2026).
   */
  const transcriptLines = useMemo(
    () =>
      (call?.transcript ?? [])
        .map((segment, index) => {
          const words = segment.words ?? [];
          const time = formatStamp(words[0]?.start_timestamp?.relative);
          const text = words
            .map((word) => String(word?.text ?? ''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          return {
            id: `${index}-${time}`,
            speaker: segment.participant?.name ?? '',
            time,
            text,
          };
        })
        .filter((line) => line.text !== ''),
    [call],
  );

  const transcriptChars = transcriptLines.reduce(
    (sum, line) => sum + line.text.length,
    0,
  );
  const canCollapseTranscript = transcriptChars > 700;

  if (isLoading) {
    return <div style={{ padding: '12px', opacity: 0.75 }}>Загрузка…</div>;
  }

  if (!call) {
    return (
      <div style={{ padding: '12px', opacity: 0.85 }}>
        {error || 'Звонок не найден'}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '12px',
        fontSize: '13px',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '14px' }}>{call.title}</div>
      <div style={{ opacity: 0.75, fontSize: '12px' }}>
        {formatDateTime(call.startedAt)}
        {formatDuration(call.startedAt, call.endedAt)
          ? ` · ${formatDuration(call.startedAt, call.endedAt)}`
          : ''}
        {call.direction ? ` · ${DIRECTION_LABELS[call.direction] ?? call.direction}` : ''}
        {call.result ? ` · ${RESULT_LABELS[call.result] ?? call.result}` : ''}
      </div>

      {error ? <div style={{ color: '#e0736f' }}>{error}</div> : null}
      {notice ? (
        <div style={{ opacity: 0.85, fontSize: '12px' }}>{notice}</div>
      ) : null}

      {/* ── клиент ─────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ fontWeight: 600 }}>Клиент</div>

        {clientLinks.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Не сопоставлен</div>
        ) : (
          clientLinks.map((row) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.label}
              </span>
              {unlinkButton('client', row)}
            </div>
          ))
        )}

        {searchFor === 'client' ? (
          searchPanel('client')
        ) : (
          <button
            type="button"
            onClick={() => openSearch('client')}
            style={{ ...baseStyle, alignSelf: 'flex-start' }}
          >
            {clientLinks.length > 0 ? 'Изменить клиента' : '＋ Сопоставить клиента'}
          </button>
        )}
      </div>

      {/* ── цель ───────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ fontWeight: 600 }}>Цель</div>

        {targetLinks.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Не определена</div>
        ) : (
          targetLinks.map((row) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.label}
              </span>
              {unlinkButton('target', row)}
            </div>
          ))
        )}

        {searchFor === 'target' ? (
          searchPanel('target')
        ) : (
          <button
            type="button"
            onClick={() => openSearch('target')}
            style={{ ...baseStyle, alignSelf: 'flex-start' }}
          >
            {targetLinks.length > 0 ? 'Изменить цель' : '＋ Сопоставить цель'}
          </button>
        )}
      </div>

      {linkError && searchFor === null ? (
        <div style={{ color: '#e0736f', fontSize: '12px' }}>{linkError}</div>
      ) : null}

      {/* ── запись ─────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ fontWeight: 600 }}>Запись и расшифровка</div>
        {call.audioUrl ? (
          <audio controls src={call.audioUrl} style={{ width: '100%' }} />
        ) : (
          <div style={{ opacity: 0.7 }}>Файла записи нет</div>
        )}

        {transcriptLines.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Расшифровки нет</div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: showAllTranscript ? '460px' : '170px',
                overflowY: 'auto',
              }}
            >
              {transcriptLines.map((line) => (
                <div
                  key={line.id}
                  style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
                >
                  <div style={{ opacity: 0.65, fontSize: '11.5px' }}>
                    {line.speaker || 'Расшифровка'}
                    {line.time ? ` · ${line.time}` : ''}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {line.text}
                  </div>
                </div>
              ))}
            </div>

            {canCollapseTranscript ? (
              <button
                type="button"
                onClick={() => setShowAllTranscript((value) => !value)}
                style={{ ...baseStyle, alignSelf: 'flex-start' }}
              >
                {showAllTranscript ? 'Свернуть расшифровку' : 'Показать всю расшифровку'}
              </button>
            ) : null}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={openCallCard}
        style={{ ...baseStyle, alignSelf: 'flex-start' }}
      >
        Открыть карточку звонка
      </button>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: CALL_PANEL_PROBE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'callPanelProbe',
  description: 'Боковая панель звонка: клиент, цель, запись и переход в карточку',
  component: CallPanel,
});
