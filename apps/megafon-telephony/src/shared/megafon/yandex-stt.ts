import { createSign, constants } from 'node:crypto';

import { kv } from 'twenty-sdk/logic-function';

/**
 * Работа с Яндекс SpeechKit v3 (deferred-general) из логик-функции.
 *
 * Авторизация — JWT сервисного аккаунта (PS256, только `node:crypto`), IAM-токен
 * кэшируется в kv приложения на 11 часов (живёт он 12).
 *
 * Аудио уходит в теле запроса (`content`), Object Storage не нужен — так же
 * устроен скрипт Ревизора.
 */

const IAM_URL = 'https://iam.api.cloud.yandex.net/iam/v1/tokens';
const STT_BASE = 'https://stt.api.cloud.yandex.net/stt/v3';
const IAM_CACHE_KEY = 'yandex:iam-token';
const IAM_CACHE_SECONDS = 11 * 3600;

type ServiceAccountKey = {
  service_account_id: string;
  key_id: string;
  private_key: string;
};

export type TranscriptWord = {
  text: string;
  start_timestamp?: { relative: number };
  end_timestamp?: { relative: number };
};

export type TranscriptEntry = {
  participant: { name: string };
  words: TranscriptWord[];
};

const b64url = (input: string | Buffer) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const readServiceAccountKey = (): ServiceAccountKey => {
  const raw = process.env.YANDEX_SA_KEY;

  if (!raw) {
    throw new Error('не задан YANDEX_SA_KEY (serverVariables приложения)');
  }

  const key = JSON.parse(raw) as ServiceAccountKey;

  if (!key.service_account_id || !key.key_id || !key.private_key) {
    throw new Error('YANDEX_SA_KEY неполный: нужны service_account_id, key_id, private_key');
  }

  return key;
};

const buildServiceJwt = (key: ServiceAccountKey): string => {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'PS256', typ: 'JWT', kid: key.key_id }));
  const payload = b64url(
    JSON.stringify({
      iss: key.service_account_id,
      aud: IAM_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signer = createSign('sha256');
  signer.update(signingInput);
  signer.end();

  return `${signingInput}.${b64url(
    signer.sign({ key: key.private_key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }),
  )}`;
};

/** IAM-токен: из kv, если ещё живой, иначе новый по JWT сервисного аккаунта. */
export const getIamToken = async (): Promise<string> => {
  const cached = await kv.get<{ token: string; expiresAt: number }>(IAM_CACHE_KEY);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (cached?.token && cached.expiresAt > nowSeconds + 600) {
    return cached.token;
  }

  const response = await fetch(IAM_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jwt: buildServiceJwt(readServiceAccountKey()) }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`IAM: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  }

  const body = (await response.json()) as { iamToken?: string };

  if (!body.iamToken) {
    throw new Error('IAM: пустой iamToken в ответе');
  }

  await kv.set(IAM_CACHE_KEY, {
    token: body.iamToken,
    expiresAt: nowSeconds + IAM_CACHE_SECONDS,
  });

  return body.iamToken;
};

/** Отправить mp3 на распознавание. Возвращает operation_id. */
export const startRecognition = async (audio: Buffer, iam: string): Promise<string> => {
  const response = await fetch(`${STT_BASE}/recognizeFileAsync`, {
    method: 'POST',
    headers: { authorization: `Bearer ${iam}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      content: audio.toString('base64'),
      recognitionModel: {
        model: 'deferred-general',
        audioFormat: { containerAudio: { containerAudioType: 'MP3' } },
        textNormalization: {
          textNormalization: 'TEXT_NORMALIZATION_ENABLED',
          profanityFilter: false,
          literatureText: false,
        },
        languageRestriction: { restrictionType: 'WHITELIST', languageCode: ['ru-RU'] },
      },
      speakerLabeling: { speakerLabeling: 'SPEAKER_LABELING_ENABLED' },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const body = (await response.json().catch(() => ({}))) as { id?: string };

  if (!response.ok || !body.id) {
    throw new Error(`SpeechKit: HTTP ${response.status} ${JSON.stringify(body).slice(0, 200)}`);
  }

  return body.id;
};

/** Забрать результат распознавания (JSONL, по строке на событие). */
export const fetchRecognition = async (operationId: string, iam: string): Promise<string> => {
  const response = await fetch(`${STT_BASE}/getRecognition?operation_id=${operationId}`, {
    headers: { authorization: `Bearer ${iam}` },
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(`SpeechKit: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  }

  return await response.text();
};

const toSeconds = (valueMs: unknown): number | undefined => {
  const parsed = Number(valueMs);

  return Number.isFinite(parsed) ? Math.round((parsed / 1000) * 1000) / 1000 : undefined;
};

/** Готов ли результат: есть хотя бы одно финальное событие. */
export const hasFinals = (raw: string): boolean =>
  raw.split('\n').some((line) => {
    if (!line.trim()) return false;

    try {
      return Boolean((JSON.parse(line) as { result?: { final?: unknown } }).result?.final);
    } catch {
      return false;
    }
  });

const mergeEntry = (entries: TranscriptEntry[], name: string, words: TranscriptWord[]) => {
  const last = entries[entries.length - 1];

  if (last && last.participant.name === name) {
    last.words.push(...words);
  } else {
    entries.push({ participant: { name }, words });
  }
};

/**
 * Сборка расшифровки из сырого ответа Яндекса.
 *
 * Роли по каналам (как в конвейере Ревизора): исходящий — канал 0 наш сотрудник,
 * канал 1 клиент; входящий — принадлежность канала не гарантирована, пишем «Канал N».
 */
export const buildTranscript = (
  raw: string,
  direction: string,
  clientLabel: string,
  ourLabel: string,
): TranscriptEntry[] => {
  const entries: TranscriptEntry[] = [];

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;

    let event: {
      result?: { final?: { channelTag?: string; alternatives?: Array<{ words?: unknown[] }> } };
    };

    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    const final = event.result?.final;
    const words = (final?.alternatives?.[0]?.words ?? [])
      .map((word) => {
        const item = word as { text?: string; startTimeMs?: unknown; endTimeMs?: unknown };
        const text = String(item.text ?? '').trim();

        if (!text) return null;

        const entry: TranscriptWord = { text };
        const start = toSeconds(item.startTimeMs);
        const end = toSeconds(item.endTimeMs);

        if (start !== undefined) entry.start_timestamp = { relative: start };
        if (end !== undefined) entry.end_timestamp = { relative: end };

        return entry;
      })
      .filter((word): word is TranscriptWord => word !== null);

    if (words.length === 0) continue;

    const channel = String(final?.channelTag ?? '0');
    const name =
      direction === 'out'
        ? channel === '0'
          ? ourLabel
          : clientLabel
        : `Канал ${channel}`;

    mergeEntry(entries, name, words);
  }

  return entries;
};

/** Расшифровка → плоский текст (для поля «Сводка»). */
export const transcriptToText = (entries: TranscriptEntry[]): string =>
  entries
    .map((entry) => `${entry.participant.name}: ${entry.words.map((word) => word.text).join(' ')}`)
    .join('\n');
