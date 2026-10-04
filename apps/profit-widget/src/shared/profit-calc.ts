/**
 * Расчёт профита (ЗП) — чистая часть, без серверных зависимостей.
 *
 * Логика (согласована 2026-10-03):
 *   • база услуг = сумма работ − стоимость подрядчика (если в направлении включён вычет);
 *   • прибыль по товарам (материалам) = сумма − сумма / (1 + наценка/100);
 *   • правило направления: роль в записи → база × значение (процент или рубли);
 *   • персональные правила — исключения для конкретного сотрудника;
 *   • «видит всё» — показываем профит по ролям записи и итог.
 *
 * Модуль импортирует и виджет (песочница), и — при желании — серверные функции,
 * поэтому здесь нет ни kv, ни клиентов CRM.
 */

import {
  BASE_LABELS,
  ROLE_LABELS,
  UNIT_LABELS,
  personalRulesOf,
  resolveDirection,
  type DirectionSettings,
  type ProfitBase,
  type ProfitDirection,
  type ProfitRole,
  type ProfitSettings,
  type ProfitUnit,
} from 'src/shared/profit-rules';

export type ProfitInputs = {
  /** Стоимость работ. */
  services: number;
  /** Стоимость материалов. */
  materials: number;
  /** Стоимость подрядчика. */
  contractorCost: number;
  /** Единиц товара (для «фикс за единицу»); по умолчанию 1. */
  units: number;
  /** Какой сотрудник (sotrudnik id) стоит в записи в каждой роли. */
  roleEmployeeIds: Partial<Record<ProfitRole, string | null>>;
};

export type ProfitRow = {
  id: string;
  title: string;
  rate: string;
  base: number;
  amount: number;
};

export type ProfitGroup = {
  role: ProfitRole;
  employeeId: string | null;
  rows: ProfitRow[];
  total: number;
};

export type ProfitBreakdown = {
  /** Строки смотрящего. */
  rows: ProfitRow[];
  /** Разбивка по ролям для «видит всё». */
  groups: ProfitGroup[];
  total: number;
  /** Есть ли вообще что показывать этому сотруднику. */
  hasProfit: boolean;
};

const safe = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

/** Значение базы в рублях. */
export const baseValue = (
  base: ProfitBase,
  inputs: ProfitInputs,
  settings: DirectionSettings,
): number => {
  switch (base) {
    case 'services': {
      const deduction = settings.contractorDeduction
        ? safe(inputs.contractorCost)
        : 0;

      return Math.max(safe(inputs.services) - deduction, 0);
    }

    case 'goodsProfit': {
      const markup = settings.materialsMarkupPercent;
      const materials = safe(inputs.materials);

      if (materials === 0) {
        return 0;
      }

      const purchase = markup > -100 ? materials / (1 + markup / 100) : materials;

      return Math.max(materials - purchase, 0);
    }

    case 'materialsSum':
      return safe(inputs.materials);

    case 'fixedPerItem':
      return safe(inputs.units);

    default:
      return 0;
  }
};

const amountByRate = (value: number, unit: ProfitUnit, base: number): number =>
  unit === 'percent' ? (base * value) / 100 : value;

export const formatRate = (value: number, unit: ProfitUnit): string =>
  unit === 'percent' ? `${value} ${UNIT_LABELS.percent}` : formatMoney(value);

/** Деньги без Intl: «1 234 ₽» (в песочнице Intl может быть недоступен). */
export const formatMoney = (value: number): string => {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '−' : '';
  const digits = String(Math.abs(rounded));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return `${sign}${grouped} ₽`;
};

const rowsForRole = (
  settings: ProfitSettings,
  direction: ProfitDirection,
  inputs: ProfitInputs,
  role: ProfitRole,
): ProfitRow[] => {
  const directionSettings = resolveDirection(settings, direction);
  const employeeId = inputs.roleEmployeeIds[role] ?? null;

  if (!employeeId) {
    return [];
  }

  return directionSettings.rules
    .filter((rule) => rule.role === role)
    .map((rule) => {
      const base = baseValue(rule.base, inputs, directionSettings);

      return {
        id: rule.id,
        title: `${ROLE_LABELS[rule.role]} · ${BASE_LABELS[rule.base]}`,
        rate: formatRate(rule.value, rule.unit),
        base,
        amount: amountByRate(rule.value, rule.unit, base),
      };
    })
    .filter((row) => row.amount !== 0);
};

const rowsForPersonal = (
  settings: ProfitSettings,
  direction: ProfitDirection,
  inputs: ProfitInputs,
  memberId: string,
): ProfitRow[] => {
  const directionSettings = resolveDirection(settings, direction);

  return personalRulesOf(settings, memberId)
    .filter((rule) => rule.direction === direction)
    .map((rule) => {
      const base = baseValue(rule.base, inputs, directionSettings);

      return {
        id: rule.id,
        title: `Персональное правило · ${BASE_LABELS[rule.base]}`,
        rate: formatRate(rule.value, rule.unit),
        base,
        amount: amountByRate(rule.value, rule.unit, base),
      };
    })
    .filter((row) => row.amount !== 0);
};

const sum = (rows: ProfitRow[]): number =>
  rows.reduce((total, row) => total + row.amount, 0);

/**
 * Профит для смотрящего.
 *
 * Если у сотрудника стоит «видит всё» — возвращаем разбивку по ролям записи
 * (и итог), иначе только его собственные строки.
 */
export const calculateProfit = (
  settings: ProfitSettings,
  direction: ProfitDirection,
  inputs: ProfitInputs,
  viewer: { memberId: string | null; employeeId: string | null; seesAll: boolean },
): ProfitBreakdown => {
  const ownPersonal = viewer.memberId
    ? rowsForPersonal(settings, direction, inputs, viewer.memberId)
    : [];

  if (viewer.seesAll) {
    const groups = (['master', 'otvetstvennyy'] as ProfitRole[])
      .map((role) => {
        const rows = rowsForRole(settings, direction, inputs, role);

        return {
          role,
          employeeId: inputs.roleEmployeeIds[role] ?? null,
          rows,
          total: sum(rows),
        };
      })
      .filter((group) => group.employeeId !== null);

    const rows = [...groups.flatMap((group) => group.rows), ...ownPersonal];

    return { rows, groups, total: sum(rows), hasProfit: rows.length > 0 };
  }

  const rows = viewer.employeeId
    ? [
        ...(['master', 'otvetstvennyy', 'priyomshchik'] as ProfitRole[])
          .filter((role) => inputs.roleEmployeeIds[role] === viewer.employeeId)
          .flatMap((role) => rowsForRole(settings, direction, inputs, role)),
        ...ownPersonal,
      ]
    : ownPersonal;

  return { rows, groups: [], total: sum(rows), hasProfit: rows.length > 0 };
};
