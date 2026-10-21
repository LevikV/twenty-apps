/**
 * Карта объектов, для которых считается профит, и чтение записи по id.
 *
 * Виджет в песочнице не знает, на карточке какого объекта он открыт (в контексте
 * приходят только id записей и пользователь), поэтому объект определяется по факту:
 * по очереди пробуем REST-эндпоинты из `RECORD_SOURCES`, первый ответивший — наш.
 *
 * Та же карта используется отчётом на дашборде: там направление выбирается вручную,
 * но поля (базы расчёта, дата периода, стадия, участник) берутся отсюда.
 *
 * Чтобы подключить новое направление, достаточно добавить сюда ещё одну запись —
 * компоненты и расчёт трогать не нужно.
 */

import type { ProfitDirection, ProfitRole } from 'src/shared/profit-rules';

export type StageOption = { value: string; label: string };

export type RecordSource = {
  /** REST-эндпоинт объекта: `/rest/<endpoint>/<id>`. */
  endpoint: string;
  /** Ключ записи в ответе REST (`data.<recordKey>`). */
  recordKey: string;
  /** Направление профита, по правилам которого считается запись. */
  direction: ProfitDirection;
  /** Подпись направления в переключателе отчёта. */
  label: string;
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
  /** Поле даты, по которой отчёт считает период (и показывает дату в списке). */
  periodField: string;
  /** Поле стадии — для фильтра отчёта. */
  stageField: string;
  /** Поле статуса — для отметки «в работе». */
  statusField: string;
  /** Роль участника, которую показываем в списке. */
  participantRole: ProfitRole;
  /** Подпись участника в списке («Мастер» / «Ответственный»). */
  participantLabel: string;
  /** Стадии для фильтра: значения и подписи из метаданных CRM. */
  stages: StageOption[];
};

/** Стадии «Ремонта оборудования». */
const REMONT_STAGES: StageOption[] = [
  { value: 'NA_PRIEMKE', label: 'На приемке' },
  { value: 'V_OCHEREDI', label: 'В очереди' },
  { value: 'V_RABOTE', label: 'В работе' },
  { value: 'TREBUET_SOGLASOVANIYA_S_ZAKAZCHIKOM', label: 'Требует согласования с заказчиком' },
  { value: 'OZHIDAET_RESHENIYA_ZAKAZCHIKA', label: 'Ожидает решения заказчика' },
  { value: 'OZHIDANIE_PREDOPLATY', label: 'Ожидание предоплаты' },
  { value: 'POISK_DETALEY', label: 'Поиск деталей' },
  { value: 'OZHIDAET_DETALEY', label: 'Ожидает деталей' },
  { value: 'TREBUET_OTKLIKA_GOTOVO', label: 'Требует отклика (готово)' },
  { value: 'GOTOVO_K_VYDACHE', label: 'Готово к выдаче' },
  { value: 'VYDAN', label: 'Выдан' },
  { value: 'ZABRAT', label: 'Забрать' },
  { value: 'NA_PROVERKE', label: 'На проверке' },
  { value: 'TREBUET_OTKLIKA_ADMINISTRATORA', label: 'Требует отклика администратора' },
  { value: 'TREBUET_OTKLIKA_MASTERA', label: 'Требует отклика мастера' },
  { value: 'TREBUET_OTKLIKA_MENEDZHERA', label: 'Требует отклика менеджера' },
];

/** Стадии «Заказа» (нативный opportunity). */
const ZAKAZ_STAGES: StageOption[] = [
  { value: 'NOVYY', label: 'Новый' },
  { value: 'V_RABOTE', label: 'В работе' },
  { value: 'GOTOV_K_VYDACHE', label: 'Готов к выдаче' },
  { value: 'OZHIDAET_PREDOPLATY', label: 'Ожидает предоплаты' },
  { value: 'OZHIDAET_OTGRUZKI_POSTAVSHCHIKA', label: 'Ожидает отгрузки поставщика' },
  { value: 'TREBUET_SOGLASOVANIYA_S_ZAKAZCHIKOM', label: 'Требует согласования с заказчиком' },
  { value: 'OZHIDAET_RESHENIYA_ZAKAZCHIKA', label: 'Ожидает решения заказчика' },
  { value: 'OTGRUZHEN_OT_POSTVSHCHIKA', label: 'Отгружен от поставщика' },
  { value: 'OZHIDAET_POSTUP_K_POSTAVSHCHIKU_CH_V', label: 'Ожидает поступ. к поставщику (ч/в)' },
  { value: 'OZHIDAET_POSTUP_K_POSTAVSHCHIKU', label: 'Ожидает поступ. к поставщику' },
  { value: 'GOTOVO_K_VYDACHE_CHASTICHNO', label: 'Готово к выдаче (частично)' },
  { value: 'OZHIDAET_OPLATY_VYDAN', label: 'Ожидает оплаты (выдан)' },
  { value: 'ZAVERSHEN', label: 'Завершен' },
];

/**
 * Порядок важен: сначала более частые объекты. Первый ответ 200 — победил.
 */
export const RECORD_SOURCES: RecordSource[] = [
  {
    endpoint: 'opportunities',
    recordKey: 'opportunity',
    direction: 'zakaz',
    label: 'Заказы',
    // Услуги в заказах в профит не идут — «Стоимость услуг» не читаем.
    servicesField: null,
    contractorField: null,
    materialsField: 'stoimostTovarov',
    materialsUchetField: 'stoimostTovarovUchet',
    roles: { otvetstvennyy: 'otvetstvennyyId' },
    periodField: 'closeDate',
    stageField: 'stage',
    statusField: 'status',
    participantRole: 'otvetstvennyy',
    participantLabel: 'Ответственный',
    stages: ZAKAZ_STAGES,
  },
  {
    endpoint: 'remontOborudovaniyas',
    recordKey: 'remontOborudovaniya',
    direction: 'remont',
    label: 'Ремонты',
    servicesField: 'stoimostRabot',
    contractorField: 'stoimostPodryadchika',
    materialsField: 'stoimostMaterialov',
    materialsUchetField: 'stoimostMaterialovUchet',
    roles: {
      master: 'masterId',
      otvetstvennyy: 'otvetstvennyyId',
      priyomshchik: 'priyomshchikId',
    },
    periodField: 'proveden',
    stageField: 'stadiya',
    statusField: 'status',
    participantRole: 'master',
    participantLabel: 'Мастер',
    stages: REMONT_STAGES,
  },
];

/** Запись карты по направлению (для отчёта). */
export const sourceByDirection = (direction: ProfitDirection): RecordSource | undefined =>
  RECORD_SOURCES.find((source) => source.direction === direction);

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
