import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  createTimelineActivity,
  type RoutePayload,
} from 'twenty-sdk/logic-function';
import { RestApiClient } from 'twenty-client-sdk/rest';

import {
  CALL_JOURNAL_LINK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  CALL_RECORDING_OBJECT_UNIVERSAL_IDENTIFIER,
  COMPANY_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
  TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/**
 * Ручное сопоставление звонка из журнала «Звонки».
 *
 * Два действия, оба — из строки журнала:
 *
 * - **клиент** — второй участник события: контакт (участник с `personId`) или
 *   компания (участник с `companyId`). Создаётся участник события, поэтому
 *   звонок сразу выходит из фильтра «Нет клиента»;
 * - **цель** — цель события (`calendarEventTarget`): контакт, компания или
 *   сделка (Заказ / Ремонт / Заправка / Тендер). Запись создаётся через API,
 *   поэтому ядро само помечает её как «ручную» (`isManuallyAssigned`) — при
 *   пересборке связей такая цель не удаляется.
 *
 * Лента: при привязке контакта и компании пишем запись в ленту клиента/компании
 * (решение Алексея 22.09.2026) — тем же типом активности приложения.
 *
 * Маршрут закрыт требованием авторизации (как и остальные служебные маршруты
 * приложения); отличить админа от сотрудника на сервере нельзя — права на роли
 * приложению не выданы.
 */

const client = new RestApiClient();

/** Поле цели события для каждого вида цели. */
const TARGET_FIELD: Record<string, string> = {
  contact: 'targetPersonId',
  company: 'targetCompanyId',
  opportunity: 'targetOpportunityId',
  remont: 'nashaSdelkaRemontOborudovaniyaId',
  zapravka: 'nashaSdelkaZapravkaKartridzheyId',
  tender: 'nashaSdelkaTenderId',
};

type Row = Record<string, unknown> & { id?: string };

const rowsOf = (response: unknown, key: string): Row[] => {
  const data = (response as { data?: Record<string, unknown> })?.data;
  const value = data?.[key];

  return Array.isArray(value) ? (value as Row[]) : [];
};

const listOf = async (path: string, calendarEventId: string): Promise<Row[]> => {
  const response = await client.get<unknown>(path, {
    query: { filter: `calendarEventId[eq]:"${calendarEventId}"`, limit: 60 },
  });
  const key =
    Object.keys((response as { data?: Record<string, unknown> })?.data ?? {})[0] ??
    '';

  return rowsOf(response, key);
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Запись в ленту контакта или компании. Идемпотентность — по паре
 * «звонок + получатель»: повторная привязка второго раза не создаёт.
 */
const addTimeline = async (params: {
  targetObjectUniversalIdentifier: string;
  targetRecordId: string;
  targetField: 'targetPersonId' | 'targetCompanyId';
  callRecordingId: string;
  happensAt: string;
  title: string;
}): Promise<boolean> => {
  const {
    targetObjectUniversalIdentifier,
    targetRecordId,
    targetField,
    callRecordingId,
    happensAt,
    title,
  } = params;

  const response = await client.get<unknown>('/rest/timelineActivities', {
    query: { filter: `linkedRecordId[eq]:"${callRecordingId}"`, limit: 60 },
  });
  const existing = rowsOf(response, 'timelineActivities');

  if (existing.some((row) => row[targetField] === targetRecordId)) return false;

  const created = await createTimelineActivity({
    timelineActivityTypeUniversalIdentifier: TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
    targetObjectUniversalIdentifier,
    targetRecordId,
    linkedRecordId: callRecordingId,
    linkedObjectMetadataUniversalIdentifier:
      CALL_RECORDING_OBJECT_UNIVERSAL_IDENTIFIER,
    happensAt,
    properties: {},
  });

  // хелпер не принимает заголовок — дозаписываем, иначе строка безымянная
  if (created?.id && title) {
    await client.patch(`/rest/timelineActivities/${created.id}`, {
      linkedRecordCachedName: title,
    });
  }

  return true;
};

const handler = async (event: RoutePayload) => {
  let body = (event?.body ?? {}) as Record<string, unknown>;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return json({ ok: false, error: 'Тело запроса не разобрано' }, 400);
    }
  }

  const action = String(body.action ?? '');
  const eventId = String(body.eventId ?? '');
  const callRecordingId = String(body.callRecordingId ?? '');
  const title = String(body.title ?? '');
  const happensAt = String(body.happensAt ?? '') || new Date().toISOString();

  try {
    // ── клиент: участник события (контакт или компания) ────────────────────
    if (action === 'linkClient') {
      if (!eventId) return json({ ok: false, error: 'Не указано событие' }, 400);

      const personId = String(body.personId ?? '');
      const companyId = String(body.companyId ?? '');
      const displayName = String(body.displayName ?? '');
      const handle = String(body.handle ?? '');

      if (!personId && !companyId) {
        return json({ ok: false, error: 'Не выбран клиент' }, 400);
      }

      const participants = await listOf('/rest/calendarEventParticipants', eventId);
      let created = false;

      if (personId && !participants.some((row) => row.personId === personId)) {
        await client.post('/rest/calendarEventParticipants', {
          calendarEventId: eventId,
          personId,
          displayName,
          handle,
          responseStatus: 'ACCEPTED',
        });
        created = true;
      }

      if (
        companyId &&
        !participants.some((row) => row.companyId === companyId)
      ) {
        await client.post('/rest/calendarEventParticipants', {
          calendarEventId: eventId,
          companyId,
          displayName,
          responseStatus: 'ACCEPTED',
        });
        created = true;
      }

      let timeline = false;

      if (callRecordingId && personId) {
        timeline = await addTimeline({
          targetObjectUniversalIdentifier: PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
          targetRecordId: personId,
          targetField: 'targetPersonId',
          callRecordingId,
          happensAt,
          title,
        });
      }

      if (callRecordingId && companyId) {
        timeline =
          (await addTimeline({
            targetObjectUniversalIdentifier: COMPANY_OBJECT_UNIVERSAL_IDENTIFIER,
            targetRecordId: companyId,
            targetField: 'targetCompanyId',
            callRecordingId,
            happensAt,
            title,
          })) || timeline;
      }

      return json({ ok: true, created, timeline });
    }

    // ── клиент: снять привязку (убрать участника) ──────────────────────────
    if (action === 'unlinkClient') {
      const participantId = String(body.participantId ?? '');

      if (!participantId) {
        return json({ ok: false, error: 'Не указан участник' }, 400);
      }

      await client.delete(`/rest/calendarEventParticipants/${participantId}`);

      return json({ ok: true });
    }

    // ── цель: цель события (контакт / компания / сделка) ───────────────────
    if (action === 'linkTarget') {
      if (!eventId) return json({ ok: false, error: 'Не указано событие' }, 400);

      const kind = String(body.kind ?? '');
      const targetId = String(body.targetId ?? '');
      const field = TARGET_FIELD[kind];

      if (!field) return json({ ok: false, error: 'Неизвестный вид цели' }, 400);
      if (!targetId) return json({ ok: false, error: 'Не выбрана цель' }, 400);

      const targets = await listOf('/rest/calendarEventTargets', eventId);
      let created = false;

      if (!targets.some((row) => row[field] === targetId)) {
        await client.post('/rest/calendarEventTargets', {
          calendarEventId: eventId,
          [field]: targetId,
        });
        created = true;
      }

      let timeline = false;

      if (callRecordingId && kind === 'contact') {
        timeline = await addTimeline({
          targetObjectUniversalIdentifier: PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
          targetRecordId: targetId,
          targetField: 'targetPersonId',
          callRecordingId,
          happensAt,
          title,
        });
      }

      if (callRecordingId && kind === 'company') {
        timeline = await addTimeline({
          targetObjectUniversalIdentifier: COMPANY_OBJECT_UNIVERSAL_IDENTIFIER,
          targetRecordId: targetId,
          targetField: 'targetCompanyId',
          callRecordingId,
          happensAt,
          title,
        });
      }

      return json({ ok: true, created, timeline });
    }

    // ── цель: снять привязку (убрать цель) ─────────────────────────────────
    if (action === 'unlinkTarget') {
      const targetId = String(body.targetId ?? '');

      if (!targetId) return json({ ok: false, error: 'Не указана цель' }, 400);

      await client.delete(`/rest/calendarEventTargets/${targetId}`);

      return json({ ok: true });
    }

    return json({ ok: false, error: 'Неизвестное действие' }, 400);
  } catch (error) {
    return json({ ok: false, error: describeError(error) }, 400);
  }
};

export default defineLogicFunction({
  universalIdentifier: CALL_JOURNAL_LINK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'call-journal-link',
  description: 'Журнал звонков: ручное сопоставление клиента и цели',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/call-journal-link',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: ['content-type'],
  },
});
