import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { CHAT_LINK_SEARCH_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { describeError } from 'src/shared/chat-service';

const client = new RestApiClient({ runAs: 'application' });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

type Source = {
  kind: string;
  path: string;
  titleField: string;
  label: string;
  /** Есть ли у записи покупатель (компания или физлицо). */
  hasBuyer: boolean;
};

/** Куда можно привязать сообщение: те же типы, что в морфе связки чатов. */
const SOURCES: Source[] = [
  {
    kind: 'sdelkaOpportunity',
    path: '/rest/opportunities',
    titleField: 'name',
    label: 'Заказ',
    hasBuyer: true,
  },
  {
    kind: 'sdelkaRemontOborudovaniya',
    path: '/rest/remontOborudovaniyas',
    titleField: 'name',
    label: 'Ремонт',
    hasBuyer: true,
  },
  {
    kind: 'sdelkaTender',
    path: '/rest/tendery',
    titleField: 'name',
    label: 'Тендер',
    hasBuyer: true,
  },
  {
    kind: 'sdelkaZapravkaKartridzhey',
    path: '/rest/zapravkaKartridzheys',
    titleField: 'name',
    label: 'Заправка',
    hasBuyer: true,
  },
  {
    kind: 'zadacha',
    path: '/rest/tasks',
    titleField: 'title',
    label: 'Задача',
    hasBuyer: false,
  },
];

const escapeValue = (value: string) => value.replace(/"/g, '\\"');

const rowsOf = (body: unknown, key: string): Record<string, unknown>[] => {
  const rows = (body as { data?: Record<string, unknown> })?.data?.[key];

  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
};

const idsOf = (rows: Record<string, unknown>[]) =>
  rows.map((row) => String(row.id ?? '')).filter(Boolean);

/** Поиск записей для привязки сообщения: по номеру, названию и покупателю. */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) return json({ error: 'Нужна авторизация' }, 401);

  const query = String(
    (event.queryStringParameters as Record<string, string> | undefined)?.q ?? '',
  ).trim();

  if (query.length < 2) return json({ results: [] });

  const pattern = `%${escapeValue(query)}%`;

  try {
    // Покупатели ищутся отдельно: в сделке лежит только ссылка на карточку,
    // а название компании или фамилия в самой сделке не хранятся.
    const [companies, people] = await Promise.all([
      client
        .get<unknown>('/rest/companies', {
          query: { filter: `name[ilike]:"${pattern}"`, select: 'id,name', limit: 10 },
        })
        .then((body) => rowsOf(body, 'companies'))
        .catch(() => []),
      client
        .get<unknown>('/rest/people', {
          query: {
            filter: `or(name.firstName[ilike]:"${pattern}",name.lastName[ilike]:"${pattern}")`,
            select: 'id,name',
            limit: 10,
          },
        })
        .then((body) => rowsOf(body, 'people'))
        .catch(() => []),
    ]);

    const companyIds = idsOf(companies);
    const personIds = idsOf(people);

    const buyerTitles = new Map<string, string>();

    for (const company of companies) {
      const name = String(company.name ?? '').trim();

      if (name) buyerTitles.set(String(company.id ?? ''), name);
    }

    for (const person of people) {
      const name = person.name as { firstName?: string; lastName?: string } | undefined;
      const title = [name?.lastName, name?.firstName].filter(Boolean).join(' ').trim();

      if (title) buyerTitles.set(String(person.id ?? ''), title);
    }

    const pages = await Promise.all(
      SOURCES.map(async (source) => {
        const conditions = [`${source.titleField}[ilike]:"${pattern}"`];

        if (source.hasBuyer) {
          if (companyIds.length > 0) {
            conditions.push(
              `pokupatelCompanyId[in]:[${companyIds.map((id) => `"${id}"`).join(',')}]`,
            );
          }

          if (personIds.length > 0) {
            conditions.push(
              `pokupatelPersonId[in]:[${personIds.map((id) => `"${id}"`).join(',')}]`,
            );
          }
        }

        const buyerSelect = source.hasBuyer ? ',pokupatelCompanyId,pokupatelPersonId' : '';

        const body = await client.get<unknown>(source.path, {
          query: {
            filter: conditions.length > 1 ? `or(${conditions.join(',')})` : conditions[0],
            select: `id,${source.titleField}${buyerSelect}`,
            limit: 8,
          },
        });

        return rowsOf(body, source.path.split('/').pop() ?? '').map((row) => {
          const buyerId = String(row.pokupatelCompanyId ?? row.pokupatelPersonId ?? '');

          return {
            kind: source.kind,
            recordId: String(row.id ?? ''),
            title: String(row[source.titleField] ?? row.name ?? ''),
            label: source.label,
            subtitle: buyerId ? (buyerTitles.get(buyerId) ?? '') : '',
          };
        });
      }),
    );

    return json({ results: pages.flat().filter((item) => item.recordId) });
  } catch (error) {
    return json({ error: describeError(error) }, 400);
  }
};

export default defineLogicFunction({
  universalIdentifier: CHAT_LINK_SEARCH_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-link-search',
  description: 'Поиск записей для привязки сообщения',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-link-search',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
