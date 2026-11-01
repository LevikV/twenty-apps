import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { SMS_CHANNEL_INFO_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { channelInfo } from 'src/shared/channels';

/** Данные для инструкции: адрес приватного сервера и токен подключения. */
const handler = async (_event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(channelInfo()), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export default defineLogicFunction({
  universalIdentifier: SMS_CHANNEL_INFO_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sms-channel-info',
  description: 'Адрес сервера шлюза и токен для подключения телефона',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/sms-channel-info',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
