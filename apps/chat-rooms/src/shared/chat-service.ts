import { RestApiClient } from 'twenty-client-sdk/rest';

import { readAllRows } from 'src/shared/paging';

import { linksOfMessages } from 'src/shared/message-links';
import { PRESENCE_TTL_MS, isPresent, setOpenTarget, takeOpenTarget } from 'src/shared/presence';

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
  /** Канал связи: SMS, TG, MAX или внутренний чат. */
  kanal: string | null;
  /** Номер, с которого идёт переписка (для каналов связи). */
  nomer: string | null;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
};

export type MentionView = {
  type: string;
  id: string;
  label: string;
};

/** Сколько последних сообщений отдавать в ленту одного диалога. */
const LIMIT_RENDER = 300;

export type MessageView = {
  id: string;
  text: string | null;
  createdAt: string;
  authorId: string | null;
  authorName: string;
  mentions: MentionView[];
  /** Направление и статус доставки — есть только у сообщений каналов связи. */
  napravlenie: string | null;
  statusDostavki: string | null;
  /** Записи, к которым отнесено сообщение (связки чатов): сделка, ремонт, тендер, заправка, задача. */
  svyazkaIds: string[];
  /** Вложения: фото, видео, документы. */
  attachments: { url: string; label: string; extension: string }[];
  transcription?: string;
};

/**
 * Номер из внешнего ключа диалога: `sms:<deviceId>:<10 цифр>`.
 * Для внутренних диалогов ключа нет — вернётся null.
 */
const numberFromExternalId = (value: string | null): string | null => {
  const parts = String(value ?? '').split(':');
  const tail = parts[parts.length - 1] ?? '';

  return /^\d{10}$/.test(tail) ? tail : null;
};

