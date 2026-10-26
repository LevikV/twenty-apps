import { kv } from 'twenty-sdk/logic-function';
import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Комната чата по сделке.
 *
 * На создание сделки любого из четырёх типов заводим один диалог вида «Чат по сделке»,
 * связку диалога со сделкой (морф-поле) и участников — всех, у кого есть учётная запись.
 *
 * Идемпотентность: перед созданием ищем связку по конкретной ноге морф-поля.
 * Повторный вызов (повторная доставка события) вернёт `skipped` и ничего не задвоит.
 */

export type DealKind =
  | 'opportunity'
  | 'remontOborudovaniya'
  | 'tender'
  | 'zapravkaKartridzhey';

type DealSettings = {
  path: string;
  key: string;
  label: string;
  targetField: string;
};

const DEALS: Record<DealKind, DealSettings> = {
  opportunity: {
    path: '/rest/opportunities',
    key: 'opportunities',
    label: 'Заказ',
    targetField: 'sdelkaOpportunityId',
  },
  remontOborudovaniya: {
    path: '/rest/remontOborudovaniyas',
    key: 'remontOborudovaniyas',
    label: 'Ремонт',
    targetField: 'sdelkaRemontOborudovaniyaId',
  },
  tender: {
    path: '/rest/tendery',
    key: 'tendery',
    label: 'Тендер',
    targetField: 'sdelkaTenderId',
  },
  zapravkaKartridzhey: {
    path: '/rest/zapravkaKartridzheys',
    key: 'zapravkaKartridzheys',
    label: 'Заправка',
    targetField: 'sdelkaZapravkaKartridzheyId',
  },
};

type DbEventPayload = {
  recordId?: string;
  properties?: {
    after?: { id?: string; name?: string | null };
    before?: { id?: string; name?: string | null };
  };
};

type CrmRecord = Record<string, unknown> & { id?: string };

const unwrap = (body: unknown): Record<string, unknown> =>
  (body as { data?: Record<string, unknown> })?.data ?? {};

const rowsOf = (body: unknown, key: string): CrmRecord[] => {
  const value = unwrap(body)[key];

  return Array.isArray(value) ? (value as CrmRecord[]) : [];
};

const pickCreated = (body: unknown): CrmRecord | undefined => {
  for (const candidate of Object.values(unwrap(body))) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const record = candidate as CrmRecord;

      if (record.id) return record;
    }
  }

  return undefined;
};

const describeError = (error: unknown): string => {
  const details = error as { message?: string; status?: number; body?: unknown };
  const body =
    details?.body === undefined
      ? ''
      : ` | body: ${JSON.stringify(details.body).slice(0, 400)}`;

  return `${details?.message ?? String(error)}${body}`;
};

const memberName = (row: CrmRecord): string => {
  const composite = row.name as { firstName?: string; lastName?: string } | undefined;
  const first = composite?.firstName ?? (row.nameFirstName as string | undefined) ?? '';
  const last = composite?.lastName ?? (row.nameLastName as string | undefined) ?? '';
  const full = `${first} ${last}`.trim();

  return full || 'Сотрудник';
};

export const handleDealCreated = async (
  kind: DealKind,
  rawPayload: unknown,
): Promise<Record<string, unknown>> => {
  const settings = DEALS[kind];
  // runAs: 'application' — комната создаётся и тогда, когда сделку завёл
  // сотрудник без прав на кастомные объекты чата.
  const client = new RestApiClient({ runAs: 'application' });
  const payload = (rawPayload ?? {}) as DbEventPayload;
  const dealId = payload.properties?.after?.id ?? payload.recordId;

  const stateKey = `room:last:${kind}`;

  if (!dealId) {
    await kv.set(stateKey, {
      ok: false,
      reason: 'в событии нет id сделки',
      at: new Date().toISOString(),
    });

    return { ok: false, reason: 'no-deal-id' };
  }

  try {
    // 1. Комната уже есть? Смотрим связку по нужной ноге морф-поля.
    const existingResponse = await client.get<unknown>('/rest/chatTargets', {
      query: {
        filter: `${settings.targetField}[eq]:"${dealId}"`,
        limit: 1,
      },
    });

    if (rowsOf(existingResponse, 'chatTargets').length > 0) {
      await kv.set(stateKey, {
        ok: true,
        skipped: 'комната уже существует',
        dealId,
        at: new Date().toISOString(),
      });

      return { ok: true, skipped: 'room-exists', dealId };
    }

    // 2. Название сделки: из события, иначе читаем карточку.
    let dealName = String(payload.properties?.after?.name ?? '').trim();

    if (!dealName) {
      const dealResponse = await client.get<unknown>(`${settings.path}/${dealId}`);

      dealName = String(pickCreated(dealResponse)?.name ?? '').trim();
    }

    const title = `${settings.label} ${dealName}`.trim();

    // 3. Диалог.
    const chat = pickCreated(
      await client.post<unknown>('/rest/chats', {
        name: title,
        nazvanie: title,
        tip: 'SDELKA',
        kanal: 'VNUTRENNIY',
        status: 'OTKRYT',
      }),
    );

    if (!chat?.id) throw new Error('диалог создан, но в ответе нет id');

    // 4. Связка диалога со сделкой.
    await client.post<unknown>('/rest/chatTargets', {
      name: dealName || title,
      chatId: chat.id,
      [settings.targetField]: dealId,
    });

    // 5. Участники — все, у кого есть учётная запись.
    const membersResponse = await client.get<unknown>('/rest/workspaceMembers', {
      query: { limit: 60 },
    });
    const members = rowsOf(membersResponse, 'workspaceMembers');
    const added: string[] = [];

    for (const member of members) {
      if (!member.id) continue;

      await client.post<unknown>('/rest/chatParticipants', {
        name: memberName(member),
        chatId: chat.id,
        polzovatelId: member.id,
        rol: 'UCHASTNIK',
      });
      added.push(memberName(member));
    }

    const summary = {
      ok: true,
      dealId,
      dealName,
      chatId: chat.id,
      title,
      participants: added,
      at: new Date().toISOString(),
    };

    await kv.set(stateKey, summary);

    return summary;
  } catch (error) {
    const message = describeError(error);

    await kv.set(`room:error:${kind}`, {
      dealId,
      message,
      at: new Date().toISOString(),
    });

    throw error;
  }
};
