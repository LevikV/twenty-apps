import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { RestApiClient } from 'twenty-client-sdk/rest';

import {
  MAX_OUTBOX_API_ROUTE_PATH,
  MAX_OUTBOX_API_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { describeError, rowsOf } from 'src/shared/crm';

/**
 * Мостовой интерфейс очереди MAX.
 *
 * `take`   — отдать задачи, ожидающие отправки для указанного устройства;
 * `report` — принять результат: отправлено (с id сообщения) или ошибка.
 *
 * Мост работает вне Twenty и держит WebSocket-сессию, поэтому маршрут
 * публичный; доступ ограничен знанием deviceId аккаунта.
 */

type Row = Record<string, unknown> & { id?: string };

const client = new RestApiClient({ runAs: 'application' });

/**
 * Первое вложение сообщения.
 *
 * REST отдаёт файловое поле вместе с подписанной ссылкой (url) — мост скачает
 * по ней файл и загрузит его в MAX. Имя берём из подписи: его увидит получатель.
 */
const messageAttachment = async (
  messageId: string,
): Promise<{ url: string; label: string } | null> => {
  if (!messageId) return null;

  try {
    const response = (await client.get<unknown>(`/rest/soobshcheniya/${messageId}`, {
      query: { select: 'id,vlozhenie' },
    })) as {
      data?: { soobshchenie?: { vlozhenie?: { url?: string; label?: string }[] } };
    };

    const files = response?.data?.soobshchenie?.vlozhenie ?? [];
    const file = files.find((item) => item?.url);

    return file ? { url: String(file.url), label: String(file.label ?? 'файл') } : null;
  } catch {
    return null;
  }
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const handler = async (event: RoutePayload) => {
  const body = (event.body ?? {}) as {
    action?: string;
    deviceId?: string;
    taskId?: string;
    ok?: boolean;
    messageId?: string;
    error?: string;
  };

  const deviceId = String(body.deviceId ?? '');

  if (!deviceId) return json({ ok: false, error: 'нет deviceId' }, 400);

  try {
    const accounts = rowsOf(
      await client.get<unknown>('/rest/maxAccounts', {
        query: { filter: `deviceId[eq]:"${deviceId}"`, select: 'id,name', limit: 1 },
      }),
      'maxAccounts',
    );

    const account = accounts[0];

    if (!account?.id) return json({ ok: false, error: 'аккаунт не найден' }, 404);

    if (body.action === 'take') {
      const tasks = rowsOf(
        await client.get<unknown>('/rest/maxOutboxTasks', {
          query: {
            filter: `shlyuzId[eq]:"${account.id}",status[eq]:"OZHIDAET"`,
            select: 'id,chatId,tekst,popytki,soobshchenieId',
            limit: 20,
          },
        }),
        'maxOutboxTasks',
      );

      const result = [];

      for (const task of tasks) {
        if (!task.id) continue;

        await client.patch<unknown>(`/rest/maxOutboxTasks/${task.id}`, {
          popytki: Number(task.popytki ?? 0) + 1,
        });

        const attachment = await messageAttachment(String(task.soobshchenieId ?? ''));

        result.push({
          id: task.id,
          chatId: String(task.chatId ?? ''),
          text: String(task.tekst ?? ''),
          fileUrl: attachment?.url ?? '',
          fileName: attachment?.label ?? '',
        });
      }

      return json({ ok: true, tasks: result });
    }

    if (body.action === 'report') {
      const taskId = String(body.taskId ?? '');

      if (!taskId) return json({ ok: false, error: 'нет taskId' }, 400);

      if (body.ok) {
        await client.patch<unknown>(`/rest/maxOutboxTasks/${taskId}`, {
          status: 'OTPRAVLENO',
          vneshniyId: String(body.messageId ?? ''),
          otpravlenoV: new Date().toISOString(),
          oshibka: '',
        });
      } else {
        await client.patch<unknown>(`/rest/maxOutboxTasks/${taskId}`, {
          status: 'OSHIBKA',
          oshibka: String(body.error ?? 'неизвестная ошибка').slice(0, 500),
        });
      }

      return json({ ok: true });
    }

    return json({ ok: false, error: 'неизвестное действие' }, 400);
  } catch (error) {
    return json({ ok: false, error: describeError(error) }, 500);
  }
};

export default defineLogicFunction({
  universalIdentifier: '10873ca3-128f-4f53-b624-f3c36d6d07b3',
  name: 'max-outbox',
  description: 'Мост MAX: забрать задачи отправки и вернуть результат',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: MAX_OUTBOX_API_ROUTE_PATH,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: ['content-type'],
  },
});
