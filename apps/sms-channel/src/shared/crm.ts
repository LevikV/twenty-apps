import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Доступ к CRM от имени приложения.
 *
 * Объекты «Центра коммуникации» (chat, soobshchenie, chatParticipant, smsGateway)
 * кастомные: у ролей сотрудников прав на них нет, поэтому приёмник ходит ролью
 * приложения, как и серверная часть самих чатов.
 */

type Row = Record<string, unknown> & { id?: string };

const client = new RestApiClient({ runAs: 'application' });

const unwrap = (body: unknown): Record<string, unknown> =>
  (body as { data?: Record<string, unknown> })?.data ?? {};

export const rowsOf = (body: unknown, key: string): Row[] => {
  const value = unwrap(body)[key];

  return Array.isArray(value) ? (value as Row[]) : [];
};

export const pickCreated = (body: unknown): Row | undefined => {
  for (const candidate of Object.values(unwrap(body))) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const record = candidate as Row;

      if (record.id) return record;
    }
  }

  return undefined;
};

export const describeError = (error: unknown): string => {
  const details = error as { message?: string; status?: number; body?: unknown };
  const body =
    details?.body === undefined ? '' : ` | ${JSON.stringify(details.body).slice(0, 300)}`;

  return `${details?.message ?? String(error)}${body}`;
};

export type Gateway = {
  id: string;
  name: string;
  memberId: string;
  number: string;
};

export type ClientRef = {
  personId: string;
  personName: string;
  companyId: string;
  companyName: string;
};

/** Шлюз по идентификатору устройства из вебхука. */
export const findGateway = async (deviceId: string): Promise<Gateway | null> => {
  const response = await client.get<unknown>('/rest/smsGateways', {
    query: { filter: `deviceId[eq]:"${deviceId}"`, limit: 1 },
  });

  const row = rowsOf(response, 'smsGateways')[0];

  if (!row?.id) return null;

  const nomer = (row.nomer as { primaryPhoneNumber?: string } | null) ?? null;
  const sotrudnikId = String(row.sotrudnikId ?? '');

  return {
    id: row.id,
    name: String(row.name ?? 'SMS-шлюз'),
    memberId: sotrudnikId,
    number: String(nomer?.primaryPhoneNumber ?? ''),
  };
};

const findByPhone = async (params: {
  path: string;
  key: string;
  field: 'phones' | 'telefony';
  phone: string;
}): Promise<Row[]> => {
  const { path, key, field, phone } = params;

  const byPrimary = rowsOf(
    await client.get<unknown>(path, {
      query: { filter: `${field}.primaryPhoneNumber[eq]:"${phone}"`, limit: 3 },
    }),
    key,
  );

  if (byPrimary.length > 0) return byPrimary;

  return rowsOf(
    await client.get<unknown>(path, {
      query: { filter: `${field}.additionalPhones[like]:"%${phone}%"`, limit: 3 },
    }),
    key,
  );
};

const personName = (row: Row): string => {
  const name = row.name as { firstName?: string; lastName?: string } | undefined;

  return [name?.lastName, name?.firstName].map((p) => String(p ?? '').trim()).filter(Boolean).join(' ');
};

/**
 * Клиент по номеру: контакт по телефону; компания — только если номер совпал
 * с телефоном компании (правило звонков от 22.09.2026).
 */
export const findClient = async (phone: string): Promise<ClientRef> => {
  const result: ClientRef = { personId: '', personName: '', companyId: '', companyName: '' };

  if (!phone) return result;

  const people = await findByPhone({ path: '/rest/people', key: 'people', field: 'phones', phone });

  if (people.length === 1 && people[0].id) {
    result.personId = people[0].id;
    result.personName = personName(people[0]);

    return result;
  }

  const companies = await findByPhone({
    path: '/rest/companies',
    key: 'companies',
    field: 'telefony',
    phone,
  });

  if (companies.length === 1 && companies[0].id) {
    result.companyId = companies[0].id;
    result.companyName = String(companies[0].name ?? '');
  }

  return result;
};

export type ChatRef = { id: string; created: boolean };

