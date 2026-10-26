import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Серверная часть «Центра коммуникации».
 *
 * Все чтения и записи чата идут ОТ ИМЕНИ ПРИЛОЖЕНИЯ, а не от имени пользователя:
 * объекты чата кастомные, и у роли «Менеджер» прав на них нет (в Twenty для
 * системных объектов чтение разрешено по умолчанию, для кастомных — только по правам роли).
 *
 * Кто именно пришёл — берём из контекста выполнения (`workspaceMemberId`), он
 * вычисляется платформой из токена и подделать его из браузера нельзя.
 * Поэтому «мои диалоги» и «я участник этого диалога» проверяются на сервере.
 */

type Row = Record<string, unknown> & { id?: string };

export type DialogView = {
  id: string;
  name: string;
  tip: string | null;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
};

export type MessageView = {
  id: string;
  text: string | null;
  createdAt: string;
  authorId: string | null;
  authorName: string;
};

const unwrap = (body: unknown): Record<string, unknown> =>
  (body as { data?: Record<string, unknown> })?.data ?? {};

const rowsOf = (body: unknown, key: string): Row[] => {
  const value = unwrap(body)[key];

  return Array.isArray(value) ? (value as Row[]) : [];
};

const pickCreated = (body: unknown): Row | undefined => {
  for (const candidate of Object.values(unwrap(body))) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const record = candidate as Row;

      if (record.id) return record;
    }
  }

  return undefined;
};

export const describeError = (error: unknown): string => {
  const details = error as { message?: string; status?: number; body?: unknown };
  const body =
    details?.body === undefined ? '' : ` | ${JSON.stringify(details.body).slice(0, 300)}`;

  return `${details?.message ?? String(error)}${body}`;
};

const fullName = (row: Row): string => {
  const composite = row.name as { firstName?: string; lastName?: string } | undefined;
  const first = composite?.firstName ?? '';
  const last = composite?.lastName ?? '';
  const full = `${first} ${last}`.trim();

  return full || 'Сотрудник';
};

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const asNumber = (value: unknown): number => (typeof value === 'number' ? value : 0);

export class ChatService {
  // runAs: 'application' — ходим от имени приложения, а не от имени сотрудника:
  // у ролей нет прав на кастомные объекты чата (PERMISSION_DENIED).
  private readonly client = new RestApiClient({ runAs: 'application' });

  async memberNames(): Promise<Record<string, string>> {
    const response = await this.client.get<unknown>('/rest/workspaceMembers', {
      query: { select: 'id,name', limit: 60 },
    });

    const map: Record<string, string> = {};

    for (const member of rowsOf(response, 'workspaceMembers')) {
      if (member.id) {
        map[member.id] = fullName(member);
      }
    }

    return map;
  }

  private async myParticipations(memberId: string): Promise<Row[]> {
    const response = await this.client.get<unknown>('/rest/chatParticipants', {
      query: {
        filter: `polzovatelId[eq]:"${memberId}"`,
        select: 'id,chatId,neprochitano,prochitanoDo',
        limit: 60,
      },
    });

    return rowsOf(response, 'chatParticipants');
  }

  async dialogs(memberId: string): Promise<{
    dialogs: DialogView[];
    names: Record<string, string>;
  }> {
    const participations = await this.myParticipations(memberId);

    if (participations.length === 0) {
      return { dialogs: [], names: await this.memberNames() };
    }

    const unreadByChat = new Map<string, number>();

    for (const participant of participations) {
      const chatId = asString(participant.chatId);

      if (chatId) {
        unreadByChat.set(chatId, asNumber(participant.neprochitano));
      }
    }

    const ids = [...unreadByChat.keys()];
    const response = await this.client.get<unknown>('/rest/chats', {
      query: {
        filter: `id[in]:[${ids.join(',')}]`,
        select: 'id,name,tip,vremyaPoslednego,posledneeSoobshchenie',
        limit: 60,
      },
    });

    const dialogs = rowsOf(response, 'chats')
      .map((chat) => ({
        id: String(chat.id ?? ''),
        name: asString(chat.name) ?? 'Без названия',
        tip: asString(chat.tip),
        lastMessage: asString(chat.posledneeSoobshchenie),
        lastAt: asString(chat.vremyaPoslednego),
        unread: unreadByChat.get(String(chat.id ?? '')) ?? 0,
      }))
      .filter((dialog) => dialog.id.length > 0)
      .sort((left, right) => (right.lastAt ?? '').localeCompare(left.lastAt ?? ''));

    return { dialogs, names: await this.memberNames() };
  }

  async assertParticipant(memberId: string, chatId: string): Promise<void> {
    const participations = await this.myParticipations(memberId);

    const isParticipant = participations.some(
      (participant) => asString(participant.chatId) === chatId,
    );

    if (!isParticipant) {
      throw new Error('Нет доступа к этому диалогу');
    }
  }

  async messages(
    memberId: string,
    chatId: string,
  ): Promise<{ messages: MessageView[]; names: Record<string, string> }> {
    await this.assertParticipant(memberId, chatId);

    const response = await this.client.get<unknown>('/rest/soobshcheniya', {
      query: {
        filter: `chatId[eq]:"${chatId}"`,
        select: 'id,tekst,createdAt,avtorId,chatId',
        limit: 60,
      },
    });

    const names = await this.memberNames();

    const messages = rowsOf(response, 'soobshcheniya')
      .map((message) => {
        const authorId = asString(message.avtorId);

        return {
          id: String(message.id ?? ''),
          text: asString(message.tekst),
          createdAt: String(message.createdAt ?? ''),
          authorId,
          authorName: authorId ? names[authorId] ?? 'Сотрудник' : 'Сотрудник',
        };
      })
      .filter((message) => message.id.length > 0)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    return { messages, names };
  }

  async send(memberId: string, chatId: string, text: string): Promise<{ id: string }> {
    await this.assertParticipant(memberId, chatId);

    const created = pickCreated(
      await this.client.post<unknown>('/rest/soobshcheniya', {
        chatId,
        tekst: text,
        avtorId: memberId,
        napravlenie: 'ISHODYASHCHIE',
        statusDostavki: 'DOSTAVLENO',
      }),
    );

    if (!created?.id) {
      throw new Error('сообщение создано, но в ответе нет id');
    }

    await this.client.patch<unknown>(`/rest/chats/${chatId}`, {
      vremyaPoslednego: new Date().toISOString(),
      posledneeSoobshchenie: text.slice(0, 120),
    });

    const response = await this.client.get<unknown>('/rest/chatParticipants', {
      query: {
        filter: `chatId[eq]:"${chatId}"`,
        select: 'id,polzovatelId,neprochitano',
        limit: 60,
      },
    });

    for (const participant of rowsOf(response, 'chatParticipants')) {
      if (!participant.id || asString(participant.polzovatelId) === memberId) {
        continue;
      }

      await this.client.patch<unknown>(`/rest/chatParticipants/${participant.id}`, {
        neprochitano: asNumber(participant.neprochitano) + 1,
      });
    }

    return { id: created.id };
  }

  async markRead(memberId: string, chatId: string): Promise<void> {
    const participations = await this.myParticipations(memberId);
    const mine = participations.find((participant) => asString(participant.chatId) === chatId);

    if (!mine?.id) {
      return;
    }

    if (asNumber(mine.neprochitano) === 0) {
      return;
    }

    await this.client.patch<unknown>(`/rest/chatParticipants/${mine.id}`, {
      neprochitano: 0,
      prochitanoDo: new Date().toISOString(),
    });
  }
}
