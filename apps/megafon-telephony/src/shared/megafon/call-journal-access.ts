import { kv } from 'twenty-sdk/logic-function';

import {
  normalizeAccessRules,
  type CallJournalAccessRules,
} from 'src/shared/megafon/call-journal-access-rules';

/**
 * Хранилище правил доступа к журналу звонков (только серверная часть).
 *
 * Правила лежат во внутреннем хранилище приложения (kv), а не в CRM-объектах:
 * настройка относится к самому приложению, а запись в карточку сотрудника
 * ядром Twenty запрещена (нужно право «Users», которое мы не просим).
 */

export const CALL_JOURNAL_ACCESS_KV_KEY = 'calls:access';

export const readAccessRules = async (): Promise<CallJournalAccessRules> =>
  normalizeAccessRules(await kv.get(CALL_JOURNAL_ACCESS_KV_KEY));

export const writeAccessRules = async (rules: CallJournalAccessRules): Promise<void> => {
  await kv.set(CALL_JOURNAL_ACCESS_KV_KEY, normalizeAccessRules(rules));
};
