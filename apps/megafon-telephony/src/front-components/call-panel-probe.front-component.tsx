import { useCallback, useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  SidePanelPages,
  openSidePanelPage,
  useRecordId,
} from 'twenty-sdk/front-component';

import { CALL_PANEL_PROBE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Заглушка боковой панели звонка — этап 1 разведки (23.09.2026).
 *
 * Проверяем в живом UI четыре вещи:
 *  1) журнал умеет открывать правую панель Twenty со своим компонентом
 *     (`SidePanelPages.ViewFrontComponent` + id компонента из метаданных);
 *  2) в панель доезжает id записи звонка (`useRecordId`);
 *  3) в песочнице работает плеер (`<audio controls src>`);
 *  4) из панели открывается штатная карточка звонка поверх (стек панели).
 *
 * После разведки компонент переделывается в настоящую панель звонка либо
 * удаляется — отдельным разрешением Алексея.
 */

type ProbeCall = {
  title?: string | null;
  startedAt?: string | null;
  audio?: Array<{ url?: string | null }> | null;
  video?: Array<{ url?: string | null }> | null;
  transcript?: unknown;
};

const readEnv = (): Record<string, string | undefined> =>
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const buttonStyle = {
  alignSelf: 'flex-start',
  background: 'transparent',
  border: '1px solid rgba(128, 128, 128, 0.5)',
  borderRadius: '6px',
  color: 'inherit',
  cursor: 'pointer',
  padding: '5px 10px',
};

const CallPanelProbe = () => {
  const recordId = useRecordId();
  const env = useMemo(readEnv, []);

  const base = (env.TWENTY_API_URL ?? '').replace(/\/+$/, '');
  const token = env.TWENTY_APP_ACCESS_TOKEN ?? '';

  const [call, setCall] = useState<ProbeCall | null>(null);
  const [state, setState] = useState<string>('загрузка…');

  useEffect(() => {
    if (!recordId) {
      setState('id записи не дошёл');

      return;
    }

    if (!base) {
      setState('нет адреса API в окружении');

      return;
    }

    let isRelevant = true;

    fetch(
      `${base}/rest/callRecordings/${recordId}?select=id,title,startedAt,audio,video,transcript`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!isRelevant) {
          return;
        }

        const row =
          (
            json as {
              data?: { callRecording?: ProbeCall | null };
            }
          )?.data?.callRecording ?? null;

        setCall(row);
        setState(row ? 'данные звонка получены' : 'звонок не найден');
      })
      .catch((fetchError) => {
        if (isRelevant) {
          setState(`ошибка запроса: ${String(fetchError)}`);
        }
      });

    return () => {
      isRelevant = false;
    };
  }, [recordId, base, token]);

  const mediaUrl =
    call?.audio?.[0]?.url ?? call?.video?.[0]?.url ?? null;
  const transcriptRows = Array.isArray(call?.transcript)
    ? call.transcript.length
    : 0;

  const openCallCard = useCallback(() => {
    if (!recordId) {
      return;
    }

    void openSidePanelPage({
      page: SidePanelPages.ViewRecord,
      objectNameSingular: 'callRecording',
      recordId,
    });
  }, [recordId]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '12px',
        fontSize: '13px',
      }}
    >
      <div style={{ fontWeight: 600 }}>Разведка: панель звонка</div>
      <div>ID записи: {recordId ?? '—'}</div>
      <div>
        API: {base ? 'есть' : 'нет'} · токен: {token ? 'есть' : 'нет'}
      </div>
      <div>Состояние: {state}</div>
      <div>Заголовок: {call?.title ?? '—'}</div>
      <div>Расшифровка: {transcriptRows ? `${transcriptRows} реплик` : 'нет'}</div>

      {mediaUrl ? (
        <audio controls src={mediaUrl} style={{ width: '100%' }} />
      ) : (
        <div style={{ opacity: 0.7 }}>
          Ссылки на запись нет — плеер не проверить
        </div>
      )}

      <button type="button" onClick={openCallCard} style={buttonStyle}>
        Открыть карточку звонка
      </button>

      <div style={{ opacity: 0.7 }}>
        Проверяем: панель открылась справа, запись слышно, карточка открывается
        поверх панели.
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: CALL_PANEL_PROBE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'callPanelProbe',
  description: 'Разведка: заглушка боковой панели звонка из журнала',
  component: CallPanelProbe,
});
