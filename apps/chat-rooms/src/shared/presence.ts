/**
 * Присутствие в чате: кто прямо сейчас смотрит диалог.
 *
 * Нужно, чтобы не присылать пуш о сообщении человеку, у которого этот чат
 * открыт на экране. Храним в памяти процесса (приложение работает в
 * twenty-server, обработчики — LOCAL), при перезапуске карта просто пустеет:
 * худшее следствие — лишний пуш, не потеря данных.
 */

export const PRESENCE_TTL_MS = 90_000;

type PresenceEntry = {
  chatId: string;
  at: number;
};

const presence = new Map<string, PresenceEntry>();

/** Отметить, что сотрудник смотрит этот чат. */
export function notePresence(memberId: string, chatId: string): void {
  if (!memberId || !chatId) {
    return;
  }

  presence.set(memberId, { chatId, at: Date.now() });
}

/** Смотрит ли сотрудник этот чат прямо сейчас. */
export function isPresent(memberId: string, chatId: string): boolean {
  const entry = presence.get(memberId);

  if (!entry) {
    return false;
  }

  return entry.chatId === chatId && Date.now() - entry.at < PRESENCE_TTL_MS;
}

/** Снять отметку (диалог закрыли). */
export function clearPresence(memberId: string): void {
  presence.delete(memberId);
}


/**
 * Диалог, который нужно открыть сотруднику по переходу из пуша.
 * Пуш не создаёт запись в «Уведомлениях», поэтому адрес страницы компоненту
 * взять неоткуда — запоминаем цель здесь на 15 минут.
 */
export const OPEN_TARGET_TTL_MS = 15 * 60 * 1000;

const openTargets = new Map<string, { chatId: string; at: number }>();

export function setOpenTarget(memberId: string, chatId: string): void {
  if (!memberId || !chatId) {
    return;
  }

  openTargets.set(memberId, { chatId, at: Date.now() });
}

export function takeOpenTarget(memberId: string): string | null {
  const entry = openTargets.get(memberId);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.at > OPEN_TARGET_TTL_MS) {
    openTargets.delete(memberId);

    return null;
  }

  return entry.chatId;
}
