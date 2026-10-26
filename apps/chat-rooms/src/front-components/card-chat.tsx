import { useCallback, useEffect, useRef, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useSelectedRecordIds } from 'twenty-sdk/front-component';

import { CARD_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Чат в карточке записи (Заказ, Ремонт, Тендер, Заправка, Задача).
 *
 * Комната создаётся при первой отправке: до этого показываем приглашение.
 * Читать и писать может любой, у кого есть доступ к записи; написавший
 * становится участником. Участников набирает сервер (`chat-record-send`).
 */

type Message = {
  id: string;
  text: string | null;
  createdAt: string;
  authorName: string;
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

export const CardChat = () => {
  const recordIds = useSelectedRecordIds();
  const recordId = recordIds.length === 1 ? recordIds[0] : null;

  const [room, setRoom] = useState<RoomState | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const draftRef = useRef(draft);

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
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [recordId]);

  useEffect(() => {
    void reload();

    const timer = window.setInterval(() => {
      if (draftRef.current.trim().length === 0) {
        void reload();
      }
    }, 10000);

    return () => window.clearInterval(timer);
  }, [reload]);

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
        body: { recordId, text },
      });
      setDraft('');
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
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Написать в обсуждение… (Enter — отправить)"
          rows={2}
          style={{
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
          }}
        />

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
