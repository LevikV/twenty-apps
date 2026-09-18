import { RestApiClient } from 'twenty-client-sdk/rest';

import type { ParsedCall } from 'src/shared/megafon/types';

/**
 * Карточка звонка в CRM: запись звонка (`callRecording`) + событие календаря
 * (`calendarEvent`), в котором живут связи с клиентом, компанией и сотрудником.
 *
 * Порядок работы: сначала ищем запись по `externalRecordingId` (= `callid` ВАТС)
 * и только если её нет — создаём. Иначе на каждый хук появлялся бы дубликат
 * события (проверено на разведке).
 */

const client = new RestApiClient();

export type ExistingCall = {
  id: string;
  title: string;
  status: string;
  calendarEventId: string;
  externalRecordingId: string;
};

type CallRecordingRecord = {
  id?: string;
  title?: string | null;
  status?: string | null;
  externalRecordingId?: string | null;
  calendarEventId?: string | null;
  calendarEvent?: { id?: string } | null;
};

const dataOf = <T>(response: unknown, key: string): T[] => {
  const data = (response as { data?: Record<string, unknown> })?.data;
  const value = data?.[key];

  return Array.isArray(value) ? (value as T[]) : [];
};

const recordOf = <T extends { id?: string }>(response: unknown): T | undefined => {
  const data = (response as { data?: Record<string, unknown> })?.data;

  if (!data) return undefined;

  // REST отвечает ключом операции: createCalendarEvent, createCallRecording и т.п.,
  // поэтому берём первый объект с id, а не ищем конкретное имя ключа.
  for (const value of Object.values(data)) {
    if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
      return value as T;
    }
  }

  return undefined;
};

const toExisting = (row: CallRecordingRecord): ExistingCall => ({
  id: String(row.id ?? ''),
  title: String(row.title ?? ''),
  status: String(row.status ?? ''),
  calendarEventId: String(row.calendarEventId ?? row.calendarEvent?.id ?? ''),
  externalRecordingId: String(row.externalRecordingId ?? ''),
});

/** Запись звонка по идентификатору вызова ВАТС. */
export const findCallByCallId = async (callid: string): Promise<ExistingCall | undefined> => {
  if (!callid) return undefined;

  const response = await client.get<unknown>('/rest/callRecordings', {
    query: { filter: `externalRecordingId[eq]:"${callid}"`, limit: 3 },
  });

  const rows = dataOf<CallRecordingRecord>(response, 'callRecordings');

  return rows.length === 1 && rows[0].id ? toExisting(rows[0]) : undefined;
};

/** Создание события календаря под звонок. */
export const createCallEvent = async (params: {
  title: string;
  startsAt: string;
  endsAt: string;
}): Promise<string> => {
  const response = await client.post<unknown>('/rest/calendarEvents', {
    title: params.title,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    isFullDay: false,
  });

  const event = recordOf<{ id?: string }>(response);

  if (!event?.id) {
    throw new Error(`calendarEvent без id: ${JSON.stringify(response).slice(0, 300)}`);
  }

  return event.id;
};

/** Создание записи звонка, привязанной к событию. */
export const createCallRecording = async (params: {
  parsed: ParsedCall;
  title: string;
  calendarEventId: string;
}): Promise<ExistingCall> => {
  const { parsed, title, calendarEventId } = params;

  const body: Record<string, unknown> = {
    title,
    status: parsed.recordingStatus,
    startedAt: parsed.startedAtIso || new Date().toISOString(),
    endedAt: parsed.endedAtIso || parsed.startedAtIso || new Date().toISOString(),
    externalRecordingId: parsed.callid,
    recordingRequestStatus: 'REQUESTED',
    calendarEventId,
  };

  if (parsed.direction) body.napravlenie = parsed.direction;
  if (parsed.outcome) body.itog = parsed.outcome;
  if (parsed.recordingUrl) body.ssylkaNaZapis = parsed.recordingUrl;

  const response = await client.post<unknown>('/rest/callRecordings', body);

  const call = recordOf<CallRecordingRecord>(response);

  if (!call?.id) {
    throw new Error(`callRecording без id: ${JSON.stringify(response).slice(0, 300)}`);
  }

  return toExisting({ ...call, calendarEventId });
};

/** Обновление записи звонка по итогам хука (время, итог, ссылка на запись, статус). */
export const updateCallRecording = async (callId: string, parsed: ParsedCall): Promise<void> => {
  const body: Record<string, unknown> = {};

  if (parsed.direction) body.napravlenie = parsed.direction;
  if (parsed.outcome) body.itog = parsed.outcome;
  if (parsed.recordingUrl) body.ssylkaNaZapis = parsed.recordingUrl;
  if (parsed.startedAtIso) body.startedAt = parsed.startedAtIso;
  if (parsed.endedAtIso) body.endedAt = parsed.endedAtIso;

  // финальный статус записи ставим только по итоговому хуку history
  if (parsed.stage === 'FINISHED') body.status = parsed.recordingStatus;

  if (Object.keys(body).length === 0) return;

  await client.patch(`/rest/callRecordings/${callId}`, body);
};
