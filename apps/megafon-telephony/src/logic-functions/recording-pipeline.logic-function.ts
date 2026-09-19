import { defineLogicFunction } from 'twenty-sdk/define';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { RECORDING_PIPELINE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  buildTranscript,
  fetchRecognition,
  getIamToken,
  hasFinals,
  startRecognition,
  transcriptToText,
} from 'src/shared/megafon/yandex-stt';

/**
 * Конвейер записей: очередь → файл в карточке → расшифровка Яндекса.
 *
 * Работает по расписанию (раз в минуту) и обрабатывает очередь порциями:
 *   PENDING — скачать mp3, положить в файловые поля звонка, отправить в Яндекс (→ SENT);
 *   SENT    — забрать результат по operationId (→ READY) либо повторить позже.
 *
 * Источник правды — объект «Очередь расшифровки»: перезапуск Redis задачу не теряет.
 * Постановкой задач занимается отдельный шаг (приём хуков/сверка) — не эта функция.
 */

const AUDIO_FIELD_UNIVERSAL_IDENTIFIER = '2eafc2d0-8fec-430c-a939-65ca5fbc0f08';
const VIDEO_FIELD_UNIVERSAL_IDENTIFIER = 'bb9523d3-457e-4f4b-8c79-27a77afb87da';

const MAX_ATTEMPTS = 10;
const CHECK_AFTER_SECONDS = 60;
const BATCH_SIZE = 5;

type QueueTask = {
  id: string;
  uid?: string | null;
  direction?: string | null;
  attempts?: number | null;
  operationId?: string | null;
  callRecordingId?: string | null;
};

type Recording = {
  id: string;
  title?: string | null;
  ssylkaNaZapis?: string | null;
  napravlenie?: string | null;
  calendarEventId?: string | null;
  audio?: Array<{ fileId: string }> | null;
};

const isoNow = () => new Date().toISOString();
const isoInSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const findRecording = async (rest: RestApiClient, task: QueueTask): Promise<Recording | null> => {
  if (task.uid) {
    const byUid = (await rest.get(
      `/rest/callRecordings?filter=externalRecordingId[eq]:${task.uid}&limit=1`,
    )) as { data?: { callRecordings?: Recording[] } };

    if (byUid.data?.callRecordings?.[0]) {
      return byUid.data.callRecordings[0];
    }
  }

  if (task.callRecordingId) {
    const byId = (await rest.get(`/rest/callRecordings/${task.callRecordingId}`)) as {
      data?: { callRecording?: Recording };
    };

    return byId.data?.callRecording ?? null;
  }

  return null;
};

/** Подписи ролей: имя клиента из заголовка, сотрудник — организатор события. */
const resolveLabels = async (rest: RestApiClient, recording: Recording) => {
  const clientLabel = (recording.title ?? '').split(': ')[1]?.trim() || 'Клиент';
  let ourLabel = 'Сотрудник';

  if (recording.calendarEventId) {
    try {
      const participants = (await rest.get(
        `/rest/calendarEventParticipants?filter=calendarEventId[eq]:${recording.calendarEventId}&limit=20`,
      )) as { data?: { calendarEventParticipants?: Array<{ displayName?: string; isOrganizer?: boolean }> } };
      const organizer = participants.data?.calendarEventParticipants?.find(
        (participant) => participant.isOrganizer && participant.displayName,
      );

      if (organizer?.displayName) ourLabel = organizer.displayName;
    } catch {
      // подпись по умолчанию — не повод ронять конвейер
    }
  }

  return { clientLabel, ourLabel };
};

const patchTask = (rest: RestApiClient, taskId: string, data: Record<string, unknown>) =>
  rest.patch(`/rest/recordingQueueTasks/${taskId}`, data);

/** PENDING: достаём файл и отправляем в Яндекс. */
const handlePending = async (
  rest: RestApiClient,
  metadata: MetadataApiClient,
  task: QueueTask,
  iam: string,
) => {
  const recording = await findRecording(rest, task);

  if (!recording) {
    return patchTask(rest, task.id, {
      status: 'FAILED',
      errorText: 'карточка звонка не найдена',
    });
  }

  const attempts = (task.attempts ?? 0) + 1;

  if (!recording.ssylkaNaZapis) {
    return patchTask(rest, task.id, {
      status: 'FAILED',
      attempts,
      errorText: 'в карточке нет ссылки на запись',
      callRecordingId: recording.id,
    });
  }

  const audioResponse = await fetch(recording.ssylkaNaZapis, { signal: AbortSignal.timeout(120_000) });

  if (!audioResponse.ok) {
    throw new Error(`скачивание записи: HTTP ${audioResponse.status}`);
  }

  const audio = Buffer.from(await audioResponse.arrayBuffer());

  // Файл кладём в карточку один раз: если он уже там, только расшифровываем.
  if (!recording.audio?.length) {
    const filename = `${task.uid ?? recording.id}.mp3`;
    const file = await metadata.uploadFile(
      audio,
      filename,
      'audio/mpeg',
      AUDIO_FIELD_UNIVERSAL_IDENTIFIER,
    );
    const value = [{ fileId: file.id, label: filename }];

    await rest.patch(`/rest/callRecordings/${recording.id}`, {
      audio: value,
      video: value,
      recordingRequestStatus: 'REQUESTED',
    });
  }

  const operationId = await startRecognition(audio, iam);

  return patchTask(rest, task.id, {
    status: 'SENT',
    attempts,
    operationId,
    direction: recording.napravlenie === 'INCOMING' ? 'in' : 'out',
    sentAt: isoNow(),
    nextCheckAt: isoInSeconds(CHECK_AFTER_SECONDS),
    callRecordingId: recording.id,
    errorText: null,
  });
};

