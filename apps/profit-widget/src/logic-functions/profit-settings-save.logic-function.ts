import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { PROFIT_SETTINGS_SAVE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { normalizeProfitSettings } from 'src/shared/profit-rules';
import { writeProfitSettings } from 'src/shared/profit-settings';

/**
 * Сохранение настроек профита (экран настроек приложения).
 *
 * Тело запроса: { settings: { rates: { <workspaceMemberId>: {...} } } }.
 * Значения прогоняются через нормализацию: проценты 0..100, ставка —
 * неотрицательное число, «видит всё» — строгий boolean.
 */
const handler = async (event: RoutePayload) => {
  const body = (event?.body ?? {}) as { settings?: unknown };
  const settings = normalizeProfitSettings(body.settings);

  await writeProfitSettings(settings);

  return new Response(JSON.stringify({ saved: true, settings }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export default defineLogicFunction({
  universalIdentifier: PROFIT_SETTINGS_SAVE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'profit-settings-save',
  description: 'Настройки профита: сохранение',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/profit-settings-save',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: ['content-type'],
  },
});