/** Диалог канала: один на пару «шлюз + номер клиента». */
export const ensureChat = async (params: {
  externalId: string;
  title: string;
  gatewayId: string;
  client: ClientRef;
}): Promise<ChatRef> => {
  const { externalId, title, gatewayId, client: ref } = params;

  const existing = rowsOf(
    await client.get<unknown>('/rest/chats', {
      query: { filter: `vneshniyId[eq]:"${externalId}"`, limit: 1 },
    }),
    'chats',
  )[0];

  if (existing?.id) return { id: existing.id, created: false };

  const payload: Record<string, unknown> = {
    name: title,
    nazvanie: title,
    kanal: 'SMS',
    tip: 'KLIENT',
    status: 'OTKRYT',
    vneshniyId: externalId,
    shlyuzId: gatewayId,
  };

  if (ref.personId) payload.kontaktId = ref.personId;
  if (ref.companyId) payload.kompaniyaId = ref.companyId;

  const created = pickCreated(await client.post<unknown>('/rest/chats', payload));

  if (!created?.id) throw new Error('диалог создан, но в ответе нет id');

  return { id: created.id, created: true };
};

/** Участник диалога: владелец шлюза. Повторно не создаём. */
export const ensureParticipant = async (chatId: string, memberId: string): Promise<void> => {
  if (!memberId) return;

  const existing = rowsOf(
    await client.get<unknown>('/rest/chatParticipants', {
      query: { filter: `chatId[eq]:"${chatId}"`, limit: 30 },
    }),
    'chatParticipants',
  ).find((row) => String(row.polzovatelId ?? '') === memberId);

  if (existing?.id) return;

  await client.post<unknown>('/rest/chatParticipants', {
    name: 'Участник диалога',
    chatId,
    polzovatelId: memberId,
    rol: 'VEDUSHCHIY',
    neprochitano: 0,
  });
};

/** Входящее сообщение. Дедупликация по внешнему id — повторная доставка не задваивает. */
export const saveIncoming = async (params: {
  chatId: string;
  externalId: string;
  text: string;
  receivedAt: string;
  svyazkaId: string;
}): Promise<{ created: boolean; id: string }> => {
  const { chatId, externalId, text, receivedAt, svyazkaId } = params;

  const existing = rowsOf(
    await client.get<unknown>('/rest/soobshcheniya', {
      query: { filter: `vneshniyId[eq]:"${externalId}"`, limit: 1 },
    }),
    'soobshcheniya',
  )[0];

  if (existing?.id) return { created: false, id: existing.id };

  const payload: Record<string, unknown> = {
    name: text.slice(0, 80) || 'SMS',
    chatId,
    tekst: text,
    napravlenie: 'VHODYASHCHIE',
    statusDostavki: 'DOSTAVLENO',
    vneshniyId: externalId,
  };

  const created = pickCreated(await client.post<unknown>('/rest/soobshcheniya', payload));

  if (!created?.id) throw new Error('сообщение создано, но в ответе нет id');

  // Связь с записью — отдельной строкой: у сообщения их может быть несколько.
  if (svyazkaId) {
    await client.post<unknown>('/rest/svyaziSoobshcheniya', {
      soobshchenieId: created.id,
      svyazkaChatovId: svyazkaId,
    });
  }

  void receivedAt;

  return { created: true, id: created.id };
};

type DealSource = {
  kind: string;
  field: string;
  path: string;
  key: string;
  label: string;
};

/** Четыре типа сделок и их поля-покупатели. */
const DEAL_SOURCES: DealSource[] = [
  {
    kind: 'sdelkaOpportunity',
    field: 'sdelkaOpportunityId',
    path: '/rest/opportunities',
    key: 'opportunities',
    label: 'Заказ',
  },
  {
    kind: 'sdelkaRemontOborudovaniya',
    field: 'sdelkaRemontOborudovaniyaId',
    path: '/rest/remontOborudovaniyas',
    key: 'remontOborudovaniyas',
    label: 'Ремонт',
  },
  {
    kind: 'sdelkaTender',
    field: 'sdelkaTenderId',
    path: '/rest/tendery',
    key: 'tendery',
    label: 'Тендер',
  },
  {
    kind: 'sdelkaZapravkaKartridzhey',
    field: 'sdelkaZapravkaKartridzheyId',
    path: '/rest/zapravkaKartridzheys',
    key: 'zapravkaKartridzheys',
    label: 'Заправка',
  },
];

const quoted = (ids: string[]) => `[${ids.map((id) => `"${id}"`).join(',')}]`;

type DealHit = { kind: string; recordId: string; field: string; label: string };

/**
 * Открытые сделки клиента этого диалога.
 *
 * Клиент — контакт диалога; плюс компании, где он указан контактом, и его
 * собственная компания. Открытая = статус «В работе».
 */
