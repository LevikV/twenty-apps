import { defineLogicFunction } from 'twenty-sdk/define';

import { SMS_OUTBOX_SEND_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  dueTasks,
  overLimit,
  patchMessage,
  patchTask,
  pendingStatus,
  readGateway,
  readRemoteState,
  sendTask,
} from 'src/shared/outbox';

/**
 * Крон-движок отправки SMS.
 *
 * Забирает задачи в статусе «ждёт», отправляет через приватный сервер шлюза и
 * обновляет статусы доставки у уже отправленных. Прямых вызовов телефона нет:
 * задача в объекте — источник правды, движок лишь крутит её состояние.
 *
 * Повтор при ошибке: до трёх попыток с паузой в 5 минут. После этого — «ошибка»
 * с текстом, чтобы менеджер видел, почему сообщение не ушло.
 */

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000;

const REMOTE_TO_TASK: Record<string, string> = {
  Delivered: 'DOSTAVLENO',
  Failed: 'OSHIBKA',
  Sent: 'OTPRAVLENO',
  Pending: 'OTPRAVLENO',
  Cancelled: 'OSHIBKA',
};

const handler = async () => {
  const errors: string[] = [];
  let sent = 0;
  let confirmed = 0;
  let failed = 0;

  // 1. Конечные статусы уже отправленных.
  for (const task of await pendingStatus().catch(() => [])) {
    try {
      const auth = await readGateway(String(task.shlyuzId ?? ''));

      if (!auth) continue;

      const remote = await readRemoteState(String(task.vneshniyId ?? ''), auth);

      if (!remote?.state) continue;

      const status = REMOTE_TO_TASK[remote.state];

      if (!status || status === 'OTPRAVLENO') continue;

      await patchTask(task.id, { status, oshibka: status === 'OSHIBKA' ? remote.state : '' });

      if (task.soobshchenieId) {
        await patchMessage(String(task.soobshchenieId), {
          statusDostavki: status === 'DOSTAVLENO' ? 'DOSTAVLENO' : 'OSHIBKA',
        });
      }

      confirmed += 1;
    } catch (error) {
      errors.push(`статус ${task.id}: ${String(error)}`);
    }
  }

  // 2. Новые отправки.
  for (const task of await dueTasks().catch(() => [])) {
    try {
      const auth = await readGateway(String(task.shlyuzId ?? ''));

      if (!auth) {
        await patchTask(task.id, { status: 'OSHIBKA', oshibka: 'шлюз не найден' });
        failed += 1;
        continue;
      }

      if (await overLimit(task, auth)) {
        await patchTask(task.id, {
          sleduyushchayaPopytka: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
          oshibka: 'лимит сообщений в час исчерпан',
        });
        continue;
      }

      const result = await sendTask(task, auth);
      const attempts = Number(task.popytki ?? 0) + 1;

      if (result.ok) {
        await patchTask(task.id, {
          status: 'OTPRAVLENO',
          vneshniyId: result.externalId,
          otpravlenoV: new Date().toISOString(),
          popytki: attempts,
          oshibka: '',
          sleduyushchayaPopytka: null,
        });

        if (task.soobshchenieId) {
          await patchMessage(String(task.soobshchenieId), {
            statusDostavki: 'OTPRAVLYAETSYA',
            vneshniyId: result.externalId,
          });
        }

        sent += 1;
      } else if (attempts >= MAX_ATTEMPTS) {
        await patchTask(task.id, {
          status: 'OSHIBKA',
          popytki: attempts,
          oshibka: result.error.slice(0, 500),
        });

        if (task.soobshchenieId) {
          await patchMessage(String(task.soobshchenieId), { statusDostavki: 'OSHIBKA' });
        }

        failed += 1;
      } else {
        await patchTask(task.id, {
          popytki: attempts,
          oshibka: result.error.slice(0, 500),
          sleduyushchayaPopytka: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
        });
      }
    } catch (error) {
      errors.push(`отправка ${task.id}: ${String(error)}`);
    }
  }

  return { sent, confirmed, failed, errors };
};

export default defineLogicFunction({
  universalIdentifier: SMS_OUTBOX_SEND_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sms-outbox-send',
  description: 'Отправка очереди SMS и обновление статусов доставки',
  timeoutSeconds: 60,
  handler,
  cronTriggerSettings: {
    pattern: '* * * * *',
  },
});
