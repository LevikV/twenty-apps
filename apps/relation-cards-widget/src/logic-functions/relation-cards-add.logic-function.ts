import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { RELATION_CARDS_ADD_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { addLink, attachToCompany, createPerson } from 'src/shared/links';

type Body = {
  mode?: 'company' | 'person';
  recordId?: string;
  personId?: string;
  companyId?: string;
  newPerson?: { firstName?: string; lastName?: string; phone?: string };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Добавление контактного лица.
 *
 * Три сценария: связать существующего человека, создать нового человека и
 * сразу связать, закрепить контакт за компанией (обратный поиск).
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) return json({ error: 'Нужна авторизация' }, 401);

  let body: Body = {};

  try {
    body = (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) as Body;
  } catch {
    return json({ error: 'Некорректное тело запроса' }, 400);
  }

  try {
    if (body.companyId && body.personId) {
      const link = await attachToCompany({ companyId: body.companyId, personId: body.personId });

      return json({ link }, 201);
    }

    const mode = body.mode === 'company' ? 'company' : 'person';
    const recordId = String(body.recordId ?? '').trim();

    if (!recordId) return json({ error: 'Нужен recordId' }, 400);

    let personId = String(body.personId ?? '').trim();

    if (!personId && body.newPerson) {
      const firstName = String(body.newPerson.firstName ?? '').trim();
      const lastName = String(body.newPerson.lastName ?? '').trim();

      if (!firstName && !lastName) return json({ error: 'Нужно имя контакта' }, 400);

      const created = await createPerson({
        firstName,
        lastName,
        phone: String(body.newPerson.phone ?? '').trim(),
      });

      personId = String(created?.id ?? '');
    }

    if (!personId) return json({ error: 'Нужен personId' }, 400);

    const link = await addLink({ mode, recordId, personId });

    return json({ link, personId }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Ошибка добавления' }, 500);
  }
};

export default defineLogicFunction({
  universalIdentifier: RELATION_CARDS_ADD_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'relation-cards-add',
  description: 'Контактные лица: добавить связь или создать контакт',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/relation-cards-add',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
