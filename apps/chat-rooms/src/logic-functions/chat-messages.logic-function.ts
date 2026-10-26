import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_MESSAGES_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';

/**
 * Лента сообщений диалога.
 *
 * Перед чтением проверяем, что сотрудник действительно участник этого диалога:
 * иначе по чужому chatId можно было бы прочитать переписку.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const chatId = String(event.queryStringParameters?.chatId ?? '').trim();

  if (!chatId) {
    return new Response(JSON.stringify({ error: 'Не передан chatId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const service = new ChatService();
    const result = await service.messages(context.workspaceMemberId, chatId);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: describeError(error) }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export default defineLogicFunction({
  universalIdentifier: CHAT_MESSAGES_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-messages',
  description: 'Лента сообщений диалога с проверкой участия',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-messages',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
