import { defineLogicFunction } from 'twenty-sdk/define';
import { kv } from 'twenty-sdk/logic-function';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { HISTORY_BACKFILL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { describeError } from 'src/shared/crm';
import {
  emptyLookup,
  lookupClientByPhone,
  type ClientLookup,
} from 'src/shared/megafon/crm-lookup';
import {
  emptyEmployee,
  lookupEmployeeByOurNumber,
  type EmployeeLookup,
} from 'src/shared/megafon/employee-lookup';
import { ensureCallLinks } from 'src/shared/megafon/link-call';

/**
 * Приведение истории звонков к формату приложения.
 *
 * Прежний воркфлоу создавал карточки звонков, но почти не ставил связи: контакт,
 * компания и запись в ленте компании у исторических звонков отсутствуют. Здесь
 * досоздаём их по тем же правилам, что и приём вебхуков (см. `crm-lookup.ts`).
 *
 * Работает по расписанию, порциями, идемпотентно: курсор хранится в kv-хранилище
 * приложения, каждый звонок обрабатывается один раз. Режим переключается
 * константой `MODE`: `dry` — только считаем, `live` — досоздаём связи.
 */

const CONFIG: { mode: 'dry' | 'live' } = { mode: 'live' };

/** Размер порции: в сухом режиме только чтение, в боевом — с записью в CRM. */
const PORTION = CONFIG.mode === 'live' ? 8 : 20;
const PAUSE_MS = 400;
const STATE_KEY = 'history:state';

const client = new RestApiClient();

type CallRow = {
  id: string;
  title?: string | null;
  calendarEventId?: string | null;
  externalRecordingId?: string | null;
  createdAt?: string | null;
};

type LogRow = {
  klient?: string | null;
  nashNomer?: string | null;
  dannye?: unknown;
};

type State = {
  mode: string;
  cursor: string;
  processed: number;
  stats: Record<string, number>;
  errors: string[];
  updatedAt: string;
};

/** 10 последних цифр номера — в CRM телефоны сравниваются в этом виде. */
const digits10 = (value: unknown): string => {
  const digits = String(value ?? '').replace(/\D/g, '');

  return digits.length >= 10 ? digits.slice(-10) : '';
};

const rowsOf = <T>(response: unknown, key: string): T[] => {
  const data = (response as { data?: Record<string, unknown> })?.data;
  const value = data?.[key];

  return Array.isArray(value) ? (value as T[]) : [];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Следующая порция звонков.
 *
 * Сортировка REST-выдачи стабильна только по `id`, поэтому идём по возрастанию
 * `id` фильтром `id > курсор` — так ни одна запись не теряется, а размер порции
 * совпадает с размером ответа.
 */
const readCalls = async (cursor: string): Promise<CallRow[]> => {
  const response = await client.get<unknown>('/rest/callRecordings', {
    query: {
      filter: cursor ? `id[gt]:"${cursor}"` : undefined,
      limit: PORTION,
    },
  });

  return rowsOf<CallRow>(response, 'callRecordings').filter((call) =>
    Boolean(call?.id),
  );
};

/** Телефон клиента и наш номер — из журнала вебхуков по UID звонка. */
const readLogPhones = async (
  uid: string,
): Promise<{ phone: string; ourNumber: string }> => {
  if (!uid) return { phone: '', ourNumber: '' };

  const response = await client.get<unknown>('/rest/webhookLogs', {
    query: { filter: `uid[eq]:"${uid}"`, limit: 6 },
  });

  const logs = rowsOf<LogRow>(response, 'webhookLogs');

  let phone = '';
  let ourNumber = '';

  for (const log of logs) {
    ourNumber = ourNumber || digits10(log.nashNomer);

    if (phone) continue;

    phone = digits10(log.klient);

    if (phone) continue;

    try {
      const parsed =
        typeof log.dannye === 'string' ? JSON.parse(log.dannye) : log.dannye;

      phone = digits10((parsed as Record<string, unknown>)?.phone);
    } catch {
      phone = '';
    }
  }

  return { phone, ourNumber };
};

const handler = async () => {
  const state = (await kv.get(STATE_KEY)) as State | null;

  const current: State = {
    mode: CONFIG.mode,
    cursor: state?.cursor ?? '',
    processed: state?.processed ?? 0,
    stats: state?.stats ?? {},
    errors: state?.errors ?? [],
    updatedAt: new Date().toISOString(),
  };

  const count = (key: string) => {
    current.stats[key] = (current.stats[key] ?? 0) + 1;
  };

  let calls: CallRow[] = [];

  try {
    calls = await readCalls(current.cursor);
  } catch (error) {
    current.errors = [`чтение звонков: ${describeError(error)}`, ...current.errors].slice(0, 5);
    current.updatedAt = new Date().toISOString();
    await kv.set(STATE_KEY, current);

    return current;
  }

  for (const call of calls) {
    const uid = String(call.externalRecordingId ?? '');

    current.processed += 1;
    current.cursor = call.id;

    try {
      const { phone, ourNumber } = await readLogPhones(uid);

      if (!phone) {
        count('без номера клиента');
        continue;
      }

      let lookup: ClientLookup = emptyLookup();
      let employee: EmployeeLookup = emptyEmployee();

      lookup = await lookupClientByPhone(phone);
      employee = await lookupEmployeeByOurNumber(ourNumber);

      if (lookup.personId) count('контакт найден');
      if (lookup.companyId) count('компания найдена');
      if (lookup.ambiguous) count('неоднозначно');
      if (!lookup.personId && !lookup.companyId && !lookup.ambiguous) count('не найдено');
      if (employee.employeeId) count('сотрудник найден');

      if (CONFIG.mode === 'live' && call.calendarEventId) {
        const links = await ensureCallLinks({
          calendarEventId: call.calendarEventId,
          callRecordingId: call.id,
          lookup,
          employee,
          clientPhone: phone,
          happensAt: String(call.createdAt ?? ''),
          title: String(call.title ?? ''),
        });

        if (links.personTarget) count('добавлен контакт');
        if (links.companyTarget) count('добавлена компания');
        if (links.companyTimeline) count('добавлена лента');
        if (links.employeeParticipant) count('добавлен сотрудник');
      }

      if (CONFIG.mode === 'dry' && lookup.companyId) count('лента (будет добавлена)');
      if (CONFIG.mode === 'dry' && (lookup.personId || lookup.companyId)) count('связи (будут добавлены)');
    } catch (error) {
      current.errors = [`${call.title ?? call.id}: ${describeError(error)}`, ...current.errors].slice(0, 5);
      count('ошибок');
    }

    if (PAUSE_MS > 0) await sleep(PAUSE_MS);
  }

  current.updatedAt = new Date().toISOString();

  await kv.set(STATE_KEY, current);

  return current;
};

export default defineLogicFunction({
  universalIdentifier: HISTORY_BACKFILL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'megafon-history-backfill',
  description: 'Приведение истории звонков: связи и лента компаний (порциями по расписанию)',
  timeoutSeconds: 120,
  handler,
  // Расписание выключено: функция — инструмент для разового прогона по истории.
  // Включается на время (расписание + сброс курсора в kv) и снова снимается.
});
