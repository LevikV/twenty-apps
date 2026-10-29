import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { CREATE_CLIENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { createClient, type CreateClientInput } from 'src/shared/create-client';

/**
 * Создание контакта или компании из звонка.
 *
 * Маршрут зовёт боковая панель звонка (`megafon-telephony`):
 * `POST /s/create-client` с телом
 * `{ kind, phone, name, pravovayaForma, tipOtnosheniy, address, comment, link }`.
 *
 * Создаёт карточку от имени приложения и связь «Контакт клиента». Задачи в очередь
 * обмена ставит не маршрут, а события базы (`person.created`, `kontaktKlienta.created`).
 * При повторе по тому же номеру карточку не дублирует — возвращает существующую.
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

  const input: CreateClientInput = {
    kind: String(body.kind ?? '').trim() as CreateClientInput['kind'],
    phone: String(body.phone ?? ''),
    name: String(body.name ?? ''),
    pravovayaForma: body.pravovayaForma
      ? String(body.pravovayaForma)
      : undefined,
    tipOtnosheniy: Array.isArray(body.tipOtnosheniy)
      ? (body.tipOtnosheniy as unknown[]).map(String)
      : undefined,
    address: body.address ? String(body.address) : undefined,
    comment: body.comment ? String(body.comment) : undefined,
    link:
      body.link && typeof body.link === 'object'
        ? {
            kind: String((body.link as Record<string, unknown>).kind ?? '') as
              | 'company'
              | 'person',
            id: String((body.link as Record<string, unknown>).id ?? ''),
          }
        : null,
    createdBy: body.createdBy ? String(body.createdBy) : undefined,
  };

  if (input.kind !== 'contact' && input.kind !== 'company') {
    return json({ ok: false, error: 'kind: contact или company' }, 400);
  }

  try {
    const result = await createClient(input);

    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: describeError(error) }, 400);
  }
};

export default defineLogicFunction({
  universalIdentifier: CREATE_CLIENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'create-client',
  description:
    'Создание контакта или компании из звонка: карточка и связь',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/create-client',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: ['content-type'],
  },
});
