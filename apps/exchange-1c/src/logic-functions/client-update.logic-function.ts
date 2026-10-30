import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { CLIENT_UPDATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { queueClientUpdate } from 'src/shared/create-out';

/**
 * Обновление карточки клиента по требованию другого приложения.
 *
 * Зовёт боковая панель звонка (`megafon-telephony`) после того, как при привязке
 * звонка дописала номер в карточку: `POST /s/client-update` с телом
 * `{ kind: 'person' | 'company', id, fields: ['phones'] | ['telefony'] }`.
 *
 * Нужен потому, что запись сделана от приложения (`source = API`) и анти-эхо её
 * пропускает — без этого маршрута дописанный номер остался бы только в CRM.
 */

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const handler = async (event?: RoutePayload | Record<string, unknown>) => {
  const raw = event as RoutePayload | undefined;
  let body = (raw?.body ?? event ?? {}) as Record<string, unknown> | string;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return json({ ok: false, error: 'Тело запроса не разобрано' }, 400);
    }
  }

  const kind = String(body.kind ?? '').trim();
  const id = String(body.id ?? '').trim();
  const fields = Array.isArray(body.fields)
    ? (body.fields as unknown[]).map(String)
    : [];

  if (kind !== 'person' && kind !== 'company') {
    return json({ ok: false, error: 'kind: person или company' }, 400);
  }

  if (!id) {
    return json({ ok: false, error: 'Не указан id карточки' }, 400);
  }

  try {
    const result = await queueClientUpdate(kind, id, fields);

    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: describeError(error) }, 400);
  }
};

export default defineLogicFunction({
  universalIdentifier: CLIENT_UPDATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'client-update',
  description: 'Дописанный номер звонка → задача UPDATE в 1С',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/client-update',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: ['content-type'],
  },
});
