import { useCallback, useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  SidePanelPages,
  openSidePanelPage,
  useTimelineActivityId,
} from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { TIMELINE_ACTIVITY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Строка ленты для звонка МегаФон.
 *
 * Лента компании — единственное место, где запись пишет наше приложение (у контакта
 * её пишет ядро своим штатным типом). Своего рендера у приложения не было, поэтому
 * строка выглядела «пустой» и по ней не было перехода. Здесь: заголовок звонка
 * и кнопка, открывающая карточку записи звонка в боковой панели.
 */

const client = new RestApiClient({ baseUrl: '' });

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

    client
      .get<{ data: { timelineActivity: TimelineRow } }>(
        `/rest/timelineActivities/${timelineActivityId}`,
      )
      .then((response) => setRow(response?.data?.timelineActivity ?? null))
      .catch(() => setRow(null));
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

  const title = row?.linkedRecordCachedName || 'Звонок';

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
      <span>{title}</span>
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
