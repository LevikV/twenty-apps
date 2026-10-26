import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_OPEN_TARGET_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';

/**
 * Диалог, который надо открыть по переходу из уведомления.
 *
 * Адрес страницы до компонента не доходит (он работает в блоб-iframe), поэтому
 * цель определяет сервер: смотрит мои непрочитанные уведомления со ссылкой на
 * страницу чата и отдаёт id диалога из самого свежего.
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
    const result = await service.openTarget(context.workspaceMemberId);

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
  universalIdentifier: CHAT_OPEN_TARGET_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-open-target',
  description: 'Диалог для открытия по уведомлению',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-open-target',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
