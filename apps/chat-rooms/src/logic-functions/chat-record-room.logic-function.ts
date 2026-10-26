import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_RECORD_ROOM_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';
import { RecordRoomService } from 'src/shared/record-room';

/**
 * Комната чата по записи (Заказ, Ремонт, Тендер, Заправка, Задача).
 *
 * Возвращает состояние комнаты для карточки: есть ли диалог, можно ли читать
 * (я участник), сообщения. Комната создаётся не здесь, а при первой отправке.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const recordId = String((event.queryStringParameters as Record<string, string> | undefined)?.recordId ?? '').trim();

  if (!recordId) {
    return new Response(JSON.stringify({ error: 'Нужен recordId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const rooms = new RecordRoomService();
    const state = await rooms.describe(recordId, context.workspaceMemberId);

    if (!state.chatId || !state.member) {
      return new Response(
        JSON.stringify({ ...state, messages: [], names: {} }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    const chat = new ChatService();
    const feed = await chat.messages(context.workspaceMemberId, state.chatId);

    return new Response(JSON.stringify({ ...state, ...feed }), {
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
  universalIdentifier: CHAT_RECORD_ROOM_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-record-room',
  description: 'Комната чата по записи (карточка)',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-record-room',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
