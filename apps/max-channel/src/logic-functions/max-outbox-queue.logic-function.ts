import { defineLogicFunction } from 'twenty-sdk/define';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { MAX_OUTBOX_QUEUE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { describeError, rowsOf } from 'src/shared/crm';

/**
 * Сообщение в диалоге MAX → задача отправки.
 *
 * Срабатывает на создание сообщения: если это исходящее в диалоге канала MAX,
 * кладём задачу в очередь моста. Мост забирает задачи через /s/max-outbox.
 */

type Row = Record<string, unknown> & { id?: string };

const client = new RestApiClient({ runAs: 'application' });

const handler = async (event: unknown) => {
  const recordId = (event as { recordId?: string })?.recordId;

  if (!recordId) return { skipped: 'нет recordId' };

  try {
    const messageResponse = (await client.get<unknown>(`/rest/soobshcheniya/${recordId}`, {
      query: { select: 'id,tekst,napravlenie,chatId,vneshniyId' },
    })) as { data?: { soobshchenie?: Row } };

    const message = messageResponse?.data?.soobshchenie;

    if (!message) return { skipped: 'сообщение не найдено' };
    if (String(message.napravlenie ?? '') !== 'ISHODYASHCHIE') return { skipped: 'входящее' };

    // Импортированное из MAX сообщение уже доставлено — повторно не шлём.
    if (String(message.vneshniyId ?? '')) return { skipped: 'импорт истории' };

    const chatId = String(message.chatId ?? '');

    if (!chatId) return { skipped: 'нет диалога' };

    const chatResponse = (await client.get<unknown>(`/rest/chats/${chatId}`, {
      query: { select: 'id,kanal,maxAccountId,vneshniyId' },
    })) as { data?: { chat?: Row } };

    const chat = chatResponse?.data?.chat;

    if (!chat || String(chat.kanal ?? '') !== 'MAX') return { skipped: 'не MAX-канал' };

    const accountId = String(chat.maxAccountId ?? '');

    if (!accountId) return { skipped: 'у диалога нет аккаунта MAX' };

    // Внешний id диалога: max:<deviceId>:<chatId в MAX>.
    const externalChatId = String(chat.vneshniyId ?? '').split(':').pop() ?? '';

    if (!externalChatId) return { skipped: 'нет внешнего chatId' };

    const existing = rowsOf(
      await client.get<unknown>('/rest/maxOutboxTasks', {
        query: { filter: `soobshchenieId[eq]:"${recordId}"`, limit: 1 },
      }),
      'maxOutboxTasks',
    );

    if (existing.length > 0) return { skipped: 'задача уже есть', taskId: existing[0].id };

    const created = rowsOf(
      await client.post<unknown>('/rest/maxOutboxTasks', {
        name: `MAX → ${externalChatId}`,
        shlyuzId: accountId,
        soobshchenieId: recordId,
        chatId: externalChatId,
        tekst: String(message.tekst ?? ''),
        status: 'OZHIDAET',
        popytki: 0,
      }),
      'maxOutboxTasks',
    )[0];

    return { queued: true, taskId: created?.id ?? '' };
  } catch (error) {
    return { error: describeError(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: 'be6bc1e1-51f2-4b39-b3e4-c09e2676c891',
  name: 'max-outbox-queue',
  description: 'Исходящее сообщение MAX-диалога → задача отправки',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'soobshchenie.created',
  },
});
