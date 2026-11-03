import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { CHAT_LINK_REMOVE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { describeError } from 'src/shared/chat-service';
import { linksOfMessages, removeLink } from 'src/shared/message-links';
import { isAdmin } from 'src/shared/roles';

const client = new RestApiClient({ runAs: 'application' });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Снять связь сообщения с записью. Может автор сообщения и администратор. */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) return json({ error: 'Нужна авторизация' }, 401);

  const body = (event.body ?? {}) as { messageId?: string; targetId?: string };
  const messageId = String(body.messageId ?? '').trim();
  const targetId = String(body.targetId ?? '').trim();

  if (!messageId || !targetId) return json({ error: 'Нужны messageId и targetId' }, 400);

  try {
    const message = await client.get<unknown>(`/rest/soobshcheniya/${messageId}`, {
      query: { select: 'id,avtorId' },
    });
    const row = (message as { data?: { soobshchenie?: Record<string, unknown> } })?.data
      ?.soobshchenie;

    if (!row?.id) return json({ error: 'сообщение не найдено' }, 404);

    const memberId = context.workspaceMemberId;
    const isAuthor = String(row.avtorId ?? '') === memberId;

    if (!isAuthor && !(await isAdmin(memberId))) {
      return json({ error: 'Менять связи может автор сообщения или администратор' }, 403);
    }

    const links = await linksOfMessages([messageId]);
    const link = links.find((item) => item.svyazkaChatovId === targetId);

    if (!link) return json({ error: 'связи нет' }, 404);

    await removeLink(link.id);

    return json({ ok: true });
  } catch (error) {
    return json({ error: describeError(error) }, 400);
  }
};

export default defineLogicFunction({
  universalIdentifier: CHAT_LINK_REMOVE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-link-remove',
  description: 'Снять связь сообщения с записью',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-link-remove',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
