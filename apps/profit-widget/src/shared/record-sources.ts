/**
 * Карта объектов, для которых считается профит, и чтение записи по id.
 *
 * Виджет в песочнице не знает, на карточке какого объекта он открыт (в контексте
 * приходят только id записей и пользователь), поэтому объект определяется по факту:
 * по очереди пробуем REST-эндпоинты из `RECORD_SOURCES`, первый ответивший — наш.
 *
 * Чтобы подключить новое направление (заправки, тендеры), достаточно добавить сюда
 * ещё одну запись — компонент и расчёт трогать не нужно.
 */

import type { ProfitDirection, ProfitRole } from 'src/shared/profit-rules';

export type RecordSource = {
  /** REST-эндпоинт объекта: `/rest/<endpoint>/<id>`. */
  endpoint: string;
  /** Ключ записи в ответе REST (`data.<recordKey>`). */
  recordKey: string;
  /** Направление профита, по правилам которого считается запись. */
  direction: ProfitDirection;
  /** Поле стоимости работ (услуг); null — услуги в профит не идут. */
  servicesField: string | null;
  /** Поле стоимости подрядчика; null — вычета нет. */
  contractorField: string | null;
  /** Поле стоимости товаров (материалов) — основная база профита. */
  materialsField: string | null;
  /** Поле учётной стоимости товаров (материалов) — справочная база. */
  materialsUchetField: string | null;
  /** Роли записи: роль → имя поля со ссылкой на сотрудника. */
  roles: Partial<Record<ProfitRole, string>>;
};

/**
 * Порядок важен: сначала более частые объекты. Первый ответ 200 — победил.
 */
export const RECORD_SOURCES: RecordSource[] = [
  {
    endpoint: 'opportunities',
    recordKey: 'opportunity',
    direction: 'zakaz',
    // Услуги в заказах в профит не идут — «Стоимость услуг» не читаем.
    servicesField: null,
    contractorField: null,
    materialsField: 'stoimostTovarov',
    materialsUchetField: 'stoimostTovarovUchet',
    roles: { otvetstvennyy: 'otvetstvennyyId' },
  },
  {
    endpoint: 'remontOborudovaniyas',
    recordKey: 'remontOborudovaniya',
    direction: 'remont',
    servicesField: 'stoimostRabot',
    contractorField: 'stoimostPodryadchika',
    materialsField: 'stoimostMaterialov',
    // Поле учётной стоимости материалов в «Ремонте» пока не создано:
    // пока пусто — справочный расчёт не показывается.
    materialsUchetField: 'stoimostMaterialovUchet',
    roles: {
      master: 'masterId',
      otvetstvennyy: 'otvetstvennyyId',
      priyomshchik: 'priyomshchikId',
    },
  },
];

const MICROS = 1_000_000;

/** Деньги из REST: `{ amountMicros, currencyCode }` → рубли. */
export const money = (value: unknown): number => {
  if (value === null || typeof value !== 'object') {
    return 0;
  }

  const micros = (value as { amountMicros?: unknown }).amountMicros;
  const parsed = typeof micros === 'number' ? micros : Number(String(micros ?? ''));

  return Number.isFinite(parsed) ? parsed / MICROS : 0;
};

/**
 * Необязательная денежная сумма: пусто в записи → undefined (данных нет),
 * заполнено (в том числе нулём) → число.
 */
export const optionalMoney = (value: unknown): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const micros = (value as { amountMicros?: unknown }).amountMicros;

  if (micros === null || micros === undefined) {
    return undefined;
  }

  return money(value);
};

export type LoadedRecord = {
  source: RecordSource;
  record: Record<string, unknown>;
};

/**
 * Находит запись среди объектов профитa по её id.
 * Бросает ошибку, если ни один объект такую запись не знает.
 */
export const loadProfitRecord = async (
  apiBase: string,
  recordId: string,
  headers: Record<string, string>,
): Promise<LoadedRecord> => {
  const statuses: string[] = [];

  for (const source of RECORD_SOURCES) {
    const response = await fetch(
      `${apiBase}/rest/${source.endpoint}/${recordId}?_ts=${Date.now()}`,
      { headers, cache: 'no-store' },
    );

    if (!response.ok) {
      statuses.push(`${source.endpoint}: HTTP ${response.status}`);
      continue;
    }

    const json = (await response.json()) as {
      data?: Record<string, Record<string, unknown> | undefined>;
    };
    const record = json.data?.[source.recordKey];

    if (record) {
      return { source, record };
    }

    statuses.push(`${source.endpoint}: пустой ответ`);
  }

  throw new Error(`запись не найдена (${statuses.join(', ')})`);
};
