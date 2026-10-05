import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { defineSettingsFrontComponent } from 'twenty-sdk/define';

import { RECORD_RULES_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  ACTION_LABELS,
  ACTION_ORDER,
  DEFAULT_RULE_MESSAGE,
  defaultRecordRulesConfig,
  newRuleId,
  normalizeRecordRulesConfig,
  type RecordRule,
  type RecordRuleAction,
  type RecordRulesConfig,
} from 'src/shared/record-rules';
import type {
  RecordRuleFieldOption,
  RecordRuleSelectableObject,
} from 'src/shared/record-rules-metadata';

/**
 * Экран настроек приложения «Правила записи».
 *
 * Правила живут во внутреннем хранилище приложения (kv) и читаются/пишутся
 * маршрутами `record-rules` и `record-rules-save`. Список объектов и их
 * полей-списков с живыми опциями приходит с `record-rules-metadata` —
 * поэтому галочки «допустимые значения» всегда актуальны и ничего
 * синхронизировать не нужно.
 *
 * Роли приложению недоступны (нужен флаг ROLES, а он даёт управление
 * ролями) — поэтому роль вписывается названием, а сотрудник выбирается
 * из списка. Заполненное поле «Сотрудник» приоритетнее роли.
 */

type EmployeeRow = { id: string; name: string };

const SETTINGS_PATH = '/record-rules';
const SETTINGS_SAVE_PATH = '/record-rules-save';
const METADATA_PATH = '/record-rules-metadata';

const readEnv = () =>
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Следующее значение по кругу — так устроены кнопки-переключатели. */
const nextInOrder = <T,>(order: T[], current: T): T => {
  const index = order.indexOf(current);

  return order[(index + 1) % order.length];
};

const noBreak = { whiteSpace: 'nowrap' } as CSSProperties;

const cardStyle: CSSProperties = {
  border: '1px solid rgba(128, 128, 128, 0.28)',
  borderRadius: '6px',
  padding: '10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const chipStyle: CSSProperties = {
  padding: '4px 8px',
  borderRadius: '6px',
  border: '1px solid rgba(128, 128, 128, 0.35)',
  background: 'transparent',
  color: 'inherit',
  fontSize: '12px',
  cursor: 'pointer',
};

const chipActiveStyle: CSSProperties = {
  ...chipStyle,
  border: '1px solid rgba(90, 140, 255, 0.9)',
  background: 'rgba(90, 140, 255, 0.14)',
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  padding: '4px 7px',
  borderRadius: '6px',
  border: '1px solid rgba(128, 128, 128, 0.35)',
  background: 'transparent',
  color: 'inherit',
  fontSize: '13px',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
};

const labelStyle: CSSProperties = { opacity: 0.75, minWidth: '120px' };

