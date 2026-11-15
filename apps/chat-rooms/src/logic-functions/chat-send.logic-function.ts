import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_SEND_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';

/**
 * Отправка сообщения.
 *
 * Автор — всегда тот, кто пришёл (из контекста), даже если в теле передали другой id.
 * После вставки: обновляем «последнее сообщение» диалога и поднимаем счётчики
 * непрочитанного остальным участникам.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = (event.body ?? {}) as {
    chatId?: string;
    text?: string;
    mentions?: { type?: string; id?: string; label?: string }[];
    // Файл загружается отдельным маршрутом chat-upload и приходит сюда
    // готовой парой «id файла + имя».
    attachment?: { fileId?: string; label?: string };
  };
  const chatId = String(body.chatId ?? '').trim();
  const text = String(body.text ?? '').trim();

  const attachmentFileId = String(body.attachment?.fileId ?? '').trim();
  const attachmentLabel = String(body.attachment?.label ?? '').trim() || 'файл';

  // Вложение без текста — нормальный случай (как в телефоне).
  if (!chatId || (!text && !attachmentFileId)) {
    return new Response(JSON.stringify({ error: 'Нужны chatId и текст или файл' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const mentions = (body.mentions ?? [])
      .filter((mention) => mention.type && mention.id && mention.label)
      .map((mention) => ({
        type: String(mention.type),
        id: String(mention.id),
        label: String(mention.label),
      }));

    const service = new ChatService();
    const result = await service.send(
      context.workspaceMemberId,
      chatId,
      text,
      mentions,
      attachmentFileId ? { vlozhenie: [{ fileId: attachmentFileId, label: attachmentLabel }] } : {},
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: describeError(error) }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
};

export default defineLogicFunction({
  universalIdentifier: CHAT_SEND_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-send',
  description: 'Отправка сообщения в диалог',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-send',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
