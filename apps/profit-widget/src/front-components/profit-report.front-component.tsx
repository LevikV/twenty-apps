import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useUserId } from 'twenty-sdk/front-component';

import { PROFIT_REPORT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  baseValue,
  calculateProfit,
  formatMoney,
  type ProfitInputs,
} from 'src/shared/profit-calc';
import {
  normalizeProfitSettings,
  type ProfitRole,
  type ProfitSettings,
  type ProfitUnit,
} from 'src/shared/profit-rules';

/**
 * Отчёт «Профит по ремонтам» — виджет дашборда.
 *
 * Этап 2 (04.10.2026): фильтры — период (пресеты + произвольный «с/по»), стадия, сотрудник.
 * Границы суток и месяца считаются по UTC+10 (Биробиджан).
 *
 * Кто что видит:
 *   • обычный сотрудник — свой профит и только те ремонты, где он участник;
 *   • кому в настройках стоит «видит всё» (руководитель) — выбор сотрудника
 *     (по умолчанию «Все сотрудники»); в колонке «Профит» — либо сумма по ремонту,
 *     либо профит выбранного сотрудника.
 *
 * Считается тем же модулем `profit-calc`, что и виджет карточки, поэтому цифры сходятся.
 */

const SETTINGS_PATH = '/profit-settings';
const MICROS = 1_000_000;
/** Биробиджан, UTC+10 — границы суток и месяца считаем по поясу Алексея. */
const SHIFT_MS = 10 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_LIMIT = 200;
const MAX_PAGES = 6;
const ROLES: ProfitRole[] = ['master', 'otvetstvennyy', 'priyomshchik'];

type PeriodPreset = 'today' | 'yesterday' | 'week' | 'month' | 'prevMonth';

const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: 'Сегодня',
  yesterday: 'Вчера',
  week: '7 дней',
  month: 'Этот месяц',
  prevMonth: 'Прошлый месяц',
};

/** Стадии «Ремонта оборудования» — значения и подписи из метаданных CRM. */
const STAGES: { value: string; label: string }[] = [
  { value: 'NA_PRIEMKE', label: 'На приемке' },
  { value: 'V_OCHEREDI', label: 'В очереди' },
  { value: 'V_RABOTE', label: 'В работе' },
  { value: 'TREBUET_SOGLASOVANIYA_S_ZAKAZCHIKOM', label: 'Требует согласования с заказчиком' },
  { value: 'OZHIDAET_RESHENIYA_ZAKAZCHIKA', label: 'Ожидает решения заказчика' },
  { value: 'OZHIDANIE_PREDOPLATY', label: 'Ожидание предоплаты' },
  { value: 'POISK_DETALEY', label: 'Поиск деталей' },
  { value: 'OZHIDAET_DETALEY', label: 'Ожидает деталей' },
  { value: 'TREBUET_OTKLIKA_GOTOVO', label: 'Требует отклика (готово)' },
  { value: 'GOTOVO_K_VYDACHE', label: 'Готово к выдаче' },
  { value: 'VYDAN', label: 'Выдан' },
  { value: 'ZABRAT', label: 'Забрать' },
  { value: 'NA_PROVERKE', label: 'На проверке' },
  { value: 'TREBUET_OTKLIKA_ADMINISTRATORA', label: 'Требует отклика администратора' },
  { value: 'TREBUET_OTKLIKA_MASTERA', label: 'Требует отклика мастера' },
  { value: 'TREBUET_OTKLIKA_MENEDZHERA', label: 'Требует отклика менеджера' },
];

type RepairRecord = {
  id: string;
  name?: string | null;
  proveden?: string | null;
  status?: string | null;
  stadiya?: string | null;
  stoimostRabot?: unknown;
  stoimostMaterialov?: unknown;
  stoimostPodryadchika?: unknown;
  masterId?: string | null;
  otvetstvennyyId?: string | null;
  priyomshchikId?: string | null;
};

type PersonName = { firstName?: string; lastName?: string } | null;

type MemberInfo = {
  id: string;
  userId?: string | null;
  sotrudnikId?: string | null;
  name?: PersonName;
};

type Employee = { id: string; name: string };

