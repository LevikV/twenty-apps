import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FREEZE_MESSAGE,
  defaultRecordRulesConfig,
  getFreezeMode,
  hasUsableRules,
  MAX_FREEZE_ALLOWED_FIELDS,
  normalizeRecordRulesConfig,
  resolveFreezeMessage,
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
      freezeEnabled: true,
      freezeValues: [],
      freezeAllowedFields: ['kommentariy'],
      freezeMessage: '',
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
      freezeEnabled: false,
      freezeValues: [],
      freezeAllowedFields: [],
      freezeMessage: '',
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

describe('заморозка записи (Задача 3)', () => {
  const normalizeOne = (raw: unknown) => {
    const config = normalizeRecordRulesConfig({ rules: [raw] });

    expect(config.rules).toHaveLength(1);

    return config.rules[0];
  };

  it('у старого правила (полей заморозки нет) заморозка выключена', () => {
    const rule = normalizeOne({
      objectName: 'remontOborudovaniya',
      fieldName: 'stadiya',
      allowedValues: ['V_RABOTE'],
    });

    expect(rule.freezeEnabled).toBe(false);
    expect(rule.freezeValues).toEqual([]);
    expect(rule.freezeAllowedFields).toEqual([]);
    expect(rule.freezeMessage).toBe('');
    expect(getFreezeMode(rule)).toBe('OFF');
  });

  it('пустой freezeValues — закрыто всё, чего нет в разрешённом наборе', () => {
    const rule = normalizeOne({
      objectName: 'remontOborudovaniya',
      fieldName: 'stadiya',
      allowedValues: ['V_RABOTE'],
      freezeEnabled: true,
      freezeValues: [],
    });

    expect(getFreezeMode(rule)).toBe('OUTSIDE_ALLOWED');
  });

  it('заполненный freezeValues — отдельный набор стадий-замков', () => {
    const rule = normalizeOne({
      objectName: 'remontOborudovaniya',
      fieldName: 'stadiya',
      allowedValues: ['V_RABOTE'],
      freezeEnabled: true,
      freezeValues: ['VYDAN', ' GOTOVO_K_VYDACHE ', 'VYDAN', ''],
    });

    expect(rule.freezeValues).toEqual(['VYDAN', 'GOTOVO_K_VYDACHE']);
    expect(getFreezeMode(rule)).toBe('CUSTOM');
  });

  it('чистит и ограничивает список полей-исключений', () => {
    const manyFields = Array.from({ length: 150 }, (_, index) => `pole${index}`);

    const rule = normalizeOne({
      objectName: 'remontOborudovaniya',
      fieldName: 'stadiya',
      allowedValues: ['V_RABOTE'],
      freezeEnabled: true,
      freezeAllowedFields: [' kommentariy ', 'kommentariy', '', 42, ...manyFields],
    });

    expect(rule.freezeAllowedFields[0]).toBe('kommentariy');
    expect(rule.freezeAllowedFields).toHaveLength(MAX_FREEZE_ALLOWED_FIELDS);
    expect(rule.freezeAllowedFields).not.toContain('');
  });

  it('битые значения заморозки не ломают правило', () => {
    const rule = normalizeOne({
      objectName: 'remontOborudovaniya',
      fieldName: 'stadiya',
      allowedValues: ['V_RABOTE'],
      freezeEnabled: 'да',
      freezeValues: 'нет',
      freezeAllowedFields: { поле: 1 },
      freezeMessage: 123,
    });

    expect(rule.freezeEnabled).toBe(false);
    expect(rule.freezeValues).toEqual([]);
    expect(rule.freezeAllowedFields).toEqual([]);
    expect(rule.freezeMessage).toBe('');
  });

  it('текст отказа: своё значение или текст по умолчанию', () => {
    const withOwnMessage = normalizeOne({
      objectName: 'remontOborudovaniya',
      fieldName: 'stadiya',
      allowedValues: ['V_RABOTE'],
      freezeEnabled: true,
      freezeMessage: 'Ремонт закрыт — правки запрещены',
    });

    expect(resolveFreezeMessage(withOwnMessage)).toBe(
      'Ремонт закрыт — правки запрещены',
    );

    const withoutMessage = normalizeOne({
      objectName: 'remontOborudovaniya',
      fieldName: 'stadiya',
      allowedValues: ['V_RABOTE'],
      freezeEnabled: true,
    });

    expect(resolveFreezeMessage(withoutMessage)).toBe(DEFAULT_FREEZE_MESSAGE);
  });
});
