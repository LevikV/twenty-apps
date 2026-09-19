import { defineLogicFunction } from 'twenty-sdk/define';
import { kv } from 'twenty-sdk/logic-function';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { RECORDING_RECONCILE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { fetchHistory, restoreCall, toParsedCall, type ReconcileReport } from 'src/shared/megafon/reconcile';

/**
 * Крон-сверка с ВАТС МегаФон (страховка от потерянных вебхуков).
 *
 * Раз в 10 минут: берём историю за today + yesterday, смотрим, чего нет в Twenty,
 * досоздаём звонок и ставим задачу в очередь расшифровки.
 *
 * Список uid из Twenty берём одним запросом — иначе лимит REST (100 запросов/мин).
 * Сколько звонков восстанавливать за прогон — ограничено, чтобы не упереться в лимит.
 */

const PERIODS = ['today', 'yesterday'];
const RESTORE_PER_RUN = 10;

type RecordingRow = { externalRecordingId?: string | null };

const handler = async () => {
  const startedAt = Date.now();
  const report: ReconcileReport = {
    periods: PERIODS,
    historyCalls: 0,
    withRecord: 0,
    missingInCrm: [],
    created: [],
    queued: 0,
    errors: [],
  };

  const token = process.env.VATS_API_TOKEN ?? '';

  if (!token) {
    return { ok: false, error: 'не задан VATS_API_TOKEN' };
  }

  const rest = new RestApiClient();

  // Все звонки Twenty — страницами по 200 (REST больше не отдаёт).
  const knownUids = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < 5; page += 1) {
    const query = `/rest/callRecordings?limit=200${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ''}`;
    const chunk = (await rest.get(query)) as {
      data?: { callRecordings?: RecordingRow[] };
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
    };

    for (const row of chunk.data?.callRecordings ?? []) {
      if (row.externalRecordingId) knownUids.add(row.externalRecordingId);
    }

    if (!chunk.pageInfo?.hasNextPage) break;

    cursor = chunk.pageInfo.endCursor ?? null;
    if (!cursor) break;
  }

  for (const period of PERIODS) {
    try {
      const calls = await fetchHistory(period, token);

      report.historyCalls += calls.length;

      for (const call of calls) {
        const uid = String(call.uid ?? '');

        if (!uid || knownUids.has(uid)) continue;

        report.missingInCrm.push(uid);
        if (String(call.record ?? '').trim()) report.withRecord += 1;

        if (report.created.length >= RESTORE_PER_RUN) continue;

        try {
          const result = await restoreCall(toParsedCall(call));

          if (result.created) report.created.push(uid);
          if (result.queued === 'created') report.queued += 1;
        } catch (error) {
          report.errors.push(`${uid}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      report.errors.push(`${period}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const summary = {
    at: new Date().toISOString(),
    ms: Date.now() - startedAt,
    historyCalls: report.historyCalls,
    missing: report.missingInCrm.length,
    created: report.created.length,
    queued: report.queued,
    errors: report.errors.slice(0, 10),
  };

  await kv.set('reconcile:last', summary);

  return summary;
};

export default defineLogicFunction({
  universalIdentifier: RECORDING_RECONCILE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'recording-reconcile',
  description: 'Сверка звонков Twenty с историей ВАТС: дозаполнение и очередь расшифровки',
  timeoutSeconds: 300,
  handler,
  cronTriggerSettings: {
    pattern: '*/10 * * * *',
  },
});
