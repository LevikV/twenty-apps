import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { CALL_JOURNAL_ACCESS_GET_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { readAccessRules } from 'src/shared/megafon/call-journal-access';

/**
 * Чтение правил доступа к журналу звонков.
 *
 * Вызывается экраном настроек приложения (показать правила) и страницей
 * «Звонки» (понять, кого сотруднику разрешено смотреть).
 *
 * Правила не секретны: это «кто чьи звонки видит». Запись защищена
 * требованием авторизации.
 */
const handler = async (_event: RoutePayload) => {
  const rules = await readAccessRules();

  return new Response(JSON.stringify({ rules }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export default defineLogicFunction({
  universalIdentifier: CALL_JOURNAL_ACCESS_GET_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'call-journal-access-get',
  description: 'Правила доступа к журналу звонков: чтение',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/call-journal-access',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