/** Смотрел ли сотрудник диалог в последние секунды (отметка «прочитано» свежая). */
const isWatchingNow = (value: unknown): boolean => {
  const at = Date.parse(String(value ?? ''));

  return !Number.isNaN(at) && Date.now() - at < PRESENCE_TTL_MS;
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
    // Диалогов у сотрудника может быть больше страницы REST (200): читаем всё,
    // иначе хвост молча пропадает и диалог «не находится».
    return readAllRows({
      client: this.client,
      path: '/rest/chatParticipants',
      key: 'chatParticipants',
      filter: `polzovatelId[eq]:"${memberId}"`,
      select: 'id,chatId,neprochitano,prochitanoDo,prisutstvie',
    });
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
    const rows = await readAllRows({
      client: this.client,
      path: '/rest/chats',
      key: 'chats',
      filter: `id[in]:[${ids.join(',')}]`,
      select: 'id,name,tip,kanal,vneshniyId,vremyaPoslednego,posledneeSoobshchenie',
    });

    const dialogs = rows
      .map((chat) => ({
        id: String(chat.id ?? ''),
        name: asString(chat.name) ?? 'Без названия',
        tip: asString(chat.tip),
        kanal: asString(chat.kanal),
        nomer: numberFromExternalId(asString(chat.vneshniyId)),
        lastMessage: asString(chat.posledneeSoobshchenie),
        lastAt: asString(chat.vremyaPoslednego),
        unread: unreadByChat.get(String(chat.id ?? '')) ?? 0,
      }))
      .filter((dialog) => dialog.id.length > 0)
      .sort((left, right) => (right.lastAt ?? '').localeCompare(left.lastAt ?? ''));

    return { dialogs, names: await this.memberNames() };
  }

  /** Сотрудники, с которыми можно начать личный диалог. */
  async membersForPicker(): Promise<{ id: string; name: string }[]> {
    const response = await this.client.get<unknown>('/rest/workspaceMembers', {
      query: { select: 'id,name', limit: 60 },
    });

    return rowsOf(response, 'workspaceMembers')
      .filter((member) => !!member.id)
      .map((member) => ({ id: String(member.id), name: fullName(member) }))
      .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
  }

  /** Личный диалог двух сотрудников: если уже есть — открываем его. */
  async createPersonal(
    memberId: string,
    otherMemberId: string,
  ): Promise<{ chatId: string; created: boolean }> {
    if (!memberId || !otherMemberId) {
      throw new Error('Не выбран собеседник');
    }

    if (memberId === otherMemberId) {
      throw new Error('Нельзя начать диалог с самим собой');
    }

    const existing = await this.findPersonalChat(memberId, otherMemberId);

    if (existing) {
      return { chatId: existing, created: false };
    }

    const names = await this.memberNames();
    const chat = pickCreated(
      await this.client.post<unknown>('/rest/chats', {
        name: `${names[memberId] ?? 'Сотрудник'} — ${names[otherMemberId] ?? 'Сотрудник'}`,
        tip: 'LICHNY',
        kanal: 'VNUTRENNIY',
        status: 'OTKRYT',
      }),
    );

    if (!chat?.id) {
      throw new Error('диалог создан, но в ответе нет id');
    }

    const chatId = String(chat.id);
    const members: [string, string][] = [
      [memberId, 'VEDUSHCHIY'],
      [otherMemberId, 'UCHASTNIK'],
    ];

    for (const [participantId, rol] of members) {
      await this.client.post<unknown>('/rest/chatParticipants', {
        name: 'Участник диалога',
        chatId,
        polzovatelId: participantId,
        rol,
        neprochitano: 0,
      });
    }

    return { chatId, created: true };
  }

  /** Уже существующий личный чат этих двоих, если он есть. */
  private async findPersonalChat(
    memberId: string,
    otherMemberId: string,
  ): Promise<string | null> {
    const mine = new Set(
      (await this.myParticipations(memberId)).map((row) => asString(row.chatId)).filter(Boolean),
    );
    const theirs = (await this.myParticipations(otherMemberId))
      .map((row) => asString(row.chatId))
      .filter((chatId): chatId is string => !!chatId && mine.has(chatId));

    if (theirs.length === 0) {
      return null;
    }

    const response = await this.client.get<unknown>('/rest/chats', {
      query: {
        filter: `id[in]:[${theirs.join(',')}]`,
        select: 'id,tip',
        limit: 60,
      },
    });

    const chat = rowsOf(response, 'chats').find((row) => asString(row.tip) === 'LICHNY');

    return chat?.id ? String(chat.id) : null;
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
    // REST в этой установке не сортирует (orderBy игнорируется) и отдаёт первые
    // страницы, поэтому фиксированный limit обрезал хвост переписки: в длинном
    // диалоге последние сообщения просто не доезжали до ленты. Читаем всё
    // страницами и показываем последние LIMIT_RENDER.
    const all = await readAllRows({
      client: this.client,
      path: '/rest/soobshcheniya',
      key: 'soobshcheniya',
      filter: `chatId[eq]:"${chatId}"`,
      select:
        'id,tekst,createdAt,avtorId,avtorImya,chatId,napravlenie,statusDostavki,vlozhenie,rasshifrovka',
    });

    const names = await this.memberNames();
    const rows = all
      .filter((message) => !!message.id)
      .sort((left, right) => String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')))
      .slice(-LIMIT_RENDER);
    const mentionMap = await this.mentionsByMessage(rows.map((message) => String(message.id)));
    const linkMap = new Map<string, string[]>();

    for (const link of await linksOfMessages(rows.map((message) => String(message.id)))) {
      linkMap.set(link.soobshchenieId, [...(linkMap.get(link.soobshchenieId) ?? []), link.svyazkaChatovId]);
    }

    const messages = rows
      .map((message) => {
        const authorId = asString(message.avtorId);
        const id = String(message.id ?? '');

        return {
          id,
          text: asString(message.tekst),
          createdAt: String(message.createdAt ?? ''),
          authorId,
          // У внешних каналов (MAX, SMS) сотрудника в CRM нет — подписываем
          // именем из канала, иначе все сообщения были бы «Сотрудник».
          authorName: authorId
            ? names[authorId] ?? 'Сотрудник'
            : asString(message.avtorImya) || 'Сотрудник',
          mentions: mentionMap.get(id) ?? [],
          napravlenie: asString(message.napravlenie),
          statusDostavki: asString(message.statusDostavki),
          svyazkaIds: linkMap.get(id) ?? [],
          attachments: (Array.isArray(message.vlozhenie) ? message.vlozhenie : [])
            .map((item) => {
              const file = item as { url?: string; label?: string; extension?: string };

              return {
                url: asString(file.url) ?? '',
                label: asString(file.label) ?? 'вложение',
                extension: asString(file.extension) ?? '',
              };
            })
            .filter((file) => file.url.length > 0),
          transcription: asString(message.rasshifrovka) ?? '',
        };
      })
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    return { messages, names };
  }

  /** Подписать сотрудника участником диалога (он ответственный по сделке). */
  async ensureParticipant(memberId: string, chatId: string): Promise<void> {
    const existing = await this.client.get<unknown>('/rest/chatParticipants', {
      query: {
        filter: `and(chatId[eq]:"${chatId}",polzovatelId[eq]:"${memberId}")`,
        limit: 1,
      },
    });

    if (rowsOf(existing, 'chatParticipants').length > 0) return;

    await this.client.post<unknown>('/rest/chatParticipants', {
      chatId,
      polzovatelId: memberId,
      neprochitano: 0,
    });
  }

  async send(
    memberId: string,
    chatId: string,
    text: string,
    mentions: MentionView[] = [],
    extra: Record<string, unknown> = {},
  ): Promise<{ id: string }> {
    await this.assertParticipant(memberId, chatId);

    const created = pickCreated(
      await this.client.post<unknown>('/rest/soobshcheniya', {
        chatId,
        tekst: text,
        avtorId: memberId,
        napravlenie: 'ISHODYASHCHIE',
        statusDostavki: 'DOSTAVLENO',
        ...extra,
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
        select: 'id,polzovatelId,neprochitano,prochitanoDo,prisutstvie',
        limit: 60,
      },
    });

    const recipients: string[] = [];
    const everyoneElse: string[] = [];

    for (const participant of rowsOf(response, 'chatParticipants')) {
      if (!participant.id || asString(participant.polzovatelId) === memberId) {
        continue;
      }

      const recipientId = asString(participant.polzovatelId);

      // Кто сейчас в этом чате — видит сообщение сразу. Счётчик ему всё равно
      // увеличиваем (маяк присутствия обнулит его в ближайшие 5 секунд), чтобы
      // сообщение не потерялось, если человек закроет карточку в эту же секунду.
      // Пуш при этом не шлём.
      const watchingNow =
        (recipientId ? isPresent(recipientId, chatId) : false) ||
        isWatchingNow(participant.prisutstvie);

      await this.client.patch<unknown>(`/rest/chatParticipants/${participant.id}`, {
        neprochitano: asNumber(participant.neprochitano) + 1,
      });

      if (recipientId) {
        everyoneElse.push(recipientId);
      }

      if (watchingNow) {
        continue;
      }

      if (recipientId) {
        recipients.push(recipientId);
      }
    }

    // Сигнал в браузеры: новое сообщение в этом чате — обновить ленту и бейдж.
    for (const recipientId of everyoneElse) {
      await this.pokeBadge(recipientId, chatId);
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

  /** Базовый адрес API (для внутренних вызовов контроллера уведомлений). */
  private apiBase(): string {
    return (readEnv().TWENTY_API_URL ?? '').replace(/\/+$/, '');
  }

  /** userId пользователя по идентификатору участника пространства. */
  private async memberUserId(memberId: string): Promise<string | null> {
    const record = await this.client.get<unknown>(`/rest/workspaceMembers/${memberId}`, {
      query: { select: 'id,userId' },
    });

    return asString(
      (record as { data?: { workspaceMember?: { userId?: string } } })?.data?.workspaceMember?.userId,
    );
  }

  /** Сигнал браузеру: счётчик непрочитанных изменился, обнови бейдж. */
  private async pokeBadge(memberId: string, chatId?: string): Promise<void> {
    try {
      const apiBase = this.apiBase();

      if (!apiBase) {
        return;
      }

      const userId = await this.memberUserId(memberId);

      if (!userId) {
        return;
      }

      await fetch(`${apiBase}/api/notify/badge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, chatId: chatId ?? null }),
      });
    } catch {
      // сигнал — не критичен: бейдж обновится опросом
    }
  }

  /** Текущий сотрудник: идентификатор пользователя для подписки на сокет. */
  async me(memberId: string): Promise<{ userId: string | null; memberId: string }> {
    return { userId: await this.memberUserId(memberId), memberId };
  }

  /** Куда вести по пушу: карточка объекта для чатов сделок, иначе — страница диалогов. */
  private async chatLink(chatId: string): Promise<{ link: string; linkLabel: string }> {
    const fallback = { link: `${CHAT_PAGE_PATH}?chatId=${chatId}`, linkLabel: 'Открыть чат' };

    try {
      const response = await this.client.get<unknown>('/rest/chatTargets', {
        query: {
          filter: `chatId[eq]:"${chatId}"`,
          select:
            'id,chatId,sdelkaOpportunityId,sdelkaRemontOborudovaniyaId,sdelkaTenderId,sdelkaZapravkaKartridzheyId,zadachaId',
          limit: 1,
        },
      });

      const target = rowsOf(response, 'chatTargets')[0];

      if (!target) {
        return fallback;
      }

      const pairs: Array<[string, string]> = [
        ['sdelkaOpportunityId', 'opportunity'],
        ['sdelkaRemontOborudovaniyaId', 'remontOborudovaniya'],
        ['sdelkaTenderId', 'tender'],
        ['sdelkaZapravkaKartridzheyId', 'zapravkaKartridzhey'],
        ['zadachaId', 'task'],
      ];

      for (const [field, objectName] of pairs) {
        const recordId = asString(target[field]);

        if (recordId) {
          return { link: `/object/${objectName}/${recordId}`, linkLabel: 'Открыть карточку' };
        }
      }
    } catch {
      // нет цели — ведём в диалоги
    }

    return fallback;
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
    const chatLink = await this.chatLink(chatId);

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
        await this.saveOpenTarget(memberId, chatId);

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
            link: chatLink.link,
            linkLabel: chatLink.linkLabel,
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

    // Список сообщений бывает в сотни записей: в одном фильтре адрес запроса
    // перерастает лимит nginx (414 Request-URI Too Large). Поэтому пачками.
    const CHUNK = 40;
    const rows: Record<string, unknown>[] = [];

    for (let start = 0; start < messageIds.length; start += CHUNK) {
      const portion = messageIds.slice(start, start + CHUNK);

      const response = await this.client.get<unknown>('/rest/upominaniya', {
        query: {
          filter: `soobshchenieId[in]:[${portion.join(',')}]`,
          select: 'id,name,soobshchenieId,tipObekta,zapisId',
          limit: 200,
        },
      });

      rows.push(...(rowsOf(response, 'upominaniya') as Record<string, unknown>[]));
    }

    for (const row of rows) {
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
   * Запомнить, какой диалог открыть по переходу из уведомления.
   *
   * Пишем в участие сотрудника в чате, а не в «Уведомления»: сообщение — это
   * не уведомление, колокольчик от него пухнуть не должен. Поле служебное.
   */
  private async saveOpenTarget(memberId: string, chatId: string): Promise<void> {
    try {
      const response = await this.client.get<unknown>('/rest/chatParticipants', {
        query: {
          filter: `polzovatelId[eq]:"${memberId}",chatId[eq]:"${chatId}"`,
          select: 'id',
          limit: 1,
        },
      });

      const row = rowsOf(response, 'chatParticipants')[0];

      if (!row?.id) {
        return;
      }

      await this.client.patch<unknown>(`/rest/chatParticipants/${row.id}`, {
        otkrytChatId: `${chatId}|${Date.now()}`,
      });
    } catch (error) {
      console.error('[open-target] не сохранилось:', error instanceof Error ? error.message : String(error));
      // подсказка не критична: без неё просто откроется обычный вид
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

    const response = await this.client.get<unknown>('/rest/chatParticipants', {
      query: {
        filter: `polzovatelId[eq]:"${memberId}",otkrytChatId[is]:NOT_NULL`,
        select: 'id,chatId,otkrytChatId',
        limit: 5,
      },
    });

    const row = rowsOf(response, 'chatParticipants')[0];
    const raw = asString(row?.otkrytChatId) ?? '';
    const [savedChatId, savedAt] = raw.split('|');

    if (!row?.id || !savedChatId) {
      return { chatId: null };
    }

    // Подсказка живёт две минуты: страница может спросить цель дважды
    // (повторный рендер), и второй запрос не должен получить пустоту.
    // Подсказка без метки времени считается свежей: так пишут каналы.
    const age = savedAt ? Date.now() - Number(savedAt) : 0;

    if (Number.isFinite(age) && savedAt && age > 2 * 60 * 1000) {
      try {
        await this.client.patch<unknown>(`/rest/chatParticipants/${row.id}`, {
          otkrytChatId: null,
        });
      } catch {
        // не смогли погасить — не страшно
      }

      return { chatId: null };
    }

    return { chatId: savedChatId };
  }

  async markRead(memberId: string, chatId: string, isWatching = false): Promise<void> {
    const participations = await this.myParticipations(memberId);
    const mine = participations.find((participant) => asString(participant.chatId) === chatId);

    if (!mine?.id) {
      return;
    }

    const unread = asNumber(mine.neprochitano);

    if (unread === 0 && !isWatching) {
      return;
    }

    const patch: Record<string, unknown> = {
      prochitanoDo: new Date().toISOString(),
      prisutstvie: new Date().toISOString(),
    };

    if (unread !== 0) {
      patch.neprochitano = 0;
    }

    await this.client.patch<unknown>(`/rest/chatParticipants/${mine.id}`, patch);

    if (unread !== 0) {
      await this.pokeBadge(memberId);
    }
  }

  /** Сотрудник закрыл чат: снимаем признак присутствия, непрочитанное досылаем пушем. */
  async leave(memberId: string, chatId: string): Promise<void> {
    const participations = await this.myParticipations(memberId);
    const mine = participations.find((participant) => asString(participant.chatId) === chatId);

    if (!mine?.id) {
      return;
    }

    await this.client.patch<unknown>(`/rest/chatParticipants/${mine.id}`, { prisutstvie: null });

    const unread = asNumber(mine.neprochitano);

    if (unread === 0) {
      return;
    }

    const userId = await this.memberUserId(memberId);

    if (!userId) {
      return;
    }

    const chatLink = await this.chatLink(chatId);
    const title = await this.chatTitle(chatId);

    try {
      await this.saveOpenTarget(memberId, chatId);

      await fetch(`${this.apiBase()}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title,
          text: unread === 1 ? 'Есть новое сообщение' : `Новых сообщений: ${unread}`,
          link: chatLink.link,
          linkLabel: chatLink.linkLabel,
          duration: 10000,
          persist: false,
        }),
      });
    } catch {
      // пуш — не критичен, непрочитанное останется в счётчике
    }
  }
}
