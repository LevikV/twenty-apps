import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_READ_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';

/** Отметка «прочитано»: сбрасывает счётчик сотрудника в этом диалоге. */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = (event.body ?? {}) as { chatId?: string };
  const chatId = String(body.chatId ?? '').trim();

  if (!chatId) {
    return new Response(JSON.stringify({ error: 'Не передан chatId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const service = new ChatService();

    await service.markRead(context.workspaceMemberId, chatId);

    return new Response(JSON.stringify({ ok: true }), {
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
  universalIdentifier: CHAT_READ_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-read',
  description: 'Отметка диалога прочитанным',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-read',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
