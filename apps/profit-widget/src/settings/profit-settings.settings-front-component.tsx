import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { defineSettingsFrontComponent } from 'twenty-sdk/define';

import { PROFIT_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  emptyProfitSettings,
  emptyProfitRate,
  normalizeProfitSettings,
  parseRateInput,
  resolveProfitRate,
  type ProfitRate,
  type ProfitSettings,
} from 'src/shared/profit-rules';

/**
 * Настройка профита (экран в настройках приложения).
 *
 * На каждого пользователя CRM — строка со ставками:
 *   • % от услуг — процент от суммы работ;
 *   • % от прибыли товаров — процент от прибыли по материалам;
 *   • фикс. ставка — задел под заправки (пока не используется);
 *   • «видит всё» — руководитель: видит и профит мастера, и профит менеджера.
 *
 * Тип расчёта здесь не задаётся: он берётся из самой записи (Мастер / Ответственный).
 * Ставки хранятся во внутреннем хранилище приложения и читаются/пишутся через
 * маршруты `profit-settings` и `profit-settings-save`.
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

/** Ключ поля ввода: одна строка текста на сотрудника и колонку. */
const textKey = (memberId: string, field: keyof ProfitRate) =>
  `${memberId}:${field}`;

const numberToText = (value: number) => (value > 0 ? String(value) : '');

const ProfitSettingsScreen = () => {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [draft, setDraft] = useState<ProfitSettings>(emptyProfitSettings());
  const [saved, setSaved] = useState<ProfitSettings>(emptyProfitSettings());
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

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

      rows.forEach((row) => {
        const rate = resolveProfitRate(settings, row.id);

        nextTexts[textKey(row.id, 'servicesPercent')] = numberToText(
          rate.servicesPercent,
        );
        nextTexts[textKey(row.id, 'materialsPercent')] = numberToText(
          rate.materialsPercent,
        );
        nextTexts[textKey(row.id, 'fixedRate')] = numberToText(rate.fixedRate);
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

  /** Строка сотрудника в draft: создаётся при первом изменении. */
  const patchRate = (
    memberId: string,
    patch: Partial<ProfitRate>,
  ): void => {
    setMessage('');
    setError('');
    setDraft((current) => ({
      rates: {
        ...current.rates,
        [memberId]: { ...(current.rates[memberId] ?? emptyProfitRate()), ...patch },
      },
    }));
  };

  const onText = (
    memberId: string,
    field: 'servicesPercent' | 'materialsPercent' | 'fixedRate',
    value: string,
  ) => {
    setTexts((current) => ({ ...current, [textKey(memberId, field)]: value }));
    patchRate(memberId, { [field]: parseRateInput(value) });
  };

  const toggleSeesAll = (memberId: string) => {
    const rate = draft.rates[memberId] ?? emptyProfitRate();

    patchRate(memberId, { seesAll: !rate.seesAll });
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

  const inputStyle: CSSProperties = {
    width: '72px',
    padding: '5px 7px',
    borderRadius: '6px',
    border: '1px solid rgba(128, 128, 128, 0.35)',
    background: 'transparent',
    color: 'inherit',
    fontSize: '13px',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '8px',
        fontSize: '13px',
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>Профит сотрудников</div>
        <div style={{ opacity: 0.75, marginTop: '4px' }}>
          Проценты считаются от суммы работ и от прибыли по материалам. Тип расчёта берётся
          из самой записи: где сотрудник указан Мастером — мастерский расчёт, где
          Ответственным — менеджерский. «Видит всё» — руководитель: видит оба профита и
          итог. Фикс. ставка пока не используется (задел под заправки).
        </div>
      </div>

      {members.map((member) => {
        const rate = draft.rates[member.id] ?? emptyProfitRate();

        return (
          <div
            key={member.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              border: '1px solid rgba(128, 128, 128, 0.28)',
              borderRadius: '6px',
              padding: '8px',
            }}
          >
            <span style={{ fontWeight: 600, minWidth: '180px' }}>{member.name}</span>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ opacity: 0.8 }}>% услуг</span>
              <input
                type="text"
                inputMode="decimal"
                value={texts[textKey(member.id, 'servicesPercent')] ?? ''}
                onChange={(event) =>
                  onText(member.id, 'servicesPercent', event.target.value)
                }
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ opacity: 0.8 }}>% прибыли товаров</span>
              <input
                type="text"
                inputMode="decimal"
                value={texts[textKey(member.id, 'materialsPercent')] ?? ''}
                onChange={(event) =>
                  onText(member.id, 'materialsPercent', event.target.value)
                }
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ opacity: 0.8 }}>фикс. ставка</span>
              <input
                type="text"
                inputMode="decimal"
                value={texts[textKey(member.id, 'fixedRate')] ?? ''}
                onChange={(event) =>
                  onText(member.id, 'fixedRate', event.target.value)
                }
                style={inputStyle}
              />
            </label>

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
                checked={rate.seesAll}
                onChange={() => toggleSeesAll(member.id)}
              />
              <span>Видит всё</span>
            </label>
          </div>
        );
      })}

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
  description: 'Профит сотрудников: проценты и фиксированные ставки',
  component: ProfitSettingsScreen,
});
