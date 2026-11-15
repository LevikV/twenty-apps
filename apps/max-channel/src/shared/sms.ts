/** Разбор вебхука Android-шлюза (SMS Gateway for Android, событие `sms:received`). */

export type IncomingSms = {
  gatewayDeviceId: string;
  externalId: string;
  text: string;
  /** Номер клиента, 10 цифр. */
  phone: string;
  /** Номер, на который пришло (симка шлюза). */
  recipient: string;
  simNumber: number;
  receivedAt: string;
  signature: string;
  eventName: string;
};

type RawBody = Record<string, unknown>;

/** Последние 10 цифр номера — в этом виде номера хранятся в Twenty. */
export const phone10 = (value: unknown): string => {
  const digits = String(value ?? '').replace(/\D/g, '');

  return digits.length > 10 ? digits.slice(-10) : digits;
};

/** Телефон для показа: +7 924 747-01-69. */
export const formatPhone = (value: unknown): string => {
  const digits = phone10(value);

  if (digits.length !== 10) return digits;

  return `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
};

export const parseIncoming = (
  body: unknown,
  headers: Record<string, string | undefined>,
): IncomingSms => {
  const root = (body ?? {}) as RawBody;
  const payload = (root.payload ?? {}) as RawBody;
  const externalId = String(payload.messageId ?? root.id ?? '');

  return {
    gatewayDeviceId: String(root.deviceId ?? ''),
    externalId,
    text: String(payload.message ?? '').trim(),
    phone: phone10(payload.phoneNumber ?? payload.sender),
    recipient: phone10(payload.recipient),
    simNumber: Number(payload.simNumber ?? 0),
    receivedAt: String(payload.receivedAt ?? new Date().toISOString()),
    signature: String(headers['x-signature'] ?? headers['X-Signature'] ?? ''),
    eventName: String(root.event ?? ''),
  };
};
