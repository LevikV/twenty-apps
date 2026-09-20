import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { CALL_JOURNAL_ACCESS_SAVE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { normalizeAccessRules } from 'src/shared/megafon/call-journal-access-rules';
import { writeAccessRules } from 'src/shared/megafon/call-journal-access';

/**
 * Сохранение правил доступа к журналу звонков (экран настроек приложения).
 *
 * Важно: маршрут закрыт требованием авторизации, но отличить администратора
 * от сотрудника на сервере нельзя — у приложения нет права на роли, а роль
 * вызывающего в логик-функции недоступна. Это осознанный компромисс: интерфейс
 * настройки виден только тем, у кого есть доступ к настройкам приложения.
 */
const handler = async (event: RoutePayload) => {
  const body = (event?.body ?? {}) as { rules?: unknown };
  const rules = normalizeAccessRules(body.rules);

  await writeAccessRules(rules);

  return new Response(JSON.stringify({ saved: true, rules }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export default defineLogicFunction({
  universalIdentifier: CALL_JOURNAL_ACCESS_SAVE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'call-journal-access-save',
  description: 'Правила доступа к журналу звонков: сохранение',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/call-journal-access-save',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: ['content-type'],
  },
});
