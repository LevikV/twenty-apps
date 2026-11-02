import { createHmac } from 'crypto';

/**
 * Подпись входящего вебхука SMS-шлюза.
 *
 * Приложение подписывает тело запроса ключом «Ключ подписи» из своих настроек:
 * `X-Signature = HMAC-SHA256(тело + X-Timestamp, ключ)` в hex. В части версий
 * заголовок времени не отправляется — тогда подписывается одно тело.
 *
 * Проверка включается, когда в окружении задан `SMS_WEBHOOK_SECRET`. Пока он
 * пуст, маршрут работает как раньше — иначе тестовый контур встал бы.
 */

const header = (headers: Record<string, string | undefined>, name: string): string =>
  String(headers[name] ?? headers[name.toLowerCase()] ?? '');

export const webhookSecret = (): string => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

  return String(env.SMS_WEBHOOK_SECRET ?? '');
};

export type SignatureCheck = { ok: true } | { ok: false; reason: string };

export const verifyWebhookSignature = (
  rawBody: string,
  headers: Record<string, string | undefined>,
  secret: string,
): SignatureCheck => {
  if (!secret) return { ok: true };

  const signature = header(headers, 'x-signature').toLowerCase();

  if (!signature) return { ok: false, reason: 'нет заголовка X-Signature' };

  const timestamp = header(headers, 'x-timestamp');
  const variants = timestamp ? [rawBody + timestamp, rawBody] : [rawBody];

  for (const payload of variants) {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');

    if (expected === signature) return { ok: true };
  }

  return { ok: false, reason: 'подпись не совпала' };
};
