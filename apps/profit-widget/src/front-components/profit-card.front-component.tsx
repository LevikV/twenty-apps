import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useSelectedRecordIds, useUserId } from 'twenty-sdk/front-component';

import { PROFIT_CARD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  calculateProfit,
  formatMoney,
  type ProfitBreakdown,
  type ProfitRow,
} from 'src/shared/profit-calc';
import {
  normalizeProfitSettings,
  type ProfitSettings,
} from 'src/shared/profit-rules';

/**
 * Виджет профита на карточке ремонта оборудования.
 *
 * Каждый видит только свой профит:
 *   • сотрудник, указанный в записи Мастером или Ответственным, — свои строки;
 *   • кому в настройках приложения стоит «видит всё» (руководитель) — разбивку
 *     по ролям записи и итог;
 *   • остальным — прочерк.
 *
 * Ничего не хранит: считает из полей карточки и настроек приложения при открытии
 * и по кнопке «Обновить» (автообновление при правке сумм в песочнице невозможно).
 */

const SETTINGS_PATH = '/profit-settings';
const MICROS = 1_000_000;

type MemberInfo = {
  id: string;
  sotrudnikId: string | null;
  name: string;
};

type RepairRecord = {
  name?: string | null;
  stoimostRabot?: unknown;
  stoimostMaterialov?: unknown;
  stoimostPodryadchika?: unknown;
  masterId?: string | null;
  otvetstvennyyId?: string | null;
  priyomshchikId?: string | null;
};

type ReadyState = {
  breakdown: ProfitBreakdown;
  recordName: string;
  viewerName: string;
  seesAll: boolean;
};

const readEnv = () =>
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Деньги из REST: `{ amountMicros, currencyCode }` → рубли. */
const money = (value: unknown): number => {
  if (value === null || typeof value !== 'object') {
    return 0;
  }

  const micros = (value as { amountMicros?: unknown }).amountMicros;
  const parsed = typeof micros === 'number' ? micros : Number(String(micros ?? ''));

  return Number.isFinite(parsed) ? parsed / MICROS : 0;
};

const fullName = (name?: { firstName?: string; lastName?: string } | null) =>
  `${name?.firstName ?? ''} ${name?.lastName ?? ''}`.trim();

