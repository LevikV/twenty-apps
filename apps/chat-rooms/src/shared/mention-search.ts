/**
 * Поиск по записям для всплывашки «@» в чате.
 *
 * Девять типов: пользователь (учётная запись), сотрудник (карточка), компания,
 * контакт, заказ, тендер, ремонт, заправка, задача.
 *
 * Почему GraphQL, а не REST: у REST-фильтра нет объединения условий, а ремонт надо
 * искать по названию ИЛИ по оборудованию. Здесь же всё одним запросом с `or`.
 *
 * Токен — токен приложения (TWENTY_APP_APPLICATION_ACCESS_TOKEN): у ролей сотрудников
 * прав на кастомные объекты нет, поэтому поиск идёт от приложения.
 */

export type MentionType =
  | 'POLZOVATEL'
  | 'SOTRUDNIK'
  | 'KOMPANIYA'
  | 'KONTAKT'
  | 'ZAKAZ'
  | 'TENDER'
  | 'REMONT'
  | 'ZAPRAVKA'
  | 'ZADACHA';

export type MentionSuggestion = {
  type: MentionType;
  id: string;
  label: string;
  subtitle: string;
};

type Env = Record<string, string | undefined>;

const readEnv = (): Env =>
  ((globalThis as unknown as { process?: { env?: Env } }).process?.env ?? {}) as Env;

const apiBase = (): string => (readEnv().TWENTY_API_URL ?? '').replace(/\/+$/, '');

const appToken = (): string => {
  const env = readEnv();

  return env.TWENTY_APP_APPLICATION_ACCESS_TOKEN ?? env.TWENTY_API_KEY ?? '';
};

