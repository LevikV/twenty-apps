import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_RECORD_SEND_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';
import { RecordRoomService } from 'src/shared/record-room';

/**
 * Отправка сообщения из карточки записи.
 *
 * Если комнаты ещё нет — создаётся здесь же (ленивое создание): диалог, связка
 * с записью и участники. Дальше сообщение уходит обычным путём.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = (event.body ?? {}) as {
    recordId?: string;
    text?: string;
    mentions?: { type?: string; id?: string; label?: string }[];
  };
  const recordId = String(body.recordId ?? '').trim();
  const text = String(body.text ?? '').trim();

  if (!recordId || !text) {
    return new Response(JSON.stringify({ error: 'Нужны recordId и текст' }), {
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

    const rooms = new RecordRoomService();

    // Упомянутые участниками не становятся: в диалог попадают только те,
    // кого назначили на запись или кто сам написал (решение 27.10.2026).
    const chatId = await rooms.ensure(recordId, context.workspaceMemberId);
    const chat = new ChatService();
    const result = await chat.send(context.workspaceMemberId, chatId, text, mentions);

    return new Response(JSON.stringify({ ...result, chatId }), {
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
  universalIdentifier: CHAT_RECORD_SEND_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-record-send',
  description: 'Отправка сообщения из карточки записи (с созданием комнаты)',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-record-send',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
