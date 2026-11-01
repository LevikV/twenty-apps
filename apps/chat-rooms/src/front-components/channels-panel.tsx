import { useCallback, useEffect, useState } from 'react';

import { callRoute } from './chat-api';

/**
 * «Мои каналы»: подключение своего телефона к CRM.
 *
 * Сотрудник ставит приложение SMS-шлюза, оно регистрируется на нашем сервере и
 * показывает логин и пароль устройства. Их вводим здесь — проверяем на сервере
 * и заводим канал. Номер не спрашиваем: он берётся из должности сотрудника,
 * чтобы клиентские SMS никогда не уходили с личного номера.
 */

type Channel = {
  id: string;
  name: string;
  nomer: string | null;
  status: string | null;
  deviceId: string | null;
  login: string | null;
  posledniyKontakt: string | null;
  limitVChas: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  NA_SVYAZI: 'На связи',
  NET_SVYAZI: 'Нет связи',
  OFFLINE: 'Не в сети',
};

const STATUS_COLOR: Record<string, string> = {
  NA_SVYAZI: '#1a7f37',
  NET_SVYAZI: '#b42318',
};

const formatPhone = (value: string | null): string => {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (digits.length !== 10) return value || '—';

  return `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
};

const formatSeen = (value: string | null): string => {
  if (!value) return 'не выходил на связь';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);

  if (minutes < 2) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours} ч назад`;

  return date.toLocaleDateString('ru-RU');
};

const card: React.CSSProperties = {
  border: '1px solid #e6e6e6',
  borderRadius: '10px',
  padding: '14px',
  background: '#fff',
};

const step = (number: number, text: string) => (
  <div key={number} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
    <span
      style={{
        flexShrink: 0,
        width: '20px',
        height: '20px',
        borderRadius: '10px',
        background: '#1961ff',
        color: '#fff',
        fontSize: '11px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {number}
    </span>
    <span style={{ fontSize: '13px', color: '#333', lineHeight: 1.5 }}>{text}</span>
  </div>
);

const CopyRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{ marginBottom: '8px' }}>
    <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>{label}</div>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <code
        style={{
          flex: 1,
          padding: '6px 8px',
          background: '#f6f6f6',
          borderRadius: '6px',
          fontSize: '12px',
          wordBreak: 'break-all',
        }}
      >
        {value || '—'}
      </code>
      <button
        type="button"
        onClick={() => void navigator.clipboard?.writeText(value)}
        style={{
          border: '1px solid #d6d6d6',
          background: '#fff',
          borderRadius: '6px',
          padding: '4px 8px',
          fontSize: '11px',
          cursor: 'pointer',
        }}
      >
        Копировать
      </button>
    </div>
  </div>
);

export const ChannelsPanel = ({ onClose }: { onClose: () => void }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [info, setInfo] = useState<{ serverAddress: string; privateToken: string } | null>(null);
  const [login, setLogin] = useState('');
  const [parol, setParol] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await callRoute<{ channels: Channel[] }>('/sms-channels');
      setChannels(result.channels ?? []);
    } catch (caught) {
      setError((caught as Error).message);
    }

    try {
      setInfo(await callRoute<{ serverAddress: string; privateToken: string }>('/sms-channel-info'));
    } catch {
      setInfo(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    setDone(null);

    try {
      const result = await callRoute<{ ok: boolean; error?: string; nomer?: string }>(
        '/sms-channel-connect',
        { method: 'POST', body: { login, parol } },
      );

      if (!result.ok) {
        setError(result.error ?? 'Не удалось подключить');
      } else {
        setDone(`Телефон подключён. Клиентские SMS пойдут с номера ${formatPhone(result.nomer ?? null)}`);
        setLogin('');
        setParol('');
        await load();
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>Мои каналы</div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
            Телефоны, с которых вы принимаете и отправляете клиентские SMS
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: '1px solid #d6d6d6',
            background: '#fff',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          К диалогам
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginTop: '16px' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {channels.length === 0 && (
            <div style={{ ...card, color: '#888', fontSize: '13px' }}>
              Пока ни одного телефона не подключено.
            </div>
          )}

          {channels.map((channel) => (
            <div key={channel.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{formatPhone(channel.nomer)}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                    {channel.name}
                  </div>
                </div>
                <span
                  style={{
                    alignSelf: 'flex-start',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: STATUS_COLOR[channel.status ?? ''] ?? '#888',
                    background: '#f4f4f4',
                    borderRadius: '6px',
                    padding: '3px 8px',
                  }}
                >
                  {STATUS_LABEL[channel.status ?? ''] ?? 'Статус неизвестен'}
                </span>
              </div>

              <div style={{ fontSize: '12px', color: '#777', marginTop: '8px' }}>
                Связь: {formatSeen(channel.posledniyKontakt)}
                {channel.limitVChas ? ` · лимит ${channel.limitVChas} SMS/час` : ''}
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...card, width: '360px', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Подключить телефон</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {step(1, 'Установите приложение «SMS Gateway for Android» и откройте его.')}
            {step(2, 'В настройках укажите адрес сервера и токен подключения:')}
          </div>

          <CopyRow label="Адрес сервера" value={info?.serverAddress ?? ''} />
          <CopyRow
            label="Токен подключения"
            value={info?.privateToken || 'запросите у администратора'}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0' }}>
            {step(3, 'В приложении появится логин и пароль устройства — введите их здесь:')}
          </div>

          <input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="Логин устройства"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: '1px solid #d6d6d6',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '13px',
              marginBottom: '8px',
            }}
          />
          <input
            value={parol}
            onChange={(event) => setParol(event.target.value)}
            placeholder="Пароль устройства"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: '1px solid #d6d6d6',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '13px',
              marginBottom: '10px',
            }}
          />

          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: '6px',
              background: busy ? '#9bb8ff' : '#1961ff',
              color: '#fff',
              padding: '9px 12px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? 'Проверяю…' : 'Проверить и подключить'}
          </button>

          {error && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px',
                background: '#fdecea',
                color: '#c03b2c',
                fontSize: '12px',
                borderRadius: '6px',
              }}
            >
              {error}
            </div>
          )}

          {done && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px',
                background: '#e8f5ec',
                color: '#1a7f37',
                fontSize: '12px',
                borderRadius: '6px',
              }}
            >
              {done}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
