import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, kv, type RoutePayload } from 'twenty-sdk/logic-function';

import { INBOUND_ROUTE_PATH } from 'src/constants/universal-identifiers';
import {
  bumpParticipantUnread,
  describeError,
  ensureChat,
  ensureParticipant,
  findClient,
  findGateway,
  findSoleTarget,
  readChatUnread,
  saveIncoming,
  touchChat,
  touchGateway,
} from 'src/shared/crm';
import { notifyIncoming } from 'src/shared/notify';
import { verifyRouteSecret, verifyWebhookSignature, webhookSecret } from 'src/shared/signature';
import { formatPhone, parseIncoming } from 'src/shared/sms';

/**
 * Приём входящих SMS от Android-шлюза.
 *
 * Телефон отправляет вебхук `sms:received` сам, поэтому маршрут публичный
 * (`isAuthRequired: false`). Сообщение попадает в общий диалог «Центра
 * коммуникации»: chat с каналом SMS, привязкой к шлюзу и карточке клиента.
 *
 * Идемпотентность держится на внешнем id сообщения: повторная доставка того же
 * вебхука вернёт `duplicate: true` и ничего не задвоит.
 */
const handler = async (event: RoutePayload) => {
  // Подпись проверяем, только если ключ задан в окружении: иначе тестовый контур
  // встал бы, а ключ задаётся на телефоне вручную.
  const secretCheck = verifyRouteSecret(
    event.queryStringParameters,
    String(process.env.SMS_INBOUND_SECRET ?? ''),
  );

  if (!secretCheck.ok) {
    return new Response(JSON.stringify({ ok: false, error: secretCheck.reason }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const signature = verifyWebhookSignature(
    String(event.rawBody ?? ''),
    event.headers ?? {},
    webhookSecret(),
  );

  if (!signature.ok) {
    return new Response(JSON.stringify({ ok: false, error: signature.reason }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const incoming = parseIncoming(event.body, event.headers ?? {});
  const errors: string[] = [];

  if (!incoming.gatewayDeviceId) {
    return new Response(JSON.stringify({ ok: false, error: 'нет deviceId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const gateway = await findGateway(incoming.gatewayDeviceId).catch((error) => {
    errors.push(`шлюз: ${describeError(error)}`);

    return null;
  });

  if (!gateway) {
    await kv.set('sms:last', { incoming, errors, result: 'шлюз не найден' });

    return new Response(JSON.stringify({ ok: true, ignored: 'шлюз не найден' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  const client = await findClient(incoming.phone).catch((error) => {
    errors.push(`клиент: ${describeError(error)}`);

    return { personId: '', personName: '', companyId: '', companyName: '' };
  });

  const title =
    client.personName || client.companyName
      ? `${formatPhone(incoming.phone)} — ${client.personName || client.companyName}`
      : formatPhone(incoming.phone);

  let chatId = '';
  let chatCreated = false;
  let messageCreated = false;
  let messageId = '';
  let notifyState = '';

  try {
    const chat = await ensureChat({
      externalId: `sms:${incoming.gatewayDeviceId}:${incoming.phone}`,
      title,
      gatewayId: gateway.id,
      client,
    });

    chatId = chat.id;
    chatCreated = chat.created;

    await ensureParticipant(chatId, gateway.memberId);

    const svyazkaId = await findSoleTarget(chatId).catch(() => '');

    const saved = await saveIncoming({
      chatId,
      externalId: incoming.externalId,
      text: incoming.text,
      receivedAt: incoming.receivedAt,
      svyazkaId,
    });

    messageCreated = saved.created;
    messageId = saved.id;

    if (saved.created) {
      const unreadBefore = await readChatUnread(chatId);

      await touchChat({
        chatId,
        text: incoming.text,
        receivedAt: incoming.receivedAt,
        unreadBefore,
      });
      await bumpParticipantUnread(chatId, gateway.memberId);

      notifyState = await notifyIncoming({
        memberId: gateway.memberId,
        chatId,
        title: title,
        text: incoming.text,
      });
    }
  } catch (error) {
    errors.push(`диалог: ${describeError(error)}`);
  }

  try {
    await touchGateway(gateway.id, incoming.receivedAt);
  } catch (error) {
    errors.push(`шлюз: ${describeError(error)}`);
  }

  const answer = {
    ok: errors.length === 0,
    source: 'sms-channel',
    gateway: gateway.name,
    member: gateway.memberId ? 'найден' : 'нет учётной записи',
    client: client.personName || client.companyName || 'не найден',
    chatId,
    chatCreated,
    messageId,
    notify: notifyState,
    duplicate: Boolean(chatId) && !messageCreated,
    signature: incoming.signature ? 'есть' : 'нет',
    errors,
  };

  await kv.set('sms:last', { incoming, gateway, client, answer });

  return new Response(JSON.stringify(answer), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export default defineLogicFunction({
  universalIdentifier: 'a4272584-eca6-44c1-9291-458dc480cec3',
  name: 'sms-inbound',
  description: 'Входящие SMS с Android-шлюза → диалог «Центра коммуникации»',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: INBOUND_ROUTE_PATH,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: ['content-type'],
  },
});
