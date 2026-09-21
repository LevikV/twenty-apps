import { RestApiClient } from 'twenty-client-sdk/rest';
import { createTimelineActivity } from 'twenty-sdk/logic-function';

import {
  CALL_RECORDING_OBJECT_UNIVERSAL_IDENTIFIER,
  COMPANY_OBJECT_UNIVERSAL_IDENTIFIER,
  TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import type { ClientLookup } from 'src/shared/megafon/crm-lookup';
import type { EmployeeLookup } from 'src/shared/megafon/employee-lookup';

/**
 * Связи звонка: клиент и компания становятся «целями» события календаря
 * (`calendarEventTarget`), клиент и сотрудник — «участниками»
 * (`calendarEventParticipant`). Так же делал прежний воркфлоу, и именно по этим
 * связям звонок виден в карточке клиента, компании и сотрудника.
 *
 * Всё идемпотентно: сначала читаем, что уже есть, и создаём только недостающее.
 */

const client = new RestApiClient();

export type LinkResult = {
  personTarget: boolean;
  companyTarget: boolean;
  personParticipant: boolean;
  employeeParticipant: boolean;
  internalEmployeeParticipant: boolean;
  companyTimeline: boolean;
};

type Row = {
  targetPersonId?: string | null;
  targetCompanyId?: string | null;
  personId?: string | null;
  workspaceMemberId?: string | null;
};

/**
 * Запись в ленте компании — штатным хелпером SDK: тип активности указывается
 * универсальным идентификатором, поэтому приложение остаётся переносимым.
 *
 * Связанная запись — сам звонок (`callRecording`), а не событие календаря: так
 * клик по строке ленты открывает карточку звонка. Идемпотентность — по паре
 * «звонок + компания».
 */
const addCompanyTimeline = async (params: {
  callRecordingId: string;
  companyId: string;
  happensAt: string;
  title: string;
}): Promise<boolean> => {
  const { callRecordingId, companyId, happensAt, title } = params;

  const response = await client.get<unknown>('/rest/timelineActivities', {
    query: { filter: `linkedRecordId[eq]:"${callRecordingId}"`, limit: 40 },
  });

  const existing = rowsOf(response, 'timelineActivities');

  if (existing.some((row) => row.targetCompanyId === companyId)) return false;

  const created = await createTimelineActivity({
    timelineActivityTypeUniversalIdentifier: TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
    targetObjectUniversalIdentifier: COMPANY_OBJECT_UNIVERSAL_IDENTIFIER,
    targetRecordId: companyId,
    linkedRecordId: callRecordingId,
    linkedObjectMetadataUniversalIdentifier:
      CALL_RECORDING_OBJECT_UNIVERSAL_IDENTIFIER,
    happensAt,
    properties: {},
  });

  // хелпер SDK не принимает заголовок записи — дозаписываем его, иначе строка
  // в ленте компании будет безымянной
  if (created?.id && title) {
    await client.patch(`/rest/timelineActivities/${created.id}`, {
      linkedRecordCachedName: title,
    });
  }

  return true;
};

const rowsOf = (response: unknown, key: string): Row[] => {
  const data = (response as { data?: Record<string, unknown> })?.data;
  const value = data?.[key];

  return Array.isArray(value) ? (value as Row[]) : [];
};

const listOf = async (path: string, calendarEventId: string): Promise<Row[]> => {
  const response = await client.get<unknown>(path, {
    query: { filter: `calendarEventId[eq]:"${calendarEventId}"`, limit: 30 },
  });

  const key = Object.keys((response as { data?: Record<string, unknown> })?.data ?? {})[0] ?? '';

  return rowsOf(response, key);
};

const addTarget = async (calendarEventId: string, body: Record<string, unknown>) =>
  client.post('/rest/calendarEventTargets', { calendarEventId, ...body });

const addParticipant = async (calendarEventId: string, body: Record<string, unknown>) =>
  client.post('/rest/calendarEventParticipants', { calendarEventId, ...body });

export const ensureCallLinks = async (params: {
  calendarEventId: string;
  callRecordingId: string;
  lookup: ClientLookup;
  employee: EmployeeLookup;
  clientPhone?: string;
  title?: string;
  happensAt?: string;
}): Promise<LinkResult> => {
  const {
    calendarEventId,
    callRecordingId,
    lookup,
    employee,
    clientPhone = '',
    happensAt = '',
    title = '',
  } = params;

  const result: LinkResult = {
    personTarget: false,
    companyTarget: false,
    personParticipant: false,
    employeeParticipant: false,
    internalEmployeeParticipant: false,
    companyTimeline: false,
  };

  if (!calendarEventId) return result;

  const targets = await listOf('/rest/calendarEventTargets', calendarEventId);
  const participants = await listOf('/rest/calendarEventParticipants', calendarEventId);

  if (lookup.personId && !targets.some((row) => row.targetPersonId === lookup.personId)) {
    await addTarget(calendarEventId, { targetPersonId: lookup.personId });
    result.personTarget = true;
  }

  if (lookup.companyId && !targets.some((row) => row.targetCompanyId === lookup.companyId)) {
    await addTarget(calendarEventId, { targetCompanyId: lookup.companyId });
    result.companyTarget = true;
  }

  // лента компании: системный тип активности приложению недоступен, пишем своим
  if (lookup.companyId) {
    result.companyTimeline = await addCompanyTimeline({
      callRecordingId,
      companyId: lookup.companyId,
      happensAt: happensAt || new Date().toISOString(),
      title,
    });
  }

  // клиент как участник события — с телефоном и именем, как в прежнем воркфлоу
  if (lookup.personId && !participants.some((row) => row.personId === lookup.personId)) {
    await addParticipant(calendarEventId, {
      personId: lookup.personId,
      handle: clientPhone || '',
      displayName: lookup.personName || '',
      responseStatus: 'ACCEPTED',
    });
    result.personParticipant = true;
  }

  if (employee.employeeId && !participants.some((row) => row.workspaceMemberId === employee.employeeId)) {
    await addParticipant(calendarEventId, {
      workspaceMemberId: employee.employeeId,
      displayName: employee.employeeName || '',
      isOrganizer: true,
      responseStatus: 'ACCEPTED',
    });
    result.employeeParticipant = true;
  }

  // внутренний звонок: вторая сторона — наш сотрудник, а не клиент
  if (
    lookup.internalEmployeeId &&
    !participants.some((row) => row.workspaceMemberId === lookup.internalEmployeeId)
  ) {
    await addParticipant(calendarEventId, {
      workspaceMemberId: lookup.internalEmployeeId,
      displayName: lookup.internalEmployeeName || '',
      handle: clientPhone || '',
      responseStatus: 'ACCEPTED',
    });
    result.internalEmployeeParticipant = true;
  }

  return result;
};
