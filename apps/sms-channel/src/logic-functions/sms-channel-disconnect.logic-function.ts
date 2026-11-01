import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { SMS_CHANNEL_DISCONNECT_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { disconnectChannel } from 'src/shared/channels';

/**
 * Отключение канала сотрудником.
 *
 * Телефон отзывается на сервере шлюза, учётные данные стираются. История
 * переписки остаётся: диалоги связаны с записью шлюза, которую мы не удаляем.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = (event.body ?? {}) as { gatewayId?: string };
  const gatewayId = String(body.gatewayId ?? '').trim();

  if (!gatewayId) {
    return new Response(JSON.stringify({ error: 'Нужен gatewayId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const result = await disconnectChannel(context.workspaceMemberId, gatewayId);

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: String(error).slice(0, 200) }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: SMS_CHANNEL_DISCONNECT_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sms-channel-disconnect',
  description: 'Отключение SMS-канала сотрудника',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/sms-channel-disconnect',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
