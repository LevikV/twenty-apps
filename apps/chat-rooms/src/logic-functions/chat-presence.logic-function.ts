import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_PRESENCE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';
import { clearPresence, notePresence } from 'src/shared/presence';

/**
 * «Я смотрю этот чат» — фронт отмечается раз в 25 секунд, пока диалог открыт.
 * Пока отметка свежая, пуш о новом сообщении этому человеку не отправляется.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = (event.body ?? {}) as { chatId?: string; closed?: boolean };
  const chatId = String(body.chatId ?? '').trim();

  if (!chatId || body.closed === true) {
    clearPresence(context.workspaceMemberId);
  } else {
    notePresence(context.workspaceMemberId, chatId);

    // Основная отметка живёт в базе: память модуля не общая для разных
    // обработчиков (каждый логик-функция собирается отдельным бандлом).
    try {
      await new ChatService().markRead(context.workspaceMemberId, chatId, true);
    } catch (error) {
      return new Response(JSON.stringify({ error: describeError(error) }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export default defineLogicFunction({
  universalIdentifier: CHAT_PRESENCE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-presence',
  description: 'Присутствие сотрудника в диалоге (для подавления пушей)',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-presence',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
