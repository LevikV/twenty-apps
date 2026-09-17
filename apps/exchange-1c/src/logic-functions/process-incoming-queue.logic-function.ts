import { defineLogicFunction } from 'twenty-sdk/define';

import { findMany, updateOne } from 'src/shared/crm';
import { TASK_STATUS, type QueueTask } from 'src/shared/payload';
import { processTask } from 'src/shared/process';
import { readSettings } from 'src/shared/settings';
import { PROCESS_QUEUE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

type TaskResult = {
  taskId: string;
  objectType: string;
  action: string;
  result: 'done' | 'pending' | 'error';
  note?: string;
};

const handler = async () => {
  const settings = readSettings();

  const tasks = (await findMany(
    'queueTasks',
    `direction[eq]:IN,status[eq]:${TASK_STATUS.pending}`,
    settings.maxTasksPerRun,
  )) as unknown as QueueTask[];

  const results: TaskResult[] = [];

  for (const task of tasks) {
    // Забираем задачу в работу
    await updateOne('queueTasks', 'queueTask', task.id, {
      status: TASK_STATUS.processing,
    });

    try {
      const outcome = await processTask(task);

      if (outcome.status === 'pending') {
        await updateOne('queueTasks', 'queueTask', task.id, {
          status: TASK_STATUS.pending,
          errorText: outcome.note ?? null,
        });

        results.push({
          taskId: task.taskId,
          objectType: task.objectType,
          action: task.action ?? '',
          result: 'pending',
          note: outcome.note,
        });

        continue;
      }

      await updateOne('queueTasks', 'queueTask', task.id, {
        status: TASK_STATUS.done,
        errorText: outcome.note ?? null,
      });

      results.push({
        taskId: task.taskId,
        objectType: task.objectType,
        action: task.action ?? '',
        result: 'done',
        note: outcome.note,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = (task.attemptCount ?? 0) + 1;
      const failed = attempts >= settings.maxAttempts;

      await updateOne('queueTasks', 'queueTask', task.id, {
        status: failed ? TASK_STATUS.error : TASK_STATUS.pending,
        attemptCount: attempts,
        errorText: message.slice(0, 400),
      });

      results.push({
        taskId: task.taskId,
        objectType: task.objectType,
        action: task.action ?? '',
        result: failed ? 'error' : 'pending',
        note: message.slice(0, 200),
      });
    }
  }

  return { processed: results.length, results };
};

export default defineLogicFunction({
  universalIdentifier: PROCESS_QUEUE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'process-incoming-queue',
  description: 'Обработка входящих задач очереди обмена 1С',
  timeoutSeconds: 300,
  handler,
  cronTriggerSettings: {
    pattern: '* * * * *',
  },
});
