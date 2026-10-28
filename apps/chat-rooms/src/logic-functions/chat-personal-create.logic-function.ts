import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_PERSONAL_CREATE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';

/**
 * Новый личный диалог.
 *
 * Если чат этих двоих уже есть — возвращаем его (второй раз не создаём).
 * Автор — ведущий, собеседник — участник.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = (event.body ?? {}) as { memberId?: string };
  const otherMemberId = String(body.memberId ?? '').trim();

  if (!otherMemberId) {
    return new Response(JSON.stringify({ error: 'Не выбран собеседник' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const result = await new ChatService().createPersonal(context.workspaceMemberId, otherMemberId);

    return new Response(JSON.stringify(result), {
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
  universalIdentifier: '1071fa3d-48ba-425d-95da-3947f58d17ef',
  name: 'chat-personal-create',
  description: 'Создать личный диалог с сотрудником (или открыть существующий)',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-personal-create',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
