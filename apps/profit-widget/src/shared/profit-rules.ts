/**
 * Настройки профита (ЗП) — чистая часть, без серверных зависимостей.
 *
 * Модуль импортируют и экран настроек (песочница фронт-компонента), и серверные
 * логик-функции, поэтому здесь нет ни kv, ни клиентов CRM.
 *
 * Модель:
 *   directions — правила по направлению (общие для всех): роль в записи → база × значение.
 *   personal   — персональные правила (исключения): сотруднику за конкретную базу.
 *   seesAll    — кому виджет показывает профит всех ролей и итог (руководитель).
 *
 * Плюс свойства расчёта направления: вычитать ли стоимость подрядчика из базы услуг
 * и наценка на товар (по ней считается закупочная цена материалов).
 *
 * Тип расчёта не хранится: он берётся из записи (стоит сотрудник Мастером /
 * Ответственным / Приёмщиком).
 */

export type ProfitDirection = 'remont' | 'zapravka' | 'tender' | 'zakaz';

export type ProfitBase =
  | 'services'
  | 'materialsProfit'
  | 'materialsSum'
  | 'goodsProfit'
  | 'contractorAmount'
  | 'fixedPerItem';

export type ProfitRole = 'master' | 'otvetstvennyy' | 'priyomshchik';

export type ProfitUnit = 'percent' | 'rub';

export type DirectionRule = {
  id: string;
  role: ProfitRole;
  base: ProfitBase;
  value: number;
  unit: ProfitUnit;
};

export type PersonalRule = {
  id: string;
  memberId: string;
  direction: ProfitDirection;
  base: ProfitBase;
  value: number;
  unit: ProfitUnit;
};

export type DirectionSettings = {
  /** Вычитать стоимость подрядчика из базы услуг. */
  contractorDeduction: boolean;
  /** Наценка на товар, %: закупка = продажа / (1 + наценка/100). */
  materialsMarkupPercent: number;
  rules: DirectionRule[];
};

export type ProfitSettings = {
  directions: Record<ProfitDirection, DirectionSettings>;
  personal: PersonalRule[];
  seesAll: string[];
};

export const DIRECTION_ORDER: ProfitDirection[] = [
  'remont',
  'zapravka',
  'tender',
  'zakaz',
];

export const DIRECTION_LABELS: Record<ProfitDirection, string> = {
  remont: 'Ремонт оборудования',
  zapravka: 'Заправка картриджей',
  tender: 'Тендер',
  zakaz: 'Заказы',
};

export const ROLE_ORDER: ProfitRole[] = ['master', 'otvetstvennyy', 'priyomshchik'];

export const ROLE_LABELS: Record<ProfitRole, string> = {
  master: 'Мастер',
  otvetstvennyy: 'Ответственный',
  priyomshchik: 'Приёмщик',
};

export const BASE_ORDER: ProfitBase[] = [
  'services',
  'materialsProfit',
  'materialsSum',
  'goodsProfit',
  'contractorAmount',
  'fixedPerItem',
];

export const BASE_LABELS: Record<ProfitBase, string> = {
  services: 'Сумма услуг',
  materialsProfit: 'Прибыль материалов',
  materialsSum: 'Сумма материалов',
  goodsProfit: 'Прибыль товаров',
  contractorAmount: 'Стоимость подрядчика',
  fixedPerItem: 'Фикс за единицу',
};

export const UNIT_ORDER: ProfitUnit[] = ['percent', 'rub'];

export const UNIT_LABELS: Record<ProfitUnit, string> = {
  percent: '%',
  rub: '₽',
};

/** Наценка на товар по умолчанию: 50 % (закупка ≈ 2/3 цены продажи). */
export const DEFAULT_MARKUP_PERCENT = 50;

export const MAX_PERCENT = 100;

/** Потолок денежного значения, чтобы опечатка не уехала в расчёт. */
export const MAX_MONEY = 10_000_000;

export const emptyDirectionSettings = (): DirectionSettings => ({
  contractorDeduction: true,
  materialsMarkupPercent: DEFAULT_MARKUP_PERCENT,
  rules: [],
});

export const defaultDirectionSettings = (): DirectionSettings =>
  emptyDirectionSettings();

export const defaultProfitSettings = (): ProfitSettings => ({
  directions: {
    remont: defaultDirectionSettings(),
    zapravka: defaultDirectionSettings(),
    tender: defaultDirectionSettings(),
    zakaz: defaultDirectionSettings(),
  },
  personal: [],
  seesAll: [],
});

/**
 * Начальные правила по ремонту оборудования (согласовано 2026-10-03):
 *   Мастер          → сумма услуг × 80 %
 *   Ответственный   → сумма услуг × 20 %
 *   Ответственный   → прибыль материалов × 30 %
 * База услуг — за вычетом стоимости подрядчика, наценка на товар 50 %.
 */
export const remontStarterRules = (): DirectionRule[] => [
  { id: 'remont-master-services', role: 'master', base: 'services', value: 80, unit: 'percent' },
  {
    id: 'remont-otv-services',
    role: 'otvetstvennyy',
    base: 'services',
    value: 20,
    unit: 'percent',
  },
  {
    id: 'remont-otv-materials',
    role: 'otvetstvennyy',
    base: 'materialsProfit',
    value: 30,
    unit: 'percent',
  },
];

