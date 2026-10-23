import { defineLogicFunction } from 'twenty-sdk/define';

import { findFirst, pluralOf } from 'src/shared/crm';
import {
  OUT_FIELDS,
  buildRepairOutPayload,
  upsertRepairOutTask,
  type RepairRecord,
} from 'src/shared/repairs-out';
import { PUSH_REPAIR_CHANGES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Обратный поток по ремонтам: правка человека в карточке «Ремонт оборудования»
 * кладёт задачу `direction = OUT` в очередь обмена — её заберёт 1С.
 *
 * Запускается событием БД `remontOborudovaniya.updated` и только по полям
 * белого списка (стадия, статус, результат диагностики, рекомендации).
 *
 * Эхо не создаём: правки приложением (`updatedBy.source = APPLICATION`, в том
 * числе пришедшие из 1С) пропускаем. Дедупликация — одна открытая задача на карточку.
 */

type DatabaseEventPayload = {
  recordId?: string;
  properties?: {
    updatedFields?: string[];
    after?: { id?: string };
  };
};

const handler = async (payload?: DatabaseEventPayload) => {
  const recordId = payload?.recordId ?? payload?.properties?.after?.id;

  if (!recordId) {
    return { ok: true, skipped: 'в событии нет recordId' };
  }

  const record = (await findFirst(
    pluralOf('remontOborudovaniya'),
    'remontOborudovaniya',
    `id[eq]:${recordId}`,
  )) as RepairRecord | undefined;

  if (!record) {
    return { ok: true, skipped: 'карточка не найдена' };
  }

  const source = record.updatedBy?.source ?? null;

  if (source !== 'MANUAL') {
    return {
      ok: true,
      skipped: `источник изменения ${source ?? 'неизвестен'} — в 1С не отправляем`,
    };
  }

  const updatedFields = payload?.properties?.updatedFields ?? [];

  if (!updatedFields.some((field) => field in OUT_FIELDS)) {
    return { ok: true, skipped: 'изменены поля вне белого списка' };
  }

  const built = buildRepairOutPayload(record, updatedFields);

  if ('error' in built) {
    return { ok: true, skipped: built.error };
  }

  if (!built.payload.fields.length) {
    return { ok: true, skipped: 'в событии нет полей из белого списка' };
  }

  const action = await upsertRepairOutTask(built.payload);

  return { ok: true, action, payload: built.payload, notes: built.notes };
};

export default defineLogicFunction({
  universalIdentifier: PUSH_REPAIR_CHANGES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'push-repair-changes',
  description: 'Правки ремонта (CRM) → задача OUT для 1С',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'remontOborudovaniya.updated',
    updatedFields: [
      'stadiya',
      'status',
      'rezultatDiagnostiki',
      'rekomendaciiPoRemontu',
    ],
  },
});
