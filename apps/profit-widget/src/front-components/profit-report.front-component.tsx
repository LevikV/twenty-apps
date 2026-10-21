import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  openSidePanelPage,
  SidePanelPages,
  useUserId,
} from 'twenty-sdk/front-component';

import { PROFIT_REPORT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  baseValue,
  calculateProfit,
  companyProfit,
  companyProfitUchet,
  formatMoney,
  referenceProfit,
  type ProfitInputs,
} from 'src/shared/profit-calc';
import {
  normalizeProfitSettings,
  type ProfitDirection,
  type ProfitRole,
  type ProfitSettings,
  type ProfitUnit,
} from 'src/shared/profit-rules';
import {
  RECORD_SOURCES,
  sourceByDirection,
  type RecordSource,
} from 'src/shared/record-sources';

/**
 * Отчёт «Профит» — виджет дашборда.
 *
 * Универсальный: направление выбирается в самом отчёте — Заказы / Ремонты / Все.
 * Поля каждого направления (базы расчёта, дата периода, стадия, участник) описаны
 * в карте `record-sources.ts`, поэтому подключение заправок и тендеров — одна запись
 * в карте, компонент не меняется.
 *
 * Поведение:
 *   • «Заказы» / «Ремонты» — итог в шапке и список записей;
 *   • «Все» — сводка по направлениям (в одну таблицу их не свести: разные поля
 *     и разная дата периода);
 *   • период — пресеты + произвольный «с/по», границы суток по UTC+10 (Биробиджан);
 *   • обычный сотрудник видит свой профит и только свои записи;
 *   • кому в настройках стоит «видит всё» — выбор сотрудника и профит по записи целиком.
 *
 * Считается тем же модулем `profit-calc`, что и виджет карточки, поэтому цифры сходятся.
 */

const SETTINGS_PATH = '/profit-settings';
const SHIFT_MS = 10 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_LIMIT = 200;
const MAX_PAGES = 6;

type PeriodPreset = 'today' | 'yesterday' | 'week' | 'month' | 'prevMonth';

const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: 'Сегодня',
  yesterday: 'Вчера',
  week: 'Эта неделя',
  month: 'Этот месяц',
  prevMonth: 'Прошлый месяц',
};

/** Ключ «все направления» — сводка. Остальные ключи совпадают с направлением профита. */
type EntityKey = 'all' | ProfitDirection;

const ENTITY_CHIPS: { key: EntityKey; label: string }[] = [
  { key: 'all', label: 'Все' },
  ...RECORD_SOURCES.map((source) => ({
    key: source.direction as EntityKey,
    label: source.label,
  })),
];

/** Как называется колонка базовой стоимости у направления. */
const BASE_COLUMN_LABELS: Partial<Record<ProfitDirection, string>> = {
  zakaz: 'Товары',
  remont: 'Материалы',
  zapravka: 'Товары',
  tender: 'Товары',
};

/** Подпись записей в шапке. */
const ROW_LABELS: Partial<Record<ProfitDirection, [string, string, string]>> = {
  zakaz: ['заказ', 'заказа', 'заказов'],
  remont: ['ремонт', 'ремонта', 'ремонтов'],
  zapravka: ['заправка', 'заправки', 'заправок'],
  tender: ['тендер', 'тендера', 'тендеров'],
};

/** Склонение: 1 заказ, 2 заказа, 5 заказов. */
const plural = (count: number, forms: [string, string, string]): string => {
  const tail = count % 100;

  if (tail >= 11 && tail <= 14) {
    return forms[2];
  }

  switch (count % 10) {
    case 1:
      return forms[0];
    case 2:
    case 3:
    case 4:
      return forms[1];
    default:
      return forms[2];
  }
};

type PersonName = { firstName?: string; lastName?: string } | null;

type MemberInfo = {
  id: string;
  userId?: string | null;
  sotrudnikId?: string | null;
  name?: PersonName;
};

type Employee = { id: string; name: string };

type ProfitRecord = Record<string, unknown> & { id: string };

type ReportRow = {
  id: string;
  /** Имя объекта в единственном числе — для открытия записи в боковой панели. */
  objectName: string;
  direction: ProfitDirection;
  day: string;
  sortKey: string;
  name: string;
  participant: string;
  services: number;
  materials: number;
  /** Профит по каждому сотруднику записи: employeeId → сумма. */
  profitByEmployee: Record<string, number>;
  /** Профит по записи целиком (все роли). */
  totalProfit: number;
  /** Тот же профит, но от базы «фактический учёт» (справочно, только для «видит всё»). */
  referenceProfit: number;
  /** Сколько остаётся компании после выплат по этой записи. */
  company: number;
  /** То же, но когда прибыль по товарам считается от фактического учёта. */
  companyUchet: number;
  inProgress: boolean;
  stage: string;
};

