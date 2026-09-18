import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Тонкая обёртка над REST-клиентом Twenty.
 * REST для кастомных объектов отдаёт списки как { data: { <plural>: [...] } },
 * а create/update — как { data: { <singular>: {...} } }.
 */

export type CrmRecord = Record<string, unknown> & { id: string };

const client = new RestApiClient();

/** Ошибку оборачиваем с телом ответа — иначе 400 нечем объяснить. */
const run = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    const details = error as { message?: string; body?: unknown; status?: number };
    const body =
      details?.body === undefined
        ? ''
        : ` | body: ${JSON.stringify(details.body).slice(0, 300)}`;

    throw new Error(
      `${label} → ${details?.message ?? String(error)}${body}`,
    );
  }
};

const unwrap = (body: unknown): Record<string, unknown> =>
  (body as { data?: Record<string, unknown> })?.data ?? {};

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (Array.isArray(value)) {
    return (value[0] as Record<string, unknown>) ?? undefined;
  }

  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return undefined;
};

const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

/** Ответы REST приходят как data.<plural> (список) или data.createX/updateX/deleteX (одна запись). */
const pickList = (
  body: unknown,
  plural: string,
): Record<string, unknown>[] => {
  const data = unwrap(body);
  const candidates: unknown[] = [
    data[plural],
    data[capitalize(plural)],
    ...Object.values(data),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as Record<string, unknown>[];
    }
  }

  const single = asRecord(data[plural]) ?? asRecord(Object.values(data)[0]);

  return single ? [single] : [];
};

const pickOne = (
  body: unknown,
  singular: string,
): Record<string, unknown> | undefined => {
  const data = unwrap(body);
  const pascal = capitalize(singular);
  const candidates: unknown[] = [
    data[singular],
    data[`create${pascal}`],
    data[`update${pascal}`],
    data[`delete${pascal}`],
    ...Object.values(data),
  ];

  for (const candidate of candidates) {
    const record = asRecord(candidate);

    if (record && typeof record.id === 'string') {
      return record;
    }
  }

  return undefined;
};

export const findMany = async (
  plural: string,
  filter: string | undefined,
  limit = 10,
  orderBy?: string,
): Promise<Record<string, unknown>[]> => {
  const query: Record<string, string | number> = { limit };

  if (filter) {
    query.filter = filter;
  }

  if (orderBy) {
    query.order_by = orderBy;
  }

  const response = await run(`GET /rest/${plural}`, () =>
    client.get<unknown>(`/rest/${plural}`, { query }),
  );

  return pickList(response, plural);
};

export const findFirst = async (
  plural: string,
  singular: string,
  filter: string,
): Promise<Record<string, unknown> | undefined> => {
  const response = await run(`GET /rest/${plural} (first)`, () =>
    client.get<unknown>(`/rest/${plural}`, {
      query: { limit: 1, filter },
    }),
  );

  return pickList(response, plural)[0] ?? pickOne(response, singular);
};

export const createOne = async (
  plural: string,
  singular: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> => {
  const response = await run(`POST /rest/${plural}`, () =>
    client.post<unknown>(`/rest/${plural}`, data),
  );

  return pickOne(response, singular) ?? pickList(response, plural)[0];
};

export const updateOne = async (
  plural: string,
  singular: string,
  id: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> => {
  const response = await run(`PATCH /rest/${plural}/${id}`, () =>
    client.patch<unknown>(`/rest/${plural}/${id}`, data),
  );

  return pickOne(response, singular);
};

export const softDeleteOne = async (
  plural: string,
  id: string,
): Promise<void> => {
  // Без soft_delete=true REST уходит в жёсткое удаление (destroy) — прав на него у приложения нет
  await run(`DELETE /rest/${plural}/${id}`, () =>
    client.delete(`/rest/${plural}/${id}`, {
      query: { soft_delete: 'true' },
    }),
  );
};

export const pluralOf = (objectNameSingular: string): string => {
  const map: Record<string, string> = {
    company: 'companies',
    person: 'people',
    dogovor: 'dogovora',
    companyAddress: 'companyAddresses',
    kontaktKlienta: 'kontaktyKlientov',
    reestrSopostavleniy: 'reestrySopostavleniy',
    queueTask: 'queueTasks',
  };

  return map[objectNameSingular] ?? `${objectNameSingular}s`;
};

/** Убираем пустые значения: пустое поле не должно затирать заполненное. */
export const compact = (
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    out[key] = value;
  }

  return out;
};
