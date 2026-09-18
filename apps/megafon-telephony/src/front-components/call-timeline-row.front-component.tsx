import { useCallback, useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  SidePanelPages,
  openSidePanelPage,
  useTimelineActivityId,
} from 'twenty-sdk/front-component';

import { TIMELINE_ACTIVITY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Строка ленты для звонка МегаФон.
 *
 * Лента компании — единственное место, где запись пишет наше приложение (у контакта
 * её пишет ядро своим штатным типом). Компонент рисует заголовок звонка и по клику
 * открывает карточку звонка в боковой панели.
 *
 * Данные берём из REST прямо из компонента: песочница фронт-компонента подставляет
 * адрес API и токен приложения в окружение, а запросы к API идут через мост хоста.
 */

type TimelineRow = {
  linkedRecordId?: string | null;
  linkedRecordCachedName?: string | null;
};

const CallTimelineRow = () => {
  const timelineActivityId = useTimelineActivityId();
  const [row, setRow] = useState<TimelineRow | null>(null);

  useEffect(() => {
    if (!timelineActivityId) {
      return;
    }

    const env =
      (
        globalThis as unknown as {
          process?: { env?: Record<string, string | undefined> };
        }
      ).process?.env ?? {};
    const base = (env.TWENTY_API_URL ?? '').replace(/\/+$/, '');
    const token = env.TWENTY_APP_ACCESS_TOKEN ?? '';

    if (!base) {
      return;
    }

    let isRelevant = true;

    fetch(`${base}/rest/timelineActivities/${timelineActivityId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (isRelevant) {
          setRow(
            (json as { data?: { timelineActivity?: TimelineRow } })?.data
              ?.timelineActivity ?? null,
          );
        }
      })
      .catch(() => setRow(null));

    return () => {
      isRelevant = false;
    };
  }, [timelineActivityId]);

  const openCall = useCallback(() => {
    if (!row?.linkedRecordId) {
      return;
    }

    openSidePanelPage({
      page: SidePanelPages.ViewRecord,
      objectNameSingular: 'callRecording',
      recordId: row.linkedRecordId,
    });
  }, [row]);

  return (
    <div
      style={{
        alignItems: 'center',
        cursor: row?.linkedRecordId ? 'pointer' : 'default',
        display: 'flex',
        gap: '6px',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
      onClick={openCall}
    >
      <span>{row?.linkedRecordCachedName || 'Звонок'}</span>
      {row?.linkedRecordId ? (
        <span style={{ opacity: 0.6, textDecoration: 'underline' }}>
          открыть
        </span>
      ) : null}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: TIMELINE_ACTIVITY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'callTimelineRow',
  description: 'Строка звонка в ленте: заголовок и переход в запись звонка',
  component: CallTimelineRow,
});
