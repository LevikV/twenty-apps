import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { CHAT_THREAD_DEALS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';

/**
 * Сделки, которые встречаются в переписке — для фильтра ленты.
 *
 * Диалог у клиента один, а сделок у него может быть много. Сообщение знает свою
 * сделку через связку, поэтому список сделок собираем по сообщениям диалога.
 */
const client = new RestApiClient({ runAs: 'application' });

const rowsOf = (body: unknown, key: string): Record<string, unknown>[] => {
  const value = (body as { data?: Record<string, unknown> })?.data?.[key];

  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
};

const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const chatId = String(event.queryStringParameters?.chatId ?? '').trim();

  if (!chatId) {
    return new Response(JSON.stringify({ error: 'Нужен chatId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const messages = rowsOf(
      await client.get<unknown>('/rest/soobshcheniya', {
        query: {
          filter: `and(chatId[eq]:"${chatId}",svyazkaId[is]:NOT_NULL)`,
          select: 'id,svyazkaId',
          limit: 300,
        },
      }),
      'soobshcheniya',
    );

    const counts = new Map<string, number>();

    for (const message of messages) {
      const id = String(message.svyazkaId ?? '');

      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const ids = [...counts.keys()];

    if (ids.length === 0) {
      return new Response(JSON.stringify({ deals: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const targets = rowsOf(
      await client.get<unknown>('/rest/chatTargets', {
        query: {
          filter: `id[in]:[${ids.map((id) => `"${id}"`).join(',')}]`,
          select: 'id,name',
          limit: ids.length,
        },
      }),
      'chatTargets',
    );

    const names = new Map(targets.map((row) => [String(row.id), String(row.name ?? '')]));

    const deals = ids.map((id) => ({
      id,
      name: names.get(id) || 'Сделка без названия',
      count: counts.get(id) ?? 0,
    }));

    return new Response(JSON.stringify({ deals }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: describeError(error) }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export default defineLogicFunction({
  universalIdentifier: CHAT_THREAD_DEALS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-thread-deals',
  description: 'Сделки в переписке для фильтра ленты',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-thread-deals',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
