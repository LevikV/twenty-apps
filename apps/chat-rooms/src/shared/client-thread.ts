import { RestApiClient } from 'twenty-client-sdk/rest';


/**
 * Переписка с клиентом из карточки сделки.
 *
 * Диалог с клиентом один на клиента и канал — вся история в одной ленте. Сделка
 * живёт не у диалога, а у сообщения: когда менеджер пишет из карточки сделки,
 * сообщение помечается связкой этой сделки. Поэтому здесь две задачи:
 * найти диалог клиента и, при отправке, проставить связку с текущей сделкой.
 */

type Row = Record<string, unknown> & { id?: string };

const client = new RestApiClient({ runAs: 'application' });

/** Сделки, у которых есть «Покупатель» и связка в «Связке чатов». */
const DEALS = [
  { plural: 'opportunities', targetField: 'sdelkaOpportunity' },
  { plural: 'remontOborudovaniyas', targetField: 'sdelkaRemontOborudovaniya' },
  { plural: 'tendery', targetField: 'sdelkaTender' },
  { plural: 'zapravkaKartridzheys', targetField: 'sdelkaZapravkaKartridzhey' },
];

const rowsOf = (body: unknown, key: string): Row[] => {
  const value = (body as { data?: Record<string, unknown> })?.data?.[key];

  return Array.isArray(value) ? (value as Row[]) : [];
};

const firstRow = (body: unknown): Row | undefined => {
  const data = (body as { data?: Record<string, unknown> })?.data ?? {};

  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
      return value[0] as Row;
    }

    if (value && typeof value === 'object' && !Array.isArray(value) && (value as Row).id) {
      return value as Row;
    }
  }

  return undefined;
};

export type DealClient = { plural: string; targetField: string; personId: string; name: string };

/** Клиент сделки: карточка «Покупатель» + тип сделки для связки. */
export const clientOfDeal = async (recordId: string): Promise<DealClient | null> => {
  for (const deal of DEALS) {
    try {
      const response = await client.get<unknown>(`/rest/${deal.plural}/${recordId}`, {
        query: { select: 'id,name,pokupatelPersonId' },
      });

      const row = firstRow(response);

      if (!row) continue;

      const personId = String(row.pokupatelPersonId ?? '');

      if (!personId) return null;

      return {
        plural: deal.plural,
        targetField: deal.targetField,
        personId,
        name: String(row.name ?? ''),
      };
    } catch {
      // Не наша сделка — пробуем следующий тип.
    }
  }

  return null;
};

/** SMS-диалог клиента: один на клиента, берём самый свежий. */
export const chatOfPerson = async (personId: string): Promise<Row | null> => {
  const rows = rowsOf(
    await client.get<unknown>('/rest/chats', {
      query: {
        filter: `and(kontaktId[eq]:"${personId}",kanal[eq]:"SMS")`,
        select: 'id,name,vneshniyId,kanal,vremyaPoslednego',
        orderBy: 'vremyaPoslednego',
        limit: 1,
      },
    }),
    'chats',
  );

  return rows[0] ?? null;
};

/** Связка «диалог ↔ сделка»: нужна, чтобы сообщение знало свою сделку. */
export const ensureTarget = async (
  chatId: string,
  deal: DealClient,
  recordId: string,
): Promise<string> => {
  const existing = rowsOf(
    await client.get<unknown>('/rest/chatTargets', {
      query: {
        filter: `and(chatId[eq]:"${chatId}",${deal.targetField}Id[eq]:"${recordId}")`,
        select: 'id',
        limit: 1,
      },
    }),
    'chatTargets',
  )[0];

  if (existing?.id) return String(existing.id);

  const created = firstRow(
    await client.post<unknown>('/rest/chatTargets', {
      name: deal.name ? `Переписка · ${deal.name}` : 'Переписка с клиентом',
      chatId,
      [`${deal.targetField}Id`]: recordId,
    }),
  );

  return String(created?.id ?? '');
};

export type ClientThread = {
  chatId: string | null;
  nomer: string | null;
  reason?: string;
};

/** Диалог клиента для карточки сделки. */
export const threadOfDeal = async (recordId: string): Promise<ClientThread> => {
  const deal = await clientOfDeal(recordId);

  if (!deal) return { chatId: null, nomer: null, reason: 'у сделки нет покупателя' };

  const chat = await chatOfPerson(deal.personId);

  if (!chat?.id) return { chatId: null, nomer: null, reason: 'с клиентом ещё не было переписки' };

  const parts = String(chat.vneshniyId ?? '').split(':');
  const tail = parts[parts.length - 1] ?? '';

  return {
    chatId: String(chat.id),
    nomer: /^\d{10}$/.test(tail) ? tail : null,
  };
};
