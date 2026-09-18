import { RestApiClient } from 'twenty-client-sdk/rest';

import type { ClientLookup } from 'src/shared/megafon/crm-lookup';
import type { EmployeeLookup } from 'src/shared/megafon/employee-lookup';
import type { ParsedCall } from 'src/shared/megafon/types';

/**
 * «Журнал вебхуков» (объект `webhookLog`) — тот же журнал, куда писал прежний
 * воркфлоу. Формат записи повторяем поле в поле, чтобы ничего не сломать:
 *
 * - `dannye` — сырое тело хука, `syroeTelo` — результат разбора (названия
 *   перепутаны исторически, решение Алексея от 18.09 — оставить как есть);
 * - `polucenoV` воркфлоу не заполнял, здесь заполняем моментом получения;
 * - `klyuchCrm` пишем как есть (решение 18.09 — убрать позже, задача в «Отложено»).
 */

const client = new RestApiClient();

/** Источник записи — по нему в журнале видно, кто обработал хук. */
export const WEBHOOK_LOG_SOURCE = 'МегаФон ВАТС (приложение)';

const str = (value: unknown): string => String(value ?? '').trim();

/** Пустые поля не отправляем — иначе REST ругается на пустые DATE_TIME. */
const compact = (body: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(body).filter(([, value]) => value !== '' && value !== undefined));

export const writeWebhookLog = async (params: {
  parsed: ParsedCall;
  lookup: ClientLookup;
  employee: EmployeeLookup;
  title: string;
  rawBody: Record<string, unknown>;
  receivedAt: string;
}): Promise<string> => {
  const { parsed, lookup, employee, title, rawBody, receivedAt } = params;

  const syroeTelo = {
    personFound: Boolean(lookup.personId),
    companyFound: Boolean(lookup.companyId),
    employeeFound: Boolean(employee.employeeId),
    employeeSource: employee.source,
    klient: parsed.clientPhone,
    companyId: lookup.companyId,
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    title,
    itog: parsed.outcome,
    napravlenie: parsed.direction,
    statusZapisi: parsed.recordingStatus,
    iso: parsed.startedAtIso,
    isoEnd: parsed.endedAtIso,
  };

  const body = compact({
    cmd: parsed.command,
    istochnik: WEBHOOK_LOG_SOURCE,
    metod: 'POST',
    klyuchCrm: str(rawBody.crm_token),
    nashNomer: str(rawBody.telnum),
    ext: parsed.extension,
    klient: parsed.clientPhone,
    sotrudnik: employee.employeeName,
    statusZvonka: parsed.outcome,
    startZvonka: parsed.startedAtIso,
    dlitelnost: parsed.durationSeconds ? String(parsed.durationSeconds) : '',
    ozhidanie: parsed.waitSeconds ? String(parsed.waitSeconds) : '',
    pereadresaciya: str(rawBody.diversion),
    ssylkaNaZapis: parsed.recordingUrl,
    polucenoV: receivedAt,
    dannye: JSON.stringify(rawBody),
    syroeTelo: JSON.stringify(syroeTelo),
  });

  const response = (await client.post<unknown>('/rest/webhookLogs', body)) as {
    data?: Record<string, { id?: string }>;
  };

  const created = Object.values(response?.data ?? {}).find(
    (value) => value && typeof value === 'object' && 'id' in value,
  );

  return String(created?.id ?? '');
};
