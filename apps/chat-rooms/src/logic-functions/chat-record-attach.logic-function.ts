import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_RECORD_ATTACH_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService } from 'src/shared/chat-service';
import {
  channelsOfMember,
  clientOfDeal,
  ensureChatForContact,
  ensureTarget,
} from 'src/shared/client-thread';
import { addLink } from 'src/shared/message-links';
import { RecordRoomService } from 'src/shared/record-room';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Привязка файла из карточки записи.
 *
 * Сам файл загружает окно прикрепления: оно создаёт сообщение в нужном чате и
 * возвращает его id. Здесь доделываем то, что умеет только приложение:
 * для клиентской переписки помечаем сообщение связкой сделки — без неё оно
 * не попадёт в ленту этой сделки.
 *
 * Для «Обсуждения» связка не нужна: комната уже связана с записью.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) return json({ error: 'Нужна авторизация' }, 401);

  const body = (event.body ?? {}) as {
    recordId?: string;
    chatId?: string;
    messageId?: string;
    mode?: string;
    channelId?: string;
  };

  const recordId = String(body.recordId ?? '').trim();
  const chatId = String(body.chatId ?? '').trim();
  const messageId = String(body.messageId ?? '').trim();
  const mode = String(body.mode ?? 'discussion').trim();

  if (!recordId) {
    return json({ error: 'Нужен recordId' }, 400);
  }

  if (messageId && !chatId) {
    return json({ error: 'Нужен chatId' }, 400);
  }

  try {
    // Вызов без messageId — подготовка: у новой сделки чата ещё нет, а окно
    // прикрепления должно знать, куда отправлять файл.
    if (!messageId) {
      // Окно может открыться в уже известном чате (лента его уже загрузила):
      // подписываем в него, иначе приёмник откажет «нет доступа к диалогу».
      if (chatId) {
        const existing = new ChatService();
        await existing.ensureParticipant(context.workspaceMemberId, chatId);

        return json({ ok: true, chatId });
      }

      if (mode !== 'client') {
        const rooms = new RecordRoomService();
        const preparedChatId = await rooms.ensure(recordId, context.workspaceMemberId);

        // Комната могла быть создана раньше без этого сотрудника, а приёмник
        // файла проверяет участие — подписываем, иначе «нет доступа к диалогу».
        const chat = new ChatService();
        await chat.ensureParticipant(context.workspaceMemberId, preparedChatId);

        return json({ ok: true, chatId: preparedChatId });
      }

      const deal = await clientOfDeal(recordId);

      if (!deal || deal.contacts.length === 0) {
        return json({ error: 'у сделки нет покупателя с телефоном' }, 400);
      }

      const channels = await channelsOfMember(context.workspaceMemberId);
      const wanted = String(body.channelId ?? '');
      const channel = channels.find((item) => item.id === wanted) ?? channels[0];

      if (!channel) {
        return json({ error: 'нет подключённого канала' }, 400);
      }

      const preparedChatId = await ensureChatForContact({
        contact: deal.contacts[0],
        channel,
        dealName: deal.name,
        companyId: deal.companyId,
      });

      const chat = new ChatService();
      await chat.ensureParticipant(context.workspaceMemberId, preparedChatId);

      return json({ ok: true, chatId: preparedChatId });
    }

    if (mode !== 'client') {
      return json({ ok: true, linked: false });
    }

    const deal = await clientOfDeal(recordId);

    if (!deal) {
      return json({ error: 'сделка не найдена' }, 400);
    }

    const targetId = await ensureTarget(chatId, deal, recordId);

    await addLink(messageId, targetId);

    return json({ ok: true, linked: true, targetId });
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
};

export default defineLogicFunction({
  universalIdentifier: CHAT_RECORD_ATTACH_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-record-attach',
  description: 'Привязка присланного файла к записи сделки',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-record-attach',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
