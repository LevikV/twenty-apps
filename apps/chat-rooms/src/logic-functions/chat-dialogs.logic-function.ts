import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_DIALOGS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';

/**
 * Мои диалоги.
 *
 * Кто пришёл — берём из контекста выполнения (workspaceMemberId из токена),
 * а не из тела или параметров запроса: подделать нельзя.
 */
const handler = async (_event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const service = new ChatService();
    const result = await service.dialogs(context.workspaceMemberId);

    return new Response(JSON.stringify({ me: context.workspaceMemberId, ...result }), {
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
  universalIdentifier: CHAT_DIALOGS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-dialogs',
  description: 'Мои диалоги: список со счётчиками непрочитанного',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-dialogs',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
