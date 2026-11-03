import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { SMS_CHANNELS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { myChannels } from 'src/shared/channels';
import { describeError } from 'src/shared/crm';

/** Мои каналы: шлюзы, подключённые этим сотрудником. */
const handler = async (_event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const channels = await myChannels(context.workspaceMemberId);

    return new Response(JSON.stringify({ me: context.workspaceMemberId, channels }), {
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
  universalIdentifier: SMS_CHANNELS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sms-channels',
  description: 'Мои каналы: подключённые телефоны сотрудника',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/sms-channels',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
