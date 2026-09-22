import { RestApiClient } from 'twenty-client-sdk/rest';
import { createTimelineActivity } from 'twenty-sdk/logic-function';

import {
  CALL_RECORDING_OBJECT_UNIVERSAL_IDENTIFIER,
  COMPANY_OBJECT_UNIVERSAL_IDENTIFIER,
  TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import type { ClientLookup } from 'src/shared/megafon/crm-lookup';
import type { DealRef } from 'src/shared/megafon/deal-lookup';
import type { EmployeeLookup } from 'src/shared/megafon/employee-lookup';

/**
 * Связи звонка (решение 22.09.2026):
 *
 * - **цели события** (`calendarEventTarget`) — только **сделки** «в работе»
 *   (заказ / ремонт / заправка / тендер). Контакт и компания целями больше
 *   не ставятся;
 * - **участники** (`calendarEventParticipant`) — клиент-контакт, компания-клиент
 *   (поле «Компания», создано 21.09) и наш сотрудник. Сотрудник ставится
 *   **один** и только по итоговому хуку (`history`) — тот, кто ответил;
 * - лента компании — своим типом активности приложения.
 *
 * Всё идемпотентно: сначала читаем, что уже есть, и создаём только недостающее.
 */

const client = new RestApiClient();

/** Поле цели события для каждого вида сделки. */
const DEAL_TARGET_FIELD: Record<DealRef['kind'], string> = {
  opportunity: 'targetOpportunityId',
  remontOborudovaniya: 'nashaSdelkaRemontOborudovaniyaId',
  zapravkaKartridzhey: 'nashaSdelkaZapravkaKartridzheyId',
  tender: 'nashaSdelkaTenderId',
};

export type LinkResult = {
  dealTargets: number;
  personParticipant: boolean;
  companyParticipant: boolean;
  employeeParticipant: boolean;
  internalEmployeeParticipant: boolean;
  companyTimeline: boolean;
};

type Row = {
  targetPersonId?: string | null;
  targetCompanyId?: string | null;
  targetOpportunityId?: string | null;
  nashaSdelkaRemontOborudovaniyaId?: string | null;
  nashaSdelkaZapravkaKartridzheyId?: string | null;
  nashaSdelkaTenderId?: string | null;
  personId?: string | null;
  companyId?: string | null;
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
    query: { filter: `calendarEventId[eq]:"${calendarEventId}"`, limit: 50 },
  });

  const key = Object.keys((response as { data?: Record<string, unknown> })?.data ?? {})[0] ?? '';

  return rowsOf(response, key);
};

const addTarget = async (calendarEventId: string, body: Record<string, unknown>) =>
  client.post('/rest/calendarEventTargets', { calendarEventId, ...body });

const addParticipant = async (calendarEventId: string, body: Record<string, unknown>) =>
  client.post('/rest/calendarEventParticipants', { calendarEventId, ...body });

/** Есть ли уже цель с таким значением в нужном поле. */
const hasTarget = (targets: Row[], field: string, value: string): boolean =>
  targets.some((row) => (row as Record<string, unknown>)[field] === value);

export const ensureCallLinks = async (params: {
  calendarEventId: string;
  callRecordingId: string;
  lookup: ClientLookup;
  employee: EmployeeLookup;
  /** Сделки-цели, найденные по клиенту (пусто — цели не будет). */
  deals?: DealRef[];
  clientPhone?: string;
  title?: string;
  happensAt?: string;
  /** Ставить ли нашего сотрудника участником (только по итоговому хуку). */
  allowEmployee?: boolean;
}): Promise<LinkResult> => {
  const {
    calendarEventId,
    callRecordingId,
    lookup,
    employee,
    deals = [],
    clientPhone = '',
    happensAt = '',
    title = '',
    allowEmployee = false,
  } = params;

  const result: LinkResult = {
    dealTargets: 0,
    personParticipant: false,
    companyParticipant: false,
    employeeParticipant: false,
    internalEmployeeParticipant: false,
    companyTimeline: false,
  };

  if (!calendarEventId) return result;

  const targets = await listOf('/rest/calendarEventTargets', calendarEventId);
  const participants = await listOf('/rest/calendarEventParticipants', calendarEventId);

  // Цели — только сделки «в работе» (контакт и компания целями не ставятся).
  for (const deal of deals) {
    const field = DEAL_TARGET_FIELD[deal.kind];

    if (field && !hasTarget(targets, field, deal.id)) {
      await addTarget(calendarEventId, { [field]: deal.id });
      result.dealTargets += 1;
    }
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

  // компания-клиент — участником события: тогда она видна в журнале в колонке
  // «Клиент» и попадает в ленту. displayName — название компании.
  if (lookup.companyId && !participants.some((row) => row.companyId === lookup.companyId)) {
    await addParticipant(calendarEventId, {
      companyId: lookup.companyId,
      displayName: lookup.companyName || '',
      responseStatus: 'ACCEPTED',
    });
    result.companyParticipant = true;
  }

  // наш сотрудник — ровно один, тот, кто ответил (по итоговому хуку history).
  if (
    allowEmployee &&
    employee.employeeId &&
    !participants.some((row) => row.workspaceMemberId === employee.employeeId)
  ) {
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
