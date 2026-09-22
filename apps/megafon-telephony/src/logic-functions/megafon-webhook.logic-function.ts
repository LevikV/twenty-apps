import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, kv, type RoutePayload } from 'twenty-sdk/logic-function';

import { MEGAFON_WEBHOOK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { lookupClientByPhone, emptyLookup, type ClientLookup } from 'src/shared/megafon/crm-lookup';
import { findCallDeals, type DealRef } from 'src/shared/megafon/deal-lookup';
import { lookupEmployeeByOurNumber, emptyEmployee, type EmployeeLookup } from 'src/shared/megafon/employee-lookup';
import { parseMegafonPayload } from 'src/shared/megafon/parse';
import { isSharedNumber } from 'src/shared/megafon/shared-numbers';
import { registerCall, type RegisterResult } from 'src/shared/megafon/register-call';
import { ensureQueueTask, type QueueSeedResult } from 'src/shared/megafon/queue';
import { writeWebhookLog } from 'src/shared/megafon/webhook-log';
import { describeError } from 'src/shared/crm';

/**
 * Приёмник вебхуков ВАТС МегаФон.
 *
 * Этап 1.4: по каждому хуку находим клиента по номеру, сотрудника по нашему номеру
 * и ведём карточку звонка (запись звонка + событие календаря) строго по одному
 * экземпляру на `callid`. Режим `dry_run=1` показывает разбор и поиск, но ничего
 * не пишет в CRM — на нём гоняются сохранённые боевые тела.
 *
 * Наблюдение: console.log из логик-функции не виден в docker logs, поэтому
 * результаты пишем в kv-хранилище приложения — читается SQL-ом.
 */
const emptyString = (v: unknown) => String(v ?? '');

const handler = async (event: RoutePayload) => {
  const body = (event?.body ?? {}) as Record<string, unknown>;
  const parsed = parseMegafonPayload(body);
  const receivedAt = new Date().toISOString();
  const errors: string[] = [];

  let lookup: ClientLookup = emptyLookup();
  let employee: EmployeeLookup = emptyEmployee();
  let deals: DealRef[] = [];

  // Звонок на общий (групповой) номер компании — например отдел продаж.
  // Признаки: номер `diversion` (на который пришёл звонок) или номер ответившего
  // есть в настройке `SHARED_PHONE_NUMBERS`, либо ВАТС прислала группу (`group`).
  // На таком звонке ВАТС шлёт событие каждому, кому звонило.
  const sharedNumber =
    isSharedNumber(parsed.diversion) || isSharedNumber(parsed.ourNumber) || Boolean(parsed.group);

  try {
    lookup = await lookupClientByPhone(parsed.clientPhone);
  } catch (error) {
    errors.push(`клиент: ${describeError(error)}`);
  }

  try {
    employee = await lookupEmployeeByOurNumber(parsed.ourNumber);
  } catch (error) {
    errors.push(`сотрудник: ${describeError(error)}`);
  }

  // Цели события — только сделки клиента «в работе»: сначала у контакта,
  // иначе у его компании (если компания не определилась — цели не будет).
  try {
    deals = await findCallDeals({ personId: lookup.personId, companyId: lookup.companyId });
  } catch (error) {
    errors.push(`сделки: ${describeError(error)}`);
  }

  // Сухой прогон: показываем разбор и результаты поиска, в CRM ничего не пишем.
  if (emptyString(body.dry_run) === '1') {
    await kv.set('webhook:dry-run', { receivedAt, parsed, lookup, employee, deals, sharedNumber, errors });

    return new Response(
      JSON.stringify({
        source: 'megafon-telephony',
        dryRun: true,
        parsed,
        lookup,
        employee,
        deals,
        sharedNumber,
        lookupError: errors.join(' | '),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }

  let result: RegisterResult | undefined;
  let logId = '';
  let queued: QueueSeedResult | '' = '';

  try {
    result = await registerCall(parsed, lookup, employee, deals);
  } catch (error) {
    errors.push(`звонок: ${describeError(error)}`);
  }

  // Итог звонка со ссылкой на запись — ставим задачу в очередь расшифровки.
  // Конвейер (cron) сам скачает mp3, зальёт его в карточку и расшифрует.
  if (parsed.command === 'history' && parsed.recordingStatus === 'PROCESSING') {
    queued = await ensureQueueTask({
      uid: parsed.callid,
      direction: parsed.direction === 'INCOMING' ? 'in' : 'out',
      startedAt: parsed.startedAtIso,
    });

    if (queued === 'failed') {
      errors.push('очередь: не удалось поставить задачу расшифровки');
    }
  }

  // Диагностика (решение 1.0): пишем и в kv приложения, и в «Журнал вебхуков»,
  // чтобы поток хуков был виден в интерфейсе CRM.
  try {
    logId = await writeWebhookLog({
      parsed,
      lookup,
      employee,
      title: result?.title ?? '',
      rawBody: body,
      receivedAt,
    });
  } catch (error) {
    errors.push(`журнал: ${describeError(error)}`);
  }

  const answer = {
    source: 'megafon-telephony',
    cmd: parsed.command,
    ok: errors.length === 0,
    action: result?.action ?? 'none',
    callId: result?.callId ?? '',
    title: result?.title ?? '',
    deals: deals.map((deal) => `${deal.kind}:${deal.name}`),
    sharedNumber,
    queued,
    logId,
    links: result?.links,
    errors,
  };

  await kv.set('webhook:last', { receivedAt, parsed, lookup, employee, deals, sharedNumber, answer, body });

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
