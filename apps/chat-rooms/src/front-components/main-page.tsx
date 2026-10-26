import { useCallback, useEffect, useRef, useState } from 'react';
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

const env = (globalThis as unknown as { process?: { env?: Record<string, string> } })
  .process?.env ?? {};
const FUNCTIONS_BASE = (env.TWENTY_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
const APP_TOKEN = env.TWENTY_APP_ACCESS_TOKEN ?? '';

const callRoute = async <T,>(
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: unknown },
): Promise<T> => {
  const method = init?.method ?? 'GET';
  const url =
    method === 'GET'
      ? `${FUNCTIONS_BASE}${path}${path.includes('?') ? '&' : '?'}_ts=${Date.now()}`
      : `${FUNCTIONS_BASE}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${APP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    ...(method === 'POST' ? { body: JSON.stringify(init?.body ?? {}) } : {}),
  });

  const text = await response.text();
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
  const [initialChatId] = useState<string | null>(() => readChatIdFromUrl());

  const activeChatIdRef = useRef<string | null>(null);

  activeChatIdRef.current = activeChatId;

  const loadDialogs = useCallback(async () => {
    const diag = typeof location === 'undefined' ? 'no-location' : location.href;

    const result = await callRoute<DialogsResponse>(
      `/chat-dialogs?diag=${encodeURIComponent(diag)}`,
    );
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

        // Пришли по уведомлению — сразу открываем нужный диалог.
        if (initialChatId && freshDialogs.some((dialog) => dialog.id === initialChatId)) {
          setActiveChatId(initialChatId);
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
    const timer = setInterval(() => {
      void refresh().catch((caughtError) => setError((caughtError as Error).message));
    }, 10000);

    return () => clearInterval(timer);
  }, [refresh]);

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

  const insertMention = (suggestion: MentionSuggestion) => {
    if (mentionStart < 0) {
      return;
    }

    const before = draft.slice(0, mentionStart);
    const after = draft.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));

    // В поле ввода — обычный текст «@Подпись»; привязка к записи живёт в состоянии
    // и уходит на сервер вместе с сообщением.
    setDraft(`${before}@${suggestion.label} ${after}`);
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

  const activeChat = dialogs.find((dialog) => dialog.id === activeChatId) ?? null;

  if (isLoading) {
    return <div style={{ padding: '24px', color: '#888' }}>Загружаю диалоги…</div>;
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minHeight: '520px',
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
          background: '#fafafa',
        }}
      >
        <div style={{ padding: '16px 16px 8px', fontWeight: 600, fontSize: '14px' }}>
          Диалоги
        </div>

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

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {dialogs.length === 0 && (
            <div style={{ padding: '16px', fontSize: '13px', color: '#999' }}>
              У вас пока нет диалогов
            </div>
          )}

          {dialogs.map((dialog) => {
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
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
              <span style={{ fontSize: '14px', fontWeight: 600 }}>
                {activeChat.name || 'Без названия'}
              </span>
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

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {messages.length === 0 && (
                <div style={{ fontSize: '13px', color: '#999' }}>
                  Сообщений пока нет — напишите первым
                </div>
              )}

              {messages.map((message) => {
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
                      onMouseDown={(event) => event.preventDefault()}
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
                <textarea
                  value={draft}
                  onChange={(event) => {
                    const value = event.target.value;

                    setDraft(value);
                    updateMentionState(value);
                  }}
                  onKeyDown={(event) => {
                    if (mentionQuery !== null && suggestions.length > 0) {
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
                        event.preventDefault();
                        setMentionQuery(null);
                        setSuggestions([]);

                        return;
                      }
                    }

                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Написать сообщение… (@ — упомянуть)"
                  rows={2}
                  style={{
                    flex: 1,
                    resize: 'none',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
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
