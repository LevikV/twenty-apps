import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, kv, type RoutePayload } from 'twenty-sdk/logic-function';

import { MEGAFON_WEBHOOK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Приёмник вебхуков ВАТС МегаФон (этап 0 — разведка).
 *
 * Задача этого шага: доказать, что приложение принимает боевой вебхук целиком
 * (urlencoded приходит распарсенным объектом), сохраняет его для разбора и может
 * вернуть свой HTTP-ответ. Бизнес-логика (создание звонка в CRM) появится на следующем этапе.
 *
 * Наблюдение: console.log из логик-функции не виден в docker logs, поэтому
 * последний payload пишем в kv-хранилище приложения — читается SQL-ом.
 */
const handler = async (event: RoutePayload) => {
  const body = (event?.body ?? {}) as Record<string, unknown>;
  const cmd = String(body.cmd ?? '');
  const callid = String(body.callid ?? '');

  const snapshot = {
    receivedAt: new Date().toISOString(),
    cmd,
    callid,
    type: String(body.type ?? ''),
    status: String(body.status ?? ''),
    phone: String(body.phone ?? ''),
    user: String(body.user ?? ''),
    ext: String(body.ext ?? ''),
    duration: String(body.duration ?? ''),
    keys: Object.keys(body),
    contentType: event?.headers?.['content-type'] ?? null,
    userAgent: event?.headers?.['user-agent'] ?? null,
    http: event?.requestContext?.http ?? null,
    body,
    rawBody: event?.rawBody ?? null,
  };

  await kv.set('webhook:last', snapshot);
  await kv.set(`webhook:last:${cmd || 'unknown'}`, snapshot);
  await kv.set('webhook:counters', {
    updatedAt: snapshot.receivedAt,
    lastCmd: cmd,
  });

  // Хук contact — единственный, где ВАТС ждёт ответ от CRM (имя клиента + ответственный).
  // Пока возвращаем технический ответ: проверяем, что наш HTTP-ответ вообще доходит.
  const answer =
    cmd === 'contact'
      ? { source: 'megafon-telephony', cmd, ok: true }
      : { source: 'megafon-telephony', cmd, ok: true, stored: true };

  return new Response(JSON.stringify(answer), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export default defineLogicFunction({
  universalIdentifier: MEGAFON_WEBHOOK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'megafon-webhook',
  description: 'Приём вебхуков ВАТС МегаФон (contact, event, history)',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/megafon',
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: ['content-type', 'user-agent'],
  },
});
