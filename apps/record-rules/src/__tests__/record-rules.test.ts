import { describe, expect, it } from 'vitest';

import {
  defaultRecordRulesConfig,
  hasUsableRules,
  normalizeRecordRulesConfig,
} from 'src/shared/record-rules';

describe('normalizeRecordRulesConfig', () => {
  it('пустое и битое значение даёт пустую конфигурацию', () => {
    expect(normalizeRecordRulesConfig(null)).toEqual({ rules: [] });
    expect(normalizeRecordRulesConfig(undefined)).toEqual({ rules: [] });
    expect(normalizeRecordRulesConfig('мусор')).toEqual({ rules: [] });
    expect(normalizeRecordRulesConfig({ rules: 'нет' })).toEqual({ rules: [] });
    expect(defaultRecordRulesConfig()).toEqual({ rules: [] });
  });

  it('чистит поля правила и подставляет безопасные значения по умолчанию', () => {
    const config = normalizeRecordRulesConfig({
      rules: [
        {
          objectName: '  remontOborudovaniya ',
          fieldName: 'stadiya',
          action: 'неизвестное',
          allowedValues: [' V_RABOTE ', 'V_RABOTE', '', 42],
        },
      ],
    });

    expect(config.rules).toHaveLength(1);

    const rule = config.rules[0];

    expect(rule.objectName).toBe('remontOborudovaniya');
    expect(rule.fieldName).toBe('stadiya');
    expect(rule.action).toBe('UPDATE');
    expect(rule.allowedValues).toEqual(['V_RABOTE']);
    expect(rule.onlyFromSet).toBe(true);
    expect(rule.active).toBe(true);
    expect(rule.applyToServiceChanges).toBe(false);
    expect(rule.roleName).toBeNull();
    expect(rule.sotrudnikId).toBeNull();
    expect(rule.id).toMatch(/^rr-/);
  });

  it('сохраняет корректное правило без изменений', () => {
    const rule = {
      id: 'rr-test',
      objectName: 'remontOborudovaniya',
      fieldName: 'stadiya',
      action: 'BOTH',
      roleName: 'Мастер по оборудованию',
      sotrudnikId: null,
      allowedValues: ['V_OCHEREDI', 'V_RABOTE'],
      onlyFromSet: true,
      message: 'Мастеру недоступна стадия «{название}»',
      active: true,
      applyToServiceChanges: false,
    };

    const config = normalizeRecordRulesConfig({ rules: [rule] });

    expect(config.rules[0]).toEqual(rule);
  });

  it('не выбрасывает правило без объекта или поля — движок его пропустит', () => {
    const config = normalizeRecordRulesConfig({
      rules: [{ id: 'rr-x', objectName: '', fieldName: '', allowedValues: [] }],
    });

    expect(config.rules).toHaveLength(1);
    expect(hasUsableRules(config)).toBe(false);
  });
});

describe('hasUsableRules', () => {
  it('истинно только для активного правила с объектом, полем и значениями', () => {
    const base = {
      id: 'rr-1',
      objectName: 'remontOborudovaniya',
      fieldName: 'stadiya',
      action: 'UPDATE' as const,
      roleName: 'Мастер по оборудованию',
      sotrudnikId: null,
      onlyFromSet: true,
      message: '',
      applyToServiceChanges: false,
    };

    expect(
      hasUsableRules({ rules: [{ ...base, allowedValues: ['V_RABOTE'], active: true }] }),
    ).toBe(true);
    expect(
      hasUsableRules({ rules: [{ ...base, allowedValues: [], active: true }] }),
    ).toBe(false);
    expect(
      hasUsableRules({ rules: [{ ...base, allowedValues: ['V_RABOTE'], active: false }] }),
    ).toBe(false);
  });
});
