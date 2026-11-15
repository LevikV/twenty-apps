import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Уведомления сотруднику — те же, что у внутренних чатов «Центра коммуникации».
 *
 * Пуш и бейдж живут не в Twenty, а в сервисе уведомлений ядра: POST /api/notify
 * и POST /api/notify/badge. Сокет подписан на `user.id`, поэтому отдаём именно
 * его, а не идентификатор участника пространства.
 */

const client = new RestApiClient({ runAs: 'application' });

/** Страница «Диалоги»: по ссылке из уведомления открывается нужный чат. */
const CHAT_PAGE_PATH = '/page/30e9b2da-683c-4fce-8a61-5c5102d69f3e';

const apiBase = (): string => {
  const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;

  // TWENTY_API_URL в этой установке не задан, поэтому падаем на SERVER_URL:
  // без адреса пуш молча не уходил, и интерфейс жил на опросе раз в 20 секунд.
  const base = String(env?.TWENTY_API_URL || env?.SERVER_URL || 'http://127.0.0.1:3000');

  return base.replace(/\/+$/, '');
};

const memberUserId = async (memberId: string): Promise<string | null> => {
  if (!memberId) return null;

  const response = (await client.get<unknown>(`/rest/workspaceMembers/${memberId}`, {
    query: { select: 'id,userId' },
  })) as { data?: { workspaceMember?: { userId?: string } } };

  const userId = response?.data?.workspaceMember?.userId;

  return typeof userId === 'string' && userId.length > 0 ? userId : null;
};

/**
 * Запомнить диалог, который открыть по переходу из уведомления.
 *
 * Пишем в участие сотрудника в чате, а не в «Уведомления»: обычное сообщение —
 * не уведомление, и колокольчик от него пухнуть не должен.
 */
const saveOpenTarget = async (memberId: string, chatId: string): Promise<void> => {
  try {
    const response = (await client.get<unknown>('/rest/chatParticipants', {
      query: {
        filter: `polzovatelId[eq]:"${memberId}",chatId[eq]:"${chatId}"`,
        select: 'id',
        limit: 1,
      },
    })) as { data?: { chatParticipants?: Array<{ id?: string }> } };

    const row = response?.data?.chatParticipants?.[0];

    if (!row?.id) {
      return;
    }

    await client.patch<unknown>(`/rest/chatParticipants/${row.id}`, { otkrytChatId: `${chatId}|${Date.now()}` });
  } catch (error) {
    console.error('[open-target] не сохранилось:', error instanceof Error ? error.message : String(error));
    // подсказка не критична: без неё откроется обычный вид страницы
  }
};

export type NotifyResult = 'ok' | 'нет базы' | 'нет userId' | 'ошибка';

/**
 * Тихий сигнал «в этом чате новое» — без всплывающего пуша.
 * Нужен для исходящих, отправленных с телефона: уведомлять не о чем,
 * но лента в открытом чате должна перечитаться сразу, а не по таймеру.
 */
export const notifyRefresh = async (params: {
  memberId: string;
  chatId: string;
}): Promise<NotifyResult> => {
  const base = apiBase();

  if (!base) return 'нет базы';

  const userId = await memberUserId(params.memberId);

  if (!userId) return 'нет userId';

  try {
    await fetch(`${base}/api/notify/badge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, chatId: params.chatId }),
    });

    return 'ok';
  } catch {
    return 'ошибка';
  }
};

/** Пуш о новом входящем сообщении и обновление бейджа непрочитанных. */
export const notifyIncoming = async (params: {
  memberId: string;
  chatId: string;
  title: string;
  text: string;
}): Promise<NotifyResult> => {
  const { memberId, chatId, title, text } = params;
  const base = apiBase();

  if (!base) return 'нет базы';

  const userId = await memberUserId(memberId);

  if (!userId) return 'нет userId';

  const body = {
    userId,
    // chatId позволяет виджету сразу перечитать ленту, а не ждать таймера.
    chatId,
    title,
    text: text.slice(0, 140),
    variant: 'info',
    tip: 'soobshchenie',
    prioritet: 'obychnoe',
    link: `${CHAT_PAGE_PATH}?chatId=${chatId}`,
    linkLabel: 'Открыть чат',
    duration: 10000,
    persist: false,
  };

  try {
    await saveOpenTarget(memberId, chatId);

    await fetch(`${base}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    await fetch(`${base}/api/notify/badge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, chatId }),
    });

    return 'ok';
  } catch {
    return 'ошибка';
  }
};
