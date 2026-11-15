import { useCallback, useEffect, useRef, useState } from 'react';

import { callRoute, functionsBase as envFunctionsBase } from './chat-api';
import { connectChatSocket, type ChatSocketHandle } from './chat-socket';
import { defineFrontComponent } from 'twenty-sdk/define';
import { SidePanelPages, openSidePanelPage, useSelectedRecordIds } from 'twenty-sdk/front-component';

import { CARD_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { fileHref } from 'src/shared/file-link';

/**
 * Чат в карточке записи (Заказ, Ремонт, Тендер, Заправка, Задача).
 *
 * Комната создаётся при первой отправке: до этого показываем приглашение.
 * Участников набирает сервер (`chat-record-send`).
 *
 * Упоминания: `@` в поле ввода открывает подсказку (поиск на сервере,
 * `/chat-mention-search`). Кого отметили — получает уведомление и становится
 * участником комнаты. Каретку в поле хоста сдвинуть нельзя (ограничение
 * песочницы, см. plan.md §11) — поэтому после вставки курсор остаётся как есть.
 */

type Message = {
  id: string;
  text: string | null;
  createdAt: string;
  authorName: string;
  mentions?: MentionView[];
  attachments?: { url: string; label: string; extension: string }[];
  transcription?: string;
};

type MentionView = { type: string; id: string; label: string };

type MentionSuggestion = {
  type: string;
  id: string;
  label: string;
  subtitle: string;
};

type ClientMessage = {
  id: string;
  text: string | null;
  createdAt: string;
  authorName: string;
  napravlenie?: string | null;
  statusDostavki?: string | null;
  personId?: string;
  authorId?: string;
  channelId?: string;
  attachments?: { url: string; label: string; extension: string }[];
  transcription?: string;
};

/** Цвета собеседников: у каждого контакта свой, чтобы лента читалась с листа. */
const CONTACT_COLORS = ['#e8f0fe', '#eaf7ef', '#fff3e0', '#f3e8fd', '#e6f7f7', '#fde8ef'];

const contactColor = (personId: string): string => {
  let hash = 0;

  for (let index = 0; index < personId.length; index += 1) {
    hash = (hash * 31 + personId.charCodeAt(index)) % 997;
  }

  return CONTACT_COLORS[hash % CONTACT_COLORS.length];
};

type ClientContact = {
  personId: string;
  name: string;
  phone: string;
  isPoint: boolean;
};

type ClientChannel = {
  id: string;
  kind: 'SMS' | 'MAX';
  name: string;
  nomer: string;
  deviceId: string;
  ownerId: string;
  ownerName: string;
};

type ClientThreadState = {
  chatId: string | null;
  nomer: string | null;
  reason?: string;
  dealName?: string;
  contacts: ClientContact[];
  channels: ClientChannel[];
  chats: { chatId: string; channelId: string; lastAt: string }[];
  defaultChannelId: string | null;
  lastMessageAt: string | null;
  messages: ClientMessage[];
};

/**
 * Свежесть переписки клиента по всем каналам, в миллисекундах.
 *
 * Нужна для окна прикрепления: файл может уйти в канал, который сейчас не
 * показан в ленте, поэтому «прибавилось ли сообщений» — ненадёжный признак.
 */
const lastClientActivity = (thread: ClientThreadState | null): number =>
  Date.parse(String(thread?.lastMessageAt ?? '')) || 0;

const DELIVERY_LABEL: Record<string, { text: string; color: string }> = {
  OTPRAVLYAETSYA: { text: 'отправляется', color: '#8b8b8b' },
  OTPRAVLENO: { text: 'отправлено', color: '#8b8b8b' },
  DOSTAVLENO: { text: 'доставлено', color: '#1a7f37' },
  OSHIBKA: { text: 'не отправлено', color: '#c03b2c' },
};

const formatClientPhone = (value: string | null): string => {
  const digits = String(value ?? '').replace(/\D/g, '');

  // Номер может прийти с кодом страны или без него.
  const national = digits.length === 11 && digits.startsWith('7') ? digits.slice(1) : digits;

  if (national.length !== 10) return '';

  return `+7 ${national.slice(0, 3)} ${national.slice(3, 6)}-${national.slice(6, 8)}-${national.slice(8)}`;
};

type RoomState = {
  chatId: string | null;
  name: string;
  tip: string | null;
  member: boolean;
  messages: Message[];
};


const keepFileUrls = <T extends { id: string; attachments?: { url: string; label: string; extension: string }[] }>(
  fresh: T[],
  previous: T[],
): T[] => {
  // Twenty выдаёт новую ссылку на файл при каждом запросе (в query меняется
  // токен). Без этого браузер считает файл новым и сбрасывает воспроизведение
  // аудио/видео при каждом обновлении ленты.
  const before = new Map(previous.map((message) => [message.id, message]));

  return fresh.map((message) => {
    const old = before.get(message.id);

    if (!old?.attachments?.length || !message.attachments?.length) {
      return message;
    }

    const oldByPath = new Map(old.attachments.map((file) => [file.url.split('?')[0], file]));

    return {
      ...message,
      attachments: message.attachments.map((file) => oldByPath.get(file.url.split('?')[0]) ?? file),
    };
  });
};

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const OBJECT_BY_TYPE: Record<string, string> = {
  POLZOVATEL: 'workspaceMember',
  SOTRUDNIK: 'sotrudnik',
  KOMPANIYA: 'company',
  KONTAKT: 'person',
  ZAKAZ: 'opportunity',
  TENDER: 'tender',
  REMONT: 'remontOborudovaniya',
  ZAPRAVKA: 'zapravkaKartridzhey',
  ZADACHA: 'task',
};

const openMention = (mention: MentionView) => {
  const objectNameSingular = OBJECT_BY_TYPE[mention.type];

  if (!objectNameSingular) {
    return;
  }

  void openSidePanelPage({
    page: SidePanelPages.ViewRecord,
    objectNameSingular,
    recordId: mention.id,
  }).catch(() => undefined);
};

/** Подсветка упоминаний в ленте — по данным сервера (как в «Центре коммуникации»). */
const renderAttachment = (
  file: { url: string; label: string; extension: string },
  index: number,
) => {
  const name = `${file.extension}${file.label}`;
  const isImage = /\.(png|jpg|jpeg|webp|gif)$/i.test(name);
  const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(name);
  const isAudio = /\.(ogg|opus|mp3|m4a|wav)$/i.test(name) || /^audio\//.test(file.label);

  if (isAudio) {
    return (
      <audio
        key={index}
        src={file.url}
        controls
        preload="metadata"
        style={{ marginTop: '6px', width: '220px', display: 'block' }}
      />
    );
  }

  if (isVideo) {
    return (
      <video
        key={index}
        src={file.url}
        controls
        preload="metadata"
        style={{ marginTop: '6px', maxWidth: '220px', borderRadius: '8px', display: 'block' }}
      />
    );
  }

  if (isImage) {
    return (
      <a key={index} href={fileHref(file.url, file.label)} target="_blank" rel="noreferrer">
        <img
          src={file.url}
          alt={file.label}
          style={{ marginTop: '6px', maxWidth: '220px', borderRadius: '8px', display: 'block' }}
        />
      </a>
    );
  }

  return (
    <a
      key={index}
      href={fileHref(file.url, file.label)}
      target="_blank"
      rel="noreferrer"
      // Для скачиваемых файлов имя берём из подписи, иначе браузер сохранит uuid.
      download={/\.pdf$/i.test(`${file.extension}${file.label}`) ? undefined : file.label}
      style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: '#1961ff' }}
    >
      {file.extension === 'pdf' ? '📄' : '📎'} {file.label}
    </a>
  );
};

