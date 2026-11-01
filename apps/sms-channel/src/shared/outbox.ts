import { RestApiClient } from 'twenty-client-sdk/rest';

import { describeError, pickCreated, rowsOf } from 'src/shared/crm';

/**
 * Очередь отправки SMS.
 *
 * Телефон живёт за NAT — вызвать его напрямую нельзя. Поэтому сообщение из чата
 * лишь ставит задачу, а крон-движок забирает её и отправляет через приватный
 * сервер шлюза. Это тот же приём, что у конвейера записей звонков.
 */

type Row = Record<string, unknown> & { id?: string };

const client = new RestApiClient({ runAs: 'application' });

export type QueueTask = Row & {
  id: string;
  nomer?: string;
  tekst?: string;
  popytki?: number;
  shlyuzId?: string;
  soobshchenieId?: string;
};

/** Сколько сообщений за час уже отправлено этим шлюзом — для лимита оператора. */
const sentLastHour = async (gatewayId: string): Promise<number> => {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const rows = rowsOf(
    await client.get<unknown>('/rest/smsOutboxTasks', {
      query: {
        filter: `and(shlyuzId[eq]:"${gatewayId}",otpravlenoV[gte]:"${since}",status[in]:["OTPRAVLENO","DOSTAVLENO"])`,
        limit: 200,
      },
    }),
    'smsOutboxTasks',
  );

  return rows.length;
};

/** Задачи, которые пора отправлять: ждут и не отложены. */
export const dueTasks = async (): Promise<QueueTask[]> => {
  const now = new Date().toISOString();

  const rows = rowsOf(
    await client.get<unknown>('/rest/smsOutboxTasks', {
      query: {
        filter: `and(status[eq]:"ZHDET",or(sleduyushchayaPopytka[is]:NULL,sleduyushchayaPopytka[lte]:"${now}"))`,
        limit: 10,
        orderBy: 'createdAt',
      },
    }),
    'smsOutboxTasks',
  );

  return rows.filter((row) => row.id) as QueueTask[];
};

/** Отправленные, по которым ещё не пришёл конечный статус доставки. */
export const pendingStatus = async (): Promise<QueueTask[]> => {
  const rows = rowsOf(
    await client.get<unknown>('/rest/smsOutboxTasks', {
      query: {
        filter: `and(status[eq]:"OTPRAVLENO",vneshniyId[neq]:NULL)`,
        limit: 20,
        orderBy: 'updatedAt',
      },
    }),
    'smsOutboxTasks',
  );

  return rows.filter((row) => row.id) as QueueTask[];
};

export type GatewayAuth = {
  base: string;
  login: string;
  parol: string;
  limit: number;
};

export const readGateway = async (gatewayId: string): Promise<GatewayAuth | null> => {
  if (!gatewayId) return null;

  const response = (await client.get<unknown>(`/rest/smsGateways/${gatewayId}`, {
    query: { select: 'id,login,parol,adresServera,limitVChas' },
  })) as { data?: { smsGateway?: Row } };

  const row = response?.data?.smsGateway;

  if (!row) return null;

  const server = String(row.adresServera ?? '');

  // В записи хранится адрес мобильного API; отправка живёт на том же сервере.
  const base = server.replace(/\/mobile\/v1\/?$/, '/3rdparty/v1').replace(/\/+$/, '');

  return {
    base,
    login: String(row.login ?? ''),
    parol: String(row.parol ?? ''),
    limit: Number(row.limitVChas ?? 0),
  };
};

const authHeader = (auth: GatewayAuth): string =>
  `Basic ${Buffer.from(`${auth.login}:${auth.parol}`).toString('base64')}`;

const firstRecord = (body: unknown): Row | undefined => {
  if (Array.isArray(body)) return body[0] as Row;

  const data = (body as { data?: unknown })?.data;

  if (Array.isArray(data)) return data[0] as Row;

  const single = pickCreated(body);

  return single ?? ((body as Row)?.id ? (body as Row) : undefined);
};

export type SendResult =
  | { ok: true; externalId: string; state: string }
  | { ok: false; error: string };

/** Отправка задачи через приватный сервер шлюза. */
export const sendTask = async (task: QueueTask, auth: GatewayAuth): Promise<SendResult> => {
  const digits = String(task.nomer ?? '').replace(/\D/g, '');
  const phone = digits.length === 10 ? `7${digits}` : digits;
  const text = String(task.tekst ?? '');

  if (!phone || !text) return { ok: false, error: 'пустой номер или текст' };

  try {
    const response = await fetch(`${auth.base}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(auth),
      },
      body: JSON.stringify({
        message: text,
        phoneNumbers: [`+${phone}`],
        withDeliveryReport: true,
      }),
    });

    const body = await response.text();

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
    }

    const record = firstRecord(body ? JSON.parse(body) : null);

    if (!record?.id) return { ok: false, error: `нет id в ответе: ${body.slice(0, 200)}` };

    return { ok: true, externalId: String(record.id), state: String(record.state ?? 'Pending') };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
};

/** Текущее состояние сообщения в шлюзе: Pending / Sent / Delivered / Failed. */
export const readRemoteState = async (
  externalId: string,
  auth: GatewayAuth,
): Promise<{ state: string; error?: string } | null> => {
  try {
    const response = await fetch(`${auth.base}/messages/${externalId}`, {
      headers: { Authorization: authHeader(auth) },
    });

    if (!response.ok) return null;

    const body = (await response.json()) as Row;

    return { state: String(body.state ?? '') };
  } catch {
    return null;
  }
};

export const patchTask = async (taskId: string, patch: Record<string, unknown>): Promise<void> => {
  await client.patch<unknown>(`/rest/smsOutboxTasks/${taskId}`, patch);
};

/** Сообщение в чате: статус доставки и внешний id (чтобы видеть в ленте). */
export const patchMessage = async (
  messageId: string,
  patch: Record<string, unknown>,
): Promise<void> => {
  if (!messageId) return;

  await client.patch<unknown>(`/rest/soobshcheniya/${messageId}`, patch);
};

export const overLimit = async (task: QueueTask, auth: GatewayAuth): Promise<boolean> => {
  if (auth.limit <= 0 || !task.shlyuzId) return false;

  return (await sentLastHour(task.shlyuzId)) >= auth.limit;
};
