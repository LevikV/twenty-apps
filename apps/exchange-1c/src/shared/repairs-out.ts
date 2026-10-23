import { randomUUID } from 'node:crypto';

import {
  createOne,
  findFirst,
  updateOne,
  type CrmRecord,
} from 'src/shared/crm';
import { TASK_STATUS } from 'src/shared/payload';

/**
 * Обратный поток: «Ремонт оборудования» Twenty → задача OUT для 1С.
 *
 * Разрешённый белый список полей (согласовано 22.10.2026):
 *   стадия → service_status_code (в 1С пишется в реквизит СтатусДокумента),
 *   статус (Завершено) → closed (1С пока игнорирует),
 *   результат диагностики → diagnostics_results,
 *   рекомендации по ремонту → repair_recommendations.
 * Суммы, состав, мастер, контрагент, договор — не отправляем, ими владеет 1С.
 */

/** Поля карточки, изменение которых уходит в 1С. */
export const OUT_FIELDS: Record<string, string> = {
  stadiya: 'service_status_code',
  status: 'closed',
  rezultatDiagnostiki: 'diagnostics_results',
  rekomendaciiPoRemontu: 'repair_recommendations',
};

/**
 * Опция Twenty → код и название значения перечисления 1С `пмСтатусСервиса`.
 * Сверено с профилем 1С 22.10.2026: 16 значений, все названия совпадают,
 * кроме кода «Требует согласования с заказчиком» → `СогласованиеЗаказчик`.
 * Коды регистрозависимы — писать ровно так.
 */
export const STADIYA_1C: Record<string, { code: string; label: string }> = {
  NA_PRIEMKE: { code: 'НаПриеме', label: 'На приеме' },
  V_OCHEREDI: { code: 'ВОчереди', label: 'В очереди' },
  V_RABOTE: { code: 'ВРаботе', label: 'В работе' },
  TREBUET_SOGLASOVANIYA_S_ZAKAZCHIKOM: {
    code: 'СогласованиеЗаказчик',
    label: 'Требует согласования с заказчиком',
  },
  OZHIDAET_RESHENIYA_ZAKAZCHIKA: {
    code: 'ОжиданиеРешенияЗаказчика',
    label: 'Ожидает решения заказчика',
  },
  OZHIDANIE_PREDOPLATY: {
    code: 'ОжиданиеПредоплаты',
    label: 'Ожидание предоплаты',
  },
  POISK_DETALEY: { code: 'ПоискДеталей', label: 'Поиск деталей' },
  OZHIDAET_DETALEY: { code: 'ОжидаетДеталей', label: 'Ожидает деталей' },
  TREBUET_OTKLIKA_GOTOVO: {
    code: 'ТребуетОткликаГотово',
    label: 'Требует отклика (готово)',
  },
  GOTOVO_K_VYDACHE: { code: 'ГотовоКВыдаче', label: 'Готово к выдаче' },
  VYDAN: { code: 'Выдан', label: 'Выдан' },
  ZABRAT: { code: 'Забрать', label: 'Забрать' },
  NA_PROVERKE: { code: 'НаПроверке', label: 'На проверке' },
  TREBUET_OTKLIKA_ADMINISTRATORA: {
    code: 'ТребуетОткликаАдминистратора',
    label: 'Требует отклика администратора',
  },
  TREBUET_OTKLIKA_MASTERA: {
    code: 'ТребуетОткликаМастера',
    label: 'Требует отклика мастера',
  },
  TREBUET_OTKLIKA_MENEDZHERA: {
    code: 'ТребуетОткликаМенеджера',
    label: 'Требует отклика менеджера',
  },
};

export type RepairRecord = CrmRecord & {
  guid?: string | null;
  name?: string | null;
  stadiya?: string | null;
  status?: string | null;
  rezultatDiagnostiki?: string | null;
  rekomendaciiPoRemontu?: string | null;
  updatedAt?: string | null;
  updatedBy?: {
    source?: string | null;
    name?: string | null;
    workspaceMemberId?: string | null;
  } | null;
};

