import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { CHAT_LINK_ADD_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { describeError } from 'src/shared/chat-service';
import {
  addLink,
  ensureChatTarget,
  KIND_FIELD,
  type LinkKind,
} from 'src/shared/message-links';
import { canManageMessage } from 'src/shared/roles';

const client = new RestApiClient({ runAs: 'application' });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Привязать сообщение к записи: сделка, ремонт, тендер, заправка или задача.
 *
 * Менять связи может автор сообщения и администратор. Связка чата с записью
 * переиспользуется, поэтому одна и та же сделка не задваивается.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) return json({ error: 'Нужна авторизация' }, 401);

  const body = (event.body ?? {}) as { messageId?: string; kind?: string; recordId?: string };
  const messageId = String(body.messageId ?? '').trim();
  const kind = String(body.kind ?? '').trim() as LinkKind;
  const recordId = String(body.recordId ?? '').trim();

  if (!messageId || !recordId || !KIND_FIELD[kind]) {
    return json({ error: 'Нужны messageId, kind и recordId' }, 400);
  }

  try {
    const message = await client.get<unknown>(`/rest/soobshcheniya/${messageId}`, {
      query: { select: 'id,avtorId,chatId' },
    });
    const row = (message as { data?: { soobshchenie?: Record<string, unknown> } })?.data
      ?.soobshchenie;

    if (!row?.id) return json({ error: 'сообщение не найдено' }, 404);

    const allowed = await canManageMessage({
      memberId: context.workspaceMemberId,
      authorId: String(row.avtorId ?? ''),
      chatId: String(row.chatId ?? ''),
    });

    if (!allowed) {
      return json({ error: 'Менять связи может автор, владелец канала или администратор' }, 403);
    }

    const targetId = await ensureChatTarget({
      chatId: String(row.chatId ?? ''),
      kind,
      recordId,
    });
    const link = await addLink(messageId, targetId);

    return json({ ok: true, linkId: link.id, targetId, created: link.created });
  } catch (error) {
    return json({ error: describeError(error) }, 400);
  }
};

export default defineLogicFunction({
  universalIdentifier: CHAT_LINK_ADD_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-link-add',
  description: 'Привязать сообщение к записи',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-link-add',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