const renderMentions = (text: string | null, mentions: MentionView[] = []) => {
  const value = text ?? '';

  if (mentions.length === 0) {
    return value;
  }

  const pattern = mentions
    .map((mention) => `@${mention.label}`)
    .filter((token, index, all) => all.indexOf(token) === index)
    .sort((left, right) => right.length - left.length)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  if (!pattern) {
    return value;
  }

  const regex = new RegExp(`(${pattern})`, 'g');
  const parts = value.split(regex);

  return parts.map((part, index) => {
    const mention = mentions.find((item) => `@${item.label}` === part);

    if (!mention) {
      return <span key={`t-${index}`}>{part}</span>;
    }

    return (
      <span
        key={`m-${index}`}
        onClick={() => openMention(mention)}
        style={{
          background: 'rgba(25,97,255,0.12)',
          borderRadius: '4px',
          padding: '0 3px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {part}
      </span>
    );
  });
};

export const CardChat = () => {
  const recordIds = useSelectedRecordIds();
  const recordId = recordIds.length === 1 ? recordIds[0] : null;

  const [room, setRoom] = useState<RoomState | null>(null);

  // Переписка с клиентом — вторая вкладка, только у сделок.
  const [tab, setTab] = useState<'discussion' | 'client'>('discussion');
  const [clientThread, setClientThread] = useState<ClientThreadState | null>(null);
  const [clientDraft, setClientDraft] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);
  const [clientPersonId, setClientPersonId] = useState('');
  const [meId, setMeId] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const clientListRef = useRef<HTMLDivElement | null>(null);
  const roomListRef = useRef<HTMLDivElement | null>(null);
  const [clientChannelId, setClientChannelId] = useState('');
  const [clientSending, setClientSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Окно прикрепления файла. Компонент живёт в песочнице about:srcdoc и не
  // видит localStorage, поэтому пропуск выдаёт маршрут приложения, а файл
  // отправляет браузер из окна поверх карточки.
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachTicket, setAttachTicket] = useState('');
  const [attachChatId, setAttachChatId] = useState('');
  const [attachMode, setAttachMode] = useState<'discussion' | 'client'>('discussion');
  const attachBaseRef = useRef(0);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [pendingMentions, setPendingMentions] = useState<MentionView[]>([]);

  const draftRef = useRef(draft);
  const roomRef = useRef<RoomState | null>(null);
  const socketRef = useRef<ChatSocketHandle | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const suppressRef = useRef<{ until: number; expected: string; caret: number } | null>(null);

  draftRef.current = draft;

  const reload = useCallback(async () => {
    if (!recordId) {
      return;
    }

    try {
      const state = await callRoute<RoomState>(
        `/chat-record-room?recordId=${encodeURIComponent(recordId)}`,
      );

      setRoom((previous) =>
        previous
          ? { ...state, messages: keepFileUrls(state.messages ?? [], previous.messages ?? []) }
          : state,
      );
      roomRef.current = state;
      setError(null);

      // Сообщаем сокету, какой чат открыт: при закрытии карточки соединение
      // оборвётся, и сервер сразу снимет отметку присутствия.
      socketRef.current?.setChat(state.chatId ?? null);

      if (state.chatId) {
        // Отмечаем присутствие: пока карточка открыта, пуш о сообщении не нужен.
        void callRoute('/chat-presence', {
          method: 'POST',
          body: { chatId: state.chatId },
        }).catch(() => undefined);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [recordId]);

  const reloadClient = useCallback(async () => {
    if (!recordId) return;

    try {
      const state = await callRoute<ClientThreadState>(
        `/chat-client-thread?recordId=${encodeURIComponent(recordId)}`,
      );

      const sortedMessages = [...(state.messages ?? [])].sort(
        (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
      );

      setClientThread((previous) => ({
        ...state,
        messages: previous
          ? keepFileUrls(sortedMessages, previous.messages ?? [])
          : sortedMessages,
      }));
      setClientError(null);
      setClientPersonId((current) => current || state.contacts?.[0]?.personId || '');
      // Канал по умолчанию — тот, где переписка свежее (часто это MAX),
      // а не первый по списку: иначе ответ уходит в старый SMS-диалог.
      setClientChannelId((current) => {
        const list = state.channels ?? [];
        const stillThere = Boolean(current) && list.some((item) => item.id === current);

        return stillThere ? current : state.defaultChannelId || list[0]?.id || '';
      });
    } catch (loadError) {
      setClientError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [recordId]);

  // Клиентскую ленту грузим только когда вкладка открыта: лишних запросов нет.
  useEffect(() => {
    if (tab !== 'client') return;

    void reloadClient();

    const timer = setInterval(() => {
      if (clientDraft.trim().length === 0) void reloadClient();
    }, 20000);

    return () => clearInterval(timer);
  }, [tab, reloadClient, clientDraft]);

  const sendToClient = async () => {
    const text = clientDraft.trim();

    if (!text || !recordId || clientSending) return;

    setClientSending(true);
    setClientError(null);

    try {
      await callRoute('/chat-client-send', {
        method: 'POST',
        body: {
          recordId,
          text,
          personId: clientPersonId || undefined,
          channelId: clientChannelId || undefined,
        },
      });
      setClientDraft('');
      await reloadClient();
    } catch (sendError) {
      setClientError(sendError instanceof Error ? sendError.message : String(sendError));
    } finally {
      setClientSending(false);
    }
  };

  /**
   * Открыть окно прикрепления файла.
   *
   * Чат берём из уже загруженного состояния: у «Обсуждения» это комната записи,
   * у «Клиента» — переписка с покупателем. Пропуск выдаёт приложение: внутри
   * песочницы обычный токен сотрудника недоступен.
   */
  const openAttach = async (mode: 'discussion' | 'client') => {
    // Для клиента чат определяет выбранный канал: у одного человека их может
    // быть несколько (MAX и несколько SMS), и «первый попавшийся» — неверный.
    const knownChatId = mode === 'client' ? '' : room?.chatId ?? '';

    const showError = mode === 'client' ? setClientError : setError;

    showError(null);

    try {
      // Подготовку спрашиваем всегда, даже когда чат уже известен: приложение
      // подпишет сотрудника в этот чат, иначе приёмник откажет в доступе.
      const prepared = await callRoute<{ chatId?: string; error?: string }>(
        '/chat-record-attach',
        {
          method: 'POST',
          body: {
            recordId,
            mode,
            chatId: knownChatId || undefined,
            channelId: mode === 'client' ? clientChannelId || undefined : undefined,
          },
        },
      );

      const chatId = prepared.chatId || knownChatId;

      if (!chatId) {
        throw new Error('не удалось открыть чат для файла');
      }

      const answer = await callRoute<{ ticket?: string }>('/chat-upload-ticket', {
        method: 'POST',
        body: {},
      });

      if (!answer.ticket) {
        throw new Error('не удалось открыть окно файла: пропуск не выдан');
      }

      setAttachTicket(answer.ticket);
      setAttachChatId(chatId);
      setAttachMode(mode);
      setAttachOpen(true);
    } catch (openError) {
      showError(openError instanceof Error ? openError.message : String(openError));
    }
  };

  // Итог загрузки из окна: файл уже создал сообщение, нам осталось связать его
  // с записью (для клиентской ленты) и перечитать нужную ленту.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; ok?: boolean; messageId?: string; error?: string }
        | null;

      // Страница окна сообщает и итог, и просьбу закрыться — второй сигнал
      // нужен, если первый потерялся (окно вложено в панель карточки).
      if (data && data.type === 'chat-upload-close') {
        setAttachOpen(false);

        return;
      }

      if (!data || data.type !== 'chat-upload') {
        return;
      }

      setAttachOpen(false);

      const showError = attachMode === 'client' ? setClientError : setError;

      if (!data.ok) {
        showError(data.error || 'файл не отправился');

        return;
      }

      if (data.messageId) {
        void callRoute('/chat-record-attach', {
          method: 'POST',
          body: {
            recordId,
            chatId: attachChatId,
            messageId: data.messageId,
            mode: attachMode,
          },
        }).catch(() => undefined);
      }

      if (attachMode === 'client') {
        void reloadClient();
      } else {
        void reload();
      }
    };

    window.addEventListener('message', onMessage);

    return () => window.removeEventListener('message', onMessage);
  }, [attachChatId, attachMode, recordId, reload, reloadClient]);

  // Страховка: если сообщение из окна не дойдёт, окно закроется по появлению
  // нового сообщения в ленте.
  useEffect(() => {
    if (!attachOpen) {
      return;
    }

    // Для клиента считаем не сообщения выбранного канала, а свежесть всей
    // переписки: файл может уйти в другой канал, и тогда счётчик не изменится.
    attachBaseRef.current =
      attachMode === 'client'
        ? lastClientActivity(clientThread)
        : room?.messages.length ?? 0;

    const timer = setInterval(() => {
      if (attachMode === 'client') {
        void reloadClient();
      } else {
        void reload();
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [attachOpen, attachMode, reload, reloadClient]);

  useEffect(() => {
    if (!attachOpen) {
      return;
    }

    const current =
      attachMode === 'client'
        ? lastClientActivity(clientThread)
        : room?.messages.length ?? 0;

    if (current > attachBaseRef.current) {
      setAttachOpen(false);
    }
  }, [
    attachOpen,
    attachMode,
    clientThread?.messages.length,
    clientThread?.lastMessageAt,
    room?.messages.length,
  ]);

  // Лента всегда внизу: и при открытии, и при новом сообщении.
  // Прокручиваем повторно после отрисовки — иначе scrollTop упирается
  // в высоту, которая ещё не пересчитана под новые пузыри.
  const keepBottom = (node: HTMLDivElement | null) => {
    if (!node) {
      return () => undefined;
    }

    const toBottom = () => {
      node.scrollTop = node.scrollHeight;
    };

    // Несколько заходов: высота ленты меняется после отрисовки содержимого.
    const timers = [0, 50, 150, 400].map((delay) => setTimeout(toBottom, delay));

    return () => timers.forEach(clearTimeout);
  };

  useEffect(
    () => keepBottom(clientListRef.current),
    [clientThread?.messages.length, clientThread?.chatId, tab, onlyMine],
  );

  // Обсуждение тоже держим на последнем сообщении.
  useEffect(
    () => keepBottom(roomListRef.current),
    [room?.messages.length, room?.chatId, tab],
  );

  useEffect(() => {
    void reload();

    const timer = setInterval(() => {
      if (draftRef.current.trim().length === 0) {
        void reload();
      }
    }, 20000);

    return () => clearInterval(timer);
  }, [reload]);

  // Присутствие: пока карточка видна, человек считается читающим этот чат.
  // Отдельный маяк, чтобы не гонять перечитывание ленты ради отметки.
  useEffect(() => {
    const beat = () => {
      const chatId = roomRef.current?.chatId;

      if (!chatId) {
        return;
      }

      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      void callRoute('/chat-presence', { method: 'POST', body: { chatId } }).catch(() => undefined);
    };

    // Уход из чата: снимаем присутствие сразу, иначе сообщение, пришедшее
    // в последние секунды, никого не разбудит.
    const leave = () => {
      const chatId = roomRef.current?.chatId;

      if (!chatId) {
        return;
      }

      void callRoute('/chat-presence', { method: 'POST', body: { chatId, closed: true } }).catch(
        () => undefined,
      );
    };

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        leave();
      } else {
        beat();
      }
    };

    const timer = setInterval(beat, 5000);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      clearInterval(timer);
      leave();

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, []);

  // Живой канал: сообщение в этом чате приходит мгновенно, опрос — страховка.
  useEffect(() => {
    let disposed = false;

    void callRoute<{ userId: string | null; memberId?: string | null }>('/chat-me')
      .then((me) => {
        if (disposed) {
          return;
        }

        const userId = String(me.userId ?? '');

        // Автор сообщения — участник рабочих пространств (workspaceMember),
        // а userId нужен только для подписки на сокет.
        setMeId(String(me.memberId ?? userId));

        if (!userId) {
          return;
        }

        socketRef.current = connectChatSocket(envFunctionsBase(), userId, {
          onChat: (chatId) => {
            if (chatId === roomRef.current?.chatId) {
              void reload();
            }
          },
        });
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [reload]);

  const updateMentionState = (value: string) => {
    const atIndex = value.lastIndexOf('@');

    if (atIndex === -1) {
      setMentionQuery(null);
      setSuggestions([]);

      return;
    }

    const tail = value.slice(atIndex + 1);

    if (tail.length > 40 || /\s/.test(tail) || tail.includes(']') || tail.includes('(')) {
      setMentionQuery(null);
      setSuggestions([]);

      return;
    }

    setMentionStart(atIndex);
    setMentionQuery(tail);
    setMentionIndex(0);
  };

  useEffect(() => {
    if (mentionQuery === null || mentionQuery.trim().length < 2) {
      setSuggestions([]);

      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      callRoute<{ suggestions: MentionSuggestion[] }>(
        `/chat-mention-search?q=${encodeURIComponent(mentionQuery.trim())}`,
      )
        .then((response) => {
          if (!cancelled) {
            setSuggestions(response.suggestions ?? []);
            setMentionIndex(0);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([]);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mentionQuery]);

  /**
   * Вставка текста в поле хоста: пишем значение и сразу ставим каретку в конец.
   * Без этого хост успевает применить своё действие (перевод строки на Enter)
   * раньше нашего обработчика, и вставка «не срабатывает».
   */
  const applyDraft = (value: string, caret: number) => {
    suppressRef.current = { until: Date.now() + 500, expected: value, caret };
    setDraft(value);

    const node = composerRef.current;

    try {
      if (node) {
        node.value = value;

        if (typeof node.setSelectionRange === 'function') {
          node.setSelectionRange(caret, caret);
        }

        node.focus?.();
      }
    } catch {
      // песочница не даёт доступа к узлу
    }
  };

  /** Подсветка упоминаний прямо в поле ввода (слой под прозрачным текстом). */
  const renderHighlightedDraft = () => {
    if (pendingMentions.length === 0 || draft.length === 0) {
      return draft;
    }

    const labels = pendingMentions
      .map((mention) => `@${mention.label}`)
      .sort((left, right) => right.length - left.length);
    const pattern = new RegExp(
      `(${labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
      'g',
    );

    return draft.split(pattern).map((part, index) =>
      labels.includes(part) ? (
        <span key={index} style={{ color: '#1961ff', fontWeight: 600 }}>
          {part}
        </span>
      ) : (
        <span key={index}>{part}</span>
      ),
    );
  };

  const insertMention = (suggestion: MentionSuggestion) => {
    if (mentionStart < 0) {
      return;
    }

    const before = draft.slice(0, mentionStart);
    const after = draft.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
    const value = `${before}@${suggestion.label} ${after}`;

    applyDraft(value, value.length);
    setMentionQuery(null);
    setSuggestions([]);
    setMentionIndex(0);
    setPendingMentions((previous) =>
      previous.some((item) => item.type === suggestion.type && item.id === suggestion.id)
        ? previous
        : [...previous, { type: suggestion.type, id: suggestion.id, label: suggestion.label }],
    );
  };

  const send = async () => {
    const text = draft.trim();

    if (!recordId || !text || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await callRoute('/chat-record-send', {
        method: 'POST',
        body: { recordId, text, mentions: pendingMentions },
      });
      setDraft('');
      setPendingMentions([]);
      setMentionQuery(null);
      setSuggestions([]);
      await reload();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : String(sendError));
    } finally {
      setIsSending(false);
    }
  };

  if (!recordId) {
    return (
      <div style={{ padding: '12px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#8b8b8b' }}>
        Откройте запись, чтобы увидеть обсуждение.
      </div>
    );
  }

  const isDeal = room?.tip === 'SDELKA';

  const tabSwitcher = isDeal ? (
    <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e8e8ea', paddingBottom: '6px' }}>
      {([
        ['discussion', 'Обсуждение'],
        ['client', 'Клиент'],
      ] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setTab(key)}
          style={{
            border: 'none',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: tab === key ? 600 : 400,
            color: tab === key ? '#1a1a1a' : '#8b8b8b',
            background: tab === key ? '#eef3ff' : 'transparent',
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null;

// Пока выбирается файл, панель целиком отдаётся окну: в карточке она
  // короткая (420 px), и любое окно внутри ленты уходило за её нижний край —
  // со стороны это выглядело как «клик не сработал».
  if (attachOpen) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '420px',
          maxHeight: '100%',
          minHeight: 0,
          boxSizing: 'border-box',
          border: '1px solid #d6d6d6',
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#fff',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
            Прикрепить файл
          </span>
          <button
            type="button"
            onClick={() => setAttachOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '16px',
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            ✕
          </button>
        </div>
        <iframe
          src={`/integrations/chat/page?chatId=${attachChatId}${
            attachMode === 'client' ? `&recordId=${encodeURIComponent(recordId)}` : ''
          }#token=${encodeURIComponent(attachTicket)}`}
          title="Прикрепить файл"
          style={{ flex: 1, width: '100%', border: 'none' }}
        />
      </div>
    );
  }

  if (isDeal && tab === 'client') {
    // «Только мои»: мои отправленные и ответы клиента на мои каналы.
    const myChannelIds = new Set((clientThread?.channels ?? []).map((channel) => channel.id));
    const visibleClientMessages = (clientThread?.messages ?? []).filter(
      (message) =>
        !onlyMine ||
        !meId ||
        (message.napravlenie === 'ISHODYASHCHIE'
          ? message.authorId === meId
          : myChannelIds.has(message.channelId ?? '')),
    );

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          height: '420px',
          minHeight: 0,
          boxSizing: 'border-box',
          overflow: 'hidden',
          fontFamily: 'Inter, sans-serif',
          color: '#1a1a1a',
        }}
      >
        {tabSwitcher}

        {clientError && (
          <div style={{ background: '#fdecec', border: '1px solid #f3c2c2', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: '#a83232' }}>
            {clientError}
          </div>
        )}

        {clientThread && clientThread.contacts.length === 0 && (
          <div style={{ fontSize: '13px', color: '#8b8b8b', padding: '8px 0' }}>
            {clientThread.reason ?? 'у сделки нет покупателя с телефоном'}
          </div>
        )}

        {clientThread && clientThread.contacts.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', color: '#8b8b8b', flexWrap: 'wrap' }}>
              <span>SMS</span>

              {clientThread.contacts.length > 1 ? (
                <select
                  value={clientPersonId}
                  onChange={(event) => setClientPersonId(event.target.value)}
                  style={{ fontSize: '11px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #d6d6d6' }}
                >
                  {clientThread.contacts.map((contact) => (
                    <option key={contact.personId} value={contact.personId}>
                      {contact.name} · {formatClientPhone(contact.phone)}
                    </option>
                  ))}
                </select>
              ) : (
                <span>
                  {clientThread.contacts[0].name} · {formatClientPhone(clientThread.contacts[0].phone)}
                </span>
              )}

              {clientThread.channels.length > 0 && (
                <select
                  value={clientChannelId}
                  onChange={(event) => setClientChannelId(event.target.value)}
                  title="С какого канала отправить"
                  style={{ fontSize: '11px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #d6d6d6', maxWidth: '210px' }}
                >
                  {clientThread.channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.kind === 'MAX' ? 'MAX' : 'SMS'} · {channel.ownerName}
                      {channel.nomer ? ` · ${channel.nomer}` : ` · ${channel.name}`}
                    </option>
                  ))}
                </select>
              )}

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginLeft: 'auto',
                  fontSize: '11px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={onlyMine}
                  onChange={(event) => setOnlyMine(event.target.checked)}
                  style={{ margin: 0 }}
                />
                Только мои
              </label>
            </div>

            <div
              ref={clientListRef}
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                // Перевёрнутая колонка: состояние покоя — низ ленты,
                // поэтому последнее сообщение видно без программной прокрутки.
                display: attachOpen ? 'none' : 'flex',
                flexDirection: 'column-reverse',
                gap: '8px',
                padding: '2px',
              }}
            >
              {visibleClientMessages.length === 0 && (
                <div style={{ fontSize: '13px', color: '#8b8b8b', padding: '8px 0' }}>
                  Сообщений пока нет.
                </div>
              )}

              {visibleClientMessages.slice().reverse().map((message) => {
                const mine = message.napravlenie === 'ISHODYASHCHIE';
                const bubble = contactColor(message.authorId || message.personId || 'клиент');

                return (
                  <div
                    key={message.id}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: '2px', flexShrink: 0 }}
                  >
                    <div style={{ fontSize: '11px', color: '#8b8b8b' }}>
                      {message.authorName} · {formatTime(message.createdAt)}
                    </div>
                    <div
                      style={{
                        maxWidth: '85%',
                        background: bubble,
                        color: '#1a1a1a',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        fontSize: '13px',
                        lineHeight: '18px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {message.text}
                      {(message.attachments ?? []).map(renderAttachment)}

                {message.transcription ? (
                  <div
                    style={{
                      marginTop: '6px',
                      paddingTop: '6px',
                      borderTop: '1px solid rgba(0,0,0,0.08)',
                      fontSize: '12px',
                      lineHeight: '16px',
                      whiteSpace: 'pre-wrap',
                      color: '#555',
                    }}
                  >
                    {message.transcription}
                  </div>
                ) : null}
                    </div>

                    {mine && message.statusDostavki && (
                      <div
                        style={{
                          fontSize: '10px',
                          color: DELIVERY_LABEL[message.statusDostavki]?.color ?? '#8b8b8b',
                        }}
                      >
                        {DELIVERY_LABEL[message.statusDostavki]?.text ?? message.statusDostavki}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => void openAttach('client')}
                title="Прикрепить файл"
                style={{
                  border: '1px solid #d6d6d6',
                  borderRadius: '6px',
                  background: '#f5f6f8',
                  color: '#1961ff',
                  padding: '0 10px',
                  fontSize: '15px',
                  cursor: 'pointer',
                }}
              >
                📎
              </button>
              <textarea
                value={clientDraft}
                onChange={(event) => setClientDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendToClient();
                  }
                }}
                placeholder="Ответить клиенту…"
                rows={2}
                style={{
                  flex: 1,
                  resize: 'none',
                  border: '1px solid #d6d6d6',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={() => void sendToClient()}
                disabled={clientSending || !clientDraft.trim()}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  background: clientSending || !clientDraft.trim() ? '#9bb8ff' : '#1961ff',
                  color: '#fff',
                  padding: '0 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: clientSending || !clientDraft.trim() ? 'default' : 'pointer',
                }}
              >
                Отправить
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const popupOpen = mentionQuery !== null && suggestions.length > 0;

    return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        // Фиксированная высота: лента прокручивается внутри, поле ввода всегда на виду.
        height: '420px',
        minHeight: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
        color: '#1a1a1a',
      }}
    >
      {tabSwitcher}

      {error && (
        <div style={{ background: '#fdecec', border: '1px solid #f3c2c2', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: '#a83232' }}>
          {error}
        </div>
      )}

      <div
        ref={roomListRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          // Перевёрнутая колонка: состояние покоя — низ ленты.
          // Пока открыто окно прикрепления — прячем ленту, иначе окно
          // уходит за нижнюю границу панели фиксированной высоты.
          display: attachOpen ? 'none' : 'flex',
          flexDirection: 'column-reverse',
          gap: '8px',
          padding: '2px',
        }}
      >
        {!room?.chatId && (
          <div style={{ fontSize: '13px', color: '#8b8b8b', padding: '8px 0' }}>
            Обсуждения ещё нет — оно начнётся с первого сообщения.
          </div>
        )}

        {room?.chatId && room.messages.length === 0 && (
          <div style={{ fontSize: '13px', color: '#8b8b8b', padding: '8px 0' }}>
            Сообщений пока нет.
          </div>
        )}

        {room?.messages.slice().reverse().map((message) => (
          <div key={message.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: '#8b8b8b' }}>
              {message.authorName} · {formatTime(message.createdAt)}
            </div>
            <div
              style={{
                background: '#f5f6f8',
                borderRadius: '8px',
                padding: '7px 10px',
                fontSize: '13px',
                lineHeight: '18px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {renderMentions(message.text, message.mentions ?? [])}
              {(message.attachments ?? []).map(renderAttachment)}

                {message.transcription ? (
                  <div
                    style={{
                      marginTop: '6px',
                      paddingTop: '6px',
                      borderTop: '1px solid rgba(0,0,0,0.08)',
                      fontSize: '12px',
                      lineHeight: '16px',
                      whiteSpace: 'pre-wrap',
                      color: '#555',
                    }}
                  >
                    {message.transcription}
                  </div>
                ) : null}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
        {popupOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              marginBottom: '4px',
              maxHeight: '220px',
              overflowY: 'auto',
              background: '#fff',
              border: '1px solid #d6d6d6',
              borderRadius: '8px',
              boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
              zIndex: 50,
            }}
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.type}:${suggestion.id}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertMention(suggestion);
                }}
                style={{
                  padding: '7px 10px',
                  cursor: 'pointer',
                  background: index === mentionIndex ? '#eef3ff' : 'transparent',
                  fontSize: '13px',
                }}
              >
                <div>{suggestion.label}</div>
                <div style={{ fontSize: '11px', color: '#8b8b8b' }}>{suggestion.subtitle}</div>
              </div>
            ))}
          </div>
        )}

        {room?.chatId && !room.member && (
          <div style={{ fontSize: '11px', color: '#8b8b8b' }}>
            Вы читаете обсуждение, но не участник — напишите, и будете получать уведомления.
          </div>
        )}

        <div style={{ position: 'relative' }}>
          {/* Слой подсветки: в поле ввода нельзя красить часть текста,
              поэтому под прозрачным текстом рисуем тот же текст с акцентом. */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              boxSizing: 'border-box',
              border: '1px solid transparent',
              borderRadius: '8px',
              padding: '8px 10px',
              fontSize: '13px',
              fontFamily: 'inherit',
              lineHeight: '18px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#1a1a1a',
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            {renderHighlightedDraft()}
          </div>

        <textarea
          ref={composerRef}
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            const guard = suppressRef.current;

            // Хост применил своё действие (например, перевод строки на Enter)
            // раньше нашего — возвращаем вставленный текст.
            if (guard && Date.now() < guard.until && value !== guard.expected) {
              const node = composerRef.current;

              try {
                if (node) {
                  node.value = guard.expected;
                }
              } catch {
                // нет доступа к узлу
              }

              return;
            }

            suppressRef.current = null;
            setDraft(value);
            updateMentionState(value);
          }}
          onKeyDown={(event) => {
            if (popupOpen) {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setMentionIndex((previous) => (previous + 1) % suggestions.length);

                return;
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setMentionIndex(
                  (previous) => (previous - 1 + suggestions.length) % suggestions.length,
                );

                return;
              }

              if (event.key === 'Enter') {
                event.preventDefault();
                insertMention(suggestions[mentionIndex]);

                return;
              }

              if (event.key === 'Escape') {
                setMentionQuery(null);
                setSuggestions([]);

                return;
              }
            }

            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Написать в обсуждение… (Ctrl+Enter — отправить, @ — упомянуть)"
          rows={2}
          style={{
            position: 'relative',
            width: '100%',
            resize: 'vertical',
            border: '1px solid #d6d6d6',
            borderRadius: '8px',
            padding: '8px 10px',
            fontSize: '13px',
            fontFamily: 'inherit',
            lineHeight: '18px',
            outline: 'none',
            boxSizing: 'border-box',
            background: 'transparent',
            color: 'transparent',
            caretColor: '#1a1a1a',
          }}
        />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void openAttach('discussion')}
            title="Прикрепить файл"
            style={{
              border: '1px solid #d6d6d6',
              borderRadius: '8px',
              background: '#f5f6f8',
              color: '#1961ff',
              padding: '6px 12px',
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            📎
          </button>

          <button
            onClick={() => void send()}
            disabled={isSending || draft.trim().length === 0}
            style={{
              background: isSending || draft.trim().length === 0 ? '#c9d6ff' : '#1961ff',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '13px',
              cursor: isSending || draft.trim().length === 0 ? 'default' : 'pointer',
            }}
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: CARD_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Чат записи',
  description: 'Обсуждение по текущей записи: лента и отправка сообщения',
  component: CardChat,
});
