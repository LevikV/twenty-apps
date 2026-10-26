import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_SEND_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';

/**
 * Отправка сообщения.
 *
 * Автор — всегда тот, кто пришёл (из контекста), даже если в теле передали другой id.
 * После вставки: обновляем «последнее сообщение» диалога и поднимаем счётчики
 * непрочитанного остальным участникам.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = (event.body ?? {}) as {
    chatId?: string;
    text?: string;
    mentions?: { type?: string; id?: string; label?: string }[];
  };
  const chatId = String(body.chatId ?? '').trim();
  const text = String(body.text ?? '').trim();

  if (!chatId || !text) {
    return new Response(JSON.stringify({ error: 'Нужны chatId и текст' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const mentions = (body.mentions ?? [])
      .filter((mention) => mention.type && mention.id && mention.label)
      .map((mention) => ({
        type: String(mention.type),
        id: String(mention.id),
        label: String(mention.label),
      }));

    const service = new ChatService();
    const result = await service.send(context.workspaceMemberId, chatId, text, mentions);

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
  universalIdentifier: CHAT_SEND_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-send',
  description: 'Отправка сообщения в диалог',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-send',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
