import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_CLIENT_THREAD_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { messagesOfDeal, threadOfDeal } from 'src/shared/client-thread';
import { describeError } from 'src/shared/chat-service';

/**
 * Переписка с клиентом для карточки сделки.
 *
 * Диалог один на клиента — отдаём его вместе с лентой. Участие в чате здесь не
 * требуется: доступ к переписке определяется доступом к самой сделке.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const recordId = String(event.queryStringParameters?.recordId ?? '').trim();

  if (!recordId) {
    return new Response(JSON.stringify({ error: 'Нужен recordId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const thread = await threadOfDeal(recordId, context.workspaceMemberId);
    // Лента сделки: только сообщения, привязанные к ней, от всех контактов покупателя.
    const messages = await messagesOfDeal(thread.targetIds, thread.contacts);

    return new Response(JSON.stringify({ ...thread, messages }), {
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
  universalIdentifier: CHAT_CLIENT_THREAD_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-client-thread',
  description: 'Переписка с клиентом в карточке сделки',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-client-thread',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