type ReportRow = {
  id: string;
  day: string;
  sortKey: string;
  name: string;
  master: string;
  services: number;
  materials: number;
  /** Профит по каждому сотруднику записи: employeeId → сумма. */
  profitByEmployee: Record<string, number>;
  /** Профит по ремонту целиком (все роли). */
  totalProfit: number;
  inProgress: boolean;
  stage: string;
};

type ReadyState = {
  rows: ReportRow[];
  periodLabel: string;
  viewerEmployeeId: string | null;
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

/** ФИО из FULL_NAME: сначала фамилия, потом имя (как в списках CRM). */
const fullName = (name?: PersonName) =>
  `${name?.lastName ?? ''} ${name?.firstName ?? ''}`.trim();

const pad = (value: number) => String(value).padStart(2, '0');

/** Календарный ключ (YYYY-MM-DD) по UTC+10. */
const dateKey = (time: number): string => {
  const local = new Date(time + SHIFT_MS);

  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
};

const shiftKey = (key: string, days: number): string =>
  dateKey(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS - SHIFT_MS);

/** Начало суток (по UTC+10) для календарного ключа → ISO в UTC. */
const dayStartIso = (key: string): string =>
  new Date(Date.parse(`${key}T00:00:00Z`) - SHIFT_MS).toISOString();

/** Последняя миллисекунда суток (по UTC+10) → ISO в UTC. */
const dayEndIso = (key: string): string =>
  new Date(Date.parse(`${key}T00:00:00Z`) + DAY_MS - SHIFT_MS - 1).toISOString();

const periodForPreset = (
  preset: PeriodPreset,
  todayKey: string,
): { from: string; to: string } => {
  switch (preset) {
    case 'today':
      return { from: todayKey, to: todayKey };
    case 'yesterday': {
      const yesterday = shiftKey(todayKey, -1);

      return { from: yesterday, to: yesterday };
    }
    case 'week':
      return { from: shiftKey(todayKey, -6), to: todayKey };
    case 'prevMonth': {
      const [yearStr, monthStr] = todayKey.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();

      return {
        from: `${prevYear}-${pad(prevMonth)}-01`,
        to: `${prevYear}-${pad(prevMonth)}-${pad(lastDay)}`,
      };
    }
    case 'month':
    default:
      return { from: `${todayKey.slice(0, 7)}-01`, to: todayKey };
  }
};

const humanDate = (key: string): string => {
  const [year, month, day] = key.split('-');

  return `${day}.${month}.${year}`;
};

const periodLabelOf = (from: string, to: string): string => {
  if (from === to) {
    return humanDate(from);
  }

  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${from.slice(8, 10)}.${from.slice(5, 7)} — ${to.slice(8, 10)}.${to.slice(5, 7)}.${to.slice(0, 4)}`;
  }

  return `${humanDate(from)} — ${humanDate(to)}`;
};

const inputsOf = (record: RepairRecord): ProfitInputs => ({
  services: money(record.stoimostRabot),
  materials: money(record.stoimostMaterialov),
  contractorCost: money(record.stoimostPodryadchika),
  units: 1,
  roleEmployeeIds: {
    master: record.masterId ?? null,
    otvetstvennyy: record.otvetstvennyyId ?? null,
    priyomshchik: record.priyomshchikId ?? null,
  },
});

const amountOf = (value: number, unit: ProfitUnit, base: number): number =>
  unit === 'percent' ? (base * value) / 100 : value;

/** Профит по ремонту целиком: правила направления по трём ролям записи. */
const recordProfit = (settings: ProfitSettings, inputs: ProfitInputs): number => {
  const direction = settings.directions.remont;

  return ROLES.reduce((total, role) => {
    if (!inputs.roleEmployeeIds[role]) {
      return total;
    }

    const rows = direction.rules.filter((rule) => rule.role === role);

    return (
      total +
      rows.reduce(
        (sum, rule) =>
          sum + amountOf(rule.value, rule.unit, baseValue(rule.base, inputs, direction)),
        0,
      )
    );
  }, 0);
};

const ProfitReport = () => {
  const userId = useUserId();
  const now = useMemo(() => new Date(), []);
  const todayKey = dateKey(now.getTime());
  const defaultPeriod = periodForPreset('month', todayKey);

  const [preset, setPreset] = useState<PeriodPreset | null>('month');
  const [from, setFrom] = useState(defaultPeriod.from);
  const [to, setTo] = useState(defaultPeriod.to);
  const [stage, setStage] = useState('');
  const [employeeId, setEmployeeId] = useState('all');

  const [refreshToken, setRefreshToken] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [ready, setReady] = useState<ReadyState | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const refresh = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  const applyPreset = useCallback(
    (next: PeriodPreset) => {
      const period = periodForPreset(next, todayKey);

      setPreset(next);
      setFrom(period.from);
      setTo(period.to);
    },
    [todayKey],
  );

  useEffect(() => {
    let isRelevant = true;

    const load = async () => {
      setIsLoading(true);
      setError('');

      const { TWENTY_API_URL, TWENTY_FUNCTIONS_URL, TWENTY_APP_ACCESS_TOKEN } = readEnv();
      const apiBase = (TWENTY_API_URL ?? '').replace(/\/+$/, '');
      const functionsBase = (TWENTY_FUNCTIONS_URL ?? '').replace(/\/+$/, '');
      const token = TWENTY_APP_ACCESS_TOKEN ?? '';
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      if (!apiBase) {
        throw new Error('Не найден адрес Twenty API');
      }

      if (!userId) {
        throw new Error('Не удалось определить пользователя');
      }

      const stamp = Date.now();
      // Кэш браузера обходим параметром `_ts`: мост песочницы не передаёт
      // `cache`, а на 304 отдаёт пустое тело.
      const [membersResponse, employeesResponse, settingsResponse] = await Promise.all([
        fetch(`${apiBase}/rest/workspaceMembers?limit=50&_ts=${stamp}`, {
          headers,
          cache: 'no-store',
        }),
        fetch(`${apiBase}/rest/sotrudniki?limit=200&_ts=${stamp}`, {
          headers,
          cache: 'no-store',
        }),
        fetch(`${functionsBase}${SETTINGS_PATH}?_ts=${stamp}`, {
          headers,
          cache: 'no-store',
        }),
      ]);

      const membersJson = (await membersResponse.json()) as {
        data?: { workspaceMembers?: MemberInfo[] };
      };
      const employeesJson = (await employeesResponse.json()) as {
        data?: { sotrudniki?: { id: string; fio?: PersonName }[] };
      };
      const settingsJson = (await settingsResponse.json()) as { settings?: unknown };

      if (!membersResponse.ok) {
        throw new Error(`не удалось прочитать участников (HTTP ${membersResponse.status})`);
      }

      if (!employeesResponse.ok) {
        throw new Error(
          `не удалось прочитать сотрудников (HTTP ${employeesResponse.status})`,
        );
      }

      if (!settingsResponse.ok) {
        throw new Error(
          `не удалось прочитать настройки профита (HTTP ${settingsResponse.status})`,
        );
      }

      const repairFilter = `proveden[gte]:${dayStartIso(from)},proveden[lte]:${dayEndIso(to)}`;
      const repairs: RepairRecord[] = [];
      let cursor: string | null = null;

      for (let page = 0; page < MAX_PAGES; page += 1) {
        const url =
          `${apiBase}/rest/remontOborudovaniyas?filter=${encodeURIComponent(repairFilter)}` +
          `&order_by=${encodeURIComponent('proveden[AscNullsFirst]')}` +
          `&limit=${PAGE_LIMIT}&_ts=${stamp}` +
          (cursor ? `&starting_after=${encodeURIComponent(cursor)}` : '');

        const response = await fetch(url, { headers, cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`не удалось прочитать ремонты (HTTP ${response.status})`);
        }

        const json = (await response.json()) as {
          data?: { remontOborudovaniyas?: RepairRecord[] };
          pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
        };

        repairs.push(...(json.data?.remontOborudovaniyas ?? []));

        if (!json.pageInfo?.hasNextPage || !json.pageInfo.endCursor) {
          break;
        }

        cursor = json.pageInfo.endCursor;
      }

      const settings: ProfitSettings = normalizeProfitSettings(settingsJson.settings);
      const members = membersJson.data?.workspaceMembers ?? [];
      const me = members.find((item) => item.userId === userId);
      const memberId = me?.id ?? null;
      const viewerEmployeeId = me?.sotrudnikId ?? null;
      const canSeeAll = memberId !== null && settings.seesAll.includes(memberId);
      const memberByEmployee = new Map(
        members
          .filter((item) => item.sotrudnikId)
          .map((item) => [item.sotrudnikId as string, item.id]),
      );
      const namesById = new Map(
        (employeesJson.data?.sotrudniki ?? []).map((item) => [item.id, fullName(item.fio)]),
      );

      // Персональные правила приложения привязаны к участнику воркспейса,
      // поэтому для каждого сотрудника берём его memberId (если учётка есть).
      const profitFor = (
        inputs: ProfitInputs,
        employee: string,
      ): number =>
        calculateProfit(settings, 'remont', inputs, {
          memberId: memberByEmployee.get(employee) ?? null,
          employeeId: employee,
          seesAll: false,
        }).total;

      const rows: ReportRow[] = repairs
        .map((record) => {
          const inputs = inputsOf(record);
          const profitByEmployee: Record<string, number> = {};

          for (const role of ROLES) {
            const employee = inputs.roleEmployeeIds[role];

            if (!employee) {
              continue;
            }

            profitByEmployee[employee] = profitFor(inputs, employee);
          }

          return {
            id: record.id,
            day: record.proveden ? dateKey(Date.parse(record.proveden)) : '—',
            sortKey: record.proveden ?? '',
            name: record.name ?? '',
            master: record.masterId ? (namesById.get(record.masterId) ?? '') : '',
            services: inputs.services,
            materials: inputs.materials,
            profitByEmployee,
            totalProfit: recordProfit(settings, inputs),
            inProgress: record.status === 'V_RABOTE',
            stage: record.stadiya ?? '',
          };
        })
        .sort((first, second) => second.sortKey.localeCompare(first.sortKey));

      const employeeList: Employee[] = [...namesById.entries()]
        .map(([id, name]) => ({ id, name: name || 'Без ФИО' }))
        .sort((first, second) => first.name.localeCompare(second.name));

      if (isRelevant) {
        setEmployees(employeeList);
        setReady({
          rows,
          periodLabel: periodLabelOf(from, to),
          viewerEmployeeId,
          viewerName: me ? fullName(me.name) : '',
          seesAll: canSeeAll,
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
  }, [userId, refreshToken, from, to]);

  /** Чей профит показываем: у «видит всё» — выбранный (или все), у остальных — свой. */
  const scope = ready
    ? ready.seesAll
      ? employeeId
      : (ready.viewerEmployeeId ?? 'self')
    : 'self';

  const view = useMemo(() => {
    if (!ready) {
      return null;
    }

    const profitOf = (row: ReportRow): number => {
      if (scope === 'all') {
        return row.totalProfit;
      }

      return row.profitByEmployee[scope] ?? 0;
    };

    const visibleRows = ready.rows
      .filter((row) => !stage || row.stage === stage)
      .filter((row) => scope === 'all' || profitOf(row) !== 0);

    const totalProfit = visibleRows.reduce((sum, row) => sum + profitOf(row), 0);
    const inProgress = visibleRows.filter((row) => row.inProgress);

    return {
      rows: visibleRows,
      profitOf,
      totalProfit,
      inProgressCount: inProgress.length,
      inProgressProfit: inProgress.reduce((sum, row) => sum + profitOf(row), 0),
    };
  }, [ready, stage, scope]);

  const scopeLabel = (() => {
    if (!ready) {
      return '';
    }

    if (!ready.seesAll) {
      return ready.viewerName || 'мой профит';
    }

    return employeeId === 'all'
      ? 'все сотрудники'
      : (employees.find((item) => item.id === employeeId)?.name ?? 'сотрудник');
  })();

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

  const chipStyle = (isActive: boolean): CSSProperties => ({
    padding: '3px 9px',
    borderRadius: '999px',
    border: `1px solid ${isActive ? 'rgba(120, 150, 255, 0.9)' : 'rgba(128, 128, 128, 0.35)'}`,
    background: isActive ? 'rgba(120, 150, 255, 0.18)' : 'transparent',
    color: 'inherit',
    fontSize: '12px',
    cursor: 'pointer',
  });

  const selectStyle: CSSProperties = {
    padding: '3px 6px',
    borderRadius: '6px',
    border: '1px solid rgba(128, 128, 128, 0.35)',
    background: 'transparent',
    color: 'inherit',
    fontSize: '12px',
    maxWidth: '260px',
  };

  const dateStyle: CSSProperties = {
    padding: '2px 6px',
    borderRadius: '6px',
    border: '1px solid rgba(128, 128, 128, 0.35)',
    background: 'transparent',
    color: 'inherit',
    fontSize: '12px',
    width: '120px',
  };

  const headCellStyle: CSSProperties = {
    textAlign: 'left',
    padding: '4px 8px',
    opacity: 0.7,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    background: 'inherit',
  };

  const cellStyle: CSSProperties = {
    padding: '4px 8px',
    whiteSpace: 'nowrap',
  };

  const filtersBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ opacity: 0.7 }}>Период:</span>
        {(Object.keys(PRESET_LABELS) as PeriodPreset[]).map((item) => (
          <button
            key={item}
            type="button"
            style={chipStyle(preset === item)}
            onClick={() => applyPreset(item)}
          >
            {PRESET_LABELS[item]}
          </button>
        ))}
        <input
          type="date"
          style={dateStyle}
          value={from}
          onChange={(event) => {
            setPreset(null);
            setFrom(event.target.value);
          }}
        />
        <span style={{ opacity: 0.6 }}>—</span>
        <input
          type="date"
          style={dateStyle}
          value={to}
          onChange={(event) => {
            setPreset(null);
            setTo(event.target.value);
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ opacity: 0.7 }}>Стадия:</span>
        <select
          style={selectStyle}
          value={stage}
          onChange={(event) => setStage(event.target.value)}
        >
          <option value="">Все стадии</option>
          {STAGES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        {ready?.seesAll && (
          <>
            <span style={{ opacity: 0.7, marginLeft: '8px' }}>Сотрудник:</span>
            <select
              style={selectStyle}
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="all">Все сотрудники</option>
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );

  if (error) {
    return (
      <div style={boxStyle}>
        {filtersBlock}
        <div>✗ {error}</div>
        <button type="button" style={buttonStyle} onClick={refresh}>
          Обновить
        </button>
      </div>
    );
  }

  if (isLoading || !ready || !view) {
    return (
      <div style={boxStyle}>
        {filtersBlock}
        <div style={{ opacity: 0.8 }}>Считаем профит…</div>
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      {filtersBlock}

      <div style={{ fontSize: '16px', fontWeight: 600 }}>
        Профит: {formatMoney(view.totalProfit)}
      </div>
      <div style={{ opacity: 0.75 }}>
        {ready.periodLabel} · {scopeLabel} · ремонтов: {view.rows.length}
        {view.inProgressCount > 0
          ? ` · в работе: ${view.inProgressCount} на ${formatMoney(view.inProgressProfit)}`
          : ''}
      </div>

      {view.rows.length === 0 ? (
        <div style={{ opacity: 0.75 }}>За выбранный период ремонтов с профитом нет.</div>
      ) : (
        <div style={{ maxHeight: '340px', overflowY: 'auto', marginTop: '4px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={headCellStyle}>Дата</th>
                <th style={headCellStyle}>№</th>
                <th style={headCellStyle}>Мастер</th>
                <th style={{ ...headCellStyle, textAlign: 'right' }}>Услуги</th>
                <th style={{ ...headCellStyle, textAlign: 'right' }}>Материалы</th>
                <th style={{ ...headCellStyle, textAlign: 'right' }}>Профит</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => {
                const profit = view.profitOf(row);

                return (
                  <tr key={row.id}>
                    <td style={cellStyle}>{row.day}</td>
                    <td style={cellStyle}>{row.name}</td>
                    <td style={cellStyle}>{row.master || '—'}</td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      {formatMoney(row.services)}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      {formatMoney(row.materials)}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>
                      {profit === 0 ? '—' : formatMoney(profit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" style={buttonStyle} onClick={refresh}>
        Обновить
      </button>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: PROFIT_REPORT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'profitReport',
  description: 'Отчёт «Профит по ремонтам» за период — виджет дашборда',
  component: ProfitReport,
});
