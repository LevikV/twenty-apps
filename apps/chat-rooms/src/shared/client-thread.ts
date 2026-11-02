import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Переписка с клиентом из карточки сделки.
 *
 * Собеседник — покупатель сделки: компания или физлицо. Пишем всегда контактному
 * лицу сделки, а если оно не заполнено — на телефон покупателя. В ленте сделки
 * показываем только сообщения, привязанные к этой сделке, но от всех контактных
 * лиц покупателя.
 */

type Row = Record<string, unknown> & { id?: string };

const client = new RestApiClient({ runAs: 'application' });

/** Сделки, у которых есть покупатель и связка в «Связке чатов». */
const DEALS: { plural: string; targetField: string; contactFields: string[] }[] = [
  {
    plural: 'opportunities',
    targetField: 'sdelkaOpportunity',
    contactFields: ['pointOfContactId', 'pokupatelPersonId'],
  },
  {
    plural: 'remontOborudovaniyas',
    targetField: 'sdelkaRemontOborudovaniya',
    contactFields: ['kontaktnoeLicoId', 'pokupatelPersonId'],
  },
  { plural: 'tendery', targetField: 'sdelkaTender', contactFields: ['pokupatelPersonId'] },
  {
    plural: 'zapravkaKartridzheys',
    targetField: 'sdelkaZapravkaKartridzhey',
    contactFields: ['pokupatelPersonId'],
  },
];

const rowsOf = (body: unknown, key: string): Row[] => {
  const value = (body as { data?: Record<string, unknown> })?.data?.[key];

  return Array.isArray(value) ? (value as Row[]) : [];
};

const firstRow = (body: unknown): Row | undefined => {
  const data = (body as { data?: Record<string, unknown> })?.data ?? {};

  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
      return value[0] as Row;
    }

    if (value && typeof value === 'object' && !Array.isArray(value) && (value as Row).id) {
      return value as Row;
    }
  }

  return undefined;
};

/**
 * Номер в виде строки: `+7 924 123-45-67`.
 *
 * REST отдаёт телефоны объектом (`phones.primaryPhoneNumber`), а фильтры и
 * выгрузки — плоскими полями. Поддерживаем оба вида.
 */
export const formatPhone = (row: Row | undefined): string => {
  if (!row) return '';

  const phones = (row.phones ?? {}) as {
    primaryPhoneNumber?: string;
    primaryPhoneCallingCode?: string;
  };

  const number = String(phones.primaryPhoneNumber ?? row.phonesPrimaryPhoneNumber ?? '').replace(
    /\D/g,
    '',
  );

  if (!number) return '';

  const code = String(
    phones.primaryPhoneCallingCode ?? row.phonesPrimaryPhoneCallingCode ?? '+7',
  );

  const national = number.length === 11 ? number.slice(1) : number;

  return `${code} ${national.slice(0, 3)} ${national.slice(3, 6)}-${national.slice(6, 8)}-${national.slice(8, 10)}`.trim();
};

const personName = (row: Row | undefined): string => {
  if (!row) return '';

  const name = row.name as { firstName?: string; lastName?: string } | undefined;
  const text = [name?.lastName, name?.firstName].filter(Boolean).join(' ').trim();

  return text || String(row.name ?? '') || 'Без имени';
};

export type ClientContact = {
  personId: string;
  name: string;
  phone: string;
  isPoint: boolean;
};

export type ClientChannel = {
  id: string;
  name: string;
  nomer: string;
  deviceId: string;
};

export type DealClient = {
  plural: string;
  targetField: string;
  name: string;
  companyId: string | null;
  contacts: ClientContact[];
  /** Кому пишем по умолчанию: контактное лицо сделки, иначе телефон покупателя. */
  phone: string;
  personId: string | null;
};

