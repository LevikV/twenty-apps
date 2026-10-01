import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Поиск нашего сотрудника по номеру из ВАТС.
 *
 * Схема с 30.09.2026: телефон живёт в карточке объекта **«Сотрудник»**
 * (`sotrudnik.telefon`), у сотрудника одна должность (`sotrudnik.dolzhnost`
 * → «Должность»), у должности — рабочий номер роли (`position.workPhone`).
 * Пользователь CRM (`workspaceMember`) связан с карточкой сотрудника полем
 * `workspaceMember.sotrudnik`, обратное поле — `sotrudnik.polzovatel`.
 *
 * Порядок поиска:
 *   1. карточка «Сотрудник» по телефону — и по основному, и по дополнительным
 *      сразу, по всем карточкам; ровно одно совпадение → это он;
 *   2. резерв: рабочий номер должности → сотрудники этой должности; ровно один → он
 *      (несколько — номер отдела, конкретного человека не определяет, не гадаем);
 *   3. страховка: личный телефон пользователя CRM (`workspaceMember.telefon`) —
 *      как было раньше; новые данные туда не пишем.
 *
 * Если у найденного сотрудника нет пользователя CRM, `employeeId` пустой:
 * участника события можно подписать именем, но «своим» в журнале такой звонок
 * не станет.
 */

const client = new RestApiClient();

type PhoneValue = {
  primaryPhoneNumber?: string | null;
  additionalPhones?: unknown;
};

type PositionRef = {
  id?: string | null;
  name?: string | null;
};

type MemberRecord = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
};

type EmployeeRecord = {
  id: string;
  fio?: { firstName?: string | null; lastName?: string | null } | null;
  telefon?: PhoneValue | null;
  dolzhnost?: PositionRef | null;
  polzovatel?: MemberRecord[] | null;
};

type PositionRecord = {
  id: string;
  name?: string | null;
};

export type EmployeeLookup = {
  /** `workspaceMemberId` участника звонка. Пусто, если у сотрудника нет пользователя CRM. */
  employeeId: string;
  /** ФИО из карточки «Сотрудник» (для страховки — имя пользователя CRM). */
  employeeName: string;
  positionName: string;
  /** Откуда взялся сотрудник: карточка «Сотрудник», рабочий номер должности или личный телефон. */
  source: 'сотрудник' | 'должность' | 'телефон' | '';
};

export const emptyEmployee = (): EmployeeLookup => ({
  employeeId: '',
  employeeName: '',
  positionName: '',
  source: '',
});

const dataOf = <T>(response: unknown, key: string): T[] => {
  const data = (response as { data?: Record<string, unknown> })?.data;
  const value = data?.[key];

  return Array.isArray(value) ? (value as T[]) : [];
};