const graphql = async <TData,>(
  query: string,
  variables: Record<string, unknown>,
): Promise<TData> => {
  const response = await fetch(`${apiBase()}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as { data?: TData; errors?: { message: string }[] };

  if (!response.ok || payload.errors?.length) {
    throw new Error(
      payload.errors?.map((item) => item.message).join('; ') ??
        `GraphQL HTTP ${response.status}`,
    );
  }

  if (!payload.data) {
    throw new Error('Пустой ответ GraphQL');
  }

  return payload.data;
};

type Edge<T> = { node: T };
type Connection<T> = { edges: Edge<T>[] };

const fullName = (value?: { firstName?: string | null; lastName?: string | null } | null) =>
  [value?.firstName, value?.lastName].filter(Boolean).join(' ').trim();

const PER_TYPE = 5;

const STAFF_QUERY = `
  query($q: String!) {
    workspaceMembers(
      filter: { or: [{ name: { firstName: { ilike: $q } } }, { name: { lastName: { ilike: $q } } }] }
      first: ${PER_TYPE}
    ) {
      edges { node { id name { firstName lastName } sotrudnikId } }
    }
    sotrudniki(
      filter: { or: [{ fio: { firstName: { ilike: $q } } }, { fio: { lastName: { ilike: $q } } }] }
      first: ${PER_TYPE}
    ) {
      edges { node { id fio } }
    }
  }
`;

const BUSINESS_QUERY = `
  query($q: String!) {
    companies(filter: { name: { ilike: $q } }, first: ${PER_TYPE}) {
      edges { node { id name } }
    }
    opportunities(filter: { name: { ilike: $q } }, first: ${PER_TYPE}) {
      edges { node { id name } }
    }
    tendery(filter: { name: { ilike: $q } }, first: ${PER_TYPE}) {
      edges { node { id name } }
    }
    zapravkaKartridzheys(filter: { name: { ilike: $q } }, first: ${PER_TYPE}) {
      edges { node { id name } }
    }
    remontOborudovaniyas(
      filter: { or: [{ name: { ilike: $q } }, { oborudovanie: { ilike: $q } }] }
      first: ${PER_TYPE}
    ) {
      edges { node { id name oborudovanie } }
    }
    tasks(filter: { title: { ilike: $q } }, first: ${PER_TYPE}) {
      edges { node { id title } }
    }
  }
`;

const PEOPLE_QUERY = `
  query($q: String!) {
    people(
      filter: { or: [{ name: { firstName: { ilike: $q } } }, { name: { lastName: { ilike: $q } } }] }
      first: ${PER_TYPE}
    ) {
      edges { node { id name { firstName lastName } } }
    }
  }
`;

type StaffData = {
  workspaceMembers: Connection<{
    id: string;
    name: { firstName: string | null; lastName: string | null };
    sotrudnikId: string | null;
  }>;
  sotrudniki: Connection<{
    id: string;
    fio: { firstName: string | null; lastName: string | null } | null;
  }>;
};

type BusinessData = {
  companies: Connection<{ id: string; name: string | null }>;
  opportunities: Connection<{ id: string; name: string | null }>;
  tendery: Connection<{ id: string; name: string | null }>;
  zapravkaKartridzheys: Connection<{ id: string; name: string | null }>;
  remontOborudovaniyas: Connection<{
    id: string;
    name: string | null;
    oborudovanie: string | null;
  }>;
  tasks: Connection<{ id: string; title: string | null }>;
};

type PeopleData = {
  people: Connection<{
    id: string;
    name: { firstName: string | null; lastName: string | null };
  }>;
};

export const searchMentions = async (rawQuery: string): Promise<MentionSuggestion[]> => {
  const trimmed = rawQuery.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const variables = { q: `%${trimmed}%` };

  const [staff, business, people] = await Promise.all([
    graphql<StaffData>(STAFF_QUERY, variables),
    graphql<BusinessData>(BUSINESS_QUERY, variables),
    graphql<PeopleData>(PEOPLE_QUERY, variables),
  ]);

  const members = staff.workspaceMembers.edges.map((edge) => edge.node);
  const linkedSotrudnikIds = new Set(
    members.map((member) => member.sotrudnikId).filter((value): value is string => !!value),
  );

  const suggestions: MentionSuggestion[] = [];

  for (const member of members) {
    suggestions.push({
      type: 'POLZOVATEL',
      id: member.id,
      label: fullName(member.name) || 'Пользователь',
      subtitle: 'учётная запись',
    });
  }

  for (const sotrudnik of staff.sotrudniki.edges.map((edge) => edge.node)) {
    if (linkedSotrudnikIds.has(sotrudnik.id)) {
      continue;
    }

    suggestions.push({
      type: 'SOTRUDNIK',
      id: sotrudnik.id,
      label: fullName(sotrudnik.fio) || 'Сотрудник',
      subtitle: 'сотрудник без учётной записи',
    });
  }

  for (const company of business.companies.edges.map((edge) => edge.node)) {
    suggestions.push({
      type: 'KOMPANIYA',
      id: company.id,
      label: company.name || 'Компания',
      subtitle: 'компания',
    });
  }

  for (const person of people.people.edges.map((edge) => edge.node)) {
    suggestions.push({
      type: 'KONTAKT',
      id: person.id,
      label: fullName(person.name) || 'Контакт',
      subtitle: 'контакт',
    });
  }

  for (const opportunity of business.opportunities.edges.map((edge) => edge.node)) {
    suggestions.push({
      type: 'ZAKAZ',
      id: opportunity.id,
      label: opportunity.name || 'Заказ',
      subtitle: 'заказ',
    });
  }

  for (const tender of business.tendery.edges.map((edge) => edge.node)) {
    suggestions.push({
      type: 'TENDER',
      id: tender.id,
      label: tender.name || 'Тендер',
      subtitle: 'тендер',
    });
  }

  for (const remont of business.remontOborudovaniyas.edges.map((edge) => edge.node)) {
    const equipment = (remont.oborudovanie ?? '').trim();

    suggestions.push({
      type: 'REMONT',
      id: remont.id,
      label: remont.name || 'Ремонт',
      subtitle: equipment ? `ремонт · ${equipment}` : 'ремонт',
    });
  }

  for (const zapravka of business.zapravkaKartridzheys.edges.map((edge) => edge.node)) {
    suggestions.push({
      type: 'ZAPRAVKA',
      id: zapravka.id,
      label: zapravka.name || 'Заправка',
      subtitle: 'заправка',
    });
  }

  for (const task of business.tasks.edges.map((edge) => edge.node)) {
    suggestions.push({
      type: 'ZADACHA',
      id: task.id,
      label: task.title || 'Задача',
      subtitle: 'задача',
    });
  }

  return suggestions;
};
