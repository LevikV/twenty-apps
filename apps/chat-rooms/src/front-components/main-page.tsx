import { useCallback, useEffect, useRef, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useUserId } from 'twenty-sdk/front-component';

import { MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

type Chat = {
  id: string;
  name: string;
  tip: string;
  vremyaPoslednego: string | null;
  posledneeSoobshchenie: string | null;
};

type Participant = {
  id: string;
  chatId: string;
  neprochitano: number | null;
  prochitanoDo: string | null;
};

type Message = {
  id: string;
  tekst: string | null;
  createdAt: string;
  avtorId: string | null;
  chatId: string;
};

type WorkspaceMember = {
  id: string;
  name?: string | { firstName?: string; lastName?: string } | null;
};

const env = (globalThis as unknown as { process?: { env?: Record<string, string> } })
  .process?.env ?? {};
const API_BASE = (
  env.TWENTY_API_URL ||
  (globalThis as unknown as { location?: { origin?: string } }).location?.origin ||
  ''
).replace(/\/+$/, '');
const APP_TOKEN = env.TWENTY_APP_ACCESS_TOKEN ?? '';

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${APP_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  return (await response.json()) as T;
};

const memberName = (member?: WorkspaceMember | null): string => {
  if (!member?.name) {
    return 'Сотрудник';
  }

  if (typeof member.name === 'string') {
    return member.name;
  }

  return [member.name.firstName, member.name.lastName].filter(Boolean).join(' ') || 'Сотрудник';
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

  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return formatTime(iso);
  }

  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

const TIP_LABEL: Record<string, string> = {
  KLIENT: 'Клиент',
  SDELKA: 'Сделка',
  LICHNY: 'Личный',
};

const ChatCenter = () => {
  const userId = useUserId();

  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [members, setMembers] = useState<Record<string, string>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const activeChatIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  activeChatIdRef.current = activeChatId;

  const loadMembers = useCallback(async () => {
    const result = await request<{ data: { workspaceMembers: WorkspaceMember[] } }>(
      '/rest/workspaceMembers?select=id,name&limit=60',
    );

    const map: Record<string, string> = {};

    for (const member of result.data.workspaceMembers) {
      map[member.id] = memberName(member);
    }

    setMembers(map);
  }, []);

  const loadDialogs = useCallback(
    async (memberId: string) => {
      const participantResult = await request<{ data: { chatParticipants: Participant[] } }>(
        `/rest/chatParticipants?filter=polzovatelId[eq]:${memberId}&select=id,chatId,neprochitano,prochitanoDo&limit=60`,
      );

      const myParticipants = participantResult.data.chatParticipants ?? [];

      if (myParticipants.length === 0) {
        setParticipants([]);
        setChats([]);

        return;
      }

      const ids = myParticipants.map((participant) => participant.chatId).join(',');

      const chatResult = await request<{ data: { chats: Chat[] } }>(
        `/rest/chats?filter=id[in]:[${ids}]&select=id,name,tip,vremyaPoslednego,posledneeSoobshchenie&limit=60`,
      );

      const sortedChats = [...(chatResult.data.chats ?? [])].sort((left, right) => {
        const leftTime = left.vremyaPoslednego ?? '';
        const rightTime = right.vremyaPoslednego ?? '';

        return rightTime.localeCompare(leftTime);
      });

      setParticipants(myParticipants);
      setChats(sortedChats);
    },
    [],
  );

  const loadMessages = useCallback(async (chatId: string) => {
    const result = await request<{ data: { soobshcheniya: Message[] } }>(
      `/rest/soobshcheniya?filter=chatId[eq]:${chatId}&select=id,tekst,createdAt,avtorId,chatId&limit=60`,
    );

    const sorted = [...(result.data.soobshcheniya ?? [])].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );

    setMessages(sorted);
  }, []);

  const markRead = useCallback(async (chatId: string) => {
    const result = await request<{ data: { chatParticipants: Participant[] } }>(
      `/rest/chatParticipants?filter=chatId[eq]:${chatId}&select=id,polzovatelId,neprochitano&limit=60`,
    );

    const me = result.data.chatParticipants?.find(
      (participant) =>
        (participant as unknown as { polzovatelId?: string }).polzovatelId === undefined
          ? false
          : (participant as unknown as { polzovatelId?: string }).polzovatelId === myMemberId,
    );

    if (!me || (me.neprochitano ?? 0) === 0) {
      return;
    }

    await request(`/rest/chatParticipants/${me.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ neprochitano: 0, prochitanoDo: new Date().toISOString() }),
    });

    setParticipants((previous) =>
      previous.map((participant) =>
        participant.id === me.id ? { ...participant, neprochitano: 0 } : participant,
      ),
    );
  }, [myMemberId]);

  const refresh = useCallback(async () => {
    if (!myMemberId) {
      return;
    }

    await loadDialogs(myMemberId);

    if (activeChatIdRef.current) {
      await loadMessages(activeChatIdRef.current);
    }
  }, [loadDialogs, loadMessages, myMemberId]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        if (!userId) {
          return;
        }

        const result = await request<{ data: { workspaceMembers: WorkspaceMember[] } }>(
          `/rest/workspaceMembers?filter=userId[eq]:${userId}&select=id,name&limit=1`,
        );

        const me = result.data.workspaceMembers?.[0];

        if (!me) {
          setError('Не нашёл вашу учётную запись в пространстве');

          return;
        }

        setMyMemberId(me.id);

        await Promise.all([loadMembers(), loadDialogs(me.id)]);
      } catch (caughtError) {
        setError((caughtError as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, [loadDialogs, loadMembers, userId]);

  useEffect(() => {
    if (!myMemberId) {
      return;
    }

    const timer = setInterval(() => {
      void refresh().catch((caughtError) => setError((caughtError as Error).message));
    }, 10000);

    return () => clearInterval(timer);
  }, [myMemberId, refresh]);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const sendMessage = async () => {
    const text = draft.trim();

    if (!text || !activeChatId || !myMemberId || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await request('/rest/soobshcheniya', {
        method: 'POST',
        body: JSON.stringify({
          chatId: activeChatId,
          tekst: text,
          avtorId: myMemberId,
          napravlenie: 'ISHODYASHCHIE',
          statusDostavki: 'DOSTAVLENO',
        }),
      });

      await request(`/rest/chats/${activeChatId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          vremyaPoslednego: new Date().toISOString(),
          posledneeSoobshchenie: text.slice(0, 120),
        }),
      });

      const participantResult = await request<{
        data: { chatParticipants: (Participant & { polzovatelId: string })[] };
      }>(`/rest/chatParticipants?filter=chatId[eq]:${activeChatId}&select=id,polzovatelId,neprochitano&limit=60`);

      for (const participant of participantResult.data.chatParticipants ?? []) {
        if (participant.polzovatelId === myMemberId) {
          continue;
        }

        await request(`/rest/chatParticipants/${participant.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ neprochitano: (participant.neprochitano ?? 0) + 1 }),
        });
      }

      setDraft('');
      await Promise.all([loadMessages(activeChatId), loadDialogs(myMemberId)]);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  const unreadByChat = new Map(
    participants.map((participant) => [participant.chatId, participant.neprochitano ?? 0]),
  );

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;

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

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {chats.length === 0 && (
            <div style={{ padding: '16px', fontSize: '13px', color: '#999' }}>
              У вас пока нет диалогов
            </div>
          )}

          {chats.map((chat) => {
            const unread = unreadByChat.get(chat.id) ?? 0;
            const isActive = chat.id === activeChatId;

            return (
              <div
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
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
                      fontWeight: unread > 0 ? 600 : 500,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {chat.name || 'Без названия'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>
                    {formatDay(chat.vremyaPoslednego)}
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
                    {chat.posledneeSoobshchenie || `${TIP_LABEL[chat.tip] ?? 'Диалог'} · пусто`}
                  </span>

                  {unread > 0 && (
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
                      {unread}
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
                {TIP_LABEL[activeChat.tip] ?? 'Диалог'}
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {messages.length === 0 && (
                <div style={{ fontSize: '13px', color: '#999' }}>
                  Сообщений пока нет — напишите первым
                </div>
              )}

              {messages.map((message) => {
                const isMine = message.avtorId === myMemberId;

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
                        {isMine ? 'Вы' : members[message.avtorId ?? ''] ?? 'Сотрудник'} ·{' '}
                        {formatTime(message.createdAt)}
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
                        {message.tekst}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {error && (
              <div style={{ padding: '0 20px 8px', fontSize: '12px', color: '#c03b2c' }}>
                {error}
              </div>
            )}

            <div
              style={{
                borderTop: '1px solid #e8e8e8',
                padding: '12px 20px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-end',
              }}
            >
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Написать сообщение…"
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
