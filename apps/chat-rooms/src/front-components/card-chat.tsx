import { useCallback, useEffect, useRef, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { SidePanelPages, openSidePanelPage, useSelectedRecordIds } from 'twenty-sdk/front-component';

import { CARD_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

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
};

type MentionView = { type: string; id: string; label: string };

type MentionSuggestion = {
  type: string;
  id: string;
  label: string;
  subtitle: string;
};

type RoomState = {
  chatId: string | null;
  name: string;
  tip: string | null;
  member: boolean;
  messages: Message[];
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
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [pendingMentions, setPendingMentions] = useState<MentionView[]>([]);

  const draftRef = useRef(draft);
  const roomRef = useRef<RoomState | null>(null);
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

      setRoom(state);
      roomRef.current = state;
      setError(null);

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

  useEffect(() => {
    void reload();

    const timer = setInterval(() => {
      if (draftRef.current.trim().length === 0) {
        void reload();
      }
    }, 10000);

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

    const timer = setInterval(beat, 5000);

    return () => clearInterval(timer);
  }, []);

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

  const popupOpen = mentionQuery !== null && suggestions.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        height: '100%',
        minHeight: '260px',
        fontFamily: 'Inter, sans-serif',
        color: '#1a1a1a',
      }}
    >
      {error && (
        <div style={{ background: '#fdecec', border: '1px solid #f3c2c2', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: '#a83232' }}>
          {error}
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
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

        {room?.messages.map((message) => (
          <div key={message.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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

            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Написать в обсуждение… (Enter — отправить, @ — упомянуть)"
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

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
