import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { ChatService } from 'src/shared/chat-service';

/** Кто я: userId текущего сотрудника (нужен виджету для подписки на сокет). */
const handler = async (_event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const result = await new ChatService().me(context.workspaceMemberId);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export default defineLogicFunction({
  universalIdentifier: '5c32cf39-7be5-42b3-b4d7-9ac0ed634bad',
  name: 'chat-me',
  description: 'Идентификатор пользователя для подписки на события чата',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-me',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
