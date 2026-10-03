/**
 * Настройки профита — чистая часть (без серверных зависимостей).
 *
 * Модуль импортируют и экран настроек (песочница фронт-компонента), и серверные
 * логик-функции, поэтому здесь нет ни kv, ни клиентов CRM.
 *
 * На каждого пользователя CRM — своя строка:
 *   servicesPercent  — процент от суммы услуг;
 *   materialsPercent — процент от прибыли по материалам;
 *   fixedRate        — фиксированная ставка (задел под заправки);
 *   seesAll          — «видит всё»: руководитель видит и профит мастера, и профит менеджера.
 *
 * Тип расчёта здесь НЕ хранится: он берётся из самой записи —
 * стоит сотрудник Мастером → мастерский расчёт, стоит Ответственным → менеджерский.
 */

export type ProfitRate = {
  servicesPercent: number;
  materialsPercent: number;
  fixedRate: number;
  seesAll: boolean;
};

export type ProfitSettings = {
  /** workspaceMemberId → ставки сотрудника. */
  rates: Record<string, ProfitRate>;
};

/** Процент не может быть больше 100. */
export const MAX_PERCENT = 100;

/** Разумный потолок фиксированной ставки, чтобы опечатка не уехала в расчёт. */
export const MAX_FIXED_RATE = 10_000_000;

export const emptyProfitRate = (): ProfitRate => ({
  servicesPercent: 0,
  materialsPercent: 0,
  fixedRate: 0,
  seesAll: false,
});

export const emptyProfitSettings = (): ProfitSettings => ({ rates: {} });

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

export const toFixedRate = (value: unknown): number =>
  clamp(toNumber(value), 0, MAX_FIXED_RATE);

/** Строка из поля ввода → число (для экрана настроек). Пусто → 0. */
export const parseRateInput = (value: string): number => toNumber(value);

export const normalizeProfitRate = (value: unknown): ProfitRate => {
  if (value === null || typeof value !== 'object') {
    return emptyProfitRate();
  }

  const candidate = value as Record<string, unknown>;

  return {
    servicesPercent: toPercent(candidate.servicesPercent),
    materialsPercent: toPercent(candidate.materialsPercent),
    fixedRate: toFixedRate(candidate.fixedRate),
    seesAll: candidate.seesAll === true,
  };
};

export const normalizeProfitSettings = (value: unknown): ProfitSettings => {
  if (value === null || typeof value !== 'object') {
    return emptyProfitSettings();
  }

  const candidate = value as { rates?: unknown };
  const rates: Record<string, ProfitRate> = {};

  if (candidate.rates !== null && typeof candidate.rates === 'object') {
    for (const [memberId, rate] of Object.entries(
      candidate.rates as Record<string, unknown>,
    )) {
      if (typeof memberId === 'string' && memberId.length > 0) {
        rates[memberId] = normalizeProfitRate(rate);
      }
    }
  }

  return { rates };
};

/** Ставки конкретного сотрудника; нет строки — нули. */
export const resolveProfitRate = (
  settings: ProfitSettings,
  workspaceMemberId: string,
): ProfitRate => settings.rates[workspaceMemberId] ?? emptyProfitRate();

/** Строка «настроена» — есть ли у сотрудника хоть один ненулевой параметр. */
export const isConfigured = (rate: ProfitRate): boolean =>
  rate.servicesPercent > 0 ||
  rate.materialsPercent > 0 ||
  rate.fixedRate > 0 ||
  rate.seesAll;
