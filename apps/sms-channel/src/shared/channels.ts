import { RestApiClient } from 'twenty-client-sdk/rest';

import { rowsOf } from 'src/shared/crm';

/**
 * Мои каналы: самообслуживание подключения телефона.
 *
 * Сотрудник ставит приложение SMS-шлюза на свой телефон, оно регистрируется на
 * приватном сервере и показывает логин и пароль устройства. Эти данные вводим
 * в карточке «Мои каналы» — по ним проверяем связь и заводим запись шлюза.
 *
 * Номер телефона не спрашиваем и по API не читаем: сервер отдаёт его
 * замаскированным. Рабочий номер берём из должности сотрудника — то же правило,
 * что у телефонии: клиентские SMS идут с рабочего номера, не с личного.
 */

type Row = Record<string, unknown> & { id?: string };

/** Адрес приватного сервера шлюза этой установки. */
export const GATEWAY_API = 'https://crm.kplus79.ru/integrations/sms/api';

const client = new RestApiClient({ runAs: 'application' });

const basic = (login: string, parol: string): string =>
  `Basic ${Buffer.from(`${login}:${parol}`).toString('base64')}`;

export type DeviceCheck =
  | { ok: true; deviceId: string; model: string; online: boolean }
  | { ok: false; error: string };

/** Проверка учётки устройства: жив ли сервер и подходят ли логин с паролем. */
export const checkDevice = async (login: string, parol: string): Promise<DeviceCheck> => {
  try {
    const response = await fetch(`${GATEWAY_API}/3rdparty/v1/devices`, {
      headers: { Authorization: basic(login, parol) },
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'Неверный логин или пароль устройства' };
    }

    if (!response.ok) {
      return { ok: false, error: `Сервер шлюза ответил HTTP ${response.status}` };
    }

    const devices = (await response.json()) as Row[];
    const device = Array.isArray(devices) ? devices[0] : undefined;

    if (!device?.id) return { ok: false, error: 'У устройства нет идентификатора' };

    const lastSeen = String(device.lastSeen ?? '');
    const online = !!lastSeen && Date.now() - Date.parse(lastSeen) < 10 * 60 * 1000;

    return {
      ok: true,
      deviceId: String(device.id),
      model: String(device.name ?? ''),
      online,
    };
  } catch (error) {
    return { ok: false, error: `Сервер шлюза недоступен: ${String(error).slice(0, 150)}` };
  }
};

/** Рабочий номер сотрудника: пользователь CRM → карточка → должность → номер. */
export const workPhoneOf = async (memberId: string): Promise<string> => {
  const memberResponse = (await client.get<unknown>(`/rest/workspaceMembers/${memberId}`, {
    query: { select: 'id,sotrudnikId' },
  })) as { data?: { workspaceMember?: Row } };

  const employeeId = String(memberResponse?.data?.workspaceMember?.sotrudnikId ?? '');

  if (!employeeId) return '';

  const employeeResponse = (await client.get<unknown>(`/rest/sotrudniki/${employeeId}`, {
    query: { select: 'id,dolzhnostId' },
  })) as { data?: { sotrudnik?: Row } };

  const positionId = String(employeeResponse?.data?.sotrudnik?.dolzhnostId ?? '');

  if (!positionId) return '';

  const positionResponse = (await client.get<unknown>(`/rest/positions/${positionId}`, {
    query: { select: 'id,workPhone' },
  })) as { data?: { position?: Row } };

  const phones = positionResponse?.data?.position?.workPhone as
    | { primaryPhoneNumber?: string; primaryPhoneCallingCode?: string }
    | undefined;

  const digits = String(phones?.primaryPhoneNumber ?? '').replace(/\D/g, '');

  return digits;
};

/** Шлюзы сотрудника — то, что он видит в «Моих каналах». */
export const myChannels = async (memberId: string): Promise<Row[]> => {
  const response = await client.get<unknown>('/rest/smsGateways', {
    query: {
      filter: `sotrudnikId[eq]:"${memberId}"`,
      select: 'id,name,nomer,status,deviceId,login,posledniyKontakt,limitVChas',
      limit: 20,
      orderBy: 'createdAt',
    },
  });

  return rowsOf(response, 'smsGateways');
};

/** Подключение: проверяем устройство и заводим (или обновляем) запись шлюза. */
export const connectChannel = async (
  memberId: string,
  login: string,
  parol: string,
): Promise<{ ok: boolean; error?: string; gatewayId?: string; created?: boolean; nomer?: string }> => {
  const cleanLogin = login.trim();
  const cleanParol = parol.trim();

  if (!cleanLogin || !cleanParol) return { ok: false, error: 'Заполните логин и пароль устройства' };

  const check = await checkDevice(cleanLogin, cleanParol);

  if (!check.ok) return { ok: false, error: check.error };

  const nomer = await workPhoneOf(memberId);

  if (!nomer) {
    return {
      ok: false,
      error: 'У вашей должности не заполнен рабочий номер — обратитесь к администратору',
    };
  }

  const existing = rowsOf(
    await client.get<unknown>('/rest/smsGateways', {
      query: { filter: `deviceId[eq]:"${check.deviceId}"`, limit: 1 },
    }),
    'smsGateways',
  )[0];

  const patch = {
    sotrudnikId: memberId,
    nomer,
    login: cleanLogin,
    parol: cleanParol,
    deviceId: check.deviceId,
    status: check.online ? 'NA_SVYAZI' : 'NET_SVYAZI',
    adresServera: `${GATEWAY_API}/mobile/v1`,
    posledniyKontakt: new Date().toISOString(),
  };

  if (existing?.id) {
    await client.patch<unknown>(`/rest/smsGateways/${String(existing.id)}`, patch);

    return { ok: true, gatewayId: String(existing.id), created: false, nomer };
  }

  const created = rowsOf(
    await client.post<unknown>('/rest/smsGateways', {
      name: `${check.model || 'Телефон'} — мой канал`,
      ...patch,
    }),
    'smsGateways',
  )[0];

  return { ok: true, gatewayId: String(created?.id ?? ''), created: true, nomer };
};

/** Данные для инструкции в интерфейсе. */
export const channelInfo = (): { serverAddress: string; privateToken: string } => {
  const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env ?? {};

  return {
    serverAddress: `${GATEWAY_API}/mobile/v1`,
    privateToken: String(env.SMS_GATEWAY_PRIVATE_TOKEN ?? ''),
  };
};
