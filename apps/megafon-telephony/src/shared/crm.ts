import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Минимальная обёртка над REST-клиентом Twenty для логик-функций.
 *
 * Ошибку оборачиваем с телом ответа — иначе «400 Bad Request» ничем не объяснить,
 * а тело Twenty кладёт причину (валидация, дубликат, конфликт уникального поля).
 */

const client = new RestApiClient();

export type CrmRecord = Record<string, unknown> & { id?: string };

/** Разворачивает ответ REST: { data: { createX: {...} } } или { data: { <plural>: [...] } }. */
const unwrap = (body: unknown): Record<string, unknown> =>
  (body as { data?: Record<string, unknown> })?.data ?? {};

const pickRecord = (
  body: unknown,
  keys: string[],
): CrmRecord | undefined => {
  const data = unwrap(body);

  for (const key of keys) {
    const candidate = data[key];

    if (Array.isArray(candidate)) {
      return (candidate[0] as CrmRecord) ?? undefined;
    }

    if (candidate && typeof candidate === 'object') {
      return candidate as CrmRecord;
    }
  }

  for (const candidate of Object.values(data)) {
    if (Array.isArray(candidate)) {
      return (candidate[0] as CrmRecord) ?? undefined;
    }

    if (candidate && typeof candidate === 'object') {
      return candidate as CrmRecord;
    }
  }

  return undefined;
};

export const describeError = (error: unknown): string => {
  const details = error as {
    message?: string;
    status?: number;
    body?: unknown;
  };
  const body =
    details?.body === undefined
      ? ''
      : ` | body: ${JSON.stringify(details.body).slice(0, 400)}`;

  return `${details?.message ?? String(error)}${body}`;
};

export const createOne = async (
  plural: string,
  singular: string,
  data: Record<string, unknown>,
): Promise<CrmRecord> => {
  const response = await client.post<unknown>(`/rest/${plural}`, data);

  const record = pickRecord(response, [
    singular,
    `create${singular.charAt(0).toUpperCase()}${singular.slice(1)}`,
  ]);

  if (!record?.id) {
    throw new Error(
      `POST /rest/${plural} → ответ без id: ${JSON.stringify(response).slice(0, 300)}`,
    );
  }

  return record;
};
