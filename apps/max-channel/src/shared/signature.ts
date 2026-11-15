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

/**
 * Секрет в адресе вебхука (`?k=...`).
 *
 * Приложение не во всех сборках даёт задать ключ подписи, поэтому маршрут
 * можно закрыть секретом в URL: адрес вебхука регистрируется на сервере шлюза
 * и подхватывается телефоном автоматически, руками ничего настраивать не нужно.
 */
export const verifyRouteSecret = (
  query: Record<string, string | undefined> | undefined,
  secret: string,
): SignatureCheck => {
  if (!secret) return { ok: true };

  const provided = String(query?.k ?? '');

  if (!provided) return { ok: false, reason: 'нет секрета в адресе' };

  // Сравнение постоянного времени: длина и содержимое не утекают по таймингу.
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);

  if (a.length !== b.length) return { ok: false, reason: 'неверный секрет в адресе' };

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;

  return diff === 0 ? { ok: true } : { ok: false, reason: 'неверный секрет в адресе' };
};

