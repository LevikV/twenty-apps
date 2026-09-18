import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, kv, type RoutePayload } from 'twenty-sdk/logic-function';

import { MEGAFON_WEBHOOK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { lookupClientByPhone, emptyLookup } from 'src/shared/megafon/crm-lookup';
import { lookupEmployeeByOurNumber, emptyEmployee } from 'src/shared/megafon/employee-lookup';
import { parseMegafonPayload } from 'src/shared/megafon/parse';
import { describeError } from 'src/shared/crm';

/**
 * Приёмник вебхуков ВАТС МегаФон.
 *
 * Этап 1.1: разбор и маппинг. Приложение принимает боевой вебхук, разбирает его
 * в структуру карточки звонка и может показать результат в режиме сухого прогона
 * (`dry_run=1`) — без единой записи в CRM. Бизнес-логика (поиск клиента, компании,
 * сотрудника, создание звонка) появится следующими подшагами.
 *
 * Наблюдение: console.log из логик-функции не виден в docker logs, поэтому
 * результаты пишем в kv-хранилище приложения — читается SQL-ом.
 */
const handler = async (event: RoutePayload) => {
  const body = (event?.body ?? {}) as Record<string, unknown>;
  const parsed = parseMegafonPayload(body);
  const receivedAt = new Date().toISOString();

  const snapshot = {
    receivedAt,
    parsed,
    contentType: event?.headers?.['content-type'] ?? null,
    userAgent: event?.headers?.['user-agent'] ?? null,
    body,
    rawBody: event?.rawBody ?? null,
  };

  await kv.set('webhook:last', snapshot);
  await kv.set(`webhook:last:${parsed.command}`, snapshot);

  // Сухой прогон: показываем, как разобран хук и кого нашли в CRM, ничего не записывая.
  // Нужен для прогона сохранённых боевых тел (fixtures) через маршрут.
  if (String(body.dry_run ?? '') === '1') {
    let lookup = emptyLookup();
    let employee = emptyEmployee();
    let lookupError = '';

    try {
      lookup = await lookupClientByPhone(parsed.clientPhone);
    } catch (error) {
      lookupError = describeError(error);
    }

    try {
      employee = await lookupEmployeeByOurNumber(parsed.ourNumber);
    } catch (error) {
      lookupError = [lookupError, describeError(error)].filter(Boolean).join(' | ');
    }

    await kv.set('webhook:dry-run', { receivedAt, parsed, lookup, employee, lookupError });

    return new Response(
      JSON.stringify({
        source: 'megafon-telephony',
        dryRun: true,
        parsed,
        lookup,
        employee,
        lookupError,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }

  const answer = { source: 'megafon-telephony', cmd: parsed.command, ok: true, stored: true };

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
