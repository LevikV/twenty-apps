import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { SMS_CHANNEL_CONNECT_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { connectChannel } from 'src/shared/channels';
import { describeError } from 'src/shared/crm';

/**
 * Подключение телефона сотрудником.
 *
 * Логин и пароль устройства выдаёт приложение шлюза при регистрации. Проверяем
 * их на сервере шлюза и только потом заводим запись — чтобы в «Моих каналах»
 * не появлялись нерабочие каналы.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = (event.body ?? {}) as { login?: string; parol?: string; nomer?: string };
  const login = String(body.login ?? '').trim();
  const parol = String(body.parol ?? '').trim();
  const nomer = String(body.nomer ?? '').trim();

  try {
    const result = await connectChannel(context.workspaceMemberId, login, parol, nomer);

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: describeError(error) }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export default defineLogicFunction({
  universalIdentifier: SMS_CHANNEL_CONNECT_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sms-channel-connect',
  description: 'Подключение телефона: проверка устройства и запись шлюза',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/sms-channel-connect',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
