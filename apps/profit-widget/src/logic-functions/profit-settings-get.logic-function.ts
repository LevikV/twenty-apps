import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { PROFIT_SETTINGS_GET_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { readProfitSettings } from 'src/shared/profit-settings';

/**
 * Чтение настроек профита.
 *
 * Вызывается экраном настроек приложения (показать ставки) и виджетом
 * профита (понять, по каким процентам считать).
 *
 * Маршрут закрыт требованием авторизации. Отличить администратора от
 * сотрудника нельзя (у приложения нет права на роли) — это осознанный
 * компромисс, тот же, что в приложении «Телефония».
 */
const handler = async (_event: RoutePayload) => {
  const settings = await readProfitSettings();

  return new Response(JSON.stringify({ settings }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export default defineLogicFunction({
  universalIdentifier: PROFIT_SETTINGS_GET_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'profit-settings-get',
  description: 'Настройки профита: чтение',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/profit-settings',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
