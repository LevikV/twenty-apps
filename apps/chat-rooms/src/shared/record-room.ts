import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Комната чата по записи (Заказ, Ремонт, Тендер, Заправка, Задача).
 *
 * Комнаты НЕ создаются заранее (решение 26.10.2026): диалог заводится при первой
 * отправке сообщения из карточки записи. Тогда же набираются участники:
 *
 *   - автор первого сообщения — ведущий;
 *   - ответственный (Заказ/Ремонт) или исполнитель (Задача);
 *   - автор записи;
 *   - соисполнители и наблюдатели из связки «Участник записи»;
 *   - упомянутые в сообщении.
 *
 * Роль — это подпись о функции человека, а не ограничение: писать могут все.
 */

type Row = Record<string, unknown> & { id?: string };

export type RecordKind = {
  singular: string;
  plural: string;
  label: string;
  tip: string;
  /** Поле-связка в объекте «Связка чатов» (chatTarget). */
  targetFieldName: string;
  /** Поле владельца записи: ответственный (сделки) или исполнитель (задача). */
  ownerField?: string;
  ownerIsMember?: boolean;
};

const KINDS: RecordKind[] = [
  {
    singular: 'opportunity',
    plural: 'opportunities',
    label: 'Заказ',
    tip: 'SDELKA',
    targetFieldName: 'sdelkaOpportunity',
    ownerField: 'otvetstvennyyId',
  },
  {
    singular: 'remontOborudovaniya',
    plural: 'remontOborudovaniyas',
    label: 'Ремонт',
    tip: 'SDELKA',
    targetFieldName: 'sdelkaRemontOborudovaniya',
    ownerField: 'otvetstvennyyId',
  },
  {
    singular: 'tender',
    plural: 'tendery',
    label: 'Тендер',
    tip: 'SDELKA',
    targetFieldName: 'sdelkaTender',
  },
  {
    singular: 'zapravkaKartridzhey',
    plural: 'zapravkaKartridzheys',
    label: 'Заправка',
    tip: 'SDELKA',
    targetFieldName: 'sdelkaZapravkaKartridzhey',
  },
  {
    singular: 'task',
    plural: 'tasks',
    label: 'Задача',
    tip: 'ZADACHA',
    targetFieldName: 'zadacha',
    ownerField: 'assigneeId',
    ownerIsMember: true,
  },
];

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

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const recordName = (row: Row): string =>
  asString(row.name) ?? asString(row.title) ?? 'без названия';

export class RecordRoomService {
  // От имени приложения: у ролей сотрудников нет прав на кастомные объекты чата.
  private readonly client = new RestApiClient({ runAs: 'application' });

  private async resolve(recordId: string): Promise<{ kind: RecordKind; record: Row } | null> {
    for (const kind of KINDS) {
      const select = ['id', 'name', 'title', 'createdBy', kind.ownerField]
        .filter((field): field is string => !!field)
        .join(',');

      try {
        const response = await this.client.get<unknown>(`/rest/${kind.plural}/${recordId}`, {
          query: { select },
        });
        const record = (response as { data?: Record<string, Record<string, unknown>> })?.data?.[
          kind.singular
        ] as Row | undefined;

        if (record?.id) {
          return { kind, record };
        }
      } catch {
        // записи с таким id в этом объекте нет — пробуем следующий
      }
    }

    return null;
  }

  private async isParticipant(chatId: string, memberId: string): Promise<boolean> {
    const response = await this.client.get<unknown>('/rest/chatParticipants', {
      query: {
        filter: `chatId[eq]:"${chatId}"`,
        select: 'id,polzovatelId',
        limit: 60,
      },
    });

    return rowsOf(response, 'chatParticipants').some(
      (row) => asString(row.polzovatelId) === memberId,
    );
  }

  private async roomIdFor(kind: RecordKind, recordId: string): Promise<string | null> {
    const response = await this.client.get<unknown>('/rest/chatTargets', {
      query: {
        filter: `${kind.targetFieldName}Id[eq]:"${recordId}"`,
        select: 'id,chatId',
        limit: 1,
      },
    });

    return asString(rowsOf(response, 'chatTargets')[0]?.chatId);
  }

