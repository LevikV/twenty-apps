import { callRoute } from 'src/front-components/chat-api';

/**
 * Загрузка вложения из интерфейса чата.
 *
 * Два пути, потому что у них разные пределы:
 *
 * 1. Небольшие файлы — маршрут приложения `/chat-upload`. Он принимает JSON
 *    с base64, а Twenty режет тело запроса примерно на 25 МБ («request entity
 *    too large»), поэтому больше 10 МБ туда не отправляем.
 *
 * 2. Крупные файлы (видео) — приёмник моста `/integrations/chat/upload`.
 *    Файл идёт потоком: браузер → nginx → приёмник → диск → Twenty
 *    multipart'ом. Память не растёт, ограничение по размеру — 2 ГБ.
 *    Приёмник проверяет, что запрос от сотрудника CRM, по его токену.
 */

const LARGE_FILE_BYTES = 10 * 1024 * 1024;

export type UploadedAttachment = { fileId: string; label: string };

/** Токен сотрудника лежит в localStorage CRM — приёмник по нему проверяет доступ. */
export const staffToken = (): string => {
  try {
    const raw = window.localStorage.getItem('tokenPairState') ?? '';
    const parsed = JSON.parse(raw) as {
      accessOrWorkspaceAgnosticToken?: { token?: string };
    };

    return parsed?.accessOrWorkspaceAgnosticToken?.token ?? '';
  } catch {
    return '';
  }
};

const readBase64 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
};

export const uploadAttachment = async (file: File): Promise<UploadedAttachment> => {
  if (file.size > LARGE_FILE_BYTES) {
    const body = new FormData();

    body.append('file', file, file.name);

    const response = await fetch('/integrations/chat/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken()}` },
      body,
    });

    if (!response.ok) {
      throw new Error(`файл не загрузился: сервер ответил ${response.status}`);
    }

    return (await response.json()) as UploadedAttachment;
  }

  const content = await readBase64(file);

  return await callRoute<UploadedAttachment>('/chat-upload', {
    method: 'POST',
    body: { name: file.name, mime: file.type, content },
  });
};
