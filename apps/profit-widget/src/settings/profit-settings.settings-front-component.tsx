import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { defineSettingsFrontComponent } from 'twenty-sdk/define';

import { PROFIT_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  BASE_LABELS,
  BASE_ORDER,
  DIRECTION_LABELS,
  DIRECTION_ORDER,
  ROLE_LABELS,
  ROLE_ORDER,
  UNIT_LABELS,
  UNIT_ORDER,
  clampByUnit,
  defaultProfitSettings,
  newRuleId,
  normalizeProfitSettings,
  parseRateInputSafe,
  personalRulesOf,
  resolveDirection,
  type DirectionRule,
  type PersonalRule,
  type ProfitBase,
  type ProfitDirection,
  type ProfitRole,
  type ProfitSettings,
  type ProfitUnit,
} from 'src/shared/profit-rules';

/**
 * Настройка профита (экран в настройках приложения).
 *
 * Три блока:
 *   1. Правила по направлениям — общие для всех: роль в записи → база × значение.
 *      Здесь же свойства расчёта: вычитать ли стоимость подрядчика из базы услуг
 *      и наценка на товар (по ней считается закупочная цена материалов).
 *   2. Сотрудники — галочка «Видит всё» (руководитель) и персональные правила
 *      (исключения вроде закупщика, который получает процент с материалов).
 *   3. Кнопка сохранения.
 *
 * Настройки хранятся во внутреннем хранилище приложения и читаются/пишутся
 * через маршруты `profit-settings` и `profit-settings-save`.
 */

type MemberRow = {
  id: string;
  name: string;
  email: string;
};

const SETTINGS_PATH = '/profit-settings';
const SETTINGS_SAVE_PATH = '/profit-settings-save';

const readEnv = () =>
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const memberName = (member: {
  name?: { firstName?: string; lastName?: string } | null;
  userEmail?: string | null;
}) => {
  const full = `${member.name?.firstName ?? ''} ${member.name?.lastName ?? ''}`.trim();

  return full || member.userEmail || 'без имени';
};

const sortByName = (rows: MemberRow[]) =>
  [...rows].sort((left, right) => left.name.localeCompare(right.name, 'ru'));

/** Следующее значение по кругу — так устроены кнопки-переключатели. */
const nextInOrder = <T,>(order: T[], current: T): T => {
  const index = order.indexOf(current);

  return order[(index + 1) % order.length];
};