const ProfitCard = () => {
  const selectedRecordIds = useSelectedRecordIds();
  const userId = useUserId();
  const recordId = selectedRecordIds?.[0] ?? null;

  const [refreshToken, setRefreshToken] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [ready, setReady] = useState<ReadyState | null>(null);

  const refresh = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let isRelevant = true;

    const load = async () => {
      setIsLoading(true);
      setError('');

      const { TWENTY_API_URL, TWENTY_FUNCTIONS_URL, TWENTY_APP_ACCESS_TOKEN } =
        readEnv();
      const apiBase = (TWENTY_API_URL ?? '').replace(/\/+$/, '');
      const functionsBase = (TWENTY_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
      const token = TWENTY_APP_ACCESS_TOKEN ?? '';
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      if (!recordId) {
        throw new Error('Не удалось определить запись ремонта');
      }

      if (!userId) {
        throw new Error('Не удалось определить пользователя');
      }

      // Кэш браузера обходим уникальным параметром `_ts`: мост песочницы не
      // передаёт `cache`, а на 304 отдаёт ответ с пустым телом.
      const [meResponse, recordResponse, settingsResponse] = await Promise.all([
        fetch(
          `${apiBase}/rest/workspaceMembers?filter=${encodeURIComponent(`userId[eq]:${userId}`)}&limit=1&_ts=${Date.now()}`,
          { headers, cache: 'no-store' },
        ),
        fetch(`${apiBase}/rest/remontOborudovaniyas/${recordId}?_ts=${Date.now()}`, {
          headers,
          cache: 'no-store',
        }),
        fetch(`${functionsBase}${SETTINGS_PATH}?_ts=${Date.now()}`, {
          headers,
          cache: 'no-store',
        }),
      ]);

      const meJson = (await meResponse.json()) as {
        data?: {
          workspaceMembers?: {
            id: string;
            sotrudnikId?: string | null;
            name?: { firstName?: string; lastName?: string } | null;
          }[];
        };
      };
      const recordJson = (await recordResponse.json()) as {
        data?: { remontOborudovaniya?: RepairRecord };
      };
      const settingsJson = (await settingsResponse.json()) as {
        settings?: unknown;
      };

      if (!meResponse.ok) {
        throw new Error(
          `не удалось прочитать сотрудника (HTTP ${meResponse.status}) ${JSON.stringify(meJson).slice(0, 200)}`,
        );
      }

      if (!recordResponse.ok) {
        throw new Error(
          `не удалось прочитать ремонт (HTTP ${recordResponse.status}) ${JSON.stringify(recordJson).slice(0, 200)}`,
        );
      }

      if (!settingsResponse.ok) {
        throw new Error(
          `не удалось прочитать настройки профита (HTTP ${settingsResponse.status}) ${JSON.stringify(settingsJson).slice(0, 200)}`,
        );
      }

      const meRow = meJson.data?.workspaceMembers?.[0];
      const record = recordJson.data?.remontOborudovaniya;

      if (!record) {
        throw new Error('Запись ремонта не найдена');
      }

      const settings: ProfitSettings = normalizeProfitSettings(settingsJson.settings);
      const memberId = meRow?.id ?? null;
      const employeeId = meRow?.sotrudnikId ?? null;
      const seesAll = memberId !== null && settings.seesAll.includes(memberId);

      const breakdown = calculateProfit(
        settings,
        'remont',
        {
          services: money(record.stoimostRabot),
          materials: money(record.stoimostMaterialov),
          contractorCost: money(record.stoimostPodryadchika),
          units: 1,
          roleEmployeeIds: {
            master: record.masterId ?? null,
            otvetstvennyy: record.otvetstvennyyId ?? null,
            priyomshchik: record.priyomshchikId ?? null,
          },
        },
        { memberId, employeeId, seesAll },
      );

      if (isRelevant) {
        setReady({
          breakdown,
          recordName: record.name ?? '',
          viewerName: meRow ? fullName(meRow.name) : '',
          seesAll,
        });
        setIsLoading(false);
      }
    };

    load().catch((loadError) => {
      if (isRelevant) {
        setReady(null);
        setError(describeError(loadError));
        setIsLoading(false);
      }
    });

    return () => {
      isRelevant = false;
    };
  }, [recordId, userId, refreshToken]);

  const boxStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '4px 2px',
    fontSize: '13px',
  };

  const buttonStyle: CSSProperties = {
    alignSelf: 'flex-start',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(128, 128, 128, 0.35)',
    background: 'transparent',
    color: 'inherit',
    fontSize: '12px',
    cursor: 'pointer',
  };

  if (isLoading) {
    return <div style={boxStyle}>Считаем профит…</div>;
  }

  if (error) {
    return (
      <div style={boxStyle}>
        <div>✗ {error}</div>
        <button type="button" style={buttonStyle} onClick={refresh}>
          Обновить
        </button>
      </div>
    );
  }

  if (!ready) {
    return <div style={boxStyle}>Нет данных</div>;
  }

  if (!ready.breakdown.hasProfit) {
    return (
      <div style={boxStyle}>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>Профит: —</div>
        <div style={{ opacity: 0.7 }}>
          {ready.breakdown.groups.length === 0 && !ready.seesAll
            ? 'По этой записи профит вам не начисляется.'
            : 'Правила расчёта для этого направления ещё не заданы.'}
        </div>
        <button type="button" style={buttonStyle} onClick={refresh}>
          Обновить
        </button>
      </div>
    );
  }

  const rowLine = (row: ProfitRow) => (
    <div
      key={row.id}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ opacity: 0.85 }}>
        {row.title} · {row.rate} от {formatMoney(row.base)}
      </span>
      <span style={{ whiteSpace: 'nowrap' }}>{formatMoney(row.amount)}</span>
    </div>
  );

  return (
    <div style={boxStyle}>
      <div style={{ fontSize: '15px', fontWeight: 600 }}>
        Профит: {formatMoney(ready.breakdown.total)}
      </div>

      {ready.breakdown.groups.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ready.breakdown.groups.map((group) => (
            <div
              key={group.role}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                borderLeft: '2px solid rgba(128, 128, 128, 0.35)',
                paddingLeft: '8px',
              }}
            >
              <div style={{ fontWeight: 600, opacity: 0.9 }}>
                {group.role === 'master' ? 'Мастер' : 'Ответственный'} —{' '}
                {formatMoney(group.total)}
              </div>
              {group.rows.map(rowLine)}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {ready.breakdown.rows.map(rowLine)}
        </div>
      )}

      <button type="button" style={buttonStyle} onClick={refresh}>
        Обновить
      </button>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: PROFIT_CARD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'profitCard',
  description: 'Профит мастера и ответственного в карточке ремонта',
  component: ProfitCard,
});
