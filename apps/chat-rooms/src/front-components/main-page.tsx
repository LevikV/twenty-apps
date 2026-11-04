import { useCallback, useEffect, useRef, useState } from 'react';

import { callRoute, functionsBase as envFunctionsBase } from './chat-api';
import { connectChatSocket, type ChatSocketHandle } from './chat-socket';
import { ChannelsPanel } from './channels-panel';
import { defineFrontComponent } from 'twenty-sdk/define';
import { SidePanelPages, openSidePanelPage } from 'twenty-sdk/front-component';

import { MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Центр коммуникации: список диалогов сотрудника, лента, отправка.
 *
 * Все данные берутся не напрямую из REST/GraphQL, а со служебных маршрутов
 * приложения (`/chat-dialogs`, `/chat-messages`, `/chat-send`, `/chat-read`).
 * Причина: объекты чата кастомные, у ролей сотрудников прав на них нет, а
 * фильтровать «мои диалоги» надёжно только на сервере — там, где известен
 * настоящий пользователь из токена.
 */

type Dialog = {
  id: string;
  name: string;
  tip: string | null;
  /** Канал: SMS, TG, MAX или внутренний. */
  kanal: string | null;
  /** Номер канала, с которого идёт переписка. */
  nomer: string | null;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
};

type MentionView = {
  type: string;
  id: string;
  label: string;
};

type Message = {
  id: string;
  text: string | null;
  createdAt: string;
  authorId: string | null;
  authorName: string;
  mentions?: MentionView[];
  napravlenie?: string | null;
  statusDostavki?: string | null;
  svyazkaIds?: string[];
};

type LinkResult = {
  kind: string;
  recordId: string;
  title: string;
  label: string;
};

/** Имя объекта Twenty для открытия записи из лейбла. */
const OBJECT_BY_KIND: Record<string, string> = {
  sdelkaOpportunity: 'opportunity',
  sdelkaRemontOborudovaniya: 'remontOborudovaniya',
  sdelkaTender: 'tender',
  sdelkaZapravkaKartridzhey: 'zapravkaKartridzhey',
  zadacha: 'task',
};

/** Подпись типа записи в лейбле под сообщением. */
const LINK_KIND_LABEL: Record<string, string> = {
  sdelkaOpportunity: 'Заказ',
  sdelkaRemontOborudovaniya: 'Ремонт',
  sdelkaTender: 'Тендер',
  sdelkaZapravkaKartridzhey: 'Заправка',
  zadacha: 'Задача',
};

const formatChannelPhone = (value: string | null): string => {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (digits.length !== 10) return '';

  return `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
};

/** Подпись статуса доставки под исходящим сообщением канала связи. */
const DELIVERY_LABEL: Record<string, { text: string; color: string }> = {
  OTPRAVLYAETSYA: { text: 'отправляется', color: '#999' },
  OTPRAVLENO: { text: 'отправлено', color: '#999' },
  DOSTAVLENO: { text: 'доставлено', color: '#1a7f37' },
  OSHIBKA: { text: 'не отправлено', color: '#c03b2c' },
};

type DialogsResponse = {
  me: string;
  dialogs: Dialog[];
  names: Record<string, string>;
};

type MessagesResponse = {
  messages: Message[];
  names: Record<string, string>;
};

type MentionSuggestion = {
  type: string;
  id: string;
  label: string;
  subtitle: string;
};


const formatTime = (iso: string | null): string => {
  if (!iso) {
    return '';
  }

  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDay = (iso: string | null): string => {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return formatTime(iso);
  }

  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

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

/** Подсвечивает в тексте сообщения упоминания и делает их ссылками на карточки. */
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

const TIP_LABEL: Record<string, string> = {
  KLIENT: 'Клиент',
  SDELKA: 'Сделка',
  LICHNY: 'Личный',
  ZADACHA: 'Задача',
};

/**
 * Диалог, который нужно открыть сразу (приходят из уведомления: `/page/<id>?chatId=<chatId>`).
 * Берём только uuid — мусор в адресе игнорируем.
 */
const readChatIdFromUrl = (): string | null => {
  try {
    const search = typeof location === 'undefined' ? '' : location.search;

    if (!search) {
      return null;
    }

    const value = new URLSearchParams(search).get('chatId');

    return value && /^[0-9a-fA-F-]{36}$/.test(value) ? value : null;
  } catch {
    return null;
  }
};

type MemberOption = { id: string; name: string };

const ChatCenter = () => {
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [pendingMentions, setPendingMentions] = useState<MentionView[]>([]);
  const [caretTarget, setCaretTarget] = useState<number | null>(null);
  const [initialChatId] = useState<string | null>(() => readChatIdFromUrl());
  // «Мои диалоги» — только личные; чаты сделок и задач прячем за включателем.
  const [showAllChats, setShowAllChats] = useState(false);
  // Две ленты: внутренние чаты сотрудников и переписка с клиентами по каналам.
  const [section, setSection] = useState<'vnutrennie' | 'klienty'>('vnutrennie');

  // Фильтры клиентской ленты: поиск по клиенту, канал и сделка.
  const [dialogSearch, setDialogSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [dealFilter, setDealFilter] = useState<string>('all');
  const [threadDeals, setThreadDeals] = useState<
    { id: string; name: string; count: number; kind?: string; recordId?: string }[]
  >([]);
  // Привязка сообщения к записи: открытый редактор, поиск и его результаты.
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState<LinkResult[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);
  // Экраны центра: сами диалоги или подключение своих каналов.
  const [view, setView] = useState<'chats' | 'channels'>('chats');
  // Создание личного диалога: выбираем сотрудника из списка.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const activeChatIdRef = useRef<string | null>(null);
  const socketRef = useRef<ChatSocketHandle | null>(null);

  // Поле ввода принадлежит хосту: чтобы вернуть каретку после подмены текста,
  // пишем значение и позицию прямо в его DOM-узел через мост remote-dom.
  const composerRef = useRef<any>(null);
  const suppressRef = useRef<{ until: number; expected: string; caret: number } | null>(null);

  // Хост после подмены значения возвращает каретку на прежнее место (несколько
  // раз, с задержкой), поэтому позицию приходится настойчиво переустанавливать.
  const caretSeqRef = useRef(0);

  activeChatIdRef.current = activeChatId;

  const loadDialogs = useCallback(async () => {
    const result = await callRoute<DialogsResponse>('/chat-dialogs');
    const freshDialogs = result.dialogs ?? [];

    setMyMemberId(result.me);
    setDialogs(freshDialogs);

    return freshDialogs;
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    const result = await callRoute<MessagesResponse>(
      `/chat-messages?chatId=${encodeURIComponent(chatId)}`,
    );

    setMessages(result.messages ?? []);
  }, []);

  const loadThreadDeals = useCallback(async (chatId: string) => {
    try {
      const result = await callRoute<{
        deals: { id: string; name: string; count: number; kind?: string; recordId?: string }[];
      }>(`/chat-thread-deals?chatId=${encodeURIComponent(chatId)}`);

      setThreadDeals(result.deals ?? []);
    } catch {
      setThreadDeals([]);
    }
  }, []);

  /** Добавить или снять связь сообщения, затем перечитать ленту и лейблы. */
  const changeLink = useCallback(
    async (
      action: 'add' | 'remove',
      payload: {
        messageId: string;
        kind?: string;
        recordId?: string;
        targetId?: string;
      },
    ) => {
      setLinkBusy(true);

      try {
        await callRoute(action === 'add' ? '/chat-link-add' : '/chat-link-remove', {
          method: 'POST',
          body: payload,
        });

        const chatId = activeChatIdRef.current;

        if (chatId) {
          await loadMessages(chatId);
          await loadThreadDeals(chatId);
        }

        setLinkFor(null);
        setLinkQuery('');
        setLinkResults([]);
      } finally {
        setLinkBusy(false);
      }
    },
    [loadMessages, loadThreadDeals],
  );

  const markRead = useCallback(async (chatId: string) => {
    await callRoute('/chat-read', { method: 'POST', body: { chatId } });

    setDialogs((previous) =>
      previous.map((dialog) => (dialog.id === chatId ? { ...dialog, unread: 0 } : dialog)),
    );
  }, []);

  const refresh = useCallback(async () => {
    const freshDialogs = await loadDialogs();
    const activeId = activeChatIdRef.current;

    if (!activeId) {
      return;
    }

    await loadMessages(activeId);

    // Отмечаем присутствие: пока диалог открыт, пуш о новом сообщении не нужен.
    void callRoute('/chat-presence', { method: 'POST', body: { chatId: activeId } }).catch(
      () => undefined,
    );

    // Диалог открыт — входящие считаются прочитанными сразу, счётчик не копится.
    const activeDialog = freshDialogs.find((dialog) => dialog.id === activeId);

    if ((activeDialog?.unread ?? 0) > 0) {
      await markRead(activeId);
    }
  }, [loadDialogs, loadMessages, markRead]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const freshDialogs = await loadDialogs();
        const exists = (chatId: string | null) =>
          !!chatId && freshDialogs.some((dialog) => dialog.id === chatId);

        // Адрес страницы до компонента не доходит (блоб-iframe), поэтому пришли ли
        // мы по уведомлению — спрашиваем сервер. Ошибку запроса сюда не пускаем:
        // страница должна открыться даже если подсказка недоступна.
        let target: string | null = exists(initialChatId) ? initialChatId : null;

        if (!target) {
          try {
            const hint = await callRoute<{ chatId: string | null }>('/chat-open-target');

            target = exists(hint.chatId) ? hint.chatId : null;
          } catch {
            target = null;
          }
        }

        if (target) {
          setActiveChatId(target);
        }
      } catch (caughtError) {
        setError((caughtError as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, [loadDialogs, initialChatId]);

  useEffect(() => {
    // Подстраховка к /chat-open-target: страница-обёртка знает ?chatId
    // и пересылает его сюда через postMessage.
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; chatId?: string } | null;

      if (data && data.type === 'crm-open-chat' && data.chatId) {
        setActiveChatId(data.chatId);
      }
    };

    window.addEventListener('message', onMessage);

    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void refresh().catch((caughtError) => setError((caughtError as Error).message));
    }, 20000);

    return () => clearInterval(timer);
  }, [refresh]);

  // Присутствие: пока диалог открыт и вкладка видна, пуш и счётчик не нужны.
  // Отдельный короткий такт — данные не перечитываем, только отмечаемся.
  useEffect(() => {
    const beat = () => {
      const chatId = activeChatIdRef.current;

      if (!chatId) {
        return;
      }

      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      void callRoute('/chat-presence', { method: 'POST', body: { chatId } }).catch(() => undefined);
    };

    const leave = () => {
      const chatId = activeChatIdRef.current;

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

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);

      return;
    }

    void loadMessages(activeChatId).catch((caughtError) =>
      setError((caughtError as Error).message),
    );
    void markRead(activeChatId).catch(() => undefined);
  }, [activeChatId, loadMessages, markRead]);

  // Живой канал: событие по чату приходит мгновенно, опрос — страховка.
  useEffect(() => {
    let disposed = false;

    void callRoute<{ userId: string | null }>('/chat-me')
      .then((me) => {
        if (disposed) {
          return;
        }

        const userId = String(me.userId ?? '');

        if (!userId) {
          return;
        }

        socketRef.current = connectChatSocket(envFunctionsBase(), userId, {
          onChat: (chatId) => {
            if (chatId === activeChatIdRef.current) {
              void loadMessages(chatId).catch(() => undefined);
              void markRead(chatId).catch(() => undefined);

              return;
            }

            void loadDialogs().catch(() => undefined);
          },
          onAny: () => {
            void loadDialogs().catch(() => undefined);
          },
        });
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [loadDialogs, loadMessages, markRead]);

  // Какой диалог открыт — сообщаем сокету: уход снимается сразу при разрыве.
  useEffect(() => {
    socketRef.current?.setChat(activeChatId);
  }, [activeChatId]);

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

  // Вставка текста в поле хоста: пишем значение и сразу ставим каретку в конец
  // вставленного. Браузер сам по себе оставляет курсор в начале строки.
  const applyDraft = (value: string, caret: number) => {
    suppressRef.current = { until: Date.now() + 500, expected: value, caret };
    setDraft(value);
    setCaretTarget(caret);

    caretSeqRef.current += 1;

    const seq = caretSeqRef.current;
    let attempts = 0;

    const write = () => {
      if (caretSeqRef.current !== seq) {
        return false;
      }

      const node = composerRef.current;

      if (!node) {
        return true;
      }

      try {
        // Пишем без сравнений: чтение из моста может возвращать не состояние хоста.
        node.value = value;

        if (typeof node.setSelectionRange === 'function') {
          node.setSelectionRange(caret, caret);
        }

        node.selectionStart = caret;
        node.selectionEnd = caret;
        node.focus?.();
      } catch {
        // песочница не даёт доступа к узлу
      }

      return true;
    };

    const timer = setInterval(() => {
      attempts += 1;

      if (!write() || attempts >= 25) {
        clearInterval(timer);
      }
    }, 100);
  };

  const renderHighlightedDraft = () => {
    if (pendingMentions.length === 0 || draft.length === 0) {
      return draft;
    }

    const labels = pendingMentions.map((mention) => `@${mention.label}`).sort(
      (left, right) => right.length - left.length,
    );
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
    const inserted = `${before}@${suggestion.label} ${after}`;
    // Курсор после выбора — в конец текста, а не сразу за вставленной ссылкой.
    const caret = inserted.length;

    applyDraft(inserted, caret);

    setMentionQuery(null);
    setSuggestions([]);
    setMentionIndex(0);

    setPendingMentions((previous) => {
      const key = `${suggestion.type}:${suggestion.id}`;

      if (previous.some((item) => `${item.type}:${item.id}` === key)) {
        return previous;
      }

      return [
        ...previous,
        { type: suggestion.type, id: suggestion.id, label: suggestion.label },
      ];
    });
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
        .then((result) => {
          if (!cancelled) {
            setSuggestions(result.suggestions ?? []);
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

  const sendMessage = async () => {
    const text = draft.trim();

    if (!text || !activeChatId || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await callRoute('/chat-send', {
        method: 'POST',
        body: { chatId: activeChatId, text, mentions: pendingMentions },
      });

      setDraft('');
      setPendingMentions([]);
      await Promise.all([loadMessages(activeChatId), loadDialogs()]);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setMemberQuery('');
    setError(null);

    if (members.length > 0) {
      return;
    }

    try {
      const result = await callRoute<{ members: MemberOption[] }>('/chat-members');
      setMembers(result.members ?? []);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    }
  };

  const startPersonalChat = async (memberId: string) => {
    if (isCreating) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const result = await callRoute<{ chatId: string }>('/chat-personal-create', {
        method: 'POST',
        body: { memberId },
      });

      await loadDialogs();
      setPickerOpen(false);
      setShowAllChats(false);

      if (result.chatId) {
        setActiveChatId(result.chatId);
      }
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const activeChat = dialogs.find((dialog) => dialog.id === activeChatId) ?? null;

  // Сделки этой переписки — для фильтра ленты. У внутренних диалогов их нет.
  useEffect(() => {
    if (!activeChatId || activeChat?.tip !== 'KLIENT') {
      setThreadDeals([]);
      setDealFilter('all');

      return;
    }

    void loadThreadDeals(activeChatId);
  }, [activeChatId, activeChat?.tip, loadThreadDeals]);

  // Поиск записи для привязки — с задержкой, чтобы не дёргать сервер на каждую букву.
  useEffect(() => {
    if (!linkFor) return;

    const query = linkQuery.trim();

    if (query.length < 2) {
      setLinkResults([]);

      return;
    }

    let alive = true;

    const timer = setTimeout(() => {
      void callRoute<{ results: LinkResult[] }>(
        `/chat-link-search?q=${encodeURIComponent(query)}`,
      )
        .then((result) => {
          if (alive) setLinkResults(result.results ?? []);
        })
        .catch(() => {
          if (alive) setLinkResults([]);
        });
    }, 250);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [linkFor, linkQuery]);

  const visibleMessages =
    dealFilter === 'all'
      ? messages
      : messages.filter((message) => (message.svyazkaIds ?? []).includes(dealFilter));

  // Открыли чат сделки по ссылке из уведомления — показываем полный список,
  // иначе выбранного диалога не видно в колонке.
  useEffect(() => {
    if (!activeChat) return;

    if (activeChat.tip === 'KLIENT') {
      setSection('klienty');
      return;
    }

    if (activeChat.tip !== 'LICHNY') {
      setShowAllChats(true);
    }
  }, [activeChat]);

  const hiddenCount = showAllChats
    ? 0
    : dialogs.filter((dialog) => dialog.tip !== 'KLIENT' && dialog.tip !== 'LICHNY').length;

  const clientDialogs = dialogs.filter((dialog) => dialog.tip === 'KLIENT');
  const clientChannels = [...new Set(clientDialogs.map((dialog) => dialog.kanal).filter(Boolean))] as string[];
  const searchValue = dialogSearch.trim().toLowerCase();

  const visibleDialogs =
    section === 'klienty'
      ? clientDialogs.filter((dialog) => {
          const byChannel = channelFilter === 'all' || dialog.kanal === channelFilter;
          const bySearch = searchValue.length === 0 || (dialog.name ?? '').toLowerCase().includes(searchValue);

          return byChannel && bySearch;
        })
      : showAllChats
        ? dialogs.filter((dialog) => dialog.tip !== 'KLIENT')
        : dialogs.filter((dialog) => dialog.tip === 'LICHNY');

  if (isLoading) {
    return <div style={{ padding: '24px', color: '#888' }}>Загружаю диалоги…</div>;
  }

  if (view === 'channels') {
    return (
      <div
        style={{
          display: 'flex',
          height: 'calc(100vh - 96px)',
          minHeight: 0,
          overflow: 'hidden',
          boxSizing: 'border-box',
          background: '#fafafa',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#333',
        }}
      >
        <ChannelsPanel onClose={() => setView('chats')} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        // Высота экрана минус шапка Twenty; страница не прокручивается.
        height: 'calc(100vh - 96px)',
        minHeight: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#333',
      }}
    >
      <div
        style={{
          width: '300px',
          flexShrink: 0,
          borderRight: '1px solid #e8e8e8',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          background: '#fafafa',
        }}
      >
        <div style={{ padding: '14px 12px 8px' }}>
          <div
            style={{
              display: 'flex',
              background: '#ececec',
              borderRadius: '8px',
              padding: '2px',
              gap: '2px',
            }}
          >
            {(
              [
                { key: 'vnutrennie', label: 'Внутренние' },
                { key: 'klienty', label: 'Клиенты' },
              ] as const
            ).map((tab) => {
              const active = section === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setSection(tab.key);
                    setShowAllChats(false);
                  }}
                  style={{
                    flex: 1,
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    background: active ? '#ffffff' : 'transparent',
                    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    fontWeight: active ? 600 : 500,
                    fontSize: '13px',
                    color: active ? '#222' : '#666',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {section === 'klienty' && (
          <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              value={dialogSearch}
              onChange={(event) => setDialogSearch(event.target.value)}
              placeholder="Поиск клиента или номера"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid #dcdcdc',
                borderRadius: '6px',
                padding: '6px 9px',
                fontSize: '12px',
                background: '#fff',
              }}
            />

            {clientChannels.length > 1 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {['all', ...clientChannels].map((channel) => {
                  const active = channelFilter === channel;

                  return (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => setChannelFilter(channel)}
                      style={{
                        border: '1px solid ' + (active ? '#1961ff' : '#e0e0e0'),
                        background: active ? '#eef3ff' : '#fff',
                        color: active ? '#1961ff' : '#666',
                        borderRadius: '12px',
                        padding: '2px 9px',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      {channel === 'all' ? 'Все каналы' : channel}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {section === 'vnutrennie' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '0 12px 8px',
            }}
          >
            <button
              type="button"
              onClick={() => void openPicker()}
              style={{
                border: '1px solid #d6d6d6',
                background: '#ffffff',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                color: '#333',
                cursor: 'pointer',
              }}
            >
              Новый чат
            </button>
          </div>
        )}

        {section === 'vnutrennie' && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 16px 10px',
            fontSize: '12px',
            color: '#777',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={showAllChats}
            onChange={(event) => setShowAllChats(event.target.checked)}
            style={{ margin: 0, cursor: 'pointer' }}
          />
          <span>
            Все чаты
            {hiddenCount > 0 && !showAllChats ? ` (скрыто ${hiddenCount})` : ''}
          </span>
        </label>
        )}

        {error && (
          <div
            style={{
              margin: '0 12px 8px',
              padding: '6px 8px',
              background: '#fdecea',
              color: '#c03b2c',
              fontSize: '11px',
              borderRadius: '6px',
              wordBreak: 'break-word',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {pickerOpen && (
            <div style={{ padding: '0 12px 12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <span style={{ fontSize: '12px', color: '#666' }}>Кому написать</span>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#1961ff',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Отмена
                </button>
              </div>

              <input
                type="text"
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                placeholder="Поиск сотрудника"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 8px',
                  fontSize: '12px',
                  border: '1px solid #dcdcdc',
                  borderRadius: '6px',
                  outline: 'none',
                  marginBottom: '6px',
                }}
              />

              {members
                .filter((member) =>
                  member.name.toLowerCase().includes(memberQuery.trim().toLowerCase()),
                )
                .map((member) => (
                  <div
                    key={member.id}
                    onClick={() => void startPersonalChat(member.id)}
                    style={{
                      padding: '8px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      cursor: isCreating ? 'default' : 'pointer',
                      color: isCreating ? '#999' : '#333',
                    }}
                  >
                    {member.name}
                  </div>
                ))}

              {members.length === 0 && (
                <div style={{ fontSize: '12px', color: '#999', padding: '8px' }}>
                  Загружаю сотрудников…
                </div>
              )}
            </div>
          )}

          {!pickerOpen && visibleDialogs.length === 0 && (
            <div style={{ padding: '16px', fontSize: '13px', color: '#999' }}>
              {dialogs.length === 0
                ? 'У вас пока нет диалогов'
                : 'Нет личных диалогов. Чаты сделок — включите «Все чаты».'}
            </div>
          )}

          {!pickerOpen &&
            visibleDialogs.map((dialog) => {
            const isActive = dialog.id === activeChatId;

            return (
              <div
                key={dialog.id}
                onClick={() => setActiveChatId(dialog.id)}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  background: isActive ? '#ffffff' : 'transparent',
                  borderLeft: isActive ? '3px solid #1961ff' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: dialog.unread > 0 ? 600 : 500,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {dialog.kanal && dialog.kanal !== 'VNUTRENNIY' && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginRight: '6px',
                          padding: '0 5px',
                          borderRadius: '4px',
                          background: '#e8f0ff',
                          color: '#1961ff',
                          fontSize: '10px',
                          fontWeight: 600,
                          verticalAlign: 'middle',
                        }}
                      >
                        {dialog.kanal}
                      </span>
                    )}
                    {dialog.name || 'Без названия'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>
                    {formatDay(dialog.lastAt)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#999',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {dialog.lastMessage || `${TIP_LABEL[dialog.tip ?? ''] ?? 'Диалог'} · пусто`}
                  </span>

                  {dialog.unread > 0 && (
                    <span
                      style={{
                        minWidth: '18px',
                        height: '18px',
                        borderRadius: '9px',
                        background: '#1961ff',
                        color: '#fff',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 5px',
                      }}
                    >
                      {dialog.unread}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: '1px solid #e8e8e8', padding: '8px 12px' }}>
          <button
            type="button"
            onClick={() => setView('channels')}
            style={{
              width: '100%',
              border: '1px solid #d6d6d6',
              background: '#ffffff',
              borderRadius: '6px',
              padding: '6px 8px',
              fontSize: '12px',
              color: '#333',
              cursor: 'pointer',
            }}
          >
            Мои каналы
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        {!activeChat && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: '13px',
            }}
          >
            Выберите диалог слева
          </div>
        )}

        {activeChat && (
          <>
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #e8e8e8',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  {activeChat.name || 'Без названия'}
                </span>
                {activeChat.nomer && (
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '1px' }}>
                    {activeChat.kanal ? `${activeChat.kanal} · ` : ''}
                    {formatChannelPhone(activeChat.nomer)}
                  </div>
                )}
              </div>

              {threadDeals.length > 0 && (
                <select
                  value={dealFilter}
                  onChange={(event) => setDealFilter(event.target.value)}
                  style={{
                    marginLeft: 'auto',
                    border: '1px solid #dcdcdc',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    background: '#fff',
                    maxWidth: '260px',
                  }}
                >
                  <option value="all">Все сделки ({messages.length})</option>
                  {threadDeals.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.name} ({deal.count})
                    </option>
                  ))}
                </select>
              )}
              <span
                style={{
                  fontSize: '11px',
                  color: '#888',
                  border: '1px solid #e0e0e0',
                  borderRadius: '10px',
                  padding: '1px 8px',
                }}
              >
                {TIP_LABEL[activeChat.tip ?? ''] ?? 'Диалог'}
              </span>
            </div>

            <div
              onClick={() => setLinkFor(null)}
              style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: 0 }}
            >
              {visibleMessages.length === 0 && (
                <div style={{ fontSize: '13px', color: '#999' }}>
                  Сообщений пока нет — напишите первым
                </div>
              )}

              {visibleMessages.map((message) => {
                const isMine = message.authorId === myMemberId;

                return (
                  <div
                    key={message.id}
                    style={{
                      display: 'flex',
                      justifyContent: isMine ? 'flex-end' : 'flex-start',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ maxWidth: '70%' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#999',
                          textAlign: isMine ? 'right' : 'left',
                          marginBottom: '2px',
                        }}
                      >
                        {isMine ? 'Вы' : message.authorName} · {formatTime(message.createdAt)}
                      </div>
                      <div
                        style={{
                          background: isMine ? '#1961ff' : '#f1f1f1',
                          color: isMine ? '#fff' : '#333',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          lineHeight: '1.45',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {renderMentions(message.text, message.mentions)}
                      </div>

                      {message.napravlenie === 'ISHODYASHCHIE' && message.statusDostavki && (
                        <div
                          style={{
                            fontSize: '10px',
                            color: DELIVERY_LABEL[message.statusDostavki]?.color ?? '#999',
                            textAlign: 'right',
                            marginTop: '2px',
                          }}
                        >
                          {DELIVERY_LABEL[message.statusDostavki]?.text ?? message.statusDostavki}
                        </div>
                      )}

                      {/* Лейблы сделок — только в Центре коммуникации, в карточке
                          записи связи не показываем и не меняем. */}
                      {activeChat?.tip === 'KLIENT' && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '4px',
                            marginTop: '4px',
                            alignItems: 'center',
                            justifyContent: isMine ? 'flex-end' : 'flex-start',
                          }}
                        >
                          {(message.svyazkaIds ?? []).map((linkId) => {
                            const deal = threadDeals.find((item) => item.id === linkId);

                            return (
                              <span
                                key={linkId}
                                title={deal ? 'Открыть запись' : ''}
                                onClick={(event) => {
                                  event.stopPropagation();

                                  const objectNameSingular = deal?.kind
                                    ? OBJECT_BY_KIND[deal.kind]
                                    : '';

                                  if (!objectNameSingular || !deal?.recordId) return;

                                  void openSidePanelPage({
                                    page: SidePanelPages.ViewRecord,
                                    objectNameSingular,
                                    recordId: deal.recordId,
                                  }).catch(() => undefined);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#eef3ff',
                                  border: '1px solid #cddcff',
                                  color: '#1961ff',
                                  borderRadius: '10px',
                                  padding: '1px 6px',
                                  fontSize: '10px',
                                  cursor: deal?.recordId ? 'pointer' : 'default',
                                }}
                              >
                                {deal
                                  ? `${LINK_KIND_LABEL[deal.kind ?? ''] ?? ''} ${deal.name}`.trim()
                                  : 'Запись'}
                                <button
                                  type="button"
                                  title="Снять связь"
                                  disabled={linkBusy}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void changeLink('remove', {
                                      messageId: message.id,
                                      targetId: linkId,
                                    });
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#1961ff',
                                    cursor: linkBusy ? 'default' : 'pointer',
                                    padding: 0,
                                    fontSize: '11px',
                                    lineHeight: 1,
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}

                          {linkFor === message.id ? (
                            <span
                              onClick={(event) => event.stopPropagation()}
                              style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}
                            >
                              <input
                                autoFocus
                                value={linkQuery}
                                onChange={(event) => setLinkQuery(event.target.value)}
                                placeholder="номер или название"
                                style={{
                                  width: '190px',
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  border: '1px solid #cddcff',
                                  borderRadius: '8px',
                                  outline: 'none',
                                }}
                              />
                              {linkResults.map((item) => (
                                <button
                                  key={`${item.kind}:${item.recordId}`}
                                  type="button"
                                  disabled={linkBusy}
                                  onClick={() =>
                                    void changeLink('add', {
                                      messageId: message.id,
                                      kind: item.kind,
                                      recordId: item.recordId,
                                    })
                                  }
                                  style={{
                                    textAlign: 'left',
                                    border: '1px solid #e2e8f5',
                                    background: '#fff',
                                    borderRadius: '6px',
                                    padding: '2px 6px',
                                    fontSize: '10px',
                                    cursor: linkBusy ? 'default' : 'pointer',
                                  }}
                                >
                                  {item.label} · {item.title}
                                </button>
                              ))}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setLinkFor(message.id);
                                setLinkQuery('');
                                setLinkResults([]);
                              }}
                              style={{
                                border: '1px dashed #cddcff',
                                background: 'transparent',
                                color: '#1961ff',
                                borderRadius: '10px',
                                padding: '1px 6px',
                                fontSize: '10px',
                                cursor: 'pointer',
                              }}
                            >
                              + связь
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div style={{ padding: '0 20px 8px', fontSize: '12px', color: '#c03b2c' }}>
                {error}
              </div>
            )}

            <div style={{ borderTop: '1px solid #e8e8e8', padding: '12px 20px' }}>
              {mentionQuery !== null && suggestions.length > 0 && (
                <div
                  style={{
                    marginBottom: '8px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    background: '#fff',
                  }}
                >
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={`${suggestion.type}-${suggestion.id}`}
                      onClick={() => insertMention(suggestion)}
                      style={{
                        padding: '6px 10px',
                        cursor: 'pointer',
                        background: index === mentionIndex ? '#eef3ff' : 'transparent',
                        borderBottom: '1px solid #f4f4f4',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{suggestion.label}</div>
                      <div style={{ fontSize: '11px', color: '#999' }}>{suggestion.subtitle}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  {/* Слой подсветки: в поле ввода нельзя красить части текста,
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
                      color: '#333',
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
                      // раньше нашего — возвращаем вставленный текст и каретку.
                      if (guard && Date.now() < guard.until && value !== guard.expected) {
                        const node = composerRef.current;

                        try {
                          if (node) {
                            node.value = guard.expected;
                            node.selectionStart = guard.caret;
                            node.selectionEnd = guard.caret;
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
                      if (String(event.key ?? '').length === 1) {
                        caretSeqRef.current += 1;
                      }

                      if (mentionQuery !== null && suggestions.length > 0) {
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          setMentionIndex((previous) => (previous + 1) % suggestions.length);

                          return;
                        }

                        if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          setMentionIndex(
                            (previous) =>
                              (previous - 1 + suggestions.length) % suggestions.length,
                          );

                          return;
                        }

                        if (event.key === 'Enter') {
                          event.preventDefault();
                          insertMention(suggestions[mentionIndex]);

                          return;
                        }

                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setMentionQuery(null);
                          setSuggestions([]);

                          return;
                        }
                      }

                      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="Написать сообщение… (@ — упомянуть, Ctrl+Enter — отправить)"
                    {...({ selectionStart: caretTarget ?? undefined, selectionEnd: caretTarget ?? undefined } as any)}
                    rows={3}
                    style={{
                      position: 'relative',
                      width: '100%',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      minHeight: '64px',
                      background: 'transparent',
                      color: 'transparent',
                      caretColor: '#333',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      lineHeight: '18px',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  onClick={() => void sendMessage()}
                  disabled={isSending || draft.trim().length === 0}
                  style={{
                    background: isSending || draft.trim().length === 0 ? '#c9d6ff' : '#1961ff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px 16px',
                    fontSize: '13px',
                    cursor: isSending || draft.trim().length === 0 ? 'default' : 'pointer',
                  }}
                >
                  Отправить
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Центр коммуникации',
  description: 'Диалоги сотрудников: список диалогов, лента сообщений, отправка',
  component: ChatCenter,
});
