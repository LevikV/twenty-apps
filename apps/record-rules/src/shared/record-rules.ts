/**
 * Чистый модуль правил проверки до записи: типы, значения по умолчанию,
 * нормализация. Никаких импортов из SDK — тестируется без CRM
 * (`yarn test:unit`) и переиспользуется и экраном настроек, и движком.
 *
 * Правила хранятся одной записью во внутреннем хранилище приложения (kv),
 * ключ — `record-rules:config`. Ядро (патч форка) читает эту же запись.
 */

export const RECORD_RULE_ACTION_CREATE = 'CREATE';
export const RECORD_RULE_ACTION_UPDATE = 'UPDATE';
export const RECORD_RULE_ACTION_BOTH = 'BOTH';

export type RecordRuleAction =
  | typeof RECORD_RULE_ACTION_CREATE
  | typeof RECORD_RULE_ACTION_UPDATE
  | typeof RECORD_RULE_ACTION_BOTH;

export const ACTION_LABELS: Record<RecordRuleAction, string> = {
  CREATE: 'Создание',
  UPDATE: 'Изменение',
  BOTH: 'Создание и изменение',
};

export const ACTION_ORDER: RecordRuleAction[] = ['UPDATE', 'CREATE', 'BOTH'];

/**
 * Одно правило.
 *
 * - `objectName` / `fieldName` — системные имена (напр. remontOborudovaniya / stadiya).
 * - `allowedValues` — значения опций целевого поля (сравнение по `value`, не по подписи).
 * - `roleName` — название роли текстом: приложение не имеет права читать роли
 *   (запрос ролей закрыт флагом ROLES, а он даёт управление ролями).
 * - `sotrudnikId` — id записи объекта «Сотрудник» для персональных исключений.
 * - Срабатывает заполненное из двух: сотрудник приоритетнее роли.
 * - `onlyFromSet` — «только внутри набора»: менять можно, лишь если текущее
 *   значение уже входит в набор, и только на значение из этого набора.
 * - `applyToServiceChanges` — учитывать ли изменения от приложений/API
 *   (по умолчанию нет: правило действует только на действия пользователей).
 */
export type RecordRule = {
  id: string;
  objectName: string;
  fieldName: string;
  action: RecordRuleAction;
  roleName: string | null;
  sotrudnikId: string | null;
  allowedValues: string[];
  onlyFromSet: boolean;
  message: string;
  active: boolean;
  applyToServiceChanges: boolean;
};

export type RecordRulesConfig = {
  rules: RecordRule[];
};

export const MAX_RULES = 100;
export const MAX_ALLOWED_VALUES = 200;
export const MAX_MESSAGE_LENGTH = 500;

export const DEFAULT_RULE_MESSAGE =
  'Стадию «{название}» может поставить только менеджер';

export const defaultRecordRulesConfig = (): RecordRulesConfig => ({ rules: [] });

export const newRuleId = (): string =>
  `rr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isRecordRuleAction = (value: unknown): value is RecordRuleAction =>
  value === RECORD_RULE_ACTION_CREATE ||
  value === RECORD_RULE_ACTION_UPDATE ||
  value === RECORD_RULE_ACTION_BOTH;

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asNullableTrimmedString = (value: unknown): string | null => {
  const text = asTrimmedString(value);

  return text.length > 0 ? text.slice(0, 200) : null;
};

const asBooleanOrDefault = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const asAllowedValues = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  for (const item of value) {
    const text = asTrimmedString(item);

    if (text.length === 0 || text.length > 200 || seen.has(text)) {
      continue;
    }

    seen.add(text);

    if (seen.size >= MAX_ALLOWED_VALUES) {
      break;
    }
  }

  return [...seen];
};

const normalizeRule = (raw: unknown): RecordRule | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const candidate = raw as Partial<RecordRule>;
  const id = asTrimmedString(candidate.id);

  return {
    id: id.length > 0 ? id.slice(0, 100) : newRuleId(),
    objectName: asTrimmedString(candidate.objectName).slice(0, 100),
    fieldName: asTrimmedString(candidate.fieldName).slice(0, 100),
    action: isRecordRuleAction(candidate.action) ? candidate.action : 'UPDATE',
    roleName: asNullableTrimmedString(candidate.roleName),
    sotrudnikId: asNullableTrimmedString(candidate.sotrudnikId),
    allowedValues: asAllowedValues(candidate.allowedValues),
    onlyFromSet: asBooleanOrDefault(candidate.onlyFromSet, true),
    message: asTrimmedString(candidate.message).slice(0, MAX_MESSAGE_LENGTH),
    active: asBooleanOrDefault(candidate.active, true),
    applyToServiceChanges: asBooleanOrDefault(
      candidate.applyToServiceChanges,
      false,
    ),
  };
};

/**
 * Приводит что угодно (пустое значение из kv, битый JSON, черновик из UI)
 * к валидной конфигурации. Битое правило не выбрасываем — чистим поля:
 * правило без объекта/поля движок всё равно пропустит (fail-safe).
 */
export const normalizeRecordRulesConfig = (raw: unknown): RecordRulesConfig => {
  if (typeof raw !== 'object' || raw === null) {
    return defaultRecordRulesConfig();
  }

  const maybeRules = (raw as { rules?: unknown }).rules;

  if (!Array.isArray(maybeRules)) {
    return defaultRecordRulesConfig();
  }

  const rules = maybeRules
    .slice(0, MAX_RULES)
    .map(normalizeRule)
    .filter((rule): rule is RecordRule => rule !== null);

  return { rules };
};

/** Есть ли среди правил хотя бы одно, пригодное к работе (для быстрого выхода). */
export const hasUsableRules = (config: RecordRulesConfig): boolean =>
  config.rules.some(
    (rule) =>
      rule.active &&
      rule.objectName.length > 0 &&
      rule.fieldName.length > 0 &&
      rule.allowedValues.length > 0,
  );
