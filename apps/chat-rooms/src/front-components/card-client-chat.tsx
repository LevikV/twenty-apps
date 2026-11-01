import { useCallback, useEffect, useRef, useState } from 'react';

import { defineFrontComponent } from 'twenty-sdk/define';
import { useSelectedRecordIds } from 'twenty-sdk/front-component';

import { callRoute } from './chat-api';
import { CARD_CLIENT_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Переписка с клиентом в карточке сделки.
 *
 * Лента одна на клиента: здесь показывается весь диалог, без обрезки по сделке.
 * Сообщения, отправленные отсюда, помечаются связкой текущей сделки — по ней в
 * «Центре коммуникации» работает фильтр по сделке.
 */

type Message = {
  id: string;
  text: string | null;
  createdAt: string;
  authorName: string;
  napravlenie?: string | null;
  statusDostavki?: string | null;
};

type ThreadState = {
  chatId: string | null;
  nomer: string | null;
  reason?: string;
  messages: Message[];
};

const DELIVERY: Record<string, { text: string; color: string }> = {
  OTPRAVLYAETSYA: { text: 'отправляется', color: '#999' },
  OTPRAVLENO: { text: 'отправлено', color: '#999' },
  DOSTAVLENO: { text: 'доставлено', color: '#1a7f37' },
  OSHIBKA: { text: 'не отправлено', color: '#c03b2c' },
};

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatPhone = (value: string | null): string => {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (digits.length !== 10) return '';

  return `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
};

const ClientChat = () => {
  const recordIds = useSelectedRecordIds();
  const recordId = recordIds.length === 1 ? recordIds[0] : null;

  const [thread, setThread] = useState<ThreadState | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!recordId) return;

    try {
      const result = await callRoute<ThreadState>(
        `/chat-client-thread?recordId=${encodeURIComponent(recordId)}`,
      );
      setThread(result);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, [recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages.length]);

  const send = async () => {
    const text = draft.trim();

    if (!text || !recordId) return;

    setIsSending(true);
    setError(null);

    try {
      await callRoute('/chat-client-send', { method: 'POST', body: { recordId, text } });
      setDraft('');
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  if (!recordId) {
    return <div style={{ padding: '12px', color: '#888', fontSize: '12px' }}>Выберите запись</div>;
  }

  if (!thread) {
    return <div style={{ padding: '12px', color: '#888', fontSize: '12px' }}>Загружаю переписку…</div>;
  }

  if (!thread.chatId) {
    return (
      <div style={{ padding: '12px', color: '#888', fontSize: '12px' }}>
        {thread.reason ?? 'Переписки с клиентом ещё нет'}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '420px',
        border: '1px solid #e6e6e6',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#fff',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #eee', fontSize: '12px', color: '#666' }}>
        SMS{thread.nomer ? ` · ${formatPhone(thread.nomer)}` : ''}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {thread.messages.length === 0 && (
          <div style={{ fontSize: '12px', color: '#999' }}>Сообщений пока нет</div>
        )}

        {thread.messages.map((message) => {
          const mine = message.napravlenie === 'ISHODYASHCHIE';

          return (
            <div
              key={message.id}
              style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: '8px' }}
            >
              <div style={{ maxWidth: '78%' }}>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#999',
                    textAlign: mine ? 'right' : 'left',
                    marginBottom: '2px',
                  }}
                >
                  {mine ? 'Вы' : 'Клиент'} · {formatTime(message.createdAt)}
                </div>
                <div
                  style={{
                    background: mine ? '#1961ff' : '#f1f1f1',
                    color: mine ? '#fff' : '#333',
                    padding: '7px 11px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    lineHeight: '1.45',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {message.text}
                </div>

                {mine && message.statusDostavki && (
                  <div
                    style={{
                      fontSize: '10px',
                      color: DELIVERY[message.statusDostavki]?.color ?? '#999',
                      textAlign: 'right',
                      marginTop: '2px',
                    }}
                  >
                    {DELIVERY[message.statusDostavki]?.text ?? message.statusDostavki}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{ padding: '0 12px 6px', fontSize: '11px', color: '#c03b2c' }}>{error}</div>
      )}

      <div style={{ borderTop: '1px solid #eee', padding: '10px 12px', display: 'flex', gap: '8px' }}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Ответить клиенту…"
          style={{
            flex: 1,
            border: '1px solid #d6d6d6',
            borderRadius: '6px',
            padding: '7px 10px',
            fontSize: '13px',
          }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={isSending || !draft.trim()}
          style={{
            border: 'none',
            borderRadius: '6px',
            background: isSending || !draft.trim() ? '#9bb8ff' : '#1961ff',
            color: '#fff',
            padding: '7px 14px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isSending || !draft.trim() ? 'default' : 'pointer',
          }}
        >
          Отправить
        </button>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: CARD_CLIENT_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Переписка с клиентом',
  description: 'SMS-переписка с клиентом сделки: лента и ответ',
  component: ClientChat,
});