type SummaryRow = {
  direction: ProfitDirection;
  label: string;
  count: number;
  base: number;
  profit: number;
  /** Профит от фактического учёта (справочно). */
  reference: number;
  company: number;
  /** Остаток компании при расчёте от фактического учёта. */
  companyUchet: number;
};

type ReadyState = {
  rows: ReportRow[];
  summary: SummaryRow[];
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

  return Number.isFinite(parsed) ? parsed / 1_000_000 : 0;
};

/** Необязательная сумма: пусто → undefined (учётной стоимости нет). */
const optionalMoney = (value: unknown): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const micros = (value as { amountMicros?: unknown }).amountMicros;

  if (micros === null || micros === undefined) {
    return undefined;
  }

  return money(value);
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
    case 'week': {
      // «Эта неделя» — календарная: с понедельника текущей недели по сегодня.
      const dayOfWeek = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
      const offset = (dayOfWeek + 6) % 7;

      return { from: shiftKey(todayKey, -offset), to: todayKey };
    }
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

/** Входы расчёта из записи по карте объекта. */
const inputsOf = (source: RecordSource, record: ProfitRecord): ProfitInputs => {
  const roleEmployeeIds: Partial<Record<ProfitRole, string | null>> = {};

  for (const [role, field] of Object.entries(source.roles)) {
    if (field) {
      roleEmployeeIds[role as ProfitRole] = (record[field] as string | null) ?? null;
    }
  }

  return {
    services: source.servicesField ? money(record[source.servicesField]) : 0,
    materials: source.materialsField ? money(record[source.materialsField]) : 0,
    contractorCost: source.contractorField ? money(record[source.contractorField]) : 0,
    units: 1,
    materialsUchet: source.materialsUchetField
      ? optionalMoney(record[source.materialsUchetField])
      : undefined,
    roleEmployeeIds,
  };
};

const amountOf = (value: number, unit: ProfitUnit, base: number): number =>
  unit === 'percent' ? (base * value) / 100 : value;

