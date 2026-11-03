import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { CHAT_THREAD_DEALS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';
import { linksOfMessages } from 'src/shared/message-links';
import { readAllRows } from 'src/shared/paging';

/**
 * Сделки, которые встречаются в переписке — для фильтра ленты.
 *
 * Диалог у клиента один, а сделок у него может быть много. Сообщение знает свою
 * сделку через связку, поэтому список сделок собираем по сообщениям диалога.
 */
const client = new RestApiClient({ runAs: 'application' });

const rowsOf = (body: unknown, key: string): Record<string, unknown>[] => {
  const value = (body as { data?: Record<string, unknown> })?.data?.[key];

  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
};

const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const chatId = String(event.queryStringParameters?.chatId ?? '').trim();

  if (!chatId) {
    return new Response(JSON.stringify({ error: 'Нужен chatId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const messages = await readAllRows({
      client,
      path: '/rest/soobshcheniya',
      key: 'soobshcheniya',
      filter: `chatId[eq]:"${chatId}"`,
      select: 'id',
    });

    const links = await linksOfMessages(
      messages.map((message) => String(message.id ?? '')).filter(Boolean),
    );

    const counts = new Map<string, number>();

    for (const link of links) {
      counts.set(link.svyazkaChatovId, (counts.get(link.svyazkaChatovId) ?? 0) + 1);
    }

    const ids = [...counts.keys()];

    if (ids.length === 0) {
      return new Response(JSON.stringify({ deals: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const targets = rowsOf(
      await client.get<unknown>('/rest/chatTargets', {
        query: {
          filter: `id[in]:[${ids.map((id) => `"${id}"`).join(',')}]`,
          select:
            'id,sdelkaOpportunityId,sdelkaRemontOborudovaniyaId,sdelkaTenderId,sdelkaZapravkaKartridzheyId,zadachaId',
          limit: ids.length,
        },
      }),
      'chatTargets',
    );

    // Название берём у самой записи, а не у связки: «Переписка · НФФР-000517»
    // в лейбле под сообщением читается плохо.
    const SOURCES = [
      { field: 'sdelkaOpportunityId', path: 'opportunities', title: 'name', kind: 'sdelkaOpportunity', label: 'Заказ' },
      { field: 'sdelkaRemontOborudovaniyaId', path: 'remontOborudovaniyas', title: 'name', kind: 'sdelkaRemontOborudovaniya', label: 'Ремонт' },
      { field: 'sdelkaTenderId', path: 'tendery', title: 'name', kind: 'sdelkaTender', label: 'Тендер' },
      { field: 'sdelkaZapravkaKartridzheyId', path: 'zapravkaKartridzheys', title: 'name', kind: 'sdelkaZapravkaKartridzhey', label: 'Заправка' },
      { field: 'zadachaId', path: 'tasks', title: 'title', kind: 'zadacha', label: 'Задача' },
    ];

    const recordOf = (target: Record<string, unknown>) => {
      for (const source of SOURCES) {
        const recordId = String(target[source.field] ?? '');

        if (recordId) return { recordId, source };
      }

      return null;
    };

    const recordIdsByPath = new Map<string, Set<string>>();

    for (const target of targets) {
      const found = recordOf(target);

      if (!found) continue;

      const bucket = recordIdsByPath.get(found.source.path) ?? new Set<string>();

      bucket.add(found.recordId);
      recordIdsByPath.set(found.source.path, bucket);
    }

    const titles = new Map<string, string>();

    await Promise.all(
      SOURCES.map(async (source) => {
        const recordIds = [...(recordIdsByPath.get(source.path) ?? [])];

        if (recordIds.length === 0) return;

        const rows = rowsOf(
          await client.get<unknown>(`/rest/${source.path}`, {
            query: {
              filter: `id[in]:[${recordIds.map((id) => `"${id}"`).join(',')}]`,
              select: `id,${source.title}`,
              limit: recordIds.length,
            },
          }),
          source.path,
        );

        for (const row of rows) {
          titles.set(String(row.id ?? ''), String(row[source.title] ?? ''));
        }
      }),
    );

    const byId = new Map(targets.map((row) => [String(row.id), row]));

    const deals = ids.map((id) => {
      const target = byId.get(id);
      const found = target ? recordOf(target) : null;
      const title = found ? titles.get(found.recordId) : '';

      return {
        id,
        name: title || (found ? `${found.source.label} без названия` : 'Запись без названия'),
        kind: found?.source.kind ?? '',
        recordId: found?.recordId ?? '',
        count: counts.get(id) ?? 0,
      };
    });

    return new Response(JSON.stringify({ deals }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: describeError(error) }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export default defineLogicFunction({
  universalIdentifier: CHAT_THREAD_DEALS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-thread-deals',
  description: 'Сделки в переписке для фильтра ленты',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-thread-deals',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
