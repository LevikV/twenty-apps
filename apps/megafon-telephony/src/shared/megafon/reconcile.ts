import { emptyLookup, lookupClientByPhone, type ClientLookup } from 'src/shared/megafon/crm-lookup';
import { emptyEmployee, lookupEmployeeByOurNumber } from 'src/shared/megafon/employee-lookup';
import { normalizePhone, parseVatsDate } from 'src/shared/megafon/parse';
import { ensureQueueTask } from 'src/shared/megafon/queue';
import { registerCall } from 'src/shared/megafon/register-call';
import type { CallDirection, CallOutcome, ParsedCall } from 'src/shared/megafon/types';

/**
 * Сверка с ВАТС: история МегаФона ↔ карточки звонков в Twenty.
 *
 * Быстрый проход — today + yesterday (двое суток, как отдаёт API). Что не найдено
 * в Twenty, досоздаём по тем же правилам, что и вебхук (`registerCall`), и ставим
 * задачу в очередь расшифровки.
 *
 * ВАЖНО: список uid из Twenty берём одним запросом на период, а не по одному на
 * звонок — иначе упираемся в лимит REST (100 запросов/мин).
 */

const VATS_BASE = 'https://kartridzh-pljus.megapbx.ru/crmapi/v1';

export type VatsHistoryCall = {
  uid?: string;
  type?: string;
  status?: string;
  client?: string;
  user?: string;
  diversion?: string;
  start?: string;
  wait?: string | number;
  duration?: string | number;
  record?: string;
};

export type ReconcileReport = {
  periods: string[];
  historyCalls: number;
  withRecord: number;
  missingInCrm: string[];
  created: string[];
  queued: number;
  errors: string[];
};

export const fetchHistory = async (period: string, token: string): Promise<VatsHistoryCall[]> => {
  const response = await fetch(`${VATS_BASE}/history/json?period=${period}&type=all&limit=1000`, {
    headers: { 'X-API-KEY': token },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`история ВАТС (${period}): HTTP ${response.status}`);
  }

  const body = (await response.json()) as VatsHistoryCall[];

  return Array.isArray(body) ? body : [];
};

const resolveOutcome = (status: string | undefined): CallOutcome => {
  switch (String(status ?? '').trim().toLowerCase()) {
    case 'success':
    case 'answered':
      return 'ANSWERED';
    case 'missed':
      return 'MISSED';
    case 'busy':
    case 'noanswer':
    case 'notavailable':
      return 'NOANSWER';
    default:
      return '';
  }
};

/** История ВАТС → тот же разобранный вид, что даёт вебхук `history`. */
export const toParsedCall = (call: VatsHistoryCall): ParsedCall => {
  const direction: CallDirection = String(call.type ?? '').toLowerCase() === 'in' ? 'INCOMING' : 'OUTGOING';
  const startedAtIso = parseVatsDate(call.start);
  const durationSeconds = Number.parseInt(String(call.duration ?? '0'), 10) || 0;

  return {
    command: 'history',
    stage: 'FINISHED',
    callid: String(call.uid ?? ''),
    direction,
    outcome: resolveOutcome(call.status),
    recordingStatus: String(call.record ?? '').trim() ? 'PROCESSING' : 'NOT_RECORDED',
    clientPhone: normalizePhone(call.client),
    clientPhoneRaw: String(call.client ?? ''),
    ourNumber: normalizePhone(call.diversion),
    extension: String(call.user ?? ''),
    user: String(call.user ?? ''),
    startedAtIso,
    endedAtIso: startedAtIso
      ? new Date(Date.parse(startedAtIso) + durationSeconds * 1000).toISOString()
      : '',
    durationSeconds,
    waitSeconds: Number.parseInt(String(call.wait ?? '0'), 10) || 0,
    recordingUrl: String(call.record ?? ''),
  };
};

/** Досоздать пропущенный звонок и поставить его в очередь расшифровки. */
export const restoreCall = async (parsed: ParsedCall): Promise<{ created: boolean; queued: string }> => {
  let lookup: ClientLookup = emptyLookup();
  let employee = emptyEmployee();

  try {
    lookup = await lookupClientByPhone(parsed.clientPhone);
  } catch {
    // без клиента звонок всё равно заводим
  }

  try {
    employee = await lookupEmployeeByOurNumber(parsed.ourNumber);
  } catch {
    // без сотрудника тоже
  }

  const result = await registerCall(parsed, lookup, employee);
  const queued =
    parsed.recordingStatus === 'PROCESSING'
      ? await ensureQueueTask({
          uid: parsed.callid,
          direction: parsed.direction === 'INCOMING' ? 'in' : 'out',
          startedAt: parsed.startedAtIso,
        })
      : 'skipped';

  return { created: result.action === 'created', queued };
};
