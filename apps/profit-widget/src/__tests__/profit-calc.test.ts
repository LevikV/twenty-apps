import { describe, expect, it } from 'vitest';

import { calculateProfit, formatMoney } from 'src/shared/profit-calc';
import {
  basesForDirection,
  defaultProfitSettings,
  normalizeProfitSettings,
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

/**
 * Заказы (согласовано 2026-10-15):
 *   база «от наценки» = сумма − сумма/1,5 (наценка 50 %); профит ответственного — 30 % от неё;
 *   у кого «видит всё» — дополнительно справочная цифра «от фактического учёта» (сумма − учёт).
 * Эталонные заказы — из разведки 15.10.2026 (см. план «Профит по заказам», этап 1).
 */
const orderSettings = (): ProfitSettings => {
  const value = defaultProfitSettings();

  value.directions.zakaz.rules = [
    {
      id: 'zakaz-otv-profit',
      role: 'otvetstvennyy',
      base: 'orderProfit',
      value: 30,
      unit: 'percent',
    },
  ];
  value.directions.zakaz.materialsMarkupPercent = 50;

  return value;
};

const orderInputs = (total: number, uchet: number, employee = 'EMP-DIMOV') => ({
  services: 0,
  materials: 0,
  contractorCost: 0,
  units: 1,
  orderTotal: total,
  uchetCost: uchet,
  roleEmployeeIds: { otvetstvennyy: employee },
});

describe('расчёт профита по заказам', () => {
  it('«от наценки» и профит 30 % сходятся с эталоном этапа 1', () => {
    const orders = [
      { name: 'НФФР-000296', total: 8630, uchet: 4446.29, base: 2876.67, profit: 863 },
      { name: 'НФФР-000289', total: 9064, uchet: 6042.67, base: 3021.33, profit: 906.4 },
      { name: 'НФФР-000510', total: 21090, uchet: 14800, base: 7030, profit: 2109 },
      { name: 'НФФР-000034', total: 147200, uchet: 67337.33, base: 49066.67, profit: 14720 },
      { name: 'НФФР-000143', total: 189000, uchet: 126000, base: 63000, profit: 18900 },
    ];

    let totalProfit = 0;

    orders.forEach((order) => {
      const result = calculateProfit(orderSettings(), 'zakaz', orderInputs(order.total, order.uchet), {
        memberId: 'M-DIMOV',
        employeeId: 'EMP-DIMOV',
        seesAll: false,
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].base).toBeCloseTo(order.base, 2);
      expect(result.rows[0].amount).toBeCloseTo(order.profit, 2);
      expect(result.hasProfit).toBe(true);
      expect(result.reference).toBeNull();

      totalProfit += result.rows[0].amount;
    });

    expect(totalProfit).toBeCloseTo(37498.4, 2);
  });

  it('«видит всё» дополнительно получает справочный расчёт «от фактического учёта»', () => {
    const result = calculateProfit(
      orderSettings(),
      'zakaz',
      orderInputs(21090, 14800),
      { memberId: 'M-BOSS', employeeId: 'EMP-BOSS', seesAll: true },
    );

    // профит ответственного — 30 % от прибыли «от наценки»: 21090/3 = 7030 → 2109
    expect(result.total).toBeCloseTo(2109, 5);
    expect(result.reference).not.toBeNull();
    // справочно: 21090 − 14800 = 6290 → 30 % = 1887
    expect(result.reference?.rows[0].base).toBeCloseTo(6290, 5);
    expect(result.reference?.rows[0].amount).toBeCloseTo(1887, 5);
    expect(result.reference?.total).toBeCloseTo(1887, 5);
  });

  it('заказ без ответственного — профита нет и справочной цифры тоже', () => {
    const result = calculateProfit(
      orderSettings(),
      'zakaz',
      { ...orderInputs(21090, 14800), roleEmployeeIds: {} },
      { memberId: 'M-BOSS', employeeId: 'EMP-BOSS', seesAll: true },
    );

    expect(result.groups).toEqual([]);
    expect(result.hasProfit).toBe(false);
    expect(result.reference).toBeNull();
  });

  it('правила по заказам не срабатывают на ремонте', () => {
    const result = calculateProfit(
      orderSettings(),
      'remont',
      inputs({ orderTotal: 21090, uchetCost: 14800 }),
      { memberId: 'M-DIMOV', employeeId: 'EMP-SHIP', seesAll: false },
    );

    expect(result.hasProfit).toBe(false);
    expect(result.total).toBe(0);
  });

  it('базы заказов доступны в настройках только направлению «Заказы» и переживают сохранение', () => {
    expect(basesForDirection('zakaz')).toEqual([
      'services',
      'goodsProfit',
      'materialsSum',
      'fixedPerItem',
      'orderProfit',
      'orderProfitUchet',
    ]);
    expect(basesForDirection('remont')).toEqual([
      'services',
      'goodsProfit',
      'materialsSum',
      'fixedPerItem',
    ]);

    const restored = normalizeProfitSettings(
      JSON.parse(JSON.stringify(orderSettings())) as unknown,
    );

    expect(restored.directions.zakaz.rules).toHaveLength(1);
    expect(restored.directions.zakaz.rules[0].base).toBe('orderProfit');
    expect(restored.directions.zakaz.rules[0].value).toBe(30);
  });
});
