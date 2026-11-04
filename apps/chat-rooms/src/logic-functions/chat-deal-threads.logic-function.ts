import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { CHAT_DEAL_THREADS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { describeError } from 'src/shared/chat-service';
import { dealThreads } from 'src/shared/deal-threads';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Список переписок в разрезе сделок — для режима «По сделкам». */
const handler = async (_event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) return json({ error: 'Нужна авторизация' }, 401);

  try {
    const threads = await dealThreads(
      new RestApiClient({ runAs: 'application' }),
      context.workspaceMemberId,
    );

    return json({ threads });
  } catch (error) {
    return json({ error: describeError(error) }, 400);
  }
};

export default defineLogicFunction({
  universalIdentifier: CHAT_DEAL_THREADS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-deal-threads',
  description: 'Переписки в разрезе сделок',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-deal-threads',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
