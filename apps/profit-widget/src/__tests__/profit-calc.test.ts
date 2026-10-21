import { describe, expect, it } from 'vitest';

import { calculateProfit, formatMoney } from 'src/shared/profit-calc';
import {
  BASE_ORDER,
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

  it('«видит всё» видит и правила приёмщика (роли не теряются)', () => {
    const value = settings();
    value.directions.remont.rules = [
      ...remontStarterRules(),
      { id: 'p-services', role: 'priyomshchik', base: 'services', value: 5, unit: 'percent' },
      { id: 'p-goods', role: 'priyomshchik', base: 'goodsProfit', value: 5, unit: 'percent' },
    ];

    const result = calculateProfit(value, 'remont', inputs(), {
      memberId: 'M-BOSS',
      employeeId: 'EMP-BOSS',
      seesAll: true,
    });

    expect(result.groups.map((group) => group.role)).toEqual([
      'master',
      'otvetstvennyy',
      'priyomshchik',
    ]);
    // 5 % от 2070 = 103,5; 5 % от (560 − 560/1,5) = 5 % от 186,67 = 9,33
    expect(result.groups[2].total).toBeCloseTo(112.83, 1);
    expect(result.total).toBeCloseTo(2238.83, 1);
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
 * Товары и товары по учёту (заказы и ремонты — одна логика):
 *   «Прибыль по товарам (материалам)»    = товары − товары / (1 + наценка/100);
 *   «Прибыль по товарам (от факт. учёта)» = товары − учётная стоимость товаров;
 *   профит ответственного — 30 % от базы; у кого «видит всё» вторая цифра показывается
 *   справочно и в профит не входит. Услуги в заказах в расчёт не участвуют.
 */
const goodsSettings = (direction: 'zakaz' | 'remont'): ProfitSettings => {
  const value = defaultProfitSettings();

  value.directions[direction].rules = [
    {
      id: `${direction}-otv-profit`,
      role: 'otvetstvennyy',
      base: 'goodsProfit',
      value: 30,
      unit: 'percent',
    },
  ];
  value.directions[direction].materialsMarkupPercent = 50;

  return value;
};

const goodsInputs = (
  materials: number,
  materialsUchet?: number,
  employee = 'EMP-DIMOV',
): Parameters<typeof calculateProfit>[2] => ({
  services: 0,
  materials,
  contractorCost: 0,
  units: 1,
  materialsUchet,
  roleEmployeeIds: { otvetstvennyy: employee },
});

describe('прибыль по товарам — заказы', () => {
  it('считается от стоимости товаров, а не от суммы заказа', () => {
    const orders = [
      { name: 'НФФР-000296', goods: 8630, uchet: 4446.29, base: 2876.67, profit: 863 },
      { name: 'НФФР-000289', goods: 9064, uchet: 6042.67, base: 3021.33, profit: 906.4 },
      { name: 'НФФР-000510', goods: 21090, uchet: 14800, base: 7030, profit: 2109 },
      { name: 'НФФР-000034', goods: 147200, uchet: 67337.33, base: 49066.67, profit: 14720 },
      { name: 'НФФР-000143', goods: 189000, uchet: 126000, base: 63000, profit: 18900 },
    ];

    let totalProfit = 0;

    orders.forEach((order) => {
      const result = calculateProfit(
        goodsSettings('zakaz'),
        'zakaz',
        goodsInputs(order.goods, order.uchet),
        { memberId: 'M-DIMOV', employeeId: 'EMP-DIMOV', seesAll: false },
      );

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
      goodsSettings('zakaz'),
      'zakaz',
      goodsInputs(21090, 14800),
      { memberId: 'M-BOSS', employeeId: 'EMP-BOSS', seesAll: true },
    );

    expect(result.total).toBeCloseTo(2109, 5);
    expect(result.reference?.rows[0].base).toBeCloseTo(6290, 5);
    expect(result.reference?.rows[0].amount).toBeCloseTo(1887, 5);
    expect(result.reference?.total).toBeCloseTo(1887, 5);
  });

  it('без учётной стоимости справочного блока нет', () => {
    const result = calculateProfit(
      goodsSettings('zakaz'),
      'zakaz',
      goodsInputs(21090),
      { memberId: 'M-BOSS', employeeId: 'EMP-BOSS', seesAll: true },
    );

    expect(result.total).toBeCloseTo(2109, 5);
    expect(result.reference).toBeNull();
  });

  it('запись без ответственного — профита нет', () => {
    const result = calculateProfit(
      goodsSettings('zakaz'),
      'zakaz',
      { ...goodsInputs(21090, 14800), roleEmployeeIds: {} },
      { memberId: 'M-BOSS', employeeId: 'EMP-BOSS', seesAll: true },
    );

    expect(result.groups).toEqual([]);
    expect(result.hasProfit).toBe(false);
  });
});

describe('прибыль по товарам — ремонт', () => {
  it('та же логика: «от наценки» и справочно «от учёта»', () => {
    const value = goodsSettings('remont');
    const result = calculateProfit(
      value,
      'remont',
      {
        services: 0,
        materials: 560,
        contractorCost: 0,
        units: 1,
        materialsUchet: 400,
        roleEmployeeIds: { otvetstvennyy: 'EMP-SHIP' },
      },
      { memberId: 'M-SHIP', employeeId: 'EMP-SHIP', seesAll: false },
    );

    // 560 − 560/1,5 = 186,67 → 30 % = 56
    expect(result.total).toBeCloseTo(56, 2);
    expect(result.reference).toBeNull(); // у сотрудника справочной цифры нет
  });

  it('руководителю по ремонту тоже показывается справочная цифра', () => {
    const result = calculateProfit(
      goodsSettings('remont'),
      'remont',
      {
        services: 0,
        materials: 560,
        contractorCost: 0,
        units: 1,
        materialsUchet: 400,
        roleEmployeeIds: { otvetstvennyy: 'EMP-SHIP' },
      },
      { memberId: 'M-BOSS', employeeId: 'EMP-BOSS', seesAll: true },
    );

    // 560 − 400 = 160 → 30 % = 48
    expect(result.reference?.rows[0].base).toBeCloseTo(160, 5);
    expect(result.reference?.rows[0].amount).toBeCloseTo(48, 5);
  });
});

describe('модель настроек', () => {
  it('база «от фактического учёта» доступна всем направлениям', () => {
    expect(basesForDirection('zakaz')).toEqual(BASE_ORDER);
    expect(basesForDirection('remont')).toEqual(BASE_ORDER);
    expect(BASE_ORDER).toContain('goodsProfitUchet');
  });

  it('правило с новой базой переживает сохранение', () => {
    const value = goodsSettings('zakaz');

    value.directions.zakaz.rules.push({
      id: 'zakaz-otv-uchet',
      role: 'otvetstvennyy',
      base: 'goodsProfitUchet',
      value: 10,
      unit: 'percent',
    });

    const restored = normalizeProfitSettings(JSON.parse(JSON.stringify(value)) as unknown);

    expect(restored.directions.zakaz.rules).toHaveLength(2);
    expect(restored.directions.zakaz.rules[1].base).toBe('goodsProfitUchet');
  });
});
