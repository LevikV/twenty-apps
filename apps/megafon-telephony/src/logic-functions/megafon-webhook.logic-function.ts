import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, kv, type RoutePayload } from 'twenty-sdk/logic-function';

import { MEGAFON_WEBHOOK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { lookupClientByPhone, emptyLookup, type ClientLookup } from 'src/shared/megafon/crm-lookup';
import { lookupEmployeeByOurNumber, emptyEmployee, type EmployeeLookup } from 'src/shared/megafon/employee-lookup';
import { parseMegafonPayload } from 'src/shared/megafon/parse';
import { registerCall, type RegisterResult } from 'src/shared/megafon/register-call';
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

  // Сухой прогон: показываем разбор и результаты поиска, в CRM ничего не пишем.
  if (emptyString(body.dry_run) === '1') {
    await kv.set('webhook:dry-run', { receivedAt, parsed, lookup, employee, errors });

    return new Response(
      JSON.stringify({
        source: 'megafon-telephony',
        dryRun: true,
        parsed,
        lookup,
        employee,
        lookupError: errors.join(' | '),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }

  let result: RegisterResult | undefined;

  try {
    result = await registerCall(parsed, lookup, employee);
  } catch (error) {
    errors.push(`звонок: ${describeError(error)}`);
  }

  const answer = {
    source: 'megafon-telephony',
    cmd: parsed.command,
    ok: errors.length === 0,
    action: result?.action ?? 'none',
    callId: result?.callId ?? '',
    title: result?.title ?? '',
    errors,
  };

  await kv.set('webhook:last', { receivedAt, parsed, lookup, employee, answer, body });

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