const openDealsOfChat = async (chatId: string): Promise<DealHit[]> => {
  const chat = rowsOf(
    await client.get<unknown>('/rest/chats', {
      query: { filter: `id[eq]:"${chatId}"`, select: 'id,kontaktId,kompaniyaId', limit: 1 },
    }),
    'chats',
  )[0];

  if (!chat) return [];

  const personIds = [String(chat.kontaktId ?? '')].filter(Boolean);
  const companyIds = [String(chat.kompaniyaId ?? '')].filter(Boolean);

  if (personIds.length > 0) {
    const person = rowsOf(
      await client.get<unknown>('/rest/people', {
        query: { filter: `id[eq]:"${personIds[0]}"`, select: 'id,companyId', limit: 1 },
      }),
      'people',
    )[0];

    const ownCompany = String(person?.companyId ?? '');

    if (ownCompany && !companyIds.includes(ownCompany)) companyIds.push(ownCompany);
  }

  const conditions: string[] = [];

  if (personIds.length > 0) conditions.push(`pokupatelPersonId[in]:${quoted(personIds)}`);
  if (companyIds.length > 0) conditions.push(`pokupatelCompanyId[in]:${quoted(companyIds)}`);

  if (conditions.length === 0) return [];

  const buyer = conditions.length > 1 ? `or(${conditions.join(',')})` : conditions[0];
  const found: DealHit[] = [];

  for (const source of DEAL_SOURCES) {
    const rows = rowsOf(
      await client.get<unknown>(source.path, {
        query: {
          filter: `status[eq]:"V_RABOTE",${buyer}`,
          select: 'id',
          limit: 2,
        },
      }),
      source.key,
    );

    for (const row of rows) {
      found.push({ kind: source.kind, recordId: String(row.id ?? ''), field: source.field, label: source.label });
    }
  }

  return found;
};

/**
 * К какой сделке отнести входящее сообщение клиента.
 *
 * Привязываем только если у клиента РОВНО ОДНА открытая сделка. Если их нет
 * или несколько — не угадываем: сообщение остаётся без привязки.
 */
export const findIncomingTarget = async (chatId: string): Promise<string> => {
  const deals = await openDealsOfChat(chatId);

  if (deals.length !== 1) return '';

  const deal = deals[0];

  if (!deal.recordId) return '';

  const existing = rowsOf(
    await client.get<unknown>('/rest/chatTargets', {
      query: {
        filter: `chatId[eq]:"${chatId}",${deal.field}[eq]:"${deal.recordId}"`,
        select: 'id',
        limit: 1,
      },
    }),
    'chatTargets',
  )[0];

  if (existing?.id) return String(existing.id);

  // Связки ещё нет — создаём: без неё сообщению не к чему привязываться.
  const created = pickCreated(
    await client.post<unknown>('/rest/chatTargets', {
      name: `Переписка · ${deal.label}`,
      chatId,
      [deal.field]: deal.recordId,
    }),
  );

  return String(created?.id ?? '');
};

/** Карточка диалога: последнее сообщение, время, счётчик непрочитанных. */
export const touchChat = async (params: {
  chatId: string;
  text: string;
  receivedAt: string;
  unreadBefore: number;
}): Promise<void> => {
  const { chatId, text, receivedAt, unreadBefore } = params;

  await client.patch<unknown>(`/rest/chats/${chatId}`, {
    posledneeSoobshchenie: text.slice(0, 200),
    vremyaPoslednego: receivedAt,
    neprochitano: unreadBefore + 1,
  });
};

export const readChatUnread = async (chatId: string): Promise<number> => {
  const row = rowsOf(
    await client.get<unknown>('/rest/chats', {
      query: { filter: `id[eq]:"${chatId}"`, limit: 1 },
    }),
    'chats',
  )[0];

  return Number(row?.neprochitano ?? 0);
};

export const bumpParticipantUnread = async (chatId: string, memberId: string): Promise<void> => {
  const participant = rowsOf(
    await client.get<unknown>('/rest/chatParticipants', {
      query: { filter: `chatId[eq]:"${chatId}"`, limit: 30 },
    }),
    'chatParticipants',
  ).find((row) => String(row.polzovatelId ?? '') === memberId);

  if (!participant?.id) return;

  await client.patch<unknown>(`/rest/chatParticipants/${participant.id}`, {
    neprochitano: Number(participant.neprochitano ?? 0) + 1,
  });
};

/** Отметка «шлюз на связи» по факту пришедшего сообщения. */
export const touchGateway = async (gatewayId: string, at: string): Promise<void> => {
  await client.patch<unknown>(`/rest/smsGateways/${gatewayId}`, {
    posledniyKontakt: at,
    status: 'NA_SVYAZI',
  });
};
