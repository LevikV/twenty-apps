/**
 * Живой канал чата: подписка на события ядра Twenty по вебсокету.
 *
 * Виджеты живут в изолированной песочнице (не в iframe), поэтому сигнал снаружи
 * до компонента дотянуть нельзя — компонент подключается к сокету ядра сам.
 * Протокол socket.io v4 разбираем вручную: приём только «notify», плюс ответ
 * на пинг, чтобы сервер не закрыл соединение.
 */

type Handlers = {
  /** Пришло событие по конкретному чату. */
  onChat: (chatId: string) => void;
  /** Пришло событие без привязки к чату (например, отметка «прочитано»). */
  onAny?: () => void;
};

export const connectChatSocket = (
  functionsBase: string,
  userId: string,
  handlers: Handlers,
): (() => void) => {
  let socket: WebSocket | null = null;
  let closed = false;
  let attempts = 0;

  const connect = () => {
    if (closed || !userId) {
      return;
    }

    let host = '';

    try {
      host = new URL(functionsBase).host;
    } catch {
      return;
    }

    if (!host) {
      return;
    }

    socket = new WebSocket(
      `wss://${host}/ws/?EIO=4&transport=websocket&userId=${encodeURIComponent(userId)}`,
    );

    socket.onopen = () => {
      attempts = 0;
    };

    socket.onmessage = (event) => {
      const raw = String(event.data ?? '');

      // 0 — приветствие сервера, 40 — подключение к пространству имён,
      // 2 — пинг, 42 — событие.
      if (raw.startsWith('0')) {
        socket?.send('40');

        return;
      }

      if (raw.startsWith('2')) {
        socket?.send('3');

        return;
      }

      if (!raw.startsWith('42')) {
        return;
      }

      try {
        const parsed = JSON.parse(raw.slice(2)) as [string, { chatId?: string }];
        const payload = parsed[1] ?? {};

        if (payload.chatId) {
          handlers.onChat(payload.chatId);
        } else {
          handlers.onAny?.();
        }
      } catch {
        // чужое сообщение — пропускаем
      }
    };

    socket.onclose = () => {
      if (closed) {
        return;
      }

      attempts += 1;
      setTimeout(connect, Math.min(30000, 2000 * attempts));
    };

    socket.onerror = () => {
      // повтор будет по onclose
    };
  };

  connect();

  return () => {
    closed = true;
    try {
      socket?.close();
    } catch {
      // закрытие не критично
    }
  };
};
