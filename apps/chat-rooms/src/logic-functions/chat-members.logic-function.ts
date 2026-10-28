import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_MEMBERS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';

/** Сотрудники для выбора собеседника в новом личном диалоге. */
const handler = async (_event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const service = new ChatService();
    const members = (await service.membersForPicker()).filter(
      (member) => member.id !== context.workspaceMemberId,
    );

    return new Response(JSON.stringify({ members }), {
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
  universalIdentifier: 'efd489f7-4467-4937-af7a-b1d67314a5f6',
  name: 'chat-members',
  description: 'Сотрудники для нового личного диалога',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-members',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
