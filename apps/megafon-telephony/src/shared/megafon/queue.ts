import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Постановка задачи в «Очередь расшифровки».
 *
 * Идемпотентно: одна задача на звонок ВАТС (`uid`). Вызывается из приёма хуков
 * (после `history` со ссылкой на запись) и из крон-сверки.
 */

export type QueueSeed = {
  uid: string;
  /** `in` / `out` — из направления звонка. */
  direction?: string;
  /** Время начала звонка (ISO). */
  startedAt?: string;
};

export type QueueSeedResult = 'created' | 'exists' | 'skipped' | 'failed';

type ExistingResponse = { data?: { recordingQueueTasks?: Array<{ id: string }> } };

export const ensureQueueTask = async (seed: QueueSeed): Promise<QueueSeedResult> => {
  if (!seed.uid) return 'skipped';

  try {
    const rest = new RestApiClient();
    const existing = (await rest.get(
      `/rest/recordingQueueTasks?filter=uid[eq]:${seed.uid}&limit=1`,
    )) as ExistingResponse;

    if (existing.data?.recordingQueueTasks?.length) return 'exists';

    await rest.post('/rest/recordingQueueTasks', {
      uid: seed.uid,
      direction: seed.direction ?? null,
      startedAt: seed.startedAt || null,
      status: 'PENDING',
    });

    return 'created';
  } catch {
    // Сбой постановки не должен ронять приём хука — звонок важнее очереди.
    return 'failed';
  }
};
