import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, kv, type RoutePayload } from 'twenty-sdk/logic-function';

import { INBOUND_ROUTE_PATH } from 'src/constants/universal-identifiers';
import {
  attachIncomingFile,
  bumpParticipantUnread,
  describeError,
  ensureChat,
  ensureParticipant,
  findAccount,
  findClient,
  findIncomingTarget,
  readChatUnread,
  saveIncoming,
  touchAccount,
  touchChat,
} from 'src/shared/crm';
import { notifyIncoming, notifyRefresh } from 'src/shared/notify';

/**
 * Приём входящего сообщения MAX от моста.
 *
 * Мост держит WebSocket-сессию аккаунта и пересылает сюда нормализованное
 * событие. Маршрут публичный (`isAuthRequired: false`): мост работает вне
 * Twenty. Идемпотентность — по внешнему id сообщения MAX.
 *
 * Телефон собеседника MAX отдаёт только если он открыт нам (добавил в
 * контакты). Если телефона нет — диалог всё равно создаётся, привязка
 * к клиенту остаётся пустой и её можно заполнить вручную. Когда телефон
 * появится позже, диалог довяжется, но ручную привязку не затрём.
 */
type Incoming = {
  deviceId?: string;
  chatId?: number | string;
  messageId?: string;
  senderId?: number;
  senderName?: string;
  text?: string;
  direction?: string;
  at?: number;
  phone?: string;
  chatType?: string;
  attach?: { fileId?: string; label?: string; kind?: string };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const handler = async (event: RoutePayload) => {
  const body = (event.body ?? {}) as Incoming;
  const errors: string[] = [];

  const deviceId = String(body.deviceId ?? '');
  const externalChatId = String(body.chatId ?? '');
  const messageId = String(body.messageId ?? '');

  if (!deviceId) return json({ ok: false, error: 'нет deviceId' }, 400);
  if (!externalChatId) return json({ ok: false, error: 'нет chatId' }, 400);
  if (!messageId) return json({ ok: false, error: 'нет messageId' }, 400);

  const account = await findAccount(deviceId).catch((error) => {
    errors.push(`аккаунт: ${describeError(error)}`);

    return null;
  });

  if (!account) {
    await kv.set('max:last', { body, errors, result: 'аккаунт не найден' });

    return json({ ok: true, ignored: 'аккаунт не найден' });
  }

  // В CRM номера хранятся десятью цифрами без кода страны: MAX отдаёт 11.
  const digits = String(body.phone ?? '').replace(/\D/g, '');
  const phone = digits.length > 10 ? digits.slice(-10) : digits;

  const client = phone
    ? await findClient(phone).catch((error) => {
        errors.push(`клиент: ${describeError(error)}`);

        return { personId: '', personName: '', companyId: '', companyName: '' };
      })
    : { personId: '', personName: '', companyId: '', companyName: '' };

  const senderName = String(body.senderName ?? '').trim();
  const title =
    client.personName || client.companyName
      ? `${client.personName || client.companyName} — MAX`
      : `${senderName || 'Диалог MAX'} (${externalChatId})`;

  const externalId = `max:${deviceId}:${externalChatId}`;
  const receivedAt = new Date(Number(body.at ?? Date.now())).toISOString();
  const text = String(body.text ?? '');
  const attach = body.attach as
    | { fileId?: string; label?: string; kind?: string }
    | undefined;
  const kindLabel =
    attach?.kind === 'VIDEO'
      ? 'Видео'
      : attach?.kind === 'PHOTO'
        ? 'Фото'
        : attach?.kind === 'AUDIO'
          ? 'Голосовое'
          : attach?.kind === 'FILE'
            ? 'Файл'
            : '(вложение)';

  let chatId = '';
  let chatCreated = false;
  let messageIdCreated = '';
  let messageCreated = false;
  let boundLater = false;
  let notifyState = '';

  try {
    const chat = await ensureChat({
      externalId,
      title,
      accountId: account.id,
      client,
    });

    chatId = chat.id;
    chatCreated = chat.created;

    // Телефон появился позже: довязываем диалог, но только если привязки нет.
    if (!chat.created && (client.personId || client.companyId)) {
      boundLater = Boolean(client.personId || client.companyId);
    }

    await ensureParticipant(chatId, account.memberId);

    const svyazkaId = await findIncomingTarget(chatId).catch(() => '');

    const saved = await saveIncoming({
      chatId,
      externalId: `max:${messageId}`,
      text: text || (attach?.fileId ? kindLabel : '(вложение)'),
      receivedAt,
      svyazkaId,
      outgoing: String(body.direction ?? '') === 'out',
      authorName: senderName,
    });

    messageCreated = saved.created;
    messageIdCreated = saved.id;

    // Вложение мост уже загрузил в Twenty — привязываем его к сообщению.
    if (saved.created && attach?.fileId) {
      try {
        await attachIncomingFile(saved.id, attach.fileId, attach.label || kindLabel);
      } catch (error) {
        errors.push(`вложение: ${describeError(error)}`);
      }
    }

    if (saved.created) {
      const unreadBefore = await readChatUnread(chatId);

      await touchChat({ chatId, text: text || '(вложение)', receivedAt, unreadBefore });

      if (String(body.direction ?? '') !== 'out') {
        await bumpParticipantUnread(chatId, account.memberId);

        notifyState = await notifyIncoming({
          memberId: account.memberId,
          chatId,
          title,
          text: text || '(вложение)',
        });
      } else {
        // Отправили с телефона: пуша не нужно, но открытая лента
        // должна перечитаться сразу.
        notifyState = await notifyRefresh({ memberId: account.memberId, chatId });
      }
    }
  } catch (error) {
    errors.push(`диалог: ${describeError(error)}`);
  }

  try {
    await touchAccount(account.id, receivedAt);
  } catch (error) {
    errors.push(`аккаунт: ${describeError(error)}`);
  }

  const answer = {
    ok: errors.length === 0,
    source: 'max-channel',
    account: account.name,
    chatId,
    chatCreated,
    messageId: messageIdCreated,
    client: client.personName || client.companyName || (phone ? 'номер есть, клиент не найден' : 'нет телефона'),
    linkable: Boolean(client.personId || client.companyId),
    duplicate: Boolean(chatId) && !messageCreated,
    notify: notifyState,
    errors,
  };

  await kv.set('max:last', { body, account, client, answer });

  void boundLater;

  return json(answer);
};

export default defineLogicFunction({
  universalIdentifier: '481b1d28-2c9f-4c9d-bb81-cc5e4b3e372b',
  name: 'max-inbound',
  description: 'Входящее сообщение MAX от моста → диалог «Центра коммуникации»',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: INBOUND_ROUTE_PATH,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: ['content-type'],
  },
});
