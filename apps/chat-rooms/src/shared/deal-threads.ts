import type { RestApiClient } from 'twenty-client-sdk/rest';

import { readAllRows, rowsOf } from 'src/shared/paging';

/** Типы записей, к которым может быть привязана переписка. */
const TARGET_SOURCES = [
  {
    kind: 'sdelkaOpportunity',
    field: 'sdelkaOpportunityId',
    path: '/rest/opportunities',
    key: 'opportunities',
    titleField: 'name',
    label: 'Заказ',
  },
  {
    kind: 'sdelkaRemontOborudovaniya',
    field: 'sdelkaRemontOborudovaniyaId',
    path: '/rest/remontOborudovaniyas',
    key: 'remontOborudovaniyas',
    titleField: 'name',
    label: 'Ремонт',
  },
  {
    kind: 'sdelkaTender',
    field: 'sdelkaTenderId',
    path: '/rest/tendery',
    key: 'tendery',
    titleField: 'name',
    label: 'Тендер',
  },
  {
    kind: 'sdelkaZapravkaKartridzhey',
    field: 'sdelkaZapravkaKartridzheyId',
    path: '/rest/zapravkaKartridzheys',
    key: 'zapravkaKartridzheys',
    titleField: 'name',
    label: 'Заправка',
  },
  {
    kind: 'zadacha',
    field: 'zadachaId',
    path: '/rest/tasks',
    key: 'tasks',
    titleField: 'title',
    label: 'Задача',
  },
];

export type DealThread = {
  /** Идентификатор связки чатов — по нему фильтруется лента. */
  targetId: string;
  chatId: string;
  kind: string;
  recordId: string;
  name: string;
  lastMessage: string;
  lastAt: string;
};

const chunks = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }

  return out;
};

const extract = (record: Record<string, unknown> | undefined) => {
  if (!record) return null;

  for (const source of TARGET_SOURCES) {
    const recordId = String(record[source.field] ?? '');

    if (recordId) return { kind: source.kind, recordId, label: source.label };
  }

  return null;
};

/**
 * Переписки, сгруппированные по записям (сделкам).
 *
 * Нужны для режима «По сделкам»: список показывает не клиентов, а записи,
 * у которых есть переписка, с последним сообщением.
 */
export const dealThreads = async (client: RestApiClient): Promise<DealThread[]> => {
  const links = await readAllRows({
    client,
    path: '/rest/svyaziSoobshcheniya',
    key: 'svyaziSoobshcheniya',
    filter: '',
    select: 'id,soobshchenieId,svyazkaChatovId',
  });

  const messageIds = [...new Set(links.map((link) => String(link.soobshchenieId ?? '')).filter(Boolean))];
  const targetIds = [...new Set(links.map((link) => String(link.svyazkaChatovId ?? '')).filter(Boolean))];

  if (messageIds.length === 0 || targetIds.length === 0) return [];

  const messages = new Map<string, Record<string, unknown>>();

  for (const chunk of chunks(messageIds, 200)) {
    const body = await client.get<unknown>('/rest/soobshcheniya', {
      query: {
        filter: `id[in]:[${chunk.map((id) => `"${id}"`).join(',')}]`,
        select: 'id,chatId,tekst,createdAt',
        limit: 200,
      },
    });

    for (const row of rowsOf(body, 'soobshcheniya')) {
      messages.set(String(row.id ?? ''), row);
    }
  }

  const targets = new Map<string, Record<string, unknown>>();

  for (const chunk of chunks(targetIds, 200)) {
    const body = await client.get<unknown>('/rest/chatTargets', {
      query: {
        filter: `id[in]:[${chunk.map((id) => `"${id}"`).join(',')}]`,
        select: `id,${TARGET_SOURCES.map((source) => source.field).join(',')}`,
        limit: 200,
      },
    });

    for (const row of rowsOf(body, 'chatTargets')) {
      targets.set(String(row.id ?? ''), row);
    }
  }

  // Названия записей: в связке лежит только ссылка.
  const titles = new Map<string, string>();
  const idsByKind = new Map<string, string[]>();

  for (const [targetId] of targets) {
    const parsed = extract(targets.get(targetId));

    if (!parsed) continue;

    const list = idsByKind.get(parsed.kind) ?? [];
    list.push(parsed.recordId);
    idsByKind.set(parsed.kind, list);
  }

  for (const source of TARGET_SOURCES) {
    const ids = [...new Set(idsByKind.get(source.kind) ?? [])];

    if (ids.length === 0) continue;

    for (const chunk of chunks(ids, 200)) {
      const body = await client.get<unknown>(source.path, {
        query: {
          filter: `id[in]:[${chunk.map((id) => `"${id}"`).join(',')}]`,
          select: `id,${source.titleField}`,
          limit: 200,
        },
      });

      for (const row of rowsOf(body, source.key)) {
        titles.set(String(row.id ?? ''), String(row[source.titleField] ?? ''));
      }
    }
  }

  const byTarget = new Map<string, DealThread>();

  for (const link of links) {
    const targetId = String(link.svyazkaChatovId ?? '');
    const message = messages.get(String(link.soobshchenieId ?? ''));
    const target = targets.get(targetId);
    const parsed = extract(target);

    if (!message || !parsed || !targetId) continue;

    const chatId = String(message.chatId ?? '');
    const createdAt = String(message.createdAt ?? '');
    const existing = byTarget.get(targetId);

    if (existing && existing.lastAt >= createdAt) continue;

    byTarget.set(targetId, {
      targetId,
      chatId,
      kind: parsed.kind,
      recordId: parsed.recordId,
      name: titles.get(parsed.recordId) || parsed.label,
      lastMessage: String(message.tekst ?? ''),
      lastAt: createdAt,
    });
  }

  return [...byTarget.values()].sort((left, right) => (left.lastAt < right.lastAt ? 1 : -1));
};
