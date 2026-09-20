import { useEffect, useMemo, useState } from 'react';
import { defineSettingsFrontComponent } from 'twenty-sdk/define';

import { CALLS_ACCESS_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  emptyAccessRules,
  normalizeAccessRules,
  type CallJournalAccessRules,
} from 'src/shared/megafon/call-journal-access-rules';

/**
 * Настройка доступа к журналу звонков (экран в настройках приложения).
 *
 * У каждого сотрудника — два уровня доступа:
 *   «Полный доступ» — видит звонки всех сотрудников и может выбирать любого;
 *   список сотрудников — видит только отмеченных (плюс всегда свои).
 * Пусто и без галочки — видит только свои звонки.
 *
 * Правила хранятся во внутреннем хранилище приложения (kv) и читаются/пишутся
 * через маршруты `call-journal-access` и `call-journal-access-save`.
 */

type MemberRow = {
  id: string;
  name: string;
  email: string;
};

const ACCESS_PATH = '/call-journal-access';
const ACCESS_SAVE_PATH = '/call-journal-access-save';

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

const CallsAccessSettings = () => {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [draft, setDraft] = useState<CallJournalAccessRules>(emptyAccessRules());
  const [saved, setSaved] = useState<CallJournalAccessRules>(emptyAccessRules());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isRelevant = true;

    const load = async () => {
      const { TWENTY_API_URL, TWENTY_FUNCTIONS_URL, TWENTY_APP_ACCESS_TOKEN } = readEnv();
      const apiBase = (TWENTY_API_URL ?? '').replace(/\/+$/, '');
      const functionsBase = (TWENTY_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
      const token = TWENTY_APP_ACCESS_TOKEN ?? '';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [membersResponse, rulesResponse] = await Promise.all([
        fetch(
          `${apiBase}/rest/workspaceMembers?limit=60&select=id,name,userEmail`,
          { headers },
        ),
        fetch(`${functionsBase}${ACCESS_PATH}`, { headers }),
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

      if (!membersResponse.ok) {
        throw new Error(
          `не удалось прочитать сотрудников (HTTP ${membersResponse.status})`,
        );
      }

      const rulesJson = (await rulesResponse.json()) as { rules?: unknown };

      if (!rulesResponse.ok) {
        throw new Error(
          `не удалось прочитать правила (HTTP ${rulesResponse.status}) ${JSON.stringify(rulesJson).slice(0, 200)}`,
        );
      }

      const rows = sortByName(
        (membersJson.data?.workspaceMembers ?? []).map((member) => ({
          id: member.id,
          name: memberName(member),
          email: member.userEmail ?? '',
        })),
      );
      const rules = normalizeAccessRules(rulesJson.rules);

      if (isRelevant) {
        setMembers(rows);
        setDraft(rules);
        setSaved(rules);
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

  const nameById = useMemo(() => {
    const map: Record<string, string> = {};

    members.forEach((member) => {
      map[member.id] = member.name;
    });

    return map;
  }, [members]);

  const toggleFull = (memberId: string) => {
    setMessage('');
    setError('');
    setDraft((current) => ({
      full: current.full.includes(memberId)
        ? current.full.filter((id) => id !== memberId)
        : [...current.full, memberId],
      rules: current.rules,
    }));
  };

  const toggleMember = (memberId: string, targetId: string) => {
    setMessage('');
    setError('');
    setDraft((current) => {
      const list = current.rules[memberId] ?? [];
      const next = list.includes(targetId)
        ? list.filter((id) => id !== targetId)
        : [...list, targetId];
      const rules = { ...current.rules };

      if (next.length > 0) {
        rules[memberId] = next;
      } else {
        delete rules[memberId];
      }

      return { ...current, rules };
    });
  };

  const save = async () => {
    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const { TWENTY_FUNCTIONS_URL, TWENTY_APP_ACCESS_TOKEN } = readEnv();
      const functionsBase = (TWENTY_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
      const token = TWENTY_APP_ACCESS_TOKEN ?? '';

      const response = await fetch(`${functionsBase}${ACCESS_SAVE_PATH}`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rules: draft }),
      });
      const json = (await response.json()) as { rules?: unknown };

      if (!response.ok) {
        throw new Error(
          `не удалось сохранить (HTTP ${response.status}) ${JSON.stringify(json).slice(0, 200)}`,
        );
      }

      const savedRules = normalizeAccessRules(json.rules ?? draft);

      setDraft(savedRules);
      setSaved(savedRules);
      setMessage('Сохранено');
    } catch (saveError) {
      setError(describeError(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: '8px', fontSize: '13px' }}>Загружаем настройки…</div>;
  }

  if (error && members.length === 0) {
    return (
      <div style={{ padding: '8px', fontSize: '13px' }}>
        <div style={{ fontWeight: 600 }}>✗ {error}</div>
      </div>
    );
  }

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
        <div style={{ fontWeight: 600, fontSize: '14px' }}>Доступ к журналу звонков</div>
        <div style={{ opacity: 0.75, marginTop: '4px' }}>
          Отметьте, чьи звонки видит сотрудник в журнале. «Полный доступ» — видит всех и
          выбирает любого. Если ничего не отмечено — сотрудник видит только свои звонки.
        </div>
      </div>

      {members.map((member) => {
        const selected = draft.rules[member.id] ?? [];
        const hasFull = draft.full.includes(member.id);
        const targets = members.filter((candidate) => candidate.id !== member.id);

        return (
          <div
            key={member.id}
            style={{
              border: '1px solid rgba(128, 128, 128, 0.28)',
              borderRadius: '6px',
              padding: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600 }}>{member.name}</span>
              {member.email ? <span style={{ opacity: 0.6 }}>{member.email}</span> : null}
              <label style={{ marginLeft: 'auto', display: 'flex', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasFull}
                  onChange={() => toggleFull(member.id)}
                />
                <span>Полный доступ (видит всех)</span>
              </label>
            </div>

            {hasFull ? null : (
              <details style={{ marginTop: '6px' }}>
                <summary style={{ cursor: 'pointer', opacity: 0.85 }}>
                  {selected.length === 0
                    ? 'Видит только свои звонки — выбрать сотрудников'
                    : `Видит: ${selected.map((id) => nameById[id] ?? 'удалённый сотрудник').join(', ')}`}
                </summary>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    marginTop: '8px',
                  }}
                >
                  {targets.map((target) => (
                    <label
                      key={target.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(target.id)}
                        onChange={() => toggleMember(member.id, target.id)}
                      />
                      <span>{target.name}</span>
                      {target.email ? (
                        <span style={{ opacity: 0.6 }}>{target.email}</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              </details>
            )}
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
  universalIdentifier: CALLS_ACCESS_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'callsAccessSettings',
  description: 'Доступ к журналу звонков: кто чьи звонки видит',
  component: CallsAccessSettings,
});
