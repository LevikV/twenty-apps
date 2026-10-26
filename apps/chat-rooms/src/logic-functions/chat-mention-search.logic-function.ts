import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_MENTION_SEARCH_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { searchMentions } from 'src/shared/mention-search';
import { describeError } from 'src/shared/chat-service';

/**
 * Поиск записи для всплывашки «@» в чате.
 *
 * Доступен любому сотруднику с учётной записью: возвращает только подписи и id,
 * ничего секретного — те же записи он видит в интерфейсе.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const query = String(event.queryStringParameters?.q ?? '');

  try {
    const suggestions = await searchMentions(query);

    return new Response(JSON.stringify({ suggestions }), {
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
  universalIdentifier: CHAT_MENTION_SEARCH_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-mention-search',
  description: 'Поиск записей для упоминания в чате',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-mention-search',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