const RecordRulesSettings = () => {
  const [objects, setObjects] = useState<RecordRuleSelectableObject[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [draft, setDraft] = useState<RecordRulesConfig>(defaultRecordRulesConfig());
  const [saved, setSaved] = useState<RecordRulesConfig>(defaultRecordRulesConfig());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isRelevant = true;

    const load = async () => {
      const { TWENTY_API_URL, TWENTY_FUNCTIONS_URL, TWENTY_APP_ACCESS_TOKEN } = readEnv();
      const apiBase = (TWENTY_API_URL ?? '').replace(/\/+$/, '');
      const functionsBase = (TWENTY_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
      const token = TWENTY_APP_ACCESS_TOKEN ?? '';
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // `_ts` — чтобы мост песочницы не отдал ответ из кэша браузера (304 без тела).
      const [settingsResponse, metadataResponse, employeesResponse] = await Promise.all([
        fetch(`${functionsBase}${SETTINGS_PATH}?_ts=${Date.now()}`, {
          headers,
          cache: 'no-store',
        }),
        fetch(`${functionsBase}${METADATA_PATH}?_ts=${Date.now()}`, {
          headers,
          cache: 'no-store',
        }),
        fetch(
          `${apiBase}/rest/sotrudniki?limit=200&select=id,fio&_ts=${Date.now()}`,
          { headers, cache: 'no-store' },
        ),
      ]);

      const settingsJson = (await settingsResponse.json()) as { settings?: unknown };
      const metadataJson = (await metadataResponse.json()) as {
        objects?: RecordRuleSelectableObject[];
      };
      const employeesJson = (await employeesResponse.json()) as {
        data?: {
          sotrudniki?: {
            id: string;
            fio?: { firstName?: string | null; lastName?: string | null } | null;
          }[];
        };
      };

      if (!settingsResponse.ok) {
        throw new Error(
          `не удалось прочитать правила (HTTP ${settingsResponse.status}) ${JSON.stringify(settingsJson).slice(0, 300)}`,
        );
      }

      if (!metadataResponse.ok) {
        throw new Error(
          `не удалось прочитать метаданные (HTTP ${metadataResponse.status}) ${JSON.stringify(metadataJson).slice(0, 300)}`,
        );
      }

      if (!employeesResponse.ok) {
        throw new Error(
          `не удалось прочитать сотрудников (HTTP ${employeesResponse.status}) ${JSON.stringify(employeesJson).slice(0, 300)}`,
        );
      }

      const settings = normalizeRecordRulesConfig(settingsJson.settings);
      const rows: EmployeeRow[] = (employeesJson.data?.sotrudniki ?? [])
        .map((row) => ({
          id: row.id,
          name: `${row.fio?.firstName ?? ''} ${row.fio?.lastName ?? ''}`.trim() || 'без имени',
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'ru'));

      if (isRelevant) {
        setObjects(Array.isArray(metadataJson.objects) ? metadataJson.objects : []);
        setEmployees(rows);
        setDraft(settings);
        setSaved(settings);
        setIsLoading(false);
      }
    };

    load().catch((loadError) => {
      if (isRelevant) {
        setError(describeError(loadError));
        setIsLoading(false);
      }
    });

    return () => {
      isRelevant = false;
    };
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  const touch = () => {
    setMessage('');
    setError('');
  };

  const patchRule = (ruleId: string, patch: Partial<RecordRule>) => {
    touch();
    setDraft((current) => ({
      rules: current.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule,
      ),
    }));
  };

  const addRule = () => {
    touch();
    setDraft((current) => ({
      rules: [
        ...current.rules,
        {
          id: newRuleId(),
          objectName: '',
          fieldName: '',
          action: 'UPDATE',
          roleName: null,
          sotrudnikId: null,
          allowedValues: [],
          onlyFromSet: true,
          message: DEFAULT_RULE_MESSAGE,
          active: true,
          applyToServiceChanges: false,
        },
      ],
    }));
  };

  const removeRule = (ruleId: string) => {
    touch();
    setDraft((current) => ({
      rules: current.rules.filter((rule) => rule.id !== ruleId),
    }));
  };

  const toggleAllowedValue = (rule: RecordRule, value: string) => {
    patchRule(rule.id, {
      allowedValues: rule.allowedValues.includes(value)
        ? rule.allowedValues.filter((item) => item !== value)
        : [...rule.allowedValues, value],
    });
  };

  const fieldsOf = (
    objectName: string,
  ): { name: string; label: string; options: RecordRuleFieldOption[] }[] =>
    objects.find((item) => item.nameSingular === objectName)?.fields ?? [];

  const cycleObject = (rule: RecordRule) => {
    if (objects.length === 0) {
      return;
    }

    const index = objects.findIndex((item) => item.nameSingular === rule.objectName);
    const next = objects[(index + 1) % objects.length];

    patchRule(rule.id, {
      objectName: next.nameSingular,
      fieldName: '',
      allowedValues: [],
    });
  };

  const cycleField = (rule: RecordRule, fields: { name: string }[]) => {
    if (fields.length === 0) {
      return;
    }

    const index = fields.findIndex((item) => item.name === rule.fieldName);
    const next = fields[(index + 1) % fields.length];

    patchRule(rule.id, { fieldName: next.name, allowedValues: [] });
  };

  const save = async () => {
    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const { TWENTY_FUNCTIONS_URL, TWENTY_APP_ACCESS_TOKEN } = readEnv();
      const functionsBase = (TWENTY_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
      const token = TWENTY_APP_ACCESS_TOKEN ?? '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${functionsBase}${SETTINGS_SAVE_PATH}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ settings: draft }),
      });
      const json = (await response.json()) as { settings?: unknown };

      if (!response.ok) {
        throw new Error(
          `не удалось сохранить (HTTP ${response.status}) ${JSON.stringify(json).slice(0, 300)}`,
        );
      }

      const savedSettings = normalizeRecordRulesConfig(json.settings ?? draft);

      setDraft(savedSettings);
      setSaved(savedSettings);
      setMessage('Сохранено');
    } catch (saveError) {
      setError(describeError(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: '8px', fontSize: '13px' }}>Загружаем правила…</div>;
  }

  if (error && objects.length === 0) {
    return (
      <div style={{ padding: '8px', fontSize: '13px' }}>
        <div style={{ fontWeight: 600 }}>✗ {error}</div>
      </div>
    );
  }

  const sectionTitle: CSSProperties = { fontWeight: 600, fontSize: '14px' };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '8px',
        fontSize: '13px',
      }}
    >
      <div>
        <div style={sectionTitle}>Правила проверки до записи</div>
        <div style={{ opacity: 0.75, marginTop: '4px' }}>
          Правило запрещает менять значение поля до сохранения: изменение не
          попадает в базу вообще. Политика — «разрешено только перечисленное»:
          значение, которого нет в списке (в том числе новая стадия), запрещено.
          Настройка меняется здесь, пересборка приложения не нужна.
        </div>
      </div>

      {draft.rules.length === 0 ? (
        <div style={{ opacity: 0.7 }}>Правил пока нет.</div>
      ) : null}

      {draft.rules.map((rule) => {
        const object = objects.find((item) => item.nameSingular === rule.objectName);
        const fields = fieldsOf(rule.objectName);
        const field = fields.find((item) => item.name === rule.fieldName);

        return (
          <div key={rule.id} style={cardStyle}>
            <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>
                {object?.labelSingular || rule.objectName || 'Новое правило'}
                {rule.active ? '' : ' · выключено'}
              </span>
              <button
                type="button"
                title="Удалить правило"
                style={chipStyle}
                onClick={() => removeRule(rule.id)}
              >
                ✕
              </button>
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Объект</span>
              <button
                type="button"
                style={chipStyle}
                onClick={() => cycleObject(rule)}
              >
                {object?.labelSingular ?? '— выберите —'} ▾
              </button>
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Поле</span>
              {fields.length === 0 ? (
                <span style={{ opacity: 0.6 }}>
                  {rule.objectName.length === 0
                    ? 'сначала выберите объект'
                    : 'у объекта нет полей-списков'}
                </span>
              ) : (
                <button
                  type="button"
                  style={chipStyle}
                  onClick={() => cycleField(rule, fields)}
                >
                  {field?.label ?? '— выберите —'} ▾
                </button>
              )}
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Действие</span>
              <button
                type="button"
                style={chipStyle}
                onClick={() =>
                  patchRule(rule.id, {
                    action: nextInOrder<RecordRuleAction>(ACTION_ORDER, rule.action),
                  })
                }
              >
                {ACTION_LABELS[rule.action]} ▾
              </button>
            </div>

            <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
              <span style={labelStyle}>Кому</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ ...rowStyle, gap: '6px' }}>
                  <span style={{ opacity: 0.8, ...noBreak }}>Роль (название):</span>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="Мастер по оборудованию"
                    value={rule.roleName ?? ''}
                    onChange={(event) =>
                      patchRule(rule.id, {
                        roleName: event.target.value.length > 0 ? event.target.value : null,
                      })
                    }
                  />
                </label>
                <div style={{ opacity: 0.6 }}>
                  Заполненный «Сотрудник» важнее роли. Список ролей приложению
                  недоступен, поэтому название вписывается текстом.
                </div>
                <div style={{ ...rowStyle, gap: '6px' }}>
                  <button
                    type="button"
                    style={rule.sotrudnikId === null ? chipActiveStyle : chipStyle}
                    onClick={() => patchRule(rule.id, { sotrudnikId: null })}
                  >
                    не задано
                  </button>
                  {employees.map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      style={employee.id === rule.sotrudnikId ? chipActiveStyle : chipStyle}
                      onClick={() => patchRule(rule.id, { sotrudnikId: employee.id })}
                    >
                      {employee.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
              <span style={labelStyle}>Разрешено</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {field === undefined ? (
                  <span style={{ opacity: 0.6 }}>сначала выберите поле</span>
                ) : (
                  <div style={{ ...rowStyle, gap: '10px' }}>
                    {field.options.map((option) => (
                      <label
                        key={option.value}
                        style={{ ...rowStyle, gap: '5px', cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={rule.allowedValues.includes(option.value)}
                          onChange={() => toggleAllowedValue(rule, option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ opacity: 0.6 }}>
                  Отмечено: {rule.allowedValues.length}. Значения берутся из поля
                  на момент открытия экрана.
                </div>
              </div>
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Условия</span>
              <label style={{ ...rowStyle, gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rule.onlyFromSet}
                  onChange={() => patchRule(rule.id, { onlyFromSet: !rule.onlyFromSet })}
                />
                <span>Менять только внутри набора</span>
              </label>
              <label style={{ ...rowStyle, gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rule.active}
                  onChange={() => patchRule(rule.id, { active: !rule.active })}
                />
                <span>Активно</span>
              </label>
              <label style={{ ...rowStyle, gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rule.applyToServiceChanges}
                  onChange={() =>
                    patchRule(rule.id, {
                      applyToServiceChanges: !rule.applyToServiceChanges,
                    })
                  }
                />
                <span>Применять к служебным изменениям (API, приложения)</span>
              </label>
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Текст отказа</span>
              <input
                type="text"
                style={inputStyle}
                placeholder={DEFAULT_RULE_MESSAGE}
                value={rule.message}
                onChange={(event) => patchRule(rule.id, { message: event.target.value })}
              />
            </div>
            <div style={{ opacity: 0.6 }}>
              {'{название}'} подставится значением, которое пытались поставить.
            </div>
          </div>
        );
      })}

      <div style={{ ...rowStyle, gap: '12px' }}>
        <button type="button" style={chipStyle} onClick={addRule}>
          + Добавить правило
        </button>
        <button
          type="button"
          onClick={save}
          disabled={isSaving || !isDirty}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px solid rgba(128, 128, 128, 0.4)',
            cursor: isSaving || !isDirty ? 'default' : 'pointer',
            opacity: isSaving || !isDirty ? 0.5 : 1,
            background: 'transparent',
            color: 'inherit',
            fontSize: '13px',
          }}
        >
          {isSaving ? 'Сохраняем…' : 'Сохранить'}
        </button>
        {message ? <span style={{ opacity: 0.85 }}>✓ {message}</span> : null}
        {error ? <span style={{ opacity: 0.95 }}>✗ {error}</span> : null}
      </div>
    </div>
  );
};

export default defineSettingsFrontComponent({
  universalIdentifier: RECORD_RULES_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'recordRulesSettings',
  description: 'Правила проверки до записи: список правил и допустимые значения',
  component: RecordRulesSettings,
});
