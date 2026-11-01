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

  if (svyazkaId) payload.svyazkaId = svyazkaId;

  const created = pickCreated(await client.post<unknown>('/rest/soobshcheniya', payload));

  if (!created?.id) throw new Error('сообщение создано, но в ответе нет id');

  void receivedAt;

  return { created: true, id: created.id };
};

/**
 * Связка диалога со сделкой, если она одна.
 *
 * Клиент пишет сам, вне карточки — контекста нет. Если у диалога ровно одна
 * сделка, ошибки не будет: относим входящее к ней. Если сделок несколько —
 * не гадаем, сообщение остаётся без привязки (привяжется ответом из карточки).
 */
export const findSoleTarget = async (chatId: string): Promise<string> => {
  const rows = rowsOf(
    await client.get<unknown>('/rest/chatTargets', {
      query: { filter: `chatId[eq]:"${chatId}"`, limit: 3 },
    }),
    'chatTargets',
  );

  return rows.length === 1 ? String(rows[0].id ?? '') : '';
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
