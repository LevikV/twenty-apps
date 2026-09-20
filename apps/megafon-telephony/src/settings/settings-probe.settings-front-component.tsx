import { useEffect, useState } from 'react';
import { defineSettingsFrontComponent } from 'twenty-sdk/define';
import { useUserId } from 'twenty-sdk/front-component';

import { SETTINGS_PROBE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Разведка: свой экран в настройках приложения.
 *
 * Ничего не меняет в CRM. Проверяет три вещи:
 *  1. рендерится ли компонент на вкладке настроек приложения;
 *  2. какие переменные приложения доступны из песочницы (публичные);
 *  3. видит ли компонент данные CRM (сотрудники, объекты) — тем же путём,
 *     что строка ленты и страница «Звонки».
 *
 * После разведки компонент удаляется из приложения.
 */

type StepResult = {
  title: string;
  ok: boolean;
  detail: string;
};

const readEnv = () =>
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const SettingsProbe = () => {
  const userId = useUserId();
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isRelevant = true;

    const run = async () => {
      const env = readEnv();
      const base = (env.TWENTY_API_URL ?? '').replace(/\/+$/, '');
      const token = env.TWENTY_APP_ACCESS_TOKEN ?? '';

      const results: StepResult[] = [
        {
          title: 'Экран настроек приложения',
          ok: true,
          detail: `компонент отрисовался; userId = ${userId ?? '—'}`,
        },
        {
          title: 'Публичные переменные приложения',
          ok: true,
          detail: env.applicationVariables
            ? String(env.applicationVariables).slice(0, 300)
            : 'переменных нет (или все секретные)',
        },
      ];

      const api = (path: string) =>
        fetch(`${base}${path}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

      // Сотрудники
      try {
        const response = await api(
          '/rest/workspaceMembers?limit=10&select=id,name,userEmail',
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
        const members = json?.data?.workspaceMembers ?? [];

        results.push({
          title: 'Сотрудники из CRM',
          ok: members.length > 0,
          detail:
            members.length > 0
              ? members
                  .map(
                    (member) =>
                      `${member.name?.firstName ?? ''} ${member.name?.lastName ?? ''} (${member.userEmail ?? '—'})`,
                  )
                  .join('; ')
              : `пусто (HTTP ${response.status})`,
        });
      } catch (error) {
        results.push({
          title: 'Сотрудники из CRM',
          ok: false,
          detail: String(error),
        });
      }

      // Данные приложения: доступ к записям
      try {
        const response = await api(
          '/rest/recordingQueueTasks?limit=1&select=id,status',
        );
        const json = (await response.json()) as {
          totalCount?: number;
        };

        results.push({
          title: 'Чтение данных приложения (очередь расшифровки)',
          ok: typeof json?.totalCount === 'number',
          detail: `HTTP ${response.status}, всего записей: ${json?.totalCount ?? '—'}`,
        });
      } catch (error) {
        results.push({
          title: 'Чтение данных приложения (очередь расшифровки)',
          ok: false,
          detail: String(error),
        });
      }

      if (isRelevant) {
        setSteps(results);
        setIsLoading(false);
      }
    };

    run().catch((error) => {
      if (isRelevant) {
        setSteps([{ title: 'Ошибка', ok: false, detail: String(error) }]);
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
        gap: '12px',
        padding: '8px',
        fontSize: '13px',
      }}
    >
      <div style={{ fontWeight: 600 }}>
        Разведка: экран настроек приложения{isLoading ? ' — проверяем…' : ''}
      </div>
      {steps.map((step) => (
        <div key={step.title} style={{ opacity: step.ok ? 1 : 0.85 }}>
          <div style={{ fontWeight: 600 }}>
            {step.ok ? '✓' : '✗'} {step.title}
          </div>
          <div style={{ marginTop: '2px', wordBreak: 'break-all' }}>
            {step.detail}
          </div>
        </div>
      ))}
    </div>
  );
};

export default defineSettingsFrontComponent({
  universalIdentifier: SETTINGS_PROBE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'settingsProbe',
  description: 'Разведка: свой экран в настройках приложения (временно)',
  component: SettingsProbe,
});