/** Номер документа для лога 1С: «ДС54524» → 54524. */
const documentNumber = (name?: string | null): string | null => {
  const match = /^ДС(\d+)$/.exec(String(name ?? '').trim());

  return match ? match[1] : null;
};

export type RepairOutPayload = Record<string, unknown> & {
  guid: string;
  fields: string[];
};

/** Собирает payload задачи OUT по карточке и списку изменённых полей события. */
export const buildRepairOutPayload = (
  record: RepairRecord,
  updatedFields: string[],
): { payload: RepairOutPayload; notes: string[] } | { error: string } => {
  const guid = String(record.guid ?? '').trim();

  if (!guid) {
    return { error: 'в карточке нет guid — отправлять в 1С нечего' };
  }

  const notes: string[] = [];
  const fields = updatedFields
    .map((field) => OUT_FIELDS[field])
    .filter((field): field is string => Boolean(field));

  const stadiya = String(record.stadiya ?? '').trim();
  const stadiya1c = STADIYA_1C[stadiya];

  if (!stadiya1c && stadiya) {
    notes.push(`неизвестная стадия CRM «${stadiya}» — service_status_code не отправлен`);
  }

  const closed = record.status === 'ZAVERSHENO';

  const payload: RepairOutPayload = {
    guid,
    number: documentNumber(record.name),
    change_date: record.updatedAt
      ? new Date(record.updatedAt).toISOString()
      : new Date().toISOString(),
    service_status: stadiya1c?.label ?? null,
    service_status_code: stadiya1c?.code ?? null,
    diagnostics_results: String(record.rezultatDiagnostiki ?? ''),
    repair_recommendations: String(record.rekomendaciiPoRemontu ?? ''),
    closed,
    fields,
    source: 'crm',
    crm_record_id: record.id,
    updated_by: record.updatedBy?.name ?? null,
  };

  return { payload, notes };
};

const QUEUE_PLURAL = 'queueTasks';
const QUEUE_SINGULAR = 'queueTask';

/**
 * Одна открытая задача на карточку: если задача уже лежит в очереди — обновляем
 * её payload актуальным состоянием, иначе создаём новую.
 *
 * ⚠️ `fields` при обновлении **объединяются** с теми, что уже есть в задаче.
 * Иначе вторая правка затирала бы список первой: человек заполнил «Результат
 * диагностики», через минуту поменял стадию — и текст диагностики в 1С уже не
 * поедет (1С пишет только поля из `fields`). Значения берутся из карточки,
 * поэтому всегда свежие; объединение касается только списка «что писать».
 */
export const upsertRepairOutTask = async (
  payload: RepairOutPayload,
): Promise<'created' | 'updated'> => {
  const open = (await findFirst(
    QUEUE_PLURAL,
    QUEUE_SINGULAR,
    `direction[eq]:OUT,objectGuid[eq]:${payload.guid},status[in]:[PENDING,PROCESSING]`,
  )) as (CrmRecord & { payload?: { fields?: unknown } }) | undefined;

  if (open?.id) {
    const previousFields = Array.isArray(open.payload?.fields)
      ? open.payload.fields.filter((field): field is string => typeof field === 'string')
      : [];

    const fields = Array.from(new Set([...previousFields, ...payload.fields]));

    await updateOne(QUEUE_PLURAL, QUEUE_SINGULAR, String(open.id), {
      action: 'UPDATE',
      status: TASK_STATUS.pending,
      payload: { ...payload, fields },
      errorText: null,
    });

    return 'updated';
  }

  await createOne(QUEUE_PLURAL, QUEUE_SINGULAR, {
    taskId: randomUUID(),
    direction: 'OUT',
    objectType: 'УниверсальныйСервис',
    objectGuid: payload.guid,
    action: 'UPDATE',
    status: TASK_STATUS.pending,
    attemptCount: 0,
    payload,
  });

  return 'created';
};
