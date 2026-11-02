import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_CLIENT_SEND_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ChatService, describeError } from 'src/shared/chat-service';
import {
  channelsOfMember,
  clientOfDeal,
  ensureChatForContact,
  ensureTarget,
} from 'src/shared/client-thread';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Ответ клиенту из карточки сделки.
 *
 * Пишем контактному лицу сделки (а если оно не заполнено — на телефон
 * покупателя). Диалог создаётся при первом сообщении и получает тот же внешний
 * ключ, что и входящие SMS, — ответ клиента попадёт в ту же ленту. Сообщение
 * помечается связкой сделки, поэтому видно в ленте этой сделки.
 */
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) return json({ error: 'Нужна авторизация' }, 401);

  const body = (event.body ?? {}) as {
    recordId?: string;
    text?: string;
    personId?: string;
    channelId?: string;
  };

  const recordId = String(body.recordId ?? '').trim();
  const text = String(body.text ?? '').trim();

  if (!recordId || !text) return json({ error: 'Нужны recordId и текст' }, 400);

  try {
    const deal = await clientOfDeal(recordId);

    if (!deal || deal.contacts.length === 0) {
      return json({ error: 'у сделки нет покупателя с телефоном' }, 400);
    }

    const contact =
      deal.contacts.find((item) => item.personId === String(body.personId ?? '')) ??
      deal.contacts[0];

    const channels = await channelsOfMember(context.workspaceMemberId);

    const channel =
      channels.find((item) => item.id === String(body.channelId ?? '')) ?? channels[0];

    if (!channel) return json({ error: 'нет подключённого канала' }, 400);

    const chatId = await ensureChatForContact({
      contact,
      channel,
      dealName: deal.name,
      companyId: deal.companyId,
    });

    const targetId = await ensureTarget(chatId, deal, recordId);

    const chat = new ChatService();

    // Ответственный по сделке может не быть участником клиентского диалога —
    // подписываем, иначе отправка упрётся в проверку участия.
    await chat.ensureParticipant(context.workspaceMemberId, chatId);

    const result = await chat.send(context.workspaceMemberId, chatId, text, [], {
      svyazkaId: targetId,
    });

    return json({ ...result, chatId, targetId, personId: contact.personId });
  } catch (error) {
    return json({ error: describeError(error) }, 400);
  }
};

export default defineLogicFunction({
  universalIdentifier: CHAT_CLIENT_SEND_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-client-send',
  description: 'Ответ клиенту из карточки сделки с привязкой к сделке',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-client-send',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