/** Профит по записи целиком: правила направления по всем ролям записи. */
const recordProfit = (
  settings: ProfitSettings,
  source: RecordSource,
  inputs: ProfitInputs,
): number => {
  const direction = settings.directions[source.direction];
  const roles = Object.keys(source.roles) as ProfitRole[];

  return roles.reduce((total, role) => {
    if (!inputs.roleEmployeeIds[role]) {
      return total;
    }

    const rows = direction.rules.filter((rule) => rule.role === role);

    return (
      total +
      rows.reduce(
        (sum, rule) => sum + amountOf(rule.value, rule.unit, baseValue(rule.base, inputs, direction)),
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

  const [entity, setEntity] = useState<EntityKey>('all');
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

  const activeSource = entity === 'all' ? undefined : sourceByDirection(entity);
  const stages = activeSource?.stages ?? [];

  const refresh = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  const pickEntity = useCallback((next: EntityKey) => {
    setEntity(next);
    // Стадии у направлений разные — старый фильтр не должен «залипнуть».
    setStage('');
    setEmployeeId('all');
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
        direction: ProfitDirection,
        inputs: ProfitInputs,
        employee: string,
      ): number =>
        calculateProfit(settings, direction, inputs, {
          memberId: memberByEmployee.get(employee) ?? null,
          employeeId: employee,
          seesAll: false,
        }).total;

      /** Читает записи одного направления за период и превращает их в строки отчёта. */
      const loadRows = async (source: RecordSource): Promise<ReportRow[]> => {
        const filter = `${source.periodField}[gte]:${dayStartIso(from)},${source.periodField}[lte]:${dayEndIso(to)}`;
        const records: ProfitRecord[] = [];
        let cursor: string | null = null;

        for (let page = 0; page < MAX_PAGES; page += 1) {
          const url =
            `${apiBase}/rest/${source.endpoint}?filter=${encodeURIComponent(filter)}` +
            `&order_by=${encodeURIComponent(`${source.periodField}[AscNullsFirst]`)}` +
            `&limit=${PAGE_LIMIT}&_ts=${stamp}` +
            (cursor ? `&starting_after=${encodeURIComponent(cursor)}` : '');

          const response = await fetch(url, { headers, cache: 'no-store' });

          if (!response.ok) {
            throw new Error(
              `не удалось прочитать «${source.label}» (HTTP ${response.status})`,
            );
          }

          const json = (await response.json()) as {
            data?: Record<string, ProfitRecord[] | undefined>;
            pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
          };

          records.push(...(json.data?.[source.endpoint] ?? []));

          if (!json.pageInfo?.hasNextPage || !json.pageInfo.endCursor) {
            break;
          }

          cursor = json.pageInfo.endCursor;
        }

        return records.map((record) => {
          const inputs = inputsOf(source, record);
          const profitByEmployee: Record<string, number> = {};
          const roles = Object.keys(source.roles) as ProfitRole[];

          for (const role of roles) {
            const employee = inputs.roleEmployeeIds[role];

            if (!employee) {
              continue;
            }

            profitByEmployee[employee] = profitFor(source.direction, inputs, employee);
          }

          const periodValue = record[source.periodField] as string | null | undefined;
          const participantId = inputs.roleEmployeeIds[source.participantRole] ?? null;
          const totalProfit = recordProfit(settings, source, inputs);
          const refProfit = referenceProfit(settings, source.direction, inputs);

          return {
            id: record.id,
            objectName: source.recordKey,
            direction: source.direction,
            day: periodValue ? dateKey(Date.parse(periodValue)) : '—',
            sortKey: periodValue ?? '',
            name: (record.name as string) ?? '',
            participant: participantId ? (namesById.get(participantId) ?? '') : '',
            services: inputs.services,
            materials: inputs.materials,
            profitByEmployee,
            totalProfit,
            referenceProfit: refProfit,
            company: companyProfit(settings, source.direction, inputs, totalProfit),
            companyUchet: companyProfitUchet(settings, source.direction, inputs, refProfit),
            inProgress: record[source.statusField] === 'V_RABOTE',
            stage: (record[source.stageField] as string) ?? '',
          };
        });
      };

      const sources =
        entity === 'all'
          ? RECORD_SOURCES
          : [sourceByDirection(entity)].filter((item): item is RecordSource => Boolean(item));

      const rows: ReportRow[] = [];

      for (const source of sources) {
        rows.push(...(await loadRows(source)));
      }

      rows.sort((first, second) => second.sortKey.localeCompare(first.sortKey));

      const summary: SummaryRow[] = sources.map((source) => {
        const own = rows.filter((row) => row.direction === source.direction);

        return {
          direction: source.direction,
          label: source.label,
          count: own.length,
          base: own.reduce((sum, row) => sum + row.materials, 0),
          profit: own.reduce((sum, row) => sum + row.totalProfit, 0),
          reference: own.reduce((sum, row) => sum + row.referenceProfit, 0),
          company: own.reduce((sum, row) => sum + row.company, 0),
          companyUchet: own.reduce((sum, row) => sum + row.companyUchet, 0),
        };
      });

      const employeeList: Employee[] = [...namesById.entries()]
        .map(([id, name]) => ({ id, name: name || 'Без ФИО' }))
        .sort((first, second) => first.name.localeCompare(second.name));

      if (isRelevant) {
        setEmployees(employeeList);
        setReady({
          rows,
          summary,
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
  }, [userId, refreshToken, from, to, entity]);

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
      companyTotal: visibleRows.reduce((sum, row) => sum + row.company, 0),
      companyUchetTotal: visibleRows.reduce((sum, row) => sum + row.companyUchet, 0),
      referenceTotal: visibleRows.reduce((sum, row) => sum + row.referenceProfit, 0),
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
        <span style={{ opacity: 0.7 }}>Считаем:</span>
        {ENTITY_CHIPS.map((item) => (
          <button
            key={item.key}
            type="button"
            style={chipStyle(entity === item.key)}
            onClick={() => pickEntity(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

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
        {stages.length > 0 && (
          <>
            <span style={{ opacity: 0.7 }}>Стадия:</span>
            <select
              style={selectStyle}
              value={stage}
              onChange={(event) => setStage(event.target.value)}
            >
              <option value="">Все стадии</option>
              {stages.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </>
        )}

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

  const entityLabel =
    entity === 'all'
      ? 'все направления'
      : (sourceByDirection(entity)?.label ?? '').toLowerCase();

  const countLabel =
    entity === 'all'
      ? `${view.rows.length} записей`
      : `${view.rows.length} ${plural(
          view.rows.length,
          ROW_LABELS[entity] ?? ['запись', 'записи', 'записей'],
        )}`;

  const summaryRows: SummaryRow[] =
    entity === 'all'
      ? ready.summary.map((row) => ({
          ...row,
          count: view.rows.filter((item) => item.direction === row.direction).length,
          company: view.rows
            .filter((item) => item.direction === row.direction)
            .reduce((sum, item) => sum + item.company, 0),
          companyUchet: view.rows
            .filter((item) => item.direction === row.direction)
            .reduce((sum, item) => sum + item.companyUchet, 0),
          reference: view.rows
            .filter((item) => item.direction === row.direction)
            .reduce((sum, item) => sum + item.referenceProfit, 0),
          profit:
            scope === 'all'
              ? view.rows
                  .filter((item) => item.direction === row.direction)
                  .reduce((sum, item) => sum + item.totalProfit, 0)
              : view.rows
                  .filter((item) => item.direction === row.direction)
                  .reduce((sum, item) => sum + (item.profitByEmployee[scope] ?? 0), 0),
        }))
      : [];

  return (
    <div style={boxStyle}>
      {filtersBlock}

      <div style={{ fontSize: '16px', fontWeight: 600 }}>
        Профит: {formatMoney(view.totalProfit)}
      </div>
      {ready.seesAll && (
        <>
          <div style={{ opacity: 0.85 }}>
            Профит от фактического учёта: {formatMoney(view.referenceTotal)}
          </div>
          <div style={{ opacity: 0.85 }}>
            Остаётся компании: {formatMoney(view.companyTotal)}
          </div>
          <div style={{ opacity: 0.85 }}>
            Остаётся компании (от учёта): {formatMoney(view.companyUchetTotal)}
          </div>
        </>
      )}
      <div style={{ opacity: 0.75 }}>
        {ready.periodLabel} · {scopeLabel} · {entityLabel} · {countLabel}
        {view.inProgressCount > 0
          ? ` · в работе: ${view.inProgressCount} на ${formatMoney(view.inProgressProfit)}`
          : ''}
      </div>

      {entity === 'all' ? (
        <div style={{ marginTop: '4px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={headCellStyle}>Направление</th>
                <th style={{ ...headCellStyle, textAlign: 'right' }}>Записей</th>
                <th style={{ ...headCellStyle, textAlign: 'right' }}>Товары/материалы</th>
                <th style={{ ...headCellStyle, textAlign: 'right' }}>Профит</th>
                {ready.seesAll && (
                  <th style={{ ...headCellStyle, textAlign: 'right' }}>Профит (учёт)</th>
                )}
                {ready.seesAll && (
                  <th style={{ ...headCellStyle, textAlign: 'right' }}>Остаётся компании</th>
                )}
                {ready.seesAll && (
                  <th style={{ ...headCellStyle, textAlign: 'right' }}>Остаётся (учёт)</th>
                )}
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row) => (
                <tr
                  key={row.direction}
                  style={{ cursor: 'pointer' }}
                  onClick={() => pickEntity(row.direction)}
                >
                  <td style={cellStyle}>{row.label}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{row.count}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{formatMoney(row.base)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>
                    {row.profit === 0 ? '—' : formatMoney(row.profit)}
                  </td>
                  {ready.seesAll && (
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      {formatMoney(row.reference)}
                    </td>
                  )}
                  {ready.seesAll && (
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      {formatMoney(row.company)}
                    </td>
                  )}
                  {ready.seesAll && (
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      {formatMoney(row.companyUchet)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view.rows.length === 0 ? (
        <div style={{ opacity: 0.75 }}>За выбранный период записей с профитом нет.</div>
      ) : (
        <div style={{ maxHeight: '340px', overflowY: 'auto', marginTop: '4px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={headCellStyle}>Дата</th>
                <th style={headCellStyle}>№</th>
                <th style={headCellStyle}>{activeSource?.participantLabel ?? 'Участник'}</th>
                {activeSource?.servicesField && (
                  <th style={{ ...headCellStyle, textAlign: 'right' }}>Услуги</th>
                )}
                <th style={{ ...headCellStyle, textAlign: 'right' }}>
                  {BASE_COLUMN_LABELS[entity] ?? 'База'}
                </th>
                <th style={{ ...headCellStyle, textAlign: 'right' }}>Профит</th>
                {ready.seesAll && (
                  <th style={{ ...headCellStyle, textAlign: 'right' }}>Профит (учёт)</th>
                )}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => {
                const profit = view.profitOf(row);

                return (
                  <tr
                    key={row.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      void openSidePanelPage({
                        page: SidePanelPages.ViewRecord,
                        recordId: row.id,
                        objectNameSingular: row.objectName,
                      });
                    }}
                  >
                    <td style={cellStyle}>{row.day}</td>
                    <td style={cellStyle}>{row.name}</td>
                    <td style={cellStyle}>{row.participant || '—'}</td>
                    {activeSource?.servicesField && (
                      <td style={{ ...cellStyle, textAlign: 'right' }}>
                        {formatMoney(row.services)}
                      </td>
                    )}
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      {formatMoney(row.materials)}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>
                      {profit === 0 ? '—' : formatMoney(profit)}
                    </td>
                    {ready.seesAll && (
                      <td style={{ ...cellStyle, textAlign: 'right' }}>
                        {row.referenceProfit === 0 ? '—' : formatMoney(row.referenceProfit)}
                      </td>
                    )}
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
  description: 'Отчёт «Профит» за период — виджет дашборда (заказы, ремонты и другие направления)',
  component: ProfitReport,
});
