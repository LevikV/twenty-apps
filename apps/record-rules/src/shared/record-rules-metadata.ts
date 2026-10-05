/**
 * Чтение метаданных для экрана настроек: объекты и их поля-списки с опциями.
 *
 * Зачем: галочки «допустимые значения» должны строиться из ЖИВЫХ опций поля.
 * Иначе пришлось бы держать копию и синхронизировать её — лишний механизм
 * и риск устаревших значений.
 *
 * По исходникам Twenty (проверено 05.10.2026): запрос `objects` и `fields`
 * в metadata API закрыт `NoPermissionGuard` — приложению доступен, флаги
 * прав не нужны. Роли, наоборот, требуют флага ROLES — поэтому роль
 * в правиле задаётся названием, а не выбором из списка.
 */

export type RecordRuleFieldOption = {
  value: string;
  label: string;
  color?: string;
};

export type RecordRuleSelectableField = {
  name: string;
  label: string;
  type: 'SELECT' | 'MULTI_SELECT';
  options: RecordRuleFieldOption[];
};

export type RecordRuleSelectableObject = {
  nameSingular: string;
  labelSingular: string;
  fields: RecordRuleSelectableField[];
};

const METADATA_QUERY = `
  query RecordRulesMetadata {
    objects(paging: { first: 200 }, filter: { isActive: { is: true } }) {
      edges {
        node {
          nameSingular
          labelSingular
          fieldsList { name label type isActive options }
        }
      }
    }
  }
`;

type RawField = {
  name?: unknown;
  label?: unknown;
  type?: unknown;
  isActive?: unknown;
  options?: unknown;
};

const toOption = (raw: unknown): RecordRuleFieldOption | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const candidate = raw as { value?: unknown; label?: unknown; color?: unknown };
  const value = typeof candidate.value === 'string' ? candidate.value : '';

  if (value.length === 0) {
    return null;
  }

  return {
    value,
    label:
      typeof candidate.label === 'string' && candidate.label.length > 0
        ? candidate.label
        : value,
    color: typeof candidate.color === 'string' ? candidate.color : undefined,
  };
};

const toSelectableField = (raw: RawField): RecordRuleSelectableField | null => {
  const type = raw.type === 'SELECT' || raw.type === 'MULTI_SELECT' ? raw.type : null;

  if (type === null || raw.isActive === false) {
    return null;
  }

  const name = typeof raw.name === 'string' ? raw.name : '';
  const label = typeof raw.label === 'string' ? raw.label : name;
  const options = Array.isArray(raw.options)
    ? raw.options.map(toOption).filter((option): option is RecordRuleFieldOption => option !== null)
    : [];

  if (name.length === 0 || options.length === 0) {
    return null;
  }

  return { name, label, type, options };
};

/**
 * Возвращает объекты, у которых есть хотя бы одно поле-список с опциями.
 * Сортировка — по русской подписи, чтобы пикер на экране был предсказуем.
 */
export const fetchSelectableObjects = async (): Promise<
  RecordRuleSelectableObject[]
> => {
  const apiUrl = (process.env.TWENTY_API_URL ?? '').replace(/\/+$/, '');
  const token = process.env.TWENTY_APP_ACCESS_TOKEN ?? '';

  if (apiUrl.length === 0 || token.length === 0) {
    throw new Error('не заданы TWENTY_API_URL / TWENTY_APP_ACCESS_TOKEN');
  }

  const response = await fetch(`${apiUrl}/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: METADATA_QUERY }),
  });

  const json = (await response.json()) as {
    data?: {
      objects?: {
        edges?: { node?: { nameSingular?: unknown; labelSingular?: unknown; fieldsList?: unknown } }[];
      };
    };
    errors?: unknown;
  };

  if (!response.ok || json.errors) {
    throw new Error(
      `metadata API: HTTP ${response.status} ${JSON.stringify(json.errors ?? {}).slice(0, 300)}`,
    );
  }

  const edges = json.data?.objects?.edges ?? [];
  const objects: RecordRuleSelectableObject[] = [];

  for (const edge of edges) {
    const node = edge?.node;
    const nameSingular = typeof node?.nameSingular === 'string' ? node.nameSingular : '';

    if (nameSingular.length === 0) {
      continue;
    }

    const fields = Array.isArray(node?.fieldsList)
      ? (node?.fieldsList as RawField[])
          .map(toSelectableField)
          .filter((field): field is RecordRuleSelectableField => field !== null)
      : [];

    if (fields.length === 0) {
      continue;
    }

    objects.push({
      nameSingular,
      labelSingular:
        typeof node?.labelSingular === 'string' && node.labelSingular.length > 0
          ? node.labelSingular
          : nameSingular,
      fields,
    });
  }

  return objects.sort((left, right) =>
    left.labelSingular.localeCompare(right.labelSingular, 'ru'),
  );
};
