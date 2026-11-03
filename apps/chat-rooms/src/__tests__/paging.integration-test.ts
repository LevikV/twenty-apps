import { describe, expect, it } from 'vitest';

import { readAllRows } from 'src/shared/paging';

/**
 * Проверка добора страниц: REST отдаёт максимум 200 строк и игнорирует offset,
 * поэтому без курсора вторая половина истории терялась бы молча.
 */
const makeClient = (total: number, pageSize = 200) => {
  const calls: { startingAfter?: string; limit?: number }[] = [];
  const ids = Array.from({ length: total }, (_, index) => `id-${String(index).padStart(4, '0')}`);

  const client = {
    get: async (_path: string, options: { query: Record<string, unknown> }) => {
      const query = options.query as { starting_after?: string; limit: number };
      calls.push({ startingAfter: query.starting_after, limit: query.limit });

      const from = query.starting_after
        ? ids.indexOf(String(query.starting_after)) + 1
        : 0;
      const page = ids.slice(from, from + pageSize);

      return {
        data: { rows: page.map((id) => ({ id })) },
        pageInfo: {
          endCursor: page[page.length - 1] ?? '',
          hasNextPage: from + page.length < ids.length,
        },
      };
    },
  };

  return { client, calls, ids };
};

describe('readAllRows', () => {
  it('добирает все страницы, а не только первую', async () => {
    const { client, calls, ids } = makeClient(450);

    const rows = await readAllRows({
      client: client as never,
      path: '/rest/rows',
      key: 'rows',
      filter: '',
      select: 'id',
    });

    expect(rows.map((row) => row.id)).toEqual(ids);
    expect(calls).toHaveLength(3);
    expect(calls[0].startingAfter).toBeUndefined();
    expect(calls[1].startingAfter).toBe('id-0199');
    expect(calls[2].startingAfter).toBe('id-0399');
  });

  it('останавливается на пустой странице без курсора', async () => {
    const { client, calls } = makeClient(1);

    const rows = await readAllRows({
      client: client as never,
      path: '/rest/rows',
      key: 'rows',
      filter: '',
      select: 'id',
    });

    expect(rows).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it('падает явно, а не отдаёт половину, при превышении предохранителя', async () => {
    const { client } = makeClient(1000);

    await expect(
      readAllRows({
        client: client as never,
        path: '/rest/rows',
        key: 'rows',
        filter: '',
        select: 'id',
        pageSize: 100,
        maxRows: 300,
      }),
    ).rejects.toThrow(/слишком много записей/);
  });
});
