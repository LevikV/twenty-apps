import { defineLogicFunction } from 'twenty-sdk/define';

import { SMS_OUTBOX_RECONCILE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  patchMessage,
  patchTask,
  readGateway,
  readRemoteState,
  staleTasks,
} from 'src/shared/outbox';

/**
 * Крон-сверка очереди SMS (страховка от зависших задач).
 *
 * Основной движок отправляет и опрашивает статусы каждую минуту. Эта сверка
 * ловит то, что он пропустил: задачи, зависшие в «отправлено» без финального
 * статуса, и задачи «ждёт», у которых давно прошло время попытки.
 *
 * Правила:
 * - «отправлено» старше 30 минут, а шлюз сообщения не знает → ошибка;
 * - «ждёт» с просроченной попыткой → возвращаем в очередь (движок подхватит);
 * - «ждёт» старше суток → ошибка «не отправлено».
 */

const REMOTE_TO_TASK: Record<string, string> = {
  Delivered: 'DOSTAVLENO',
  Failed: 'OSHIBKA',
  Cancelled: 'OSHIBKA',
  Sent: 'OTPRAVLENO',
  Pending: 'OTPRAVLENO',
};

const MINUTE = 60 * 1000;
const STALE_SENT_MS = 30 * MINUTE;
const STALE_WAIT_MS = 15 * MINUTE;
const TOO_OLD_MS = 24 * 60 * MINUTE;

const age = (iso: unknown): number => {
  const time = Date.parse(String(iso ?? ''));

  return Number.isFinite(time) ? Date.now() - time : Number.POSITIVE_INFINITY;
};

const handler = async () => {
  const report = {
    checked: 0,
    confirmed: 0,
    returned: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const task of await staleTasks().catch(() => [])) {
    report.checked += 1;

    const status = String(task.status ?? '');
    const externalId = String(task.vneshniyId ?? '');

    try {
      if (status === 'OTPRAVLENO') {
        // Свежие не трогаем: обычный движок ещё успеет опросить.
        if (age(task.updatedAt ?? task.createdAt) < STALE_SENT_MS) continue;

        const auth = await readGateway(String(task.shlyuzId ?? ''));

        if (!auth) {
          report.errors.push(`задача ${task.id}: шлюз не найден`);

          continue;
        }

        const remote = await readRemoteState(externalId, auth);

        // Шлюз не знает сообщение (404) — оно потеряно, дальше ждать нечего.
        if (!remote) {
          await patchTask(task.id!, { status: 'OSHIBKA', oshibka: 'сообщение не найдено в шлюзе' });
          await patchMessage(String(task.soobshchenieId ?? ''), { statusDostavki: 'OSHIBKA' });
          report.failed += 1;

          continue;
        }

        const mapped = REMOTE_TO_TASK[remote.state];

        if (mapped && mapped !== 'OTPRAVLENO') {
          await patchTask(task.id!, { status: mapped, oshibka: mapped === 'OSHIBKA' ? remote.state : '' });
          await patchMessage(String(task.soobshchenieId ?? ''), { statusDostavki: mapped });
          report.confirmed += 1;
        }

        continue;
      }

      // «Ждёт»: сначала возвращаем в очередь, если попытка просто потерялась.
      if (age(task.createdAt) > TOO_OLD_MS) {
        await patchTask(task.id!, { status: 'OSHIBKA', oshibka: 'не отправлено за сутки' });
        await patchMessage(String(task.soobshchenieId ?? ''), { statusDostavki: 'OSHIBKA' });
        report.failed += 1;

        continue;
      }

      if (age(task.sledyushchayaPopytka ?? task.createdAt) > STALE_WAIT_MS) {
        await patchTask(task.id!, { sledyushchayaPopytka: new Date().toISOString() });
        report.returned += 1;
      }
    } catch (error) {
      report.errors.push(`задача ${task.id}: ${String(error).slice(0, 120)}`);
    }
  }

  return report;
};

export default defineLogicFunction({
  universalIdentifier: SMS_OUTBOX_RECONCILE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sms-outbox-reconcile',
  description: 'Сверка зависших задач отправки SMS',
  timeoutSeconds: 60,
  handler,
  cronTriggerSettings: {
    pattern: '*/10 * * * *',
  },
});
