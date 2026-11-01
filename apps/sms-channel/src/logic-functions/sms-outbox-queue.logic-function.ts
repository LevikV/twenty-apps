import { defineLogicFunction } from 'twenty-sdk/define';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { SMS_OUTBOX_QUEUE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { describeError, rowsOf } from 'src/shared/crm';

/**
 * Сообщение в клиентском диалоге → задача отправки.
 *
 * Срабатывает на создание сообщения. Если это исходящее в диалоге канала SMS,
 * ставим задачу в очередь; отправляет её крон-движок. Повторного постановления
 * нет: ищем задачу по ссылке на сообщение.
 */

type Row = Record<string, unknown> & { id?: string };

const client = new RestApiClient({ runAs: 'application' });

const handler = async (event: unknown) => {
  const recordId = (event as { recordId?: string })?.recordId;

  if (!recordId) return { skipped: 'нет recordId' };

  try {
    const messageResponse = (await client.get<unknown>(`/rest/soobshcheniya/${recordId}`, {
      query: { select: 'id,tekst,napravlenie,chatId' },
    })) as { data?: { soobshchenie?: Row } };

    const message = messageResponse?.data?.soobshchenie;

    if (!message) return { skipped: 'сообщение не найдено' };

    if (String(message.napravlenie ?? '') !== 'ISHODYASHCHIE') {
      return { skipped: 'входящее' };
    }

    const chatId = String(message.chatId ?? '');

    if (!chatId) return { skipped: 'нет диалога' };

    const chatResponse = (await client.get<unknown>(`/rest/chats/${chatId}`, {
      query: { select: 'id,kanal,shlyuzId,vneshniyId' },
    })) as { data?: { chat?: Row } };

    const chat = chatResponse?.data?.chat;

    if (!chat || String(chat.kanal ?? '') !== 'SMS') return { skipped: 'не SMS-канал' };

    const gatewayId = String(chat.shlyuzId ?? '');

    if (!gatewayId) return { skipped: 'у диалога нет шлюза' };

    // Номер клиента лежит во внешнем id диалога: sms:<deviceId>:<10 цифр>.
    const externalId = String(chat.vneshniyId ?? '');
    const phone = externalId.split(':').pop() ?? '';

    if (!phone) return { skipped: 'нет номера клиента' };

    const existing = rowsOf(
      await client.get<unknown>('/rest/smsOutboxTasks', {
        query: { filter: `soobshchenieId[eq]:"${recordId}"`, limit: 1 },
      }),
      'smsOutboxTasks',
    );

    if (existing.length > 0) return { skipped: 'задача уже есть', taskId: existing[0].id };

    const created = rowsOf(
      await client.post<unknown>('/rest/smsOutboxTasks', {
        name: `SMS → ${phone}`,
        shlyuzId: gatewayId,
        soobshchenieId: recordId,
        nomer: phone,
        tekst: String(message.tekst ?? ''),
        status: 'ZHDET',
        popytki: 0,
      }),
      'smsOutboxTasks',
    )[0];

    return { queued: true, taskId: created?.id ?? '' };
  } catch (error) {
    return { error: describeError(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: SMS_OUTBOX_QUEUE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sms-outbox-queue',
  description: 'Исходящее сообщение SMS-диалога → задача отправки',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'soobshchenie.created',
  },
});
