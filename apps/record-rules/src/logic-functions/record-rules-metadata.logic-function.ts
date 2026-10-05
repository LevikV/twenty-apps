import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { RECORD_RULES_METADATA_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { fetchSelectableObjects } from 'src/shared/record-rules-metadata';

/**
 * Метаданные для экрана настроек: объекты и их поля-списки с опциями.
 *
 * Живёт на серверной стороне, потому что обращается к metadata API
 * с токеном приложения. Экран получает готовый список и рисует пикеры
 * объектов/полей и галочки значений.
 */
const handler = async (_event: RoutePayload) => {
  const objects = await fetchSelectableObjects();

  return new Response(JSON.stringify({ objects }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export default defineLogicFunction({
  universalIdentifier: RECORD_RULES_METADATA_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'record-rules-metadata',
  description: 'Правила записи: объекты и поля с опциями для экрана настроек',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/record-rules-metadata',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
