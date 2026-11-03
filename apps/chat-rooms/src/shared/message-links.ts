import { RestApiClient } from 'twenty-client-sdk/rest';

import { readAllRows } from 'src/shared/paging';

/**
 * Связи сообщения с записями.
 *
 * Одно сообщение может быть привязано к нескольким сделкам, ремонтам, тендерам,
 * заправкам и задачам. Связь живёт в объекте «Связь сообщения»
 * (`svyazSoobshcheniya`): строка = сообщение + связка чатов, а запись берётся
 * через морф самой связки.
 */
const client = new RestApiClient({ runAs: 'application' });

export type LinkKind =
  | 'sdelkaOpportunity'
  | 'sdelkaRemontOborudovaniya'
  | 'sdelkaTender'
  | 'sdelkaZapravkaKartridzhey'
  | 'zadacha';

/** Поле «Связки чатов», в котором лежит запись нужного типа. */
export const KIND_FIELD: Record<LinkKind, string> = {
  sdelkaOpportunity: 'sdelkaOpportunityId',
  sdelkaRemontOborudovaniya: 'sdelkaRemontOborudovaniyaId',
  sdelkaTender: 'sdelkaTenderId',
  sdelkaZapravkaKartridzhey: 'sdelkaZapravkaKartridzheyId',
  zadacha: 'zadachaId',
};

export const KIND_LABEL: Record<LinkKind, string> = {
  sdelkaOpportunity: 'Сделка',
  sdelkaRemontOborudovaniya: 'Ремонт',
  sdelkaTender: 'Тендер',
  sdelkaZapravkaKartridzhey: 'Заправка',
  zadacha: 'Задача',
};

export type MessageLink = {
  id: string;
  soobshchenieId: string;
  svyazkaChatovId: string;
};

export const rowsOf = (body: unknown, key: string): Record<string, unknown>[] => {
  const value = (body as { data?: Record<string, unknown> })?.data?.[key];

  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
};

const IN_CHUNK = 30; // сколько id кладём в фильтр [in], чтобы не рвать строку запроса

const normalize = (rows: Record<string, unknown>[]): MessageLink[] =>
  rows
    .map((row) => ({
      id: String(row.id ?? ''),
      soobshchenieId: String(row.soobshchenieId ?? ''),
      svyazkaChatovId: String(row.svyazkaChatovId ?? ''),
    }))
    .filter((row) => row.id && row.soobshchenieId && row.svyazkaChatovId);

/** Все связи по фильтру — курсором, страница за страницей. */
const readLinks = async (filter: string): Promise<MessageLink[]> => {
  const rows = await readAllRows({
    client,
    path: '/rest/svyaziSoobshcheniya',
    key: 'svyaziSoobshcheniya',
    filter,
    select: 'id,soobshchenieId,svyazkaChatovId',
  });

  return normalize(rows);
};

const chunks = <T,>(items: T[], size: number): T[][] => {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
};

/** Связи для набора сообщений (пачками, чтобы не рвать запрос). */
export const linksOfMessages = async (messageIds: string[]): Promise<MessageLink[]> => {
  if (messageIds.length === 0) return [];

  const result: MessageLink[] = [];

  for (const chunk of chunks(messageIds, IN_CHUNK)) {
    result.push(...(await readLinks(`soobshchenieId[in]:[${chunk.join(',')}]`)));
  }

  return result;
};

/** Связи, ведущие на набор связок чатов (то есть на конкретные записи). */
export const linksOfTargets = async (targetIds: string[]): Promise<MessageLink[]> => {
  if (targetIds.length === 0) return [];

  const result: MessageLink[] = [];

  for (const chunk of chunks(targetIds, IN_CHUNK)) {
    result.push(...(await readLinks(`svyazkaChatovId[in]:[${chunk.join(',')}]`)));
  }

  return result;
};

/** Идентификаторы сообщений, привязанных хотя бы к одной из записей. */
export const messageIdsOfTargets = async (targetIds: string[]): Promise<string[]> => {
  const links = await linksOfTargets(targetIds);

  return Array.from(new Set(links.map((link) => link.soobshchenieId)));
};

/** Привязать сообщение к связке чата (идемпотентно). */
export const addLink = async (
  messageId: string,
  targetId: string,
): Promise<{ id: string; created: boolean }> => {
  const existing = rowsOf(
    await client.get<unknown>('/rest/svyaziSoobshcheniya', {
      query: {
        filter: `and(soobshchenieId[eq]:"${messageId}",svyazkaChatovId[eq]:"${targetId}")`,
        select: 'id',
        limit: 1,
      },
    }),
    'svyaziSoobshcheniya',
  )[0];

  if (existing?.id) return { id: String(existing.id), created: false };

  const body = await client.post<unknown>('/rest/svyaziSoobshcheniya', {
    soobshchenieId: messageId,
    svyazkaChatovId: targetId,
  });
  const created =
    rowsOf(body, 'svyaziSoobshcheniya')[0] ??
    (body as { data?: { createSvyazSoobshcheniya?: Record<string, unknown> } })?.data
      ?.createSvyazSoobshcheniya;

  const id = String(created?.id ?? '');

  if (!id) throw new Error('связь создана, но в ответе нет id');

  return { id, created: true };
};

/** Снять связь сообщения с записью. */
export const removeLink = async (linkId: string): Promise<void> => {
  if (!linkId) throw new Error('Нужна связь');

  await client.delete<unknown>(`/rest/svyaziSoobshcheniya/${linkId}`);
};

/**
 * Связка чата с записью: ищем существующую, иначе создаём.
 * Одна пара «диалог + запись» — одна связка, к ней цепляются сообщения.
 */
export const ensureChatTarget = async (params: {
  chatId: string;
  kind: LinkKind;
  recordId: string;
}): Promise<string> => {
  const { chatId, kind, recordId } = params;
  const field = KIND_FIELD[kind];

  if (!field) throw new Error('Неизвестный тип записи');

  const existing = rowsOf(
    await client.get<unknown>('/rest/chatTargets', {
      query: {
        filter: `and(chatId[eq]:"${chatId}",${field}[eq]:"${recordId}")`,
        select: 'id',
        limit: 1,
      },
    }),
    'chatTargets',
  )[0];

  if (existing?.id) return String(existing.id);

  const body = await client.post<unknown>('/rest/chatTargets', { [field]: recordId, chatId });
  const created =
    rowsOf(body, 'chatTargets')[0] ??
    (body as { data?: { createChatTarget?: Record<string, unknown> } })?.data?.createChatTarget;

  const id = String(created?.id ?? '');

  if (!id) throw new Error('связка создана, но в ответе нет id');

  return id;
};
