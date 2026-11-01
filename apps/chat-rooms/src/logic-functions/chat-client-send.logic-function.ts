import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_CLIENT_SEND_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';
import { clientOfDeal, ensureTarget, threadOfDeal } from 'src/shared/client-thread';

/**
 * Ответ клиенту из карточки сделки.
 *
 * Сообщение уходит в общий диалог с клиентом, но помечается связкой этой сделки —
 * так в «Центре коммуникации» работает фильтр по сделке. Если сотрудник ещё не
 * участвует в диалоге (он ответственный по сделке, а телефон у другого менеджера),
 * подписываем его участником.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = (event.body ?? {}) as { recordId?: string; text?: string };
  const recordId = String(body.recordId ?? '').trim();
  const text = String(body.text ?? '').trim();

  if (!recordId || !text) {
    return new Response(JSON.stringify({ error: 'Нужны recordId и текст' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const thread = await threadOfDeal(recordId);

    if (!thread.chatId) {
      return new Response(
        JSON.stringify({ error: thread.reason ?? 'Переписки с клиентом ещё нет' }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }

    const deal = await clientOfDeal(recordId);
    const targetId = deal ? await ensureTarget(thread.chatId, deal, recordId) : '';

    const chat = new ChatService();

    // Ответственный по сделке может не быть участником клиентского диалога —
    // подписываем, иначе отправка упрётся в проверку участия.
    await chat.ensureParticipant(context.workspaceMemberId, thread.chatId);

    const result = await chat.send(
      context.workspaceMemberId,
      thread.chatId,
      text,
      [],
      targetId ? { svyazkaId: targetId } : {},
    );

    return new Response(JSON.stringify({ ...result, chatId: thread.chatId, targetId }), {
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
  universalIdentifier: CHAT_CLIENT_SEND_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-client-send',
  description: 'Ответ клиенту из карточки сделки с привязкой к сделке',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-client-send',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
