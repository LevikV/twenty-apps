import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { RECORD_RULES_SAVE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { writeRecordRules } from 'src/shared/record-rules-store';

/**
 * Сохранение правил (экран настроек приложения).
 *
 * Тело: { settings: { rules: [...] } }. Значения прогоняются через
 * нормализацию: типы полей, допустимое действие, обрезка строк, лимиты.
 * Ответ отдаёт уже сохранённый (нормализованный) вариант — экран берёт
 * его как эталон для сравнения «есть ли изменения».
 */
const handler = async (event: RoutePayload) => {
  const body = (event?.body ?? {}) as { settings?: unknown };
  const settings = await writeRecordRules(body.settings as never);

  return new Response(JSON.stringify({ saved: true, settings }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export default defineLogicFunction({
  universalIdentifier: RECORD_RULES_SAVE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'record-rules-save',
  description: 'Правила записи: сохранение',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/record-rules-save',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: ['content-type'],
  },
});
