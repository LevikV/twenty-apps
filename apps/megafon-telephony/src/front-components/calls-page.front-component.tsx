import { useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useUserId } from 'twenty-sdk/front-component';

import { CALLS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Экран «Звонки» — шаг 1: разведка.
 *
 * Компонент ничего не меняет в CRM. Он проверяет из песочницы фронт-компонента:
 *  1. приходит ли текущий пользователь (useUserId);
 *  2. находится ли по нему сотрудник (workspaceMember);
 *  3. читаются ли роли через metadata API (getRoles) и определяется ли Admin;
 *  4. читаются ли события сотрудника (участники) и его звонки (callRecordings).
 *
 * Данные берём обычным fetch: песочница подставляет адрес API и токен приложения,
 * а запрос идёт через мост хоста (тот же путь, что у строки ленты компании).
 */

type StepResult = {
  title: string;
  ok: boolean;
  detail: string;
};

type CallExample = {
  id: string;
  title: string | null;
  startedAt: string | null;
  itog: string | null;
  napravlenie: string | null;
};

const readEnv = () =>
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const CALLS_PAGE_SELECT =
  'id,title,startedAt,itog,napravlenie,externalRecordingId';

const CallsPage = () => {
  const userId = useUserId();
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [calls, setCalls] = useState<CallExample[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setSteps([
        {
          title: 'Текущий пользователь',
          ok: false,
          detail: 'userId от хоста не пришёл',
        },
      ]);
      setIsLoading(false);

      return;
    }

    let isRelevant = true;

    const run = async () => {
      const { TWENTY_API_URL, TWENTY_APP_ACCESS_TOKEN } = readEnv();
      const base = (TWENTY_API_URL ?? '').replace(/\/+$/, '');
      const token = TWENTY_APP_ACCESS_TOKEN ?? '';

      const results: StepResult[] = [
        { title: 'Текущий пользователь', ok: true, detail: `userId = ${userId}` },
      ];
      const foundCalls: CallExample[] = [];

      const api = (path: string, init?: RequestInit) =>
        fetch(`${base}${path}`, {
          ...init,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init?.headers ?? {}),
          },
        });

      let memberId: string | null = null;

      // 1. Сотрудник по пользователю
      try {
        const filter = encodeURIComponent(`userId[eq]:${userId}`);
        const response = await api(
          `/rest/workspaceMembers?filter=${filter}&select=id,name,userEmail`,
        );
        const json = (await response.json()) as {
          data?: {
            workspaceMembers?: {
              id: string;
              userEmail?: string;
              name?: { firstName?: string; lastName?: string };
            }[];
          };
        };
        const member = json?.data?.workspaceMembers?.[0];

        if (!member) {
          throw new Error(`сотрудник не найден (HTTP ${response.status})`);
        }

        memberId = member.id;
        results.push({
          title: 'Сотрудник по userId',
          ok: true,
          detail: `${member.name?.firstName ?? ''} ${member.name?.lastName ?? ''} · ${member.userEmail ?? ''} · id = ${member.id}`,
        });
      } catch (error) {
        results.push({
          title: 'Сотрудник по userId',
          ok: false,
          detail: String(error),
        });
      }

      // 2. Роли и признак Admin
      //
      // Чтение ролей в Twenty закрыто правами: резолвер getRoles требует флаг ROLES,
      // который есть у админа, но не у роли приложения. Поэтому сначала пробуем запрос
      // от имени пользователя (cookie), и только потом — токеном приложения.
      const rolesQuery = JSON.stringify({
        query: '{ getRoles { id label workspaceMembers { id } } }',
      });

      const readRoles = async (withApplicationToken: boolean) => {
        const response = await fetch(`${base}/metadata`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(withApplicationToken && token
              ? { Authorization: `Bearer ${token}` }
              : {}),
          },
          body: rolesQuery,
        });
        const rawText = await response.text();
        const parsed = (() => {
          try {
            return JSON.parse(rawText) as {
              data?: {
                getRoles?: { label: string; workspaceMembers: { id: string }[] }[];
              };
            };
          } catch {
            return null;
          }
        })();

        return {
          status: response.status,
          rawText,
          roles: parsed?.data?.getRoles ?? null,
        };
      };

      try {
        const asUser = await readRoles(false);
        const asApplication = asUser.roles ? null : await readRoles(true);
        const roles = asUser.roles ?? asApplication?.roles ?? null;

        if (!roles) {
          throw new Error(
            `от имени пользователя: HTTP ${asUser.status}, ${asUser.rawText.slice(0, 200) || '(пусто)'}` +
              `; токеном приложения: HTTP ${asApplication?.status ?? '—'}, ${(asApplication?.rawText ?? '—').slice(0, 200)}`,
          );
        }

        const myRoles = roles
          .filter((role) =>
            role.workspaceMembers?.some((member) => member.id === memberId),
          )
          .map((role) => role.label);

        results.push({
          title: `Роли сотрудника (${asUser.roles ? 'от имени пользователя' : 'токеном приложения'})`,
          ok: true,
          detail:
            myRoles.length > 0
              ? `${myRoles.join(', ')} — админ: ${myRoles.includes('Admin') ? 'да' : 'нет'} (всего ролей в CRM: ${roles.length})`
              : 'роли у сотрудника не назначены',
        });
      } catch (error) {
        results.push({
          title: 'Роли сотрудника (metadata API)',
          ok: false,
          detail: String(error),
        });
      }

      // 3. События сотрудника (участник) и его звонки
      if (memberId) {
        try {
          const filter = encodeURIComponent(
            `workspaceMemberId[eq]:${memberId}`,
          );
          const response = await api(
            `/rest/calendarEventParticipants?filter=${filter}&limit=60&select=id,calendarEventId`,
          );
          const json = (await response.json()) as {
            data?: { calendarEventParticipants?: { calendarEventId: string }[] };
            totalCount?: number;
          };
          const eventIds = (json?.data?.calendarEventParticipants ?? [])
            .map((participant) => participant.calendarEventId)
            .filter(Boolean);

          results.push({
            title: 'События-звонки сотрудника',
            ok: true,
            detail: `записей участника: ${json?.totalCount ?? eventIds.length}, событий на этой странице: ${eventIds.length}`,
          });

          if (eventIds.length > 0) {
            const inFilter = encodeURIComponent(
              `calendarEventId[in]:[${eventIds
                .slice(0, 10)
                .map((id) => `"${id}"`)
                .join(',')}]`,
            );
            const callsResponse = await api(
              `/rest/callRecordings?filter=${inFilter}&limit=10&select=${CALLS_PAGE_SELECT}`,
            );
            const callsJson = (await callsResponse.json()) as {
              data?: { callRecordings?: CallExample[] };
            };
            foundCalls.push(...(callsJson?.data?.callRecordings ?? []));

            results.push({
              title: 'Звонки сотрудника (первые 10 событий)',
              ok: true,
              detail: `получено записей звонков: ${foundCalls.length}`,
            });
          }
        } catch (error) {
          results.push({
            title: 'События и звонки сотрудника',
            ok: false,
            detail: String(error),
          });
        }
      }

      if (isRelevant) {
        setSteps(results);
        setCalls(foundCalls);
        setIsLoading(false);
      }
    };

    run().catch((error) => {
      if (isRelevant) {
        setSteps((previous) => [
          ...previous,
          { title: 'Неожиданная ошибка', ok: false, detail: String(error) },
        ]);
        setIsLoading(false);
      }
    });

    return () => {
      isRelevant = false;
    };
  }, [userId]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '16px',
        fontSize: '13px',
      }}
    >
      <div style={{ fontSize: '15px', fontWeight: 600 }}>
        Разведка: доступ к данным из виджета
        {isLoading ? ' — проверяем…' : ''}
      </div>

      {steps.map((step) => (
        <div
          key={step.title}
          style={{
            border: '1px solid var(--twenty-color-border-medium, #d6d6d6)',
            borderRadius: '6px',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {step.ok ? '✓' : '✗'} {step.title}
          </div>
          <div style={{ marginTop: '4px', opacity: 0.85, wordBreak: 'break-all' }}>
            {step.detail}
          </div>
        </div>
      ))}

      {calls.length > 0 ? (
        <div style={{ marginTop: '4px' }}>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>
            Примеры звонков
          </div>
          {calls.map((call) => (
            <div key={call.id} style={{ opacity: 0.9, padding: '2px 0' }}>
              {call.startedAt
                ? new Date(call.startedAt).toLocaleString('ru-RU')
                : '—'}{' '}
              · {call.napravlenie ?? '—'} · {call.itog ?? '—'} ·{' '}
              {call.title ?? 'без заголовка'}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: CALLS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'callsPage',
  description:
    'Экран «Звонки»: список звонков по сотрудникам с фильтрами и сопоставлением',
  component: CallsPage,
});
