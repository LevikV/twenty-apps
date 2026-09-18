import type { ClientLookup } from 'src/shared/megafon/crm-lookup';
import {
  createCallEvent,
  createCallRecording,
  findCallByCallId,
  updateCallRecording,
} from 'src/shared/megafon/call-record';
import type { EmployeeLookup } from 'src/shared/megafon/employee-lookup';
import { ensureCallLinks, type LinkResult } from 'src/shared/megafon/link-call';
import { buildCallTitle } from 'src/shared/megafon/parse';
import type { ParsedCall } from 'src/shared/megafon/types';

/**
 * Обработка одного хука ВАТС: найти звонок по `callid`, обновить или создать.
 * Ничего не создаём повторно — иначе событие календаря задвоится.
 */

export type RegisterResult = {
  action: 'created' | 'updated' | 'skipped';
  callId: string;
  calendarEventId: string;
  title: string;
  links?: LinkResult;
  reason?: string;
};

/** Кто в заголовке: имя клиента, иначе — номер. */
const titleFor = (parsed: ParsedCall, lookup: ClientLookup): string => {
  const who = lookup.personName || lookup.companyName || parsed.clientPhone;

  return buildCallTitle(parsed.direction, who || 'неизвестный номер');
};

export const registerCall = async (
  parsed: ParsedCall,
  lookup: ClientLookup,
  employee: EmployeeLookup,
): Promise<RegisterResult> => {
  if (!parsed.callid) {
    return {
      action: 'skipped',
      callId: '',
      calendarEventId: '',
      title: '',
      reason: 'в хуке нет callid',
    };
  }

  const title = titleFor(parsed, lookup);
  const existing = await findCallByCallId(parsed.callid);

  if (existing) {
    await updateCallRecording(existing.id, parsed);

    const links = await ensureCallLinks({
      calendarEventId: existing.calendarEventId,
      callRecordingId: existing.id,
      lookup,
      employee,
      clientPhone: parsed.clientPhone,
      happensAt: parsed.startedAtIso || new Date().toISOString(),
      title: existing.title || title,
    });

    return {
      action: 'updated',
      callId: existing.id,
      calendarEventId: existing.calendarEventId,
      title: existing.title || title,
      links,
    };
  }

  const startsAt = parsed.startedAtIso || new Date().toISOString();
  const endsAt = parsed.endedAtIso || startsAt;
  const calendarEventId = await createCallEvent({ title, startsAt, endsAt });
  const call = await createCallRecording({ parsed, title, calendarEventId });
  const links = await ensureCallLinks({
    calendarEventId,
    callRecordingId: call.id,
    lookup,
    employee,
    clientPhone: parsed.clientPhone,
    happensAt: startsAt,
    title,
  });

  return { action: 'created', callId: call.id, calendarEventId, title, links };
};
