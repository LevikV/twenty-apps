import type { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Постраничное чтение REST.
 *
 * В этой установке Twenty REST отдаёт максимум 200 строк за запрос, а `offset`
 * игнорирует — работает только курсор `starting_after` из `pageInfo.endCursor`.
 * Поэтому всё, что может вырасти (связи, сообщения сделки), читаем курсором:
 * иначе хвост молча пропадает.
 */
export const PAGE_SIZE = 200;
export const MAX_ROWS = 20000;

export const rowsOf = (body: unknown, key: string): Record<string, unknown>[] => {
  const value = (body as { data?: Record<string, unknown> })?.data?.[key];

  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
};

const cursorOf = (body: unknown): { cursor: string; hasNext: boolean } => {
  const info = (body as { pageInfo?: { endCursor?: string; hasNextPage?: boolean } })?.pageInfo;

  return { cursor: String(info?.endCursor ?? ''), hasNext: Boolean(info?.hasNextPage) };
};

export const readAllRows = async (params: {
  client: RestApiClient;
  path: string;
  key: string;
  filter: string;
  select: string;
  pageSize?: number;
  maxRows?: number;
}): Promise<Record<string, unknown>[]> => {
  const { client, path, key, filter, select } = params;
  const pageSize = params.pageSize ?? PAGE_SIZE;
  const maxRows = params.maxRows ?? MAX_ROWS;

  const all: Record<string, unknown>[] = [];
  let cursor = '';

  for (;;) {
    const body = await client.get<unknown>(path, {
      query: {
        // Пустая строка фильтра — не «без фильтра», а ошибка разбора: сервер
        // отвечает «'filter' invalid for 'and()'». Поэтому не передаём его вовсе.
        ...(filter ? { filter } : {}),
        select,
        limit: pageSize,
        ...(cursor ? { starting_after: cursor } : {}),
      },
    });

    const page = rowsOf(body, key);
    const info = cursorOf(body);

    all.push(...page);

    if (!info.hasNext || page.length === 0) return all;

    cursor = info.cursor;

    if (!cursor) return all;

    if (all.length >= maxRows) {
      throw new Error(
        `слишком много записей (больше ${maxRows}): выборка остановлена, чтобы не показать неполные данные`,
      );
    }
  }
};