const cardStyle: CSSProperties = {
  border: '1px solid rgba(128, 128, 128, 0.28)',
  borderRadius: '6px',
  padding: '8px',
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

const inputStyle: CSSProperties = {
  width: '70px',
  padding: '4px 7px',
  borderRadius: '6px',
  border: '1px solid rgba(128, 128, 128, 0.35)',
  background: 'transparent',
  color: 'inherit',
  fontSize: '13px',
};

const ProfitSettingsScreen = () => {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [draft, setDraft] = useState<ProfitSettings>(defaultProfitSettings());
  const [saved, setSaved] = useState<ProfitSettings>(defaultProfitSettings());
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [openDirections, setOpenDirections] = useState<Record<string, boolean>>({
    remont: true,
  });

  useEffect(() => {
    let isRelevant = true;

    const load = async () => {
      const { TWENTY_API_URL, TWENTY_FUNCTIONS_URL, TWENTY_APP_ACCESS_TOKEN } =
        readEnv();
      const apiBase = (TWENTY_API_URL ?? '').replace(/\/+$/, '');
      const functionsBase = (TWENTY_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
      const token = TWENTY_APP_ACCESS_TOKEN ?? '';
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // Кэш браузера обходим уникальным параметром `_ts`: мост песочницы не
      // передаёт `cache`, а на 304 отдаёт ответ с пустым телом.
      const [membersResponse, settingsResponse] = await Promise.all([
        fetch(
          `${apiBase}/rest/workspaceMembers?limit=60&select=id,name,userEmail&_ts=${Date.now()}`,
          { headers, cache: 'no-store' },
        ),
        fetch(`${functionsBase}${SETTINGS_PATH}?_ts=${Date.now()}`, {
          headers,
          cache: 'no-store',
        }),
      ]);

      const membersJson = (await membersResponse.json()) as {
        data?: {
          workspaceMembers?: {
            id: string;
            userEmail?: string | null;
            name?: { firstName?: string; lastName?: string } | null;
          }[];
        };
      };
      const settingsJson = (await settingsResponse.json()) as {
        settings?: unknown;
      };

      if (!membersResponse.ok) {
        throw new Error(
          `не удалось прочитать сотрудников (HTTP ${membersResponse.status}) ${JSON.stringify(membersJson).slice(0, 300)}`,
        );
      }

      if (!settingsResponse.ok) {
        throw new Error(
          `не удалось прочитать настройки (HTTP ${settingsResponse.status}) ${JSON.stringify(settingsJson).slice(0, 300)}`,
        );
      }

      const rows = sortByName(
        (membersJson.data?.workspaceMembers ?? []).map((member) => ({
          id: member.id,
          name: memberName(member),
          email: member.userEmail ?? '',
        })),
      );
      const settings = normalizeProfitSettings(settingsJson.settings);
      const nextTexts: Record<string, string> = {};

      DIRECTION_ORDER.forEach((direction) => {
        resolveDirection(settings, direction).rules.forEach((rule) => {
          nextTexts[rule.id] = rule.value > 0 ? String(rule.value) : '';
        });
      });
      settings.personal.forEach((rule) => {
        nextTexts[rule.id] = rule.value > 0 ? String(rule.value) : '';
      });

      if (isRelevant) {
        setMembers(rows);
        setDraft(settings);
        setSaved(settings);
        setTexts(nextTexts);
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

  const patchDirection = (
    direction: ProfitDirection,
    patch: Partial<{ contractorDeduction: boolean; materialsMarkupPercent: number }>,
  ) => {
    touch();
    setDraft((current) => ({
      ...current,
      directions: {
        ...current.directions,
        [direction]: { ...resolveDirection(current, direction), ...patch },
      },
    }));
  };

  const patchRule = (
    direction: ProfitDirection,
    ruleId: string,
    patch: Partial<DirectionRule>,
  ) => {
    touch();
    setDraft((current) => ({
      ...current,
      directions: {
        ...current.directions,
        [direction]: {
          ...resolveDirection(current, direction),
          rules: resolveDirection(current, direction).rules.map((rule) =>
            rule.id === ruleId ? { ...rule, ...patch } : rule,
          ),
        },
      },
    }));
  };

  const addRule = (direction: ProfitDirection) => {
    const rule: DirectionRule = {
      id: newRuleId(),
      role: 'master',
      base: 'services',
      value: 0,
      unit: 'percent',
    };

    touch();
    setTexts((current) => ({ ...current, [rule.id]: '' }));
    setDraft((current) => ({
      ...current,
      directions: {
        ...current.directions,
        [direction]: {
          ...resolveDirection(current, direction),
          rules: [...resolveDirection(current, direction).rules, rule],
        },
      },
    }));
  };

  const removeRule = (direction: ProfitDirection, ruleId: string) => {
    touch();
    setDraft((current) => ({
      ...current,
      directions: {
        ...current.directions,
        [direction]: {
          ...resolveDirection(current, direction),
          rules: resolveDirection(current, direction).rules.filter(
            (rule) => rule.id !== ruleId,
          ),
        },
      },
    }));
  };

  const addPersonal = (memberId: string) => {
    const rule: PersonalRule = {
      id: newRuleId(),
      memberId,
      direction: 'remont',
      base: 'materialsSum',
      value: 0,
      unit: 'percent',
    };

    touch();
    setTexts((current) => ({ ...current, [rule.id]: '' }));
    setDraft((current) => ({ ...current, personal: [...current.personal, rule] }));
  };

  const patchPersonal = (ruleId: string, patch: Partial<PersonalRule>) => {
    touch();
    setDraft((current) => ({
      ...current,
      personal: current.personal.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule,
      ),
    }));
  };

  const removePersonal = (ruleId: string) => {
    touch();
    setDraft((current) => ({
      ...current,
      personal: current.personal.filter((rule) => rule.id !== ruleId),
    }));
  };

  const toggleSeesAll = (memberId: string) => {
    touch();
    setDraft((current) => ({
      ...current,
      seesAll: current.seesAll.includes(memberId)
        ? current.seesAll.filter((id) => id !== memberId)
        : [...current.seesAll, memberId],
    }));
  };

  const onValueInput = (
    ruleId: string,
    unit: ProfitUnit,
    raw: string,
    apply: (value: number) => void,
  ) => {
    setTexts((current) => ({ ...current, [ruleId]: raw }));
    apply(clampByUnit(parseRateInputSafe(raw), unit));
  };

  const save = async () => {
    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const { TWENTY_FUNCTIONS_URL, TWENTY_APP_ACCESS_TOKEN } = readEnv();
      const functionsBase = (TWENTY_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
      const token = TWENTY_APP_ACCESS_TOKEN ?? '';

      const response = await fetch(`${functionsBase}${SETTINGS_SAVE_PATH}`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: draft }),
      });
      const json = (await response.json()) as { settings?: unknown };

      if (!response.ok) {
        throw new Error(
          `не удалось сохранить (HTTP ${response.status}) ${JSON.stringify(json).slice(0, 300)}`,
        );
      }

      const savedSettings = normalizeProfitSettings(json.settings ?? draft);

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
    return (
      <div style={{ padding: '8px', fontSize: '13px' }}>Загружаем настройки…</div>
    );
  }

  if (error && members.length === 0) {
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
        <div style={sectionTitle}>Правила профита</div>
        <div style={{ opacity: 0.75, marginTop: '4px' }}>
          Правила направления действуют для всех: в записи берётся роль (Мастер,
          Ответственный, Приёмщик) и от неё считается процент от выбранной базы.
          Персональное правило — исключение для конкретного сотрудника. Проценты и
          правила меняются здесь, пересборка приложения не нужна.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {DIRECTION_ORDER.map((direction) => {
          const settings = resolveDirection(draft, direction);
          const isOpen = openDirections[direction] === true;

          return (
            <div key={direction} style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setOpenDirections((current) => ({
                    ...current,
                    [direction]: !isOpen,
                  }))
                }
              >
                <span style={{ fontWeight: 600 }}>
                  {isOpen ? '▾' : '▸'} {DIRECTION_LABELS[direction]}
                </span>
                <span style={{ opacity: 0.6 }}>
                  {settings.rules.length === 0
                    ? 'правил нет'
                    : `правил: ${settings.rules.length}`}
                </span>
              </div>

              {isOpen ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={settings.contractorDeduction}
                        onChange={() =>
                          patchDirection(direction, {
                            contractorDeduction: !settings.contractorDeduction,
                          })
                        }
                      />
                      <span>Вычитать стоимость подрядчика из базы услуг</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ opacity: 0.8 }}>Наценка на товар, %</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          texts[`${direction}:markup`] ??
                          (settings.materialsMarkupPercent > 0
                            ? String(settings.materialsMarkupPercent)
                            : '')
                        }
                        onChange={(event) => {
                          const raw = event.target.value;

                          setTexts((current) => ({
                            ...current,
                            [`${direction}:markup`]: raw,
                          }));
                          patchDirection(direction, {
                            materialsMarkupPercent: clampByUnit(
                              parseRateInputSafe(raw),
                              'percent',
                            ),
                          });
                        }}
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  {settings.rules.map((rule) => (
                    <div
                      key={rule.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
                    >
                      <button
                        type="button"
                        title="Роль в записи — нажмите, чтобы сменить"
                        style={chipStyle}
                        onClick={() =>
                          patchRule(direction, rule.id, {
                            role: nextInOrder(ROLE_ORDER, rule.role),
                          })
                        }
                      >
                        {ROLE_LABELS[rule.role]} ▾
                      </button>

                      <button
                        type="button"
                        title="База расчёта — нажмите, чтобы сменить"
                        style={chipStyle}
                        onClick={() =>
                          patchRule(direction, rule.id, {
                            base: nextInOrder(BASE_ORDER, rule.base),
                          })
                        }
                      >
                        {BASE_LABELS[rule.base]} ▾
                      </button>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={texts[rule.id] ?? ''}
                        onChange={(event) =>
                          onValueInput(rule.id, rule.unit, event.target.value, (value) =>
                            patchRule(direction, rule.id, { value }),
                          )
                        }
                        style={inputStyle}
                      />

                      <button
                        type="button"
                        title="Процент или рубли — нажмите, чтобы сменить"
                        style={chipStyle}
                        onClick={() =>
                          patchRule(direction, rule.id, {
                            unit: nextInOrder(UNIT_ORDER, rule.unit),
                            value: clampByUnit(
                              rule.value,
                              nextInOrder(UNIT_ORDER, rule.unit),
                            ),
                          })
                        }
                      >
                        {UNIT_LABELS[rule.unit]} ▾
                      </button>

                      <button
                        type="button"
                        title="Удалить правило"
                        style={{ ...chipStyle, marginLeft: 'auto' }}
                        onClick={() => removeRule(direction, rule.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <div>
                    <button
                      type="button"
                      style={chipStyle}
                      onClick={() => addRule(direction)}
                    >
                      + Добавить правило
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div>
        <div style={sectionTitle}>Сотрудники</div>
        <div style={{ opacity: 0.75, marginTop: '4px' }}>
          «Видит всё» — сотрудник видит в карточке профит всех ролей и итог (руководитель).
          Персональные правила — исключения для конкретного человека, например процент
          с материалов закупщику.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {members.map((member) => {
          const rules = personalRulesOf(draft, member.id);

          return (
            <div key={member.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600 }}>{member.name}</span>
                {member.email ? (
                  <span style={{ opacity: 0.6 }}>{member.email}</span>
                ) : null}
                <label
                  style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draft.seesAll.includes(member.id)}
                    onChange={() => toggleSeesAll(member.id)}
                  />
                  <span>Видит всё</span>
                </label>
              </div>

              {rules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                    marginTop: '8px',
                  }}
                >
                  <button
                    type="button"
                    title="Направление — нажмите, чтобы сменить"
                    style={chipStyle}
                    onClick={() =>
                      patchPersonal(rule.id, {
                        direction: nextInOrder(DIRECTION_ORDER, rule.direction),
                      })
                    }
                  >
                    {DIRECTION_LABELS[rule.direction]} ▾
                  </button>

                  <button
                    type="button"
                    title="База расчёта — нажмите, чтобы сменить"
                    style={chipStyle}
                    onClick={() =>
                      patchPersonal(rule.id, {
                        base: nextInOrder(BASE_ORDER, rule.base),
                      })
                    }
                  >
                    {BASE_LABELS[rule.base]} ▾
                  </button>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={texts[rule.id] ?? ''}
                    onChange={(event) =>
                      onValueInput(rule.id, rule.unit, event.target.value, (value) =>
                        patchPersonal(rule.id, { value }),
                      )
                    }
                    style={inputStyle}
                  />

                  <button
                    type="button"
                    title="Процент или рубли — нажмите, чтобы сменить"
                    style={chipStyle}
                    onClick={() =>
                      patchPersonal(rule.id, {
                        unit: nextInOrder(UNIT_ORDER, rule.unit),
                        value: clampByUnit(
                          rule.value,
                          nextInOrder(UNIT_ORDER, rule.unit),
                        ),
                      })
                    }
                  >
                    {UNIT_LABELS[rule.unit]} ▾
                  </button>

                  <button
                    type="button"
                    title="Удалить правило"
                    style={{ ...chipStyle, marginLeft: 'auto' }}
                    onClick={() => removePersonal(rule.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  style={chipStyle}
                  onClick={() => addPersonal(member.id)}
                >
                  + Персональное правило
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
  universalIdentifier: PROFIT_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'profitSettings',
  description: 'Профит сотрудников: правила по направлениям и персональные исключения',
  component: ProfitSettingsScreen,
});