  async describe(recordId: string, memberId: string): Promise<{
    chatId: string | null;
    name: string;
    tip: string | null;
    member: boolean;
  }> {
    const resolved = await this.resolve(recordId);

    if (!resolved) {
      throw new Error('Запись не найдена');
    }

    const chatId = await this.roomIdFor(resolved.kind, recordId);

    if (!chatId) {
      return {
        chatId: null,
        name: `${resolved.kind.label} ${recordName(resolved.record)}`,
        tip: resolved.kind.tip,
        member: false,
      };
    }

    return {
      chatId,
      name: `${resolved.kind.label} ${recordName(resolved.record)}`,
      tip: resolved.kind.tip,
      member: await this.isParticipant(chatId, memberId),
    };
  }

  /**
   * Комната для записи: существующая либо только что созданная.
   * Вызывается при отправке сообщения — раньше комнаты не существует.
   */
  async ensure(recordId: string, memberId: string, mentionedMemberIds: string[]): Promise<string> {
    const resolved = await this.resolve(recordId);

    if (!resolved) {
      throw new Error('Запись не найдена');
    }

    const existing = await this.roomIdFor(resolved.kind, recordId);

    if (existing) {
      // Кто написал — тот участник: если человек ещё не в комнате, добавляем его.
      if (!(await this.isParticipant(existing, memberId))) {
        await this.client.post<unknown>('/rest/chatParticipants', {
          name: 'Участник диалога',
          chatId: existing,
          polzovatelId: memberId,
          rol: 'UCHASTNIK',
          neprochitano: 0,
        });
      }

      return existing;
    }

    const chat = pickCreated(
      await this.client.post<unknown>('/rest/chats', {
        name: `${resolved.kind.label} ${recordName(resolved.record)}`,
        tip: resolved.kind.tip,
        kanal: 'VNUTRENNIY',
        status: 'OTKRYT',
      }),
    );

    if (!chat?.id) {
      throw new Error('диалог создан, но в ответе нет id');
    }

    const chatId = String(chat.id);

    await this.client.post<unknown>('/rest/chatTargets', {
      name: `${resolved.kind.label} ${recordName(resolved.record)}`,
      chatId,
      [`${resolved.kind.targetFieldName}Id`]: recordId,
    });

    const participants = await this.collectParticipants(resolved.kind, resolved.record, memberId);
    const all = new Map<string, string>();

    for (const member of participants) {
      all.set(member.memberId, member.rol);
    }

    for (const mentioned of mentionedMemberIds) {
      if (mentioned && mentioned !== memberId && !all.has(mentioned)) {
        all.set(mentioned, 'UCHASTNIK');
      }
    }

    for (const [member, rol] of all) {
      await this.client.post<unknown>('/rest/chatParticipants', {
        name: 'Участник диалога',
        chatId,
        polzovatelId: member,
        rol,
        neprochitano: 0,
      });
    }

    return chatId;
  }

  private async collectParticipants(
    kind: RecordKind,
    record: Row,
    authorMemberId: string,
  ): Promise<{ memberId: string; rol: string }[]> {
    const result: { memberId: string; rol: string }[] = [{ memberId: authorMemberId, rol: 'VEDUSHCHIY' }];
    const seen = new Set<string>([authorMemberId]);

    const push = (memberId: string | null, rol: string) => {
      if (memberId && !seen.has(memberId)) {
        seen.add(memberId);
        result.push({ memberId, rol });
      }
    };

    const creator = asString((record.createdBy as { workspaceMemberId?: string } | undefined)?.workspaceMemberId);

    push(creator, 'UCHASTNIK');

    if (kind.ownerField) {
      const owner = asString(record[kind.ownerField]);

      if (owner) {
        push(
          kind.ownerIsMember ? owner : await this.memberIdBySotrudnik(owner),
          'UCHASTNIK',
        );
      }
    }

    const extra = await this.client.get<unknown>('/rest/uchastnikiZapisi', {
      query: {
        filter: `${kind.targetFieldName}Id[eq]:"${record.id}"`,
        select: 'id,sotrudnikId,rol',
        limit: 60,
      },
    });

    for (const row of rowsOf(extra, 'uchastnikiZapisi')) {
      const sotrudnikId = asString(row.sotrudnikId);

      if (!sotrudnikId) {
        continue;
      }

      push(
        await this.memberIdBySotrudnik(sotrudnikId),
        asString(row.rol) ?? 'NABLYUDATEL',
      );
    }

    return result;
  }

  async memberIdBySotrudnik(sotrudnikId: string): Promise<string | null> {
    const response = await this.client.get<unknown>('/rest/workspaceMembers', {
      query: { filter: `sotrudnikId[eq]:"${sotrudnikId}"`, select: 'id', limit: 1 },
    });

    return asString(rowsOf(response, 'workspaceMembers')[0]?.id);
  }
}
