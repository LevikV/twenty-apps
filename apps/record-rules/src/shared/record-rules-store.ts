import { kv } from 'twenty-sdk/logic-function';

import {
  normalizeRecordRulesConfig,
  type RecordRulesConfig,
} from 'src/shared/record-rules';

/**
 * Хранилище правил: одна запись во внутреннем хранилище приложения (kv).
 *
 * ⚠️ Фронт-компонент не должен импортировать этот модуль — он тянет `kv`
 * в бандл песочницы. Экран настроек работает через маршруты логик-функций.
 *
 * Движок проверки до записи (патч ядра) читает ту же самую запись
 * `core."keyValuePair"` по ключу `record-rules:config`.
 */

export const RECORD_RULES_KV_KEY = 'record-rules:config';

export const readRecordRules = async (): Promise<RecordRulesConfig> =>
  normalizeRecordRulesConfig(await kv.get(RECORD_RULES_KV_KEY));

export const writeRecordRules = async (
  config: RecordRulesConfig,
): Promise<RecordRulesConfig> => {
  const normalized = normalizeRecordRulesConfig(config);

  await kv.set(RECORD_RULES_KV_KEY, normalized);

  return normalized;
};
