import { defineLogicFunction } from 'twenty-sdk/define';
import {
  Response,
  type LogicFunctionExecutionContext,
  type RoutePayload,
} from 'twenty-sdk/logic-function';

import { CHAT_UPLOAD_TICKET_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Пропуск для окна прикрепления файла.
 *
 * Фронт-компонент «Центра коммуникации» живёт в песочнице about:srcdoc: у неё
 * нет доступа к localStorage, поэтому токен сотрудника внутрь окна передать
 * нельзя. Компонент вызывает этот маршрут (он авторизован обычным способом),
 * получает одноразовый пропуск на 15 минут и подставляет его в адрес окна.
 * Пропуск гасится при первом использовании — приёмник файлов помнит его
 * в памяти и сверяет сотрудника сам.
 */

// Секрет общий с приёмником файлов (/opt/max-gateway/upload_server.py).
const TICKET_SECRET = 'chat-upload-7f31c2d9a4b8e605';
const TICKET_URL = 'https://crm.kplus79.ru/integrations/chat/ticket';

const handler = async (_event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.workspaceMemberId) {
    return new Response(JSON.stringify({ error: 'Нужна авторизация' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const response = await fetch(TICKET_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret: TICKET_SECRET,
        memberId: context.workspaceMemberId,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const answer = (await response.json()) as { ticket?: string };

    return new Response(JSON.stringify({ ticket: answer.ticket ?? '' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `пропуск не выдан: ${(error as Error).message}` }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: CHAT_UPLOAD_TICKET_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'chat-upload-ticket',
  description: 'Одноразовый пропуск для окна прикрепления файла',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/chat-upload-ticket',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