/** SENT: забираем результат и пишем расшифровку в карточку звонка. */
const handleSent = async (
  rest: RestApiClient,
  task: QueueTask,
  iam: string,
) => {
  const attempts = (task.attempts ?? 0) + 1;

  if (!task.operationId) {
    return patchTask(rest, task.id, {
      status: 'FAILED',
      attempts,
      errorText: 'нет operationId',
    });
  }

  const raw = await fetchRecognition(task.operationId, iam);

  if (!hasFinals(raw)) {
    if (attempts >= MAX_ATTEMPTS) {
      await patchTask(rest, task.id, {
        status: 'FAILED',
        attempts,
        errorText: `Яндекс не отдал результат за ${MAX_ATTEMPTS} попыток`,
      });

      if (task.callRecordingId) {
        await rest.patch(`/rest/callRecordings/${task.callRecordingId}`, { status: 'FAILED' });
      }

      return;
    }

    return patchTask(rest, task.id, {
      attempts,
      nextCheckAt: isoInSeconds(CHECK_AFTER_SECONDS),
    });
  }

  const recording = await findRecording(rest, task);

  if (!recording) {
    return patchTask(rest, task.id, {
      status: 'FAILED',
      attempts,
      errorText: 'карточка звонка не найдена при записи расшифровки',
    });
  }

  const { clientLabel, ourLabel } = await resolveLabels(rest, recording);
  const transcript = buildTranscript(raw, task.direction ?? 'in', clientLabel, ourLabel);
  const text = transcriptToText(transcript);

  await rest.patch(`/rest/callRecordings/${recording.id}`, {
    transcript,
    summary: { markdown: text.slice(0, 4000) },
    status: 'COMPLETED',
  });

  return patchTask(rest, task.id, {
    status: 'READY',
    attempts,
    completedAt: isoNow(),
    callRecordingId: recording.id,
    errorText: null,
  });
};

const handler = async () => {
  const rest = new RestApiClient();
  const metadata = new MetadataApiClient();
  const startedAt = Date.now();
  const report: Record<string, unknown> = { processed: 0, errors: [] as string[] };

  const iam = await getIamToken();

  const pending = (await rest.get(
    `/rest/recordingQueueTasks?filter=status[eq]:PENDING&limit=${BATCH_SIZE}`,
  )) as { data?: { recordingQueueTasks?: QueueTask[] } };

  for (const task of pending.data?.recordingQueueTasks ?? []) {
    try {
      await handlePending(rest, metadata, task, iam);
      report.processed = (report.processed as number) + 1;
    } catch (error) {
      (report.errors as string[]).push(`PENDING ${task.uid ?? task.id}: ${describeError(error)}`);

      const attempts = (task.attempts ?? 0) + 1;

      if (attempts >= MAX_ATTEMPTS) {
        await patchTask(rest, task.id, { status: 'FAILED', attempts, errorText: describeError(error) });
      } else {
        await patchTask(rest, task.id, {
          attempts,
          errorText: describeError(error),
          nextCheckAt: isoInSeconds(CHECK_AFTER_SECONDS),
        });
      }
    }
  }

  const due = (await rest.get(
    `/rest/recordingQueueTasks?filter=status[eq]:SENT,nextCheckAt[lte]:${isoNow()}&limit=${BATCH_SIZE}`,
  )) as { data?: { recordingQueueTasks?: QueueTask[] } };

  for (const task of due.data?.recordingQueueTasks ?? []) {
    try {
      await handleSent(rest, task, iam);
      report.processed = (report.processed as number) + 1;
    } catch (error) {
      (report.errors as string[]).push(`SENT ${task.uid ?? task.id}: ${describeError(error)}`);

      const attempts = (task.attempts ?? 0) + 1;

      await patchTask(rest, task.id, {
        attempts,
        errorText: describeError(error),
        nextCheckAt: isoInSeconds(CHECK_AFTER_SECONDS),
      });
    }
  }

  report.ms = Date.now() - startedAt;

  return report;
};

export default defineLogicFunction({
  universalIdentifier: RECORDING_PIPELINE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'recording-pipeline',
  description: 'Очередь расшифровки: файл в карточку, Яндекс SpeechKit, транскрипт',
  timeoutSeconds: 300,
  handler,
  cronTriggerSettings: {
    pattern: '* * * * *',
  },
});
