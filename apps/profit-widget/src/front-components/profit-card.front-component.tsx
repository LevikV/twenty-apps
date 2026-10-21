import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useSelectedRecordIds, useUserId } from 'twenty-sdk/front-component';

import { PROFIT_CARD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  calculateProfit,
  companyProfit,
  formatMoney,
  type ProfitBreakdown,
  type ProfitInputs,
  type ProfitRow,
} from 'src/shared/profit-calc';
import {
  loadProfitRecord,
  money,
  optionalMoney,
  type RecordSource,
} from 'src/shared/record-sources';
import {
  DIRECTION_LABELS,
  ROLE_LABELS,
  normalizeProfitSettings,
  type ProfitRole,
  type ProfitSettings,
} from 'src/shared/profit-rules';

/**
 * Виджет профита в карточке записи — один на все направления.
 *
 * Объект определяется по id записи (см. `record-sources.ts`): «Заказ» (opportunities),
 * «Ремонт оборудования» (remontOborudovaniyas); заправки и тендеры добавляются туда же.
 * Направление, поля сумм и роли берутся из карты объекта, поэтому новых компонентов
 * под каждое направление не нужно.
 *
 * Каждый видит только свой профит:
 *   • сотрудник, указанный в записи в одной из ролей, — свои строки;
 *   • кому в настройках приложения стоит «видит всё» (руководитель) — разбивку
 *     по ролям записи, итог и справочный расчёт «от фактического учёта»;
 *   • остальным — прочерк.
 *
 * Ничего не хранит: считает из полей карточки и настроек приложения при открытии
 * и по кнопке «Обновить» (автообновление при правке сумм в песочнице невозможно).
 */

const SETTINGS_PATH = '/profit-settings';

type ReadyState = {
  breakdown: ProfitBreakdown;
  source: RecordSource;
  seesAll: boolean;
  /** Сколько остаётся компании после выплат (только для «видит всё»). */
  company: number;
};

const readEnv = () =>
  (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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
        throw new Error('Не удалось определить запись');
      }

      if (!userId) {
        throw new Error('Не удалось определить пользователя');
      }

      // Кэш браузера обходим уникальным параметром `_ts`: мост песочницы не
      // передаёт `cache`, а на 304 отдаёт ответ с пустым телом.
      const [meResponse, settingsResponse, loaded] = await Promise.all([
        fetch(
          `${apiBase}/rest/workspaceMembers?filter=${encodeURIComponent(`userId[eq]:${userId}`)}&limit=1&_ts=${Date.now()}`,
          { headers, cache: 'no-store' },
        ),
        fetch(`${functionsBase}${SETTINGS_PATH}?_ts=${Date.now()}`, {
          headers,
          cache: 'no-store',
        }),
        loadProfitRecord(apiBase, recordId, headers),
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
      const settingsJson = (await settingsResponse.json()) as {
        settings?: unknown;
      };

      if (!meResponse.ok) {
        throw new Error(
          `не удалось прочитать сотрудника (HTTP ${meResponse.status}) ${JSON.stringify(meJson).slice(0, 200)}`,
        );
      }

      if (!settingsResponse.ok) {
        throw new Error(
          `не удалось прочитать настройки профита (HTTP ${settingsResponse.status}) ${JSON.stringify(settingsJson).slice(0, 200)}`,
        );
      }

      const { source, record } = loaded;
      const meRow = meJson.data?.workspaceMembers?.[0];
      const settings: ProfitSettings = normalizeProfitSettings(settingsJson.settings);
      const memberId = meRow?.id ?? null;
      const employeeId = meRow?.sotrudnikId ?? null;
      const seesAll = memberId !== null && settings.seesAll.includes(memberId);

      const amountOf = (field: string | null): number =>
        field ? money(record[field]) : 0;
      const roleEmployeeIds: Partial<Record<ProfitRole, string | null>> = {};

      (Object.keys(source.roles) as ProfitRole[]).forEach((role) => {
        const field = source.roles[role] ?? null;

        roleEmployeeIds[role] = field
          ? ((record[field] as string | null | undefined) ?? null)
          : null;
      });

      const inputs: ProfitInputs = {
        services: amountOf(source.servicesField),
        materials: amountOf(source.materialsField),
        contractorCost: amountOf(source.contractorField),
        units: 1,
        materialsUchet: source.materialsUchetField
          ? optionalMoney(record[source.materialsUchetField])
          : undefined,
        roleEmployeeIds,
      };

      const breakdown = calculateProfit(settings, source.direction, inputs, {
        memberId,
        employeeId,
        seesAll,
      });

      if (isRelevant) {
        setReady({
          breakdown,
          source,
          seesAll,
          company: companyProfit(settings, source.direction, inputs, breakdown.total),
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
    // Правила не заданы — только если у направления вообще нет строк ни по одной роли.
    const rulesMissing =
      ready.seesAll && ready.breakdown.groups.length === 0 && ready.breakdown.rows.length === 0;

    return (
      <div style={boxStyle}>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>Профит: —</div>
        <div style={{ opacity: 0.7 }}>
          {rulesMissing
            ? `Правила расчёта для направления «${DIRECTION_LABELS[ready.source.direction]}» ещё не заданы.`
            : 'По этой записи профит вам не начисляется.'}
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

      {ready.seesAll && (
        <div style={{ opacity: 0.85 }}>
          Остаётся компании: {formatMoney(ready.company)}
        </div>
      )}

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
                {ROLE_LABELS[group.role]} — {formatMoney(group.total)}
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

      {ready.breakdown.reference ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            borderLeft: '2px solid rgba(128, 128, 128, 0.35)',
            paddingLeft: '8px',
            opacity: 0.85,
          }}
        >
          <div style={{ fontWeight: 600, opacity: 0.9 }}>
            Справочно, от фактического учёта —{' '}
            {formatMoney(ready.breakdown.reference.total)}
          </div>
          {ready.breakdown.reference.rows.map((row) => (
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
                прибыль {formatMoney(row.base)} · {row.rate}
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{formatMoney(row.amount)}</span>
            </div>
          ))}
          <div style={{ opacity: 0.7 }}>
            Справочная цифра по учётным ценам из 1С, в профит не входит.
          </div>
        </div>
      ) : null}

      <button type="button" style={buttonStyle} onClick={refresh}>
        Обновить
      </button>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: PROFIT_CARD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'profitCard',
  description: 'Профит сотрудника в карточке записи (ремонт, заказ; дальше — заправки, тендеры)',
  component: ProfitCard,
});
