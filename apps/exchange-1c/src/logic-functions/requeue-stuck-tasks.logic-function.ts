import { defineLogicFunction } from 'twenty-sdk/define';

import { findMany, updateOne } from 'src/shared/crm';
import { TASK_STATUS, type QueueTask } from 'src/shared/payload';
import { readSettings } from 'src/shared/settings';
import { REQUEUE_STUCK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/** Задачи, застрявшие в PROCESSING, возвращаем в очередь; после N попыток — в ошибку. */
const handler = async () => {
  const settings = readSettings();
  const deadline = Date.now() - settings.stuckMinutes * 60 * 1000;

  const tasks = (await findMany(
    'queueTasks',
    `status[eq]:${TASK_STATUS.processing}`,
    100,
  )) as unknown as QueueTask[];

  const requeued: string[] = [];
  const failed: string[] = [];

  for (const task of tasks) {
    const updatedAt = task.updatedAt ? Date.parse(task.updatedAt) : 0;

    if (!updatedAt || updatedAt > deadline) {
      continue;
    }

    const attempts = (task.attemptCount ?? 0) + 1;
    const isFailed = attempts >= settings.maxAttempts;

    await updateOne('queueTasks', 'queueTask', task.id, {
      status: isFailed ? TASK_STATUS.error : TASK_STATUS.pending,
      attemptCount: attempts,
      errorText: isFailed
        ? `задача зависла в обработке (${attempts} попыток)`
        : 'задача возвращена в очередь после зависания',
    });

    (isFailed ? failed : requeued).push(task.taskId);
  }

  return { checked: tasks.length, requeued, failed };
};

export default defineLogicFunction({
  universalIdentifier: REQUEUE_STUCK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'requeue-stuck-tasks',
  description: 'Возврат зависших задач очереди в работу',
  timeoutSeconds: 120,
  handler,
  cronTriggerSettings: {
    pattern: '*/5 * * * *',
  },
});
