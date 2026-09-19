import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { RECORDING_FILE_SELFTEST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Диагностика этапа 2 конвейера: скачать mp3 из ВАТС и залить его в карточку звонка.
 *
 * Вызывается вручную: POST /s/recording-selftest с телом { "uid": "<callid ВАТС>" }.
 * Ничего не создаёт — работает с уже существующей записью звонка; после проверки удаляется.
 */

const AUDIO_FIELD_UNIVERSAL_IDENTIFIER = '2eafc2d0-8fec-430c-a939-65ca5fbc0f08';
const VIDEO_FIELD_UNIVERSAL_IDENTIFIER = 'bb9523d3-457e-4f4b-8c79-27a77afb87da';
const VATS_BASE = 'https://kartridzh-pljus.megapbx.ru/crmapi/v1';

type VatsCall = { uid?: string; record?: string; duration?: string | number; start?: string };

const findRecordUrl = async (uid: string, token: string): Promise<VatsCall | null> => {
  for (const period of ['today', 'yesterday']) {
    const response = await fetch(
      `${VATS_BASE}/history/json?period=${period}&type=all&limit=1000`,
      { headers: { 'X-API-KEY': token }, signal: AbortSignal.timeout(20_000) },
    );
    const calls = (await response.json().catch(() => [])) as VatsCall[];

    if (Array.isArray(calls)) {
      const found = calls.find((call) => call.uid === uid);
      if (found) return found;
    }
  }

  return null;
};

const handler = async (event: RoutePayload) => {
  const startedAt = Date.now();
  const body = (event?.body ?? {}) as Record<string, unknown>;
  const uid = String(body.uid ?? '').trim();
  const steps: Record<string, unknown> = {};

  if (!uid) {
    return new Response(JSON.stringify({ error: 'нужен uid звонка ВАТС' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const rest = new RestApiClient();
    const metadata = new MetadataApiClient();

    // 1. Карточка звонка в Twenty.
    const found = (await rest.get(
      `/rest/callRecordings?filter=externalRecordingId[eq]:${uid}&limit=1`,
    )) as { data?: { callRecordings?: Array<{ id: string; title?: string }> } };
    const recording = found.data?.callRecordings?.[0];

    if (!recording) {
      return new Response(JSON.stringify({ error: 'запись звонка не найдена', uid }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    steps.recordingId = recording.id;
    steps.title = recording.title ?? null;

    // 2. Ссылка на mp3 в истории ВАТС.
    const call = await findRecordUrl(uid, process.env.VATS_API_TOKEN ?? '');
    if (!call?.record) {
      return new Response(
        JSON.stringify({ error: 'в истории ВАТС нет ссылки на запись', uid, steps }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      );
    }

    steps.durationSec = Number(call.duration ?? 0);

    // 3. Скачивание файла.
    const downloadStartedAt = Date.now();
    const audioResponse = await fetch(call.record, { signal: AbortSignal.timeout(60_000) });
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    steps.download = {
      httpStatus: audioResponse.status,
      contentType: audioResponse.headers.get('content-type'),
      bytes: audioBuffer.length,
      ms: Date.now() - downloadStartedAt,
    };

    const filename = `${uid}.mp3`;

    // 4. Заливка файла в файловое поле (тот же файл в audio и video).
    const uploadStartedAt = Date.now();
    const file = await metadata.uploadFile(
      audioBuffer,
      filename,
      'audio/mpeg',
      AUDIO_FIELD_UNIVERSAL_IDENTIFIER,
    );
    steps.upload = { fileId: file.id, path: file.path, size: file.size, ms: Date.now() - uploadStartedAt };

    // 5. Привязка файла к записи звонка.
    const value = [{ fileId: file.id, label: filename }];
    await rest.patch(`/rest/callRecordings/${recording.id}`, {
      audio: value,
      video: value,
      status: 'PROCESSING',
    });
    steps.patched = true;

    return new Response(
      JSON.stringify({ ok: true, uid, steps, ms: Date.now() - startedAt }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error), steps, ms: Date.now() - startedAt }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: RECORDING_FILE_SELFTEST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'recording-file-selftest',
  description: 'Диагностика этапа 2: скачивание mp3 и заливка в карточку звонка',
  timeoutSeconds: 120,
  handler,
  httpRouteTriggerSettings: {
    path: '/recording-selftest',
    httpMethod: 'POST',
    isAuthRequired: false,
  },
});
