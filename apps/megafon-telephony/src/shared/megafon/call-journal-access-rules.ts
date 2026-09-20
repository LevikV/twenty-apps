/**
 * Правила доступа к журналу звонков — чистая часть (без серверных зависимостей).
 *
 * Модуль импортируется и экраном настроек (песочница фронт-компонента),
 * и серверными логик-функциями, поэтому здесь нет ни kv, ни клиентов CRM.
 *
 * Смысл правил:
 *   full  — кому доступны звонки всех сотрудников (выбор любого в фильтре);
 *   rules — кому какие сотрудники разрешены (по id).
 * Если сотрудника нет ни там, ни там — он видит только свои звонки.
 */

export type CallJournalAccessRules = {
  full: string[];
  rules: Record<string, string[]>;
};

export const emptyAccessRules = (): CallJournalAccessRules => ({
  full: [],
  rules: {},
});

const asIdArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];

export const normalizeAccessRules = (value: unknown): CallJournalAccessRules => {
  if (value === null || typeof value !== 'object') {
    return emptyAccessRules();
  }

  const candidate = value as { full?: unknown; rules?: unknown };
  const rules: Record<string, string[]> = {};

  if (candidate.rules !== null && typeof candidate.rules === 'object') {
    for (const [memberId, memberIds] of Object.entries(
      candidate.rules as Record<string, unknown>,
    )) {
      const ids = asIdArray(memberIds);

      rules[memberId] = ids;
    }
  }

  return { full: asIdArray(candidate.full), rules };
};

/** Что видит конкретный сотрудник: полный доступ или список разрешённых. */
export const resolveMemberVisibility = (
  rules: CallJournalAccessRules,
  workspaceMemberId: string,
): { mode: 'all' | 'list'; memberIds: string[] } => {
  if (rules.full.includes(workspaceMemberId)) {
    return { mode: 'all', memberIds: [] };
  }

  return { mode: 'list', memberIds: rules.rules[workspaceMemberId] ?? [] };
};
