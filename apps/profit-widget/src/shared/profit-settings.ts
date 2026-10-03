import { kv } from 'twenty-sdk/logic-function';

import {
  normalizeProfitSettings,
  type ProfitSettings,
} from 'src/shared/profit-rules';

/**
 * Хранилище настроек профита (только серверная часть).
 *
 * Ставки лежат во внутреннем хранилище приложения (kv), а не в CRM-объектах:
 * настройка относится к приложению, а запись в карточку участника воркспейса
 * ядром Twenty запрещена (нужно право «Users», которое мы не просим).
 *
 * ⚠️ Фронт-компонент не должен импортировать этот модуль — он тянет `kv`
 * в бандл песочницы. Экран настроек работает через маршруты логик-функций.
 */

export const PROFIT_SETTINGS_KV_KEY = 'profit:rates';

export const readProfitSettings = async (): Promise<ProfitSettings> =>
  normalizeProfitSettings(await kv.get(PROFIT_SETTINGS_KV_KEY));

export const writeProfitSettings = async (
  settings: ProfitSettings,
): Promise<void> => {
  await kv.set(PROFIT_SETTINGS_KV_KEY, normalizeProfitSettings(settings));
};
