import { RestApiClient } from 'twenty-client-sdk/rest';

import { isPresent, setOpenTarget, takeOpenTarget } from 'src/shared/presence';

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

export type MentionView = {
  type: string;
  id: string;
  label: string;
};

export type MessageView = {
  id: string;
  text: string | null;
  createdAt: string;
  authorId: string | null;
  authorName: string;
  mentions: MentionView[];
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

const CHAT_PAGE_PATH = '/page/30e9b2da-683c-4fce-8a61-5c5102d69f3e';

const readEnv = (): Record<string, string | undefined> =>
  ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env ?? {}) as Record<string, string | undefined>;

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

    return this.messagesByChat(chatId);
  }

  /**
   * Лента без проверки участия — для карточки записи: обсуждение читает любой,
   * у кого есть доступ к самой записи (участник — это про подписку и уведомления).
   */
  async messagesByChat(
    chatId: string,
  ): Promise<{ messages: MessageView[]; names: Record<string, string> }> {
    const response = await this.client.get<unknown>('/rest/soobshcheniya', {
      query: {
        filter: `chatId[eq]:"${chatId}"`,
        select: 'id,tekst,createdAt,avtorId,chatId',
        limit: 60,
      },
    });

    const names = await this.memberNames();
    const rows = rowsOf(response, 'soobshcheniya').filter((message) => !!message.id);
    const mentionMap = await this.mentionsByMessage(rows.map((message) => String(message.id)));

    const messages = rows
      .map((message) => {
        const authorId = asString(message.avtorId);
        const id = String(message.id ?? '');

        return {
          id,
          text: asString(message.tekst),
          createdAt: String(message.createdAt ?? ''),
          authorId,
          authorName: authorId ? names[authorId] ?? 'Сотрудник' : 'Сотрудник',
          mentions: mentionMap.get(id) ?? [],
        };
      })
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    return { messages, names };
  }

  async send(
    memberId: string,
    chatId: string,
    text: string,
    mentions: MentionView[] = [],
  ): Promise<{ id: string }> {
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

    if (mentions.length > 0) {
      await this.saveMentions(String(created.id), mentions);
      await this.notifyMentioned(memberId, chatId, mentions, text);
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

    const recipients: string[] = [];

    for (const participant of rowsOf(response, 'chatParticipants')) {
      if (!participant.id || asString(participant.polzovatelId) === memberId) {
        continue;
      }

      await this.client.patch<unknown>(`/rest/chatParticipants/${participant.id}`, {
        neprochitano: asNumber(participant.neprochitano) + 1,
      });

      const recipientId = asString(participant.polzovatelId);

      if (recipientId) {
        recipients.push(recipientId);
      }
    }

    await this.pushNewMessage(memberId, chatId, text, recipients);

    return { id: created.id };
  }


  /** Название диалога для пуша (как его видит человек в списке). */
  private async chatTitle(chatId: string): Promise<string> {
    try {
      const record = await this.client.get<unknown>(`/rest/chats/${chatId}`, {
        query: { select: 'id,name' },
      });
      const name = asString((record as { data?: { chat?: { name?: string } } })?.data?.chat?.name);

      return name || 'Чат';
    } catch {
      return 'Чат';
    }
  }

  /**
   * Пуш о новом сообщении — без записи в «Уведомления» (сообщение и так в чате).
   * Не шлём автору и тем, у кого этот диалог открыт прямо сейчас.
   */
  private async pushNewMessage(
    senderMemberId: string,
    chatId: string,
    text: string,
    recipients: string[],
  ): Promise<void> {
    const targets = recipients.filter(
      (memberId) => memberId !== senderMemberId && !isPresent(memberId, chatId),
    );

    if (targets.length === 0) {
      return;
    }

    const apiBase = (readEnv().TWENTY_API_URL ?? '').replace(/\/+$/, '');

    if (!apiBase) {
      return;
    }

    const names = await this.memberNames();
    const authorName = names[senderMemberId] ?? 'Сотрудник';
    const title = await this.chatTitle(chatId);

    for (const memberId of targets) {
      try {
        const record = await this.client.get<unknown>(`/rest/workspaceMembers/${memberId}`, {
          query: { select: 'id,userId' },
        });

        const userId = asString(
          (record as { data?: { workspaceMember?: { userId?: string } } })?.data
            ?.workspaceMember?.userId,
        );

        if (!userId) {
          continue;
        }

        setOpenTarget(memberId, chatId);

        await fetch(`${apiBase}/api/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            title: `${authorName} · ${title}`,
            text: text.slice(0, 140),
            variant: 'info',
            tip: 'soobshchenie',
            prioritet: 'obychnoe',
            link: `${CHAT_PAGE_PATH}?chatId=${chatId}`,
            linkLabel: 'Открыть чат',
            duration: 10000,
            persist: false,
          }),
        });
      } catch {
        // пуш — не критичная часть: сообщение уже сохранено
      }
    }
  }

  private async mentionsByMessage(messageIds: string[]): Promise<Map<string, MentionView[]>> {
    const map = new Map<string, MentionView[]>();

    if (messageIds.length === 0) {
      return map;
    }

    const response = await this.client.get<unknown>('/rest/upominaniya', {
      query: {
        filter: `soobshchenieId[in]:[${messageIds.join(',')}]`,
        select: 'id,name,soobshchenieId,tipObekta,zapisId',
        limit: 200,
      },
    });

    for (const row of rowsOf(response, 'upominaniya')) {
      const messageId = asString(row.soobshchenieId);

      if (!messageId) {
        continue;
      }

      const mention: MentionView = {
        type: asString(row.tipObekta) ?? 'ZAKAZ',
        id: asString(row.zapisId) ?? '',
        label: asString(row.name) ?? '',
      };

      if (!mention.id) {
        continue;
      }

      const existing = map.get(messageId) ?? [];

      existing.push(mention);
      map.set(messageId, existing);
    }

    return map;
  }

  /**
   * Пуш упомянутым людям.
   *
   * Уведомление получает только тот, у кого есть учётная запись (владелец карточки
   * «Сотрудник»). Автору своё же упоминание не шлём.
   * Адрес — внешний `TWENTY_API_URL`: обращения к внутренним адресам docker-сети
   * блокируются защитой от SSRF.
   */
  private async notifyMentioned(
    senderMemberId: string,
    chatId: string,
    mentions: MentionView[],
    text: string,
  ): Promise<void> {
    const targets = new Set<string>();

    for (const mention of mentions) {
      if (mention.type !== 'POLZOVATEL' && mention.type !== 'SOTRUDNIK') {
        continue;
      }

      const memberId =
        mention.type === 'POLZOVATEL'
          ? mention.id
          : await this.memberIdBySotrudnik(mention.id);

      if (memberId && memberId !== senderMemberId) {
        targets.add(memberId);
      }
    }

    if (targets.size === 0) {
      return;
    }

    const names = await this.memberNames();
    const authorName = names[senderMemberId] ?? 'Сотрудник';
    const apiBase = (readEnv().TWENTY_API_URL ?? '').replace(/\/+$/, '');

    if (!apiBase) {
      return;
    }

    // Личные и клиентские чаты упоминания не уведомляют: открывать человеку
    // нечего, а карточки объекта у такого чата нет.
    const chatTarget = await this.objectTargetForChat(chatId);

    if (!chatTarget) {
      return;
    }

    for (const memberId of targets) {
      const record = await this.client.get<unknown>(`/rest/workspaceMembers/${memberId}`, {
        query: { select: 'id,userId' },
      });

      const userId = asString(
        (record as { data?: { workspaceMember?: { userId?: string } } })?.data?.workspaceMember
          ?.userId,
      );

      if (!userId) {
        continue;
      }

      await fetch(`${apiBase}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: `${authorName} упомянул вас в чате`,
          text: text.slice(0, 160),
          variant: 'info',
          tip: 'soobshchenie',
          prioritet: 'obychnoe',
          link: `/object/${chatTarget.objectName}/${chatTarget.recordId}`,
          linkLabel: 'Открыть карточку',
          duration: 8000,
        }),
      });
    }
  }


  /** Объект, к которому привязан чат (null — личный или клиентский). */
  private async objectTargetForChat(
    chatId: string,
  ): Promise<{ objectName: string; recordId: string } | null> {
    const response = await this.client.get<unknown>('/rest/chatTargets', {
      query: {
        filter: `chatId[eq]:"${chatId}"`,
        select:
          'id,sdelkaOpportunityId,sdelkaRemontOborudovaniyaId,sdelkaTenderId,sdelkaZapravkaKartridzheyId,zadachaId',
        limit: 1,
      },
    });

    const target = rowsOf(response, 'chatTargets')[0];

    if (!target) {
      return null;
    }

    const map: Array<[string, string]> = [
      ['sdelkaOpportunityId', 'opportunity'],
      ['sdelkaRemontOborudovaniyaId', 'remontOborudovaniya'],
      ['sdelkaTenderId', 'tender'],
      ['sdelkaZapravkaKartridzheyId', 'zapravkaKartridzhey'],
      ['zadachaId', 'task'],
    ];

    for (const [field, objectName] of map) {
      const recordId = asString(target[field]);

      if (recordId) {
        return { objectName, recordId };
      }
    }

    return null;
  }

  /** Учётная запись человека по карточке сотрудника (если она есть). */
  private async memberIdBySotrudnik(sotrudnikId: string): Promise<string | null> {
    const response = await this.client.get<unknown>('/rest/workspaceMembers', {
      query: { filter: `sotrudnikId[eq]:"${sotrudnikId}"`, select: 'id', limit: 1 },
    });

    return asString(rowsOf(response, 'workspaceMembers')[0]?.id);
  }

  private async saveMentions(messageId: string, mentions: MentionView[]): Promise<void> {
    const seen = new Set<string>();

    for (const mention of mentions) {
      const key = `${mention.type}:${mention.id}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      const payload: Record<string, unknown> = {
        name: mention.label,
        soobshchenieId: messageId,
        tipObekta: mention.type,
        zapisId: mention.id,
      };

      if (mention.type === 'POLZOVATEL') {
        payload.polzovatelId = mention.id;
      }

      if (mention.type === 'SOTRUDNIK') {
        const memberId = await this.memberIdBySotrudnik(mention.id);

        if (memberId) {
          payload.polzovatelId = memberId;
        }
      }

      await this.client.post<unknown>('/rest/upominaniya', payload);
    }
  }

  /**
   * Диалог, который нужно открыть по переходу из уведомления.
   *
   * Внутри фронт-компонента адрес страницы недоступен (он живёт в блоб-iframe),
   * поэтому цель берём на сервере: последнее непрочитанное уведомление со ссылкой
   * на страницу, в котором лежит id диалога (`<pageId>|<chatId>`), не старше 10 минут.
   */
  async openTarget(memberId: string): Promise<{ chatId: string | null }> {
    // Пуш о сообщении: записи в «Уведомлениях» нет, цель держим в памяти.
    const pending = takeOpenTarget(memberId);

    if (pending) {
      return { chatId: pending };
    }

    const response = await this.client.get<unknown>('/rest/uvedomleniya', {
      query: {
        filter: `poluchatelId[eq]:"${memberId}"`,
        select: 'id,linkedObjectName,linkedRecordId,createdAt,prochitano',
        limit: 10,
      },
    });

    // Важно: колокольчик помечает уведомление прочитанным ДО того, как страница
    // откроется, поэтому на признак «прочитано» не опираемся — только на свежесть.
    const rows = rowsOf(response, 'uvedomleniya').sort((left, right) =>
      String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')),
    );

    for (const row of rows) {
      if (asString(row.linkedObjectName) !== 'page') {
        continue;
      }

      const recordId = asString(row.linkedRecordId) ?? '';
      const [, chatId] = recordId.split('|');

      if (!chatId) {
        continue;
      }

      const createdAt = Date.parse(String(row.createdAt ?? ''));

      // Старое уведомление не должно перехватывать открытие страницы из меню.
      if (!Number.isNaN(createdAt) && Date.now() - createdAt > 10 * 60 * 1000) {
        continue;
      }

      return { chatId };
    }

    return { chatId: null };
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
