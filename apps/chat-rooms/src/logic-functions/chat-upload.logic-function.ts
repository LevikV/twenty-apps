import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_UPLOAD_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { uploadAttachment } from 'src/shared/attach-upload';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Загрузка файла к сообщению чата.
 *
 * Фронт читает выбранный файл в base64 и присылает сюда. Возвращаем
 * `fileId` и имя — их фронт передаёт в chat-send, а тот пишет вложение
 * в сообщение. Дальше сообщение уходит в канал обычным путём.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) return json({ error: 'Нужна авторизация' }, 401);

  const body = (event.body ?? {}) as { name?: string; mime?: string; content?: string };

  const name = String(body.name ?? '').trim();
  const mime = String(body.mime ?? '').trim();
  const content = String(body.content ?? '');

  if (!name || !content) return json({ error: 'Нужны имя файла и содержимое' }, 400);

  try {
    const file = await uploadAttachment(name, mime, content);

    return json({ ok: true, ...file });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
};

export default defineLogicFunction({
  universalIdentifier: CHAT_UPLOAD_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-upload',
  description: 'Загрузка файла вложения для сообщения чата',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-upload',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