/** Покупатель сделки и его контактные лица. */
export const clientOfDeal = async (recordId: string): Promise<DealClient | null> => {
  for (const deal of DEALS) {
    let row: Row | undefined;

    try {
      row = firstRow(
        await client.get<unknown>(`/rest/${deal.plural}/${recordId}`, {
          query: {
            select: `id,name,pokupatelPersonId,pokupatelCompanyId,${deal.contactFields.join(',')}`,
          },
        }),
      );
    } catch {
      // Не наша сделка — пробуем следующий тип.
      continue;
    }

    if (!row) continue;

    const pointId =
      deal.contactFields
        .map((field) => String(row?.[field] ?? ''))
        .find(Boolean) ?? '';

    const personId = String(row.pokupatelPersonId ?? '');
    const companyId = String(row.pokupatelCompanyId ?? '');

    if (!pointId && !personId && !companyId) return null;

    const contacts: ClientContact[] = [];

    const pushContact = async (id: string, isPoint: boolean) => {
      if (!id || contacts.some((item) => item.personId === id)) return;

      const person = firstRow(
        await client.get<unknown>(`/rest/people/${id}`, {
          query: { select: 'id,name,phones' },
        }),
      );

      contacts.push({
        personId: id,
        name: personName(person),
        phone: formatPhone(person),
        isPoint,
      });
    };

    if (pointId) await pushContact(pointId, true);

    if (personId) await pushContact(personId, false);

    // Покупатель-компания: собеседники — все её контактные лица.
    if (companyId) {
      const links = rowsOf(
        await client.get<unknown>('/rest/kontaktyKlientov', {
          query: {
            filter: `klientCompanyId[eq]:${companyId}`,
            limit: 200,
            select: 'id,kontaktnoeLicoId',
          },
        }),
        'kontaktyKlientov',
      );

      for (const link of links) {
        await pushContact(String(link.kontaktnoeLicoId ?? ''), false);
      }
    }

    const point = contacts.find((item) => item.isPoint && item.phone);

    return {
      plural: deal.plural,
      targetField: deal.targetField,
      name: String(row.name ?? ''),
      companyId: companyId || null,
      contacts: contacts.filter((item) => item.phone),
      phone: point?.phone ?? contacts[0]?.phone ?? '',
      personId: point?.personId ?? contacts[0]?.personId ?? null,
    };
  }

  return null;
};

/** SMS-диалог конкретного контакта: один на пару «шлюз + номер». */
export const chatOfPerson = async (personId: string): Promise<Row | null> => {
  const rows = rowsOf(
    await client.get<unknown>('/rest/chats', {
      query: {
        filter: `and(kontaktId[eq]:"${personId}",kanal[eq]:"SMS")`,
        select: 'id,name,vneshniyId,kanal,vremyaPoslednego,shlyuzId',
        orderBy: 'vremyaPoslednego',
        limit: 1,
      },
    }),
    'chats',
  );

  return rows[0] ?? null;
};

/** Связка «диалог ↔ сделка»: нужна, чтобы сообщение знало свою сделку. */
export const ensureTarget = async (
  chatId: string,
  deal: DealClient,
  recordId: string,
): Promise<string> => {
  const existing = rowsOf(
    await client.get<unknown>('/rest/chatTargets', {
      query: {
        filter: `and(chatId[eq]:"${chatId}",${deal.targetField}Id[eq]:"${recordId}")`,
        select: 'id',
        limit: 1,
      },
    }),
    'chatTargets',
  )[0];

  if (existing?.id) return String(existing.id);

  const created = firstRow(
    await client.post<unknown>('/rest/chatTargets', {
      name: deal.name ? `Переписка · ${deal.name}` : 'Переписка с клиентом',
      chatId,
      [`${deal.targetField}Id`]: recordId,
    }),
  );

  return String(created?.id ?? '');
};

/** Связки этой сделки — по ним отбираем сообщения ленты. */
export const targetsOfDeal = async (deal: DealClient, recordId: string): Promise<string[]> =>
  rowsOf(
    await client.get<unknown>('/rest/chatTargets', {
      query: {
        filter: `${deal.targetField}Id[eq]:"${recordId}"`,
        select: 'id',
        limit: 200,
      },
    }),
    'chatTargets',
  )
    .map((row) => String(row.id ?? ''))
    .filter(Boolean);

/** Каналы сотрудника: через них он может отвечать клиенту. */
export const channelsOfMember = async (memberId: string): Promise<ClientChannel[]> => {
  const rows = rowsOf(
    await client.get<unknown>('/rest/smsGateways', {
      query: {
        filter: `sotrudnikId[eq]:"${memberId}"`,
        select: 'id,name,deviceId,nomerPrimaryPhoneNumber,status',
        limit: 20,
      },
    }),
    'smsGateways',
  );

  const list = rows
    .filter((row) => String(row.deviceId ?? ''))
    .map((row) => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? row.nomerPrimaryPhoneNumber ?? 'Канал'),
      nomer: formatPhone({ phones: { primaryPhoneNumber: row.nomerPrimaryPhoneNumber } }),
      deviceId: String(row.deviceId ?? ''),
    }));

  if (list.length > 0) return list;

  // Ответственный по сделке может не иметь своего канала — тогда доступен любой
  // рабочий, иначе из карточки нельзя ответить вообще.
  const all = rowsOf(
    await client.get<unknown>('/rest/smsGateways', {
      query: {
        filter: `status[eq]:"NA_SVYAZI"`,
        select: 'id,name,deviceId,nomerPrimaryPhoneNumber',
        limit: 20,
      },
    }),
    'smsGateways',
  );

  return all
    .filter((row) => String(row.deviceId ?? ''))
    .map((row) => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? row.nomerPrimaryPhoneNumber ?? 'Канал'),
      nomer: formatPhone({ phones: { primaryPhoneNumber: row.nomerPrimaryPhoneNumber } }),
      deviceId: String(row.deviceId ?? ''),
    }));
};

