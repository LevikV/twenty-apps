import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { RELATION_CARDS_DATA_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { loadRelations } from 'src/shared/links';

/**
 * Данные карточки «Контактные лица» для записи.
 *
 * Выполняется от имени приложения: роль пользователя может не иметь доступа к
 * служебному объекту связей, а видеть контактные лица клиента должна.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const recordId = String(event.queryStringParameters?.recordId ?? '').trim();

  if (!recordId) {
    return new Response(JSON.stringify({ error: 'Нужен recordId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const data = await loadRelations(recordId);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Ошибка загрузки' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: RELATION_CARDS_DATA_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'relation-cards-data',
  description: 'Контактные лица записи: связи, лица и владельцы',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/relation-cards-data',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