/** ФИО в формате CRM: «Фамилия Имя». */
const fullName = (name?: { firstName?: string | null; lastName?: string | null } | null): string =>
  [name?.lastName, name?.firstName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');

/** ФИО сотрудника из карточки «Сотрудник». */
export const employeeDisplayName = (employee: EmployeeRecord): string => fullName(employee.fio);

/**
 * Записи, у которых номер указан основным **или** дополнительным телефоном.
 *
 * Дополнительные телефоны в Twenty — поле-массив (`RAW_JSON`): оператор `eq`
 * для него запрещён, доступен только `like`, поэтому ищем по 10 цифрам внутри
 * значения. Совпадения объединяем по id: приоритета основного поля здесь нет —
 * у сотрудника может быть пустое основное и два дополнительных.
 */
const findByPhone = async <T extends { id: string }>(params: {
  path: string;
  key: string;
  field: string;
  phone: string;
  /** `depth=1` — иначе Twenty не разворачивает связи (должность, пользователя). */
  depth?: number;
}): Promise<T[]> => {
  const { path, key, field, phone, depth } = params;
  const base = depth ? { depth } : {};

  const byPrimary = dataOf<T>(
    await client.get<unknown>(path, {
      query: { ...base, filter: `${field}.primaryPhoneNumber[eq]:"${phone}"`, limit: 5 },
    }),
    key,
  );

  const byAdditional = dataOf<T>(
    await client.get<unknown>(path, {
      query: { ...base, filter: `${field}.additionalPhones[like]:"%${phone}%"`, limit: 5 },
    }),
    key,
  );

  const byId = new Map<string, T>();

  [...byPrimary, ...byAdditional].forEach((row) => {
    if (row?.id) byId.set(row.id, row);
  });

  return [...byId.values()];
};

/** Карточка «Сотрудник», у которой этот номер (основной или дополнительный). */
export const findEmployeeByPhone = async (phone: string): Promise<EmployeeRecord | undefined> => {
  if (!phone) return undefined;

  const employees = await findByPhone<EmployeeRecord>({
    path: '/rest/sotrudniki',
    key: 'sotrudniki',
    field: 'telefon',
    phone,
    depth: 1,
  });

  return employees.length === 1 ? employees[0] : undefined;
};

/** Пользователь CRM, привязанный к карточке сотрудника (ровно один). */
export const findMemberByEmployee = async (employee: EmployeeRecord): Promise<MemberRecord | undefined> => {
  const linked = Array.isArray(employee.polzovatel) ? employee.polzovatel : [];

  return linked.length === 1 ? linked[0] : undefined;
};

/** Должность с этим рабочим номером (основным или дополнительным). */
export const findPositionByWorkPhone = async (phone: string): Promise<PositionRecord | undefined> => {
  if (!phone) return undefined;

  const positions = await findByPhone<PositionRecord>({
    path: '/rest/positions',
    key: 'positions',
    field: 'workPhone',
    phone,
  });

  return positions.length === 1 ? positions[0] : undefined;
};

/** Единственный сотрудник этой должности (несколько — не гадаем). */
export const findEmployeeByPosition = async (positionId: string): Promise<EmployeeRecord | undefined> => {
  if (!positionId) return undefined;

  const response = await client.get<unknown>('/rest/sotrudniki', {
    query: { filter: `dolzhnostId[eq]:"${positionId}"`, limit: 3, depth: 1 },
  });

  const employees = dataOf<EmployeeRecord>(response, 'sotrudniki');

  return employees.length === 1 ? employees[0] : undefined;
};

/** Страховка: пользователь CRM, у которого этот номер указан личным телефоном. */
export const findMemberByPersonalPhone = async (phone: string): Promise<MemberRecord | undefined> => {
  if (!phone) return undefined;

  const response = await client.get<unknown>('/rest/workspaceMembers', {
    query: { filter: `telefon.primaryPhoneNumber[eq]:"${phone}"`, limit: 3 },
  });

  const members = dataOf<MemberRecord>(response, 'workspaceMembers');

  return members.length === 1 ? members[0] : undefined;
};

const fromEmployee = async (
  employee: EmployeeRecord,
  source: EmployeeLookup['source'],
  positionName = '',
): Promise<EmployeeLookup> => {
  const member = await findMemberByEmployee(employee);

  return {
    employeeId: member?.id ?? '',
    employeeName: employeeDisplayName(employee),
    positionName: positionName || String(employee.dolzhnost?.name ?? ''),
    source,
  };
};

/** Полный поиск сотрудника по нашему номеру: карточка «Сотрудник» → должность → личный телефон. */
export const lookupEmployeeByOurNumber = async (ourNumber: string): Promise<EmployeeLookup> => {
  if (!ourNumber) return emptyEmployee();

  const employee = await findEmployeeByPhone(ourNumber);

  if (employee) return fromEmployee(employee, 'сотрудник');

  const position = await findPositionByWorkPhone(ourNumber);

  if (position) {
    const byPosition = await findEmployeeByPosition(position.id);

    if (byPosition) return fromEmployee(byPosition, 'должность', String(position.name ?? ''));
  }

  const member = await findMemberByPersonalPhone(ourNumber);

  if (member) {
    return {
      employeeId: member.id,
      employeeName: fullName(member.name),
      positionName: '',
      source: 'телефон',
    };
  }

  return emptyEmployee();
};
