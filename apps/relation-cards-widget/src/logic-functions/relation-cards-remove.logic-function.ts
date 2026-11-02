import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { RELATION_CARDS_REMOVE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { removeLink } from 'src/shared/links';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Удаление связи «клиент ↔ контактное лицо» (от имени приложения). */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) return json({ error: 'Нужна авторизация' }, 401);

  let body: { linkId?: string } = {};

  try {
    body = (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) as {
      linkId?: string;
    };
  } catch {
    return json({ error: 'Некорректное тело запроса' }, 400);
  }

  const linkId = String(body.linkId ?? '').trim();

  if (!linkId) return json({ error: 'Нужен linkId' }, 400);

  try {
    await removeLink(linkId);

    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Ошибка удаления' }, 500);
  }
};

export default defineLogicFunction({
  universalIdentifier: RELATION_CARDS_REMOVE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'relation-cards-remove',
  description: 'Контактные лица: убрать связь',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/relation-cards-remove',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
