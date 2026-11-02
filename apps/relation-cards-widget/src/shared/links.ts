import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Связи «клиент ↔ контактное лицо».
 *
 * Виджет работает под любой ролью, поэтому ходит не в REST напрямую, а через
 * маршруты приложения: они выполняются от имени приложения и не зависят от
 * прав роли на служебный объект связей.
 */

type Row = Record<string, unknown> & { id?: string };

const client = new RestApiClient({ runAs: 'application' });

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

const LINK_SELECT = 'id,name,dolzhnost,objectGuid,klientCompanyId,klientPersonId,kontaktnoeLicoId';

const fetchLinks = async (filter: string): Promise<Row[]> =>
  rowsOf(
    await client.get<unknown>('/rest/kontaktyKlientov', {
      query: { filter, limit: 200, select: LINK_SELECT },
    }),
    'kontaktyKlientov',
  );

const fetchPeople = async (ids: string[]): Promise<Row[]> => {
  if (ids.length === 0) return [];

  return rowsOf(
    await client.get<unknown>('/rest/people', {
      query: { filter: `id[in]:[${ids.join(',')}]`, limit: 200, select: 'id,name,phones,jobTitle' },
    }),
    'people',
  );
};

const fetchCompanies = async (ids: string[]): Promise<Row[]> => {
  if (ids.length === 0) return [];

  return rowsOf(
    await client.get<unknown>('/rest/companies', {
      query: { filter: `id[in]:[${ids.join(',')}]`, limit: 200, select: 'id,name' },
    }),
    'companies',
  );
};

export type RelationData = {
  isCompany: boolean;
  links: Row[];
  usage: Row[];
  persons: Record<string, Row>;
  ownerNames: Record<string, string>;
};

/** Всё, что нужно виджету для отрисовки карточки. */
export const loadRelations = async (recordId: string): Promise<RelationData> => {
  const company = rowsOf(
    await client.get<unknown>('/rest/companies', {
      query: { filter: `id[eq]:${recordId}`, limit: 1, select: 'id,name' },
    }),
    'companies',
  );

  const isCompany = company.length > 0;

  const links = isCompany
    ? await fetchLinks(`klientCompanyId[eq]:${recordId}`)
    : await fetchLinks(`klientPersonId[eq]:${recordId}`);

  const usage = isCompany ? [] : await fetchLinks(`kontaktnoeLicoId[eq]:${recordId}`);

  const all = [...links, ...usage];

  const personIds = Array.from(
    new Set(all.map((link) => String(link.kontaktnoeLicoId ?? '')).filter(Boolean)),
  );

  // У карточки сделки/контакта показываем, за какими клиентами закреплено лицо.
  const ownerPersonIds = Array.from(
    new Set(all.map((link) => String(link.klientPersonId ?? '')).filter(Boolean)),
  );

  const ownerCompanyIds = Array.from(
    new Set(all.map((link) => String(link.klientCompanyId ?? '')).filter(Boolean)),
  );

  const [personRows, ownerPersonRows, ownerCompanyRows] = await Promise.all([
    fetchPeople([...personIds, ...ownerPersonIds]),
    fetchPeople(ownerPersonIds),
    fetchCompanies(ownerCompanyIds),
  ]);

  const persons: Record<string, Row> = {};

  for (const person of [...personRows, ...ownerPersonRows]) {
    if (person.id) persons[String(person.id)] = person;
  }

  const ownerNames: Record<string, string> = {};

  for (const person of ownerPersonRows) {
    const name = person.name as Record<string, unknown> | undefined;
    const text = [name?.lastName, name?.firstName].filter(Boolean).join(' ').trim();

    if (person.id) ownerNames[String(person.id)] = text || 'Без названия';
  }

  for (const item of ownerCompanyRows) {
    if (item.id) ownerNames[String(item.id)] = String(item.name ?? '').trim() || 'Без названия';
  }

  return { isCompany, links, usage, persons, ownerNames };
};

/** Связь «клиент ↔ контактное лицо». */
export const addLink = async (input: {
  mode: 'company' | 'person';
  recordId: string;
  personId: string;
}): Promise<Row | undefined> => {
  const body: Record<string, string> = { kontaktnoeLicoId: input.personId };

  if (input.mode === 'company') {
    body.klientCompanyId = input.recordId;
  } else {
    body.klientPersonId = input.recordId;
  }

  return firstRow(await client.post<unknown>('/rest/kontaktyKlientov', body));
};

/** Закрепление контакта за компанией (обратный поиск). */
export const attachToCompany = async (input: {
  companyId: string;
  personId: string;
}): Promise<Row | undefined> =>
  firstRow(
    await client.post<unknown>('/rest/kontaktyKlientov', {
      klientCompanyId: input.companyId,
      kontaktnoeLicoId: input.personId,
    }),
  );

export const removeLink = async (linkId: string): Promise<void> => {
  await client.delete(`/rest/kontaktyKlientov/${linkId}`);
};

export const createPerson = async (input: {
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<Row | undefined> =>
  firstRow(
    await client.post<unknown>('/rest/people', {
      name: { firstName: input.firstName, lastName: input.lastName },
      ...(input.phone ? { phones: { primaryPhoneNumber: input.phone } } : {}),
    }),
  );
