/**
 * Вызовы серверных маршрутов приложения из виджета.
 *
 * Токен приложения живёт ограниченное время, а страница может простоять открытой
 * часами — тогда все вызовы падают с «Token has expired». Поэтому токен читаем
 * в момент вызова, а если сервер всё же ответил «истёк» — просим хост Twenty
 * обновить его и повторяем запрос один раз.
 */

type Globals = {
  process?: { env?: Record<string, string> };
  frontComponentHostCommunicationApi?: {
    requestAccessTokenRefresh?: () => Promise<string>;
  };
};

const globals = globalThis as unknown as Globals;

const envValue = (key: string): string => (globals.process?.env?.[key] ?? '').trim();

export const functionsBase = (): string =>
  envValue('TWENTY_FUNCTIONS_URL').replace(/\/+$/, '');

export const appToken = (): string => envValue('TWENTY_APP_ACCESS_TOKEN');

/** Просим хост обновить токен приложения; пустая строка — не получилось. */
export const requestFreshToken = async (): Promise<string> => {
  try {
    const fresh = await globals.frontComponentHostCommunicationApi?.requestAccessTokenRefresh?.();
    const token = (fresh ?? '').trim();

    if (token && globals.process?.env) {
      globals.process.env.TWENTY_APP_ACCESS_TOKEN = token;
    }

    return token;
  } catch {
    return '';
  }
};

const isTokenExpired = (status: number, text: string): boolean =>
  (status === 401 || status === 403 || status === 500) &&
  /token has expired|token expired|token_expired|недействителен/i.test(text);

const send = async (
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } | undefined,
  token: string,
): Promise<globalThis.Response> => {
  const method = init?.method ?? 'GET';
  const base = functionsBase();
  const url =
    method === 'GET'
      ? `${base}${path}${path.includes('?') ? '&' : '?'}_ts=${Date.now()}`
      : `${base}${path}`;

  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(method === 'POST' ? { body: JSON.stringify(init?.body ?? {}) } : {}),
  });
};

export const callRoute = async <T,>(
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: unknown },
): Promise<T> => {
  let response = await send(path, init, appToken());
  let text = await response.text();

  if (!response.ok && isTokenExpired(response.status, text)) {
    const fresh = await requestFreshToken();

    if (fresh) {
      response = await send(path, init, fresh);
      text = await response.text();
    }
  }

  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error;

    throw new Error(message ?? `HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  return payload as T;
};
