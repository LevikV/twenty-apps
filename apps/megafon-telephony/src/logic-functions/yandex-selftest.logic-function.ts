import { defineLogicFunction } from 'twenty-sdk/define';
import { createSign, createVerify, constants, generateKeyPairSync } from 'node:crypto';

import { YANDEX_SELFTEST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Диагностика песочницы логик-функций (этап 1 конвейера записей).
 *
 * Проверяем ровно то, на чём будет стоять конвейер:
 *  1) есть ли исходящий доступ к API Яндекса из песочницы;
 *  2) доступна ли криптография Node (PS256 для JWT сервисного аккаунта);
 *  3) какие переменные окружения приложение получает от платформы (только имена).
 *
 * Секретов не касается, в CRM ничего не пишет. Вызывается вручную:
 * `yarn twenty dev:function:exec --functionName yandex-selftest`
 */

type Check = { ok: boolean; detail?: unknown; ms?: number };

const timed = async (fn: () => Promise<unknown>): Promise<Check> => {
  const startedAt = Date.now();

  try {
    const detail = await fn();

    return { ok: true, detail, ms: Date.now() - startedAt };
  } catch (error) {
    return { ok: false, detail: String(error), ms: Date.now() - startedAt };
  }
};

const handler = async () => {
  const checks: Record<string, Check | unknown> = {};

  // 1. Исходящий доступ к SpeechKit: без токена ждём 401/403, а не сетевую ошибку.
  checks.yandexStt = await timed(async () => {
    const response = await fetch(
      'https://stt.api.cloud.yandex.net/stt/v3/getRecognition?operation_id=selftest',
      { signal: AbortSignal.timeout(10_000) },
    );

    return { httpStatus: response.status, reachable: response.status < 500 };
  });

  // 2. IAM-эндпоинт (POST с мусорным телом — ждём осмысленный ответ валидации).
  checks.yandexIam = await timed(async () => {
    const response = await fetch('https://iam.api.cloud.yandex.net/iam/v1/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jwt: 'selftest' }),
      signal: AbortSignal.timeout(10_000),
    });

    return { httpStatus: response.status };
  });

  // 3. Криптография PS256 — подпись и проверка на свежем ключе.
  checks.ps256 = await timed(async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const payload = 'selftest';
    const signer = createSign('sha256');
    signer.update(payload);
    signer.end();
    const signature = signer.sign({
      key: privateKey,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: 32,
    });
    const verifier = createVerify('sha256');
    verifier.update(payload);
    verifier.end();

    return {
      verified: verifier.verify(
        { key: publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
        signature,
      ),
      signatureBytes: signature.length,
    };
  });

  // 4. Что платформа кладёт в окружение (только имена, без значений).
  checks.runtime = {
    node: process.version,
    envNames: Object.keys(process.env)
      .filter((name) => name.startsWith('TWENTY') || /YANDEX|VATS|MEGAFON/.test(name))
      .sort(),
  };

  return checks;
};

export default defineLogicFunction({
  universalIdentifier: YANDEX_SELFTEST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'yandex-selftest',
  description: 'Диагностика песочницы: доступ к Яндексу и криптография (этап 1)',
  timeoutSeconds: 60,
  handler,
  // Временный маршрут только для проверки этапа 1 — после проверки удаляется.
  httpRouteTriggerSettings: {
    path: '/yandex-selftest',
    httpMethod: 'GET',
    isAuthRequired: false,
  },
});