/** Диалог контакта по номеру канала: ищем существующий, иначе создаём. */
export const ensureChatForContact = async (params: {
  contact: ClientContact;
  channel: ClientChannel;
  dealName: string;
  companyId: string | null;
}): Promise<string> => {
  const { contact, channel, dealName, companyId } = params;

  // Ключ диалога совпадает с входящими SMS: 10 цифр без кода страны.
  const digits = contact.phone.replace(/\D/g, '');
  const national = digits.length === 11 ? digits.slice(1) : digits;

  const externalId = `sms:${channel.deviceId}:${national}`;

  const existing = rowsOf(
    await client.get<unknown>('/rest/chats', {
      query: { filter: `vneshniyId[eq]:"${externalId}"`, limit: 1, select: 'id' },
    }),
    'chats',
  )[0];

  if (existing?.id) return String(existing.id);

  const payload: Record<string, unknown> = {
    name: contact.phone,
    nazvanie: dealName || contact.phone,
    kanal: 'SMS',
    tip: 'KLIENT',
    status: 'OTKRYT',
    vneshniyId: externalId,
    shlyuzId: channel.id,
    kontaktId: contact.personId,
  };

  if (companyId) payload.kompaniyaId = companyId;

  const created = firstRow(await client.post<unknown>('/rest/chats', payload));

  if (!created?.id) throw new Error('диалог создан, но в ответе нет id');

  return String(created.id);
};

export type ClientThread = {
  chatId: string | null;
  nomer: string | null;
  contacts: ClientContact[];
  channels: ClientChannel[];
  targetIds: string[];
  reason?: string;
  dealName?: string;
};

/** Всё, что нужно вкладке «Клиент»: собеседники, каналы и связки сделки. */
export const threadOfDeal = async (
  recordId: string,
  memberId?: string,
): Promise<ClientThread> => {
  const deal = await clientOfDeal(recordId);

  if (!deal) {
    return {
      chatId: null,
      nomer: null,
      contacts: [],
      channels: [],
      targetIds: [],
      reason: 'у сделки нет покупателя',
    };
  }

  const channels = memberId ? await channelsOfMember(memberId) : [];
  const targetIds = await targetsOfDeal(deal, recordId);

  const chat = deal.personId ? await chatOfPerson(deal.personId) : null;

  return {
    chatId: chat?.id ? String(chat.id) : null,
    nomer: deal.phone || null,
    contacts: deal.contacts,
    channels,
    targetIds,
    dealName: deal.name,
  };
};

export type ClientMessage = {
  id: string;
  text: string;
  createdAt: string;
  napravlenie: string;
  statusDostavki: string;
  chatId: string;
  authorName: string;
};

/** Сообщения, привязанные к сделке, от любых контактов покупателя. */
export const messagesOfDeal = async (
  targetIds: string[],
  contacts: ClientContact[],
): Promise<ClientMessage[]> => {
  if (targetIds.length === 0) return [];

  const rows = rowsOf(
    await client.get<unknown>('/rest/soobshcheniya', {
      query: {
        filter: `svyazkaId[in]:[${targetIds.join(',')}]`,
        select: 'id,tekst,createdAt,chatId,napravlenie,statusDostavki',
        orderBy: 'createdAt',
        limit: 200,
      },
    }),
    'soobshcheniya',
  );

  const chatIds = Array.from(new Set(rows.map((row) => String(row.chatId ?? '')).filter(Boolean)));

  const nameByPerson = new Map(contacts.map((item) => [item.personId, item.name]));
  const nameByChat = new Map<string, string>();

  if (chatIds.length > 0) {
    const chats = rowsOf(
      await client.get<unknown>('/rest/chats', {
        query: {
          filter: `id[in]:[${chatIds.join(',')}]`,
          select: 'id,kontaktId',
          limit: 200,
        },
      }),
      'chats',
    );

    for (const chat of chats) {
      const personId = String(chat.kontaktId ?? '');

      nameByChat.set(
        String(chat.id ?? ''),
        nameByPerson.get(personId) ?? 'Клиент',
      );
    }
  }

  return rows.map((row) => ({
    id: String(row.id ?? ''),
    text: String(row.tekst ?? ''),
    createdAt: String(row.createdAt ?? ''),
    napravlenie: String(row.napravlenie ?? ''),
    statusDostavki: String(row.statusDostavki ?? ''),
    chatId: String(row.chatId ?? ''),
    authorName: nameByChat.get(String(row.chatId ?? '')) ?? 'Клиент',
  }));
};
