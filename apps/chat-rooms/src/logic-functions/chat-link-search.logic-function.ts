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
};

/** Куда можно привязать сообщение: те же типы, что в морфе связки чатов. */
const SOURCES: Source[] = [
  { kind: 'sdelkaOpportunity', path: '/rest/opportunities', titleField: 'name', label: 'Заказ' },
  {
    kind: 'sdelkaRemontOborudovaniya',
    path: '/rest/remontOborudovaniyas',
    titleField: 'name',
    label: 'Ремонт',
  },
  { kind: 'sdelkaTender', path: '/rest/tendery', titleField: 'name', label: 'Тендер' },
  {
    kind: 'sdelkaZapravkaKartridzhey',
    path: '/rest/zapravkaKartridzheys',
    titleField: 'name',
    label: 'Заправка',
  },
  { kind: 'zadacha', path: '/rest/tasks', titleField: 'title', label: 'Задача' },
];

const escapeValue = (value: string) => value.replace(/"/g, '\\"');

/** Поиск записей для привязки сообщения: по названию и номеру. */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) return json({ error: 'Нужна авторизация' }, 401);

  const query = String(
    (event.queryStringParameters as Record<string, string> | undefined)?.q ?? '',
  ).trim();

  if (query.length < 2) return json({ results: [] });

  const pattern = `%${escapeValue(query)}%`;

  try {
    const pages = await Promise.all(
      SOURCES.map(async (source) => {
        const body = await client.get<unknown>(source.path, {
          query: {
            filter: `${source.titleField}[ilike]:"${pattern}"`,
            select: `id,${source.titleField}`,
            limit: 8,
          },
        });

        const rows = (body as { data?: Record<string, unknown> })?.data?.[
          source.path.split('/').pop() ?? ''
        ];

        return (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).map((row) => ({
          kind: source.kind,
          recordId: String(row.id ?? ''),
          title: String(row[source.titleField] ?? row.name ?? ''),
          label: source.label,
        }));
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
