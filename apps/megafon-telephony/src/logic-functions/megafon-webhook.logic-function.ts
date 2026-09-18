import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, kv, type RoutePayload } from 'twenty-sdk/logic-function';

import { MEGAFON_WEBHOOK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { createOne, describeError } from 'src/shared/crm';

/**
 * Приёмник вебхуков ВАТС МегаФон (этап 0 — разведка).
 *
 * Задача этого шага: доказать, что приложение принимает боевой вебхук целиком
 * (urlencoded приходит распарсенным объектом), сохраняет его для разбора, может
 * вернуть свой HTTP-ответ и может писать записи в CRM.
 *
 * Бизнес-логика звонка (поиск клиента и компании, сотрудник, связи, лента)
 * появится на следующем этапе.
 *
 * Наблюдение: console.log из логик-функции не виден в docker logs, поэтому
 * результаты пишем в kv-хранилище приложения — читается SQL-ом.
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

  // Пробная запись в CRM (только разведка, включается явным флагом test_write=1
  // и тестовым callid). Нужна, чтобы проверить: REST из логик-функции создаёт
  // событие календаря и запись звонка, несмотря на стоп-лист автоматизации.
  if (String(body.test_write ?? '') === '1' && callid.startsWith('KPTEST')) {
    const startedAt = new Date().toISOString();
    const title = `📞 Тест приложения: ${String(body.phone ?? callid)}`;

    let probe: Record<string, unknown>;

    try {
      const calendarEvent = await createOne('calendarEvents', 'calendarEvent', {
        title,
        startsAt: startedAt,
        endsAt: startedAt,
        isFullDay: false,
        description: 'Пробная запись из приложения «Телефония МегаФон» (разведка)',
      });

      const callRecording = await createOne('callRecordings', 'callRecording', {
        title,
        status: 'NOT_RECORDED',
        startedAt,
        endedAt: startedAt,
        calendarEventId: calendarEvent.id,
        externalRecordingId: callid,
      });

      probe = {
        ok: true,
        command: cmd,
        callid,
        calendarEventId: calendarEvent.id,
        callRecordingId: callRecording.id,
      };
    } catch (error) {
      probe = {
        ok: false,
        command: cmd,
        callid,
        error: describeError(error),
      };
    }

    await kv.set('webhook:probe', { at: new Date().toISOString(), ...probe });

    return new Response(JSON.stringify({ source: 'megafon-telephony', ...probe }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Хук contact — единственный, где ВАТС ждёт ответ от CRM (имя клиента + ответственный).
  // Пока возвращаем технический ответ: проверяем, что наш HTTP-ответ вообще доходит.
  const answer = { source: 'megafon-telephony', cmd, ok: true, stored: true };

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
