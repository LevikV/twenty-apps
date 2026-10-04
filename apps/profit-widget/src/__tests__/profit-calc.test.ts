import { describe, expect, it } from 'vitest';

import { calculateProfit, formatMoney } from 'src/shared/profit-calc';
import {
  defaultProfitSettings,
  remontStarterRules,
  type ProfitSettings,
} from 'src/shared/profit-rules';

/**
 * Проверка расчёта на живых числах.
 * Запись ДС56481: работы 2070 ₽, материалы 560 ₽, подрядчика нет.
 * Мастер 80 % работ; Ответственный 20 % работ + 30 % прибыли по материалам;
 * прибыль по материалам при наценке 50 % = 560 − 560/1,5 ≈ 186,67 ₽.
 */

const settings = (): ProfitSettings => {
  const value = defaultProfitSettings();

  value.directions.remont.rules = remontStarterRules();
  value.directions.remont.materialsMarkupPercent = 50;
  value.directions.remont.contractorDeduction = true;

  return value;
};

const inputs = (overrides: Partial<Parameters<typeof calculateProfit>[2]> = {}) => ({
  services: 2070,
  materials: 560,
  contractorCost: 0,
  units: 1,
  roleEmployeeIds: {
    master: 'EMP-SHIP',
    otvetstvennyy: 'EMP-SHIP',
    priyomshchik: 'EMP-SHIP',
  },
  ...overrides,
});

describe('расчёт профита по ремонту', () => {
  it('мастер и ответственный видят только свои строки', () => {
    const result = calculateProfit(settings(), 'remont', inputs(), {
      memberId: 'M-SHIP',
      employeeId: 'EMP-SHIP',
      seesAll: false,
    });

    // 80 % от 2070 = 1656; 20 % = 414; 30 % от 186,67 = 56
    expect(result.rows.map((row) => Math.round(row.amount))).toEqual([1656, 414, 56]);
    expect(result.total).toBeCloseTo(2126, 5);
    expect(result.hasProfit).toBe(true);
    expect(result.groups).toEqual([]);
  });

  it('подрядчик уменьшает базу услуг', () => {
    const result = calculateProfit(
      settings(),
      'remont',
      inputs({ services: 5000, contractorCost: 3000, materials: 0 }),
      { memberId: 'M-SHIP', employeeId: 'EMP-SHIP', seesAll: false },
    );

    // база 2000: мастер 1600, ответственный 400
    expect(result.rows.map((row) => Math.round(row.amount))).toEqual([1600, 400]);
    expect(result.total).toBeCloseTo(2000, 5);
  });

  it('«видит всё» получает разбивку по ролям и итог', () => {
    const result = calculateProfit(settings(), 'remont', inputs(), {
      memberId: 'M-BOSS',
      employeeId: 'EMP-BOSS',
      seesAll: true,
    });

    expect(result.groups.map((group) => group.role)).toEqual([
      'master',
      'otvetstvennyy',
    ]);
    expect(result.groups[0].total).toBeCloseTo(1656, 5);
    expect(result.groups[1].total).toBeCloseTo(470, 5);
    expect(result.total).toBeCloseTo(2126, 5);
  });

  it('не участник записи — профита нет', () => {
    const result = calculateProfit(settings(), 'remont', inputs(), {
      memberId: 'M-OTHER',
      employeeId: 'EMP-OTHER',
      seesAll: false,
    });

    expect(result.hasProfit).toBe(false);
    expect(result.total).toBe(0);
  });

  it('персональное правило считается от своей базы', () => {
    const value = settings();

    value.personal = [
      {
        id: 'p1',
        memberId: 'M-SHIP',
        direction: 'remont',
        base: 'materialsSum',
        value: 20,
        unit: 'percent',
      },
    ];

    const result = calculateProfit(value, 'remont', inputs(), {
      memberId: 'M-SHIP',
      employeeId: 'EMP-SHIP',
      seesAll: false,
    });

    // 2126 + 20 % от 560
    expect(result.total).toBeCloseTo(2238, 5);
  });

  it('деньги форматируются без Intl', () => {
    expect(formatMoney(2126.4)).toBe('2 126 ₽');
    expect(formatMoney(0)).toBe('0 ₽');
  });
});