let idCounter = 0;

/** Локальный id правила — только для React-ключей и правки в UI. */
export const newRuleId = (): string => {
  idCounter += 1;

  return `r${Date.now().toString(36)}${idCounter}`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Число из чего угодно: пусто/мусор → 0; запятая как разделитель тоже принимается. */
export const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const parsed = Number(value.trim().replace(',', '.'));

  return Number.isFinite(parsed) ? parsed : 0;
};

export const toPercent = (value: unknown): number =>
  clamp(toNumber(value), 0, MAX_PERCENT);

export const toMoney = (value: unknown): number =>
  clamp(toNumber(value), 0, MAX_MONEY);

/** Значение правила: проценты режем по 100, деньги — по потолку. */
export const clampByUnit = (value: unknown, unit: ProfitUnit): number =>
  unit === 'percent' ? toPercent(value) : toMoney(value);

/** Строка из поля ввода → число (пусто → 0, запятая как разделитель). */
export const parseRateInputSafe = (value: string): number => toNumber(value);

export const isDirection = (value: unknown): value is ProfitDirection =>
  typeof value === 'string' && DIRECTION_ORDER.includes(value as ProfitDirection);

export const isBase = (value: unknown): value is ProfitBase =>
  typeof value === 'string' && BASE_ORDER.includes(value as ProfitBase);

export const isRole = (value: unknown): value is ProfitRole =>
  typeof value === 'string' && ROLE_ORDER.includes(value as ProfitRole);

export const isUnit = (value: unknown): value is ProfitUnit =>
  value === 'percent' || value === 'rub';

const normalizeRule = (value: unknown): DirectionRule | null => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (!isRole(candidate.role) || !isBase(candidate.base)) {
    return null;
  }

  const unit = isUnit(candidate.unit) ? candidate.unit : 'percent';

  return {
    id:
      typeof candidate.id === 'string' && candidate.id.length > 0
        ? candidate.id
        : newRuleId(),
    role: candidate.role,
    base: candidate.base,
    value: clampByUnit(candidate.value, unit),
    unit,
  };
};

const normalizePersonalRule = (value: unknown): PersonalRule | null => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.memberId !== 'string' ||
    candidate.memberId.length === 0 ||
    !isBase(candidate.base)
  ) {
    return null;
  }

  const unit = isUnit(candidate.unit) ? candidate.unit : 'percent';

  return {
    id:
      typeof candidate.id === 'string' && candidate.id.length > 0
        ? candidate.id
        : newRuleId(),
    memberId: candidate.memberId,
    direction: isDirection(candidate.direction) ? candidate.direction : 'remont',
    base: candidate.base,
    value: clampByUnit(candidate.value, unit),
    unit,
  };
};

const normalizeDirectionSettings = (value: unknown): DirectionSettings => {
  const fallback = emptyDirectionSettings();

  if (value === null || typeof value !== 'object') {
    return fallback;
  }

  const candidate = value as { rules?: unknown; contractorDeduction?: unknown; materialsMarkupPercent?: unknown };
  const rules = Array.isArray(candidate.rules)
    ? candidate.rules
        .map(normalizeRule)
        .filter((rule): rule is DirectionRule => rule !== null)
    : [];

  return {
    contractorDeduction: candidate.contractorDeduction !== false,
    materialsMarkupPercent:
      candidate.materialsMarkupPercent === undefined
        ? DEFAULT_MARKUP_PERCENT
        : toPercent(candidate.materialsMarkupPercent),
    rules,
  };
};

export const normalizeProfitSettings = (value: unknown): ProfitSettings => {
  const fallback = defaultProfitSettings();

  if (value === null || typeof value !== 'object') {
    return fallback;
  }

  const candidate = value as {
    directions?: unknown;
    personal?: unknown;
    seesAll?: unknown;
  };
  const directions = { ...fallback.directions };

  if (candidate.directions !== null && typeof candidate.directions === 'object') {
    for (const direction of DIRECTION_ORDER) {
      directions[direction] = normalizeDirectionSettings(
        (candidate.directions as Record<string, unknown>)[direction],
      );
    }
  }

  const personal = Array.isArray(candidate.personal)
    ? candidate.personal
        .map(normalizePersonalRule)
        .filter((rule): rule is PersonalRule => rule !== null)
    : [];

  const seesAll = Array.isArray(candidate.seesAll)
    ? candidate.seesAll.filter(
        (item): item is string => typeof item === 'string' && item.length > 0,
      )
    : [];

  return { directions, personal, seesAll };
};

/** Настройки направления; неизвестное направление → пустые значения. */
export const resolveDirection = (
  settings: ProfitSettings,
  direction: ProfitDirection,
): DirectionSettings =>
  settings.directions[direction] ?? emptyDirectionSettings();

/** Персональные правила конкретного сотрудника. */
export const personalRulesOf = (
  settings: ProfitSettings,
  memberId: string,
): PersonalRule[] => settings.personal.filter((rule) => rule.memberId === memberId);
