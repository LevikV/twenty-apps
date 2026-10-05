import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { RECORD_RULES_GET_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { readRecordRules } from 'src/shared/record-rules-store';

/**
 * Чтение правил проверки до записи.
 *
 * Вызывается экраном настроек приложения. Те же данные читает движок ядра
 * напрямую из kv — маршрут нужен только UI.
 */
const handler = async (_event: RoutePayload) => {
  const settings = await readRecordRules();

  return new Response(JSON.stringify({ settings }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export default defineLogicFunction({
  universalIdentifier: RECORD_RULES_GET_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'record-rules-get',
  description: 'Правила записи: чтение',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/record-rules',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
