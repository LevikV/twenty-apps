import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Поиск сотрудника (пользователя CRM) по нашему номеру.
 *
 * Схема в CRM: у сотрудника (`workspaceMember`) есть должность (`memberPosition`),
 * а у должности — рабочий номер (`workPhone`). Поэтому: наш номер → должность →
 * сотрудник. Резерв — личный телефон сотрудника (`telefon`).
 */

const client = new RestApiClient();

type PositionRecord = {
  id: string;
  name?: string | null;
};

type MemberRecord = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null };
  userEmail?: string | null;
};

export type EmployeeLookup = {
  employeeId: string;
  employeeName: string;
  positionName: string;
  /** Откуда взялся сотрудник: по должности (рабочий номер) или по личному телефону. */
  source: 'должность' | 'телефон' | '';
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

/** ФИО сотрудника в формате CRM: «Фамилия Имя». */
export const memberDisplayName = (member: MemberRecord): string =>
  [member.name?.lastName, member.name?.firstName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');

/** Должность с этим рабочим номером (10 цифр). */
export const findPositionByWorkPhone = async (phone: string): Promise<PositionRecord | undefined> => {
  if (!phone) return undefined;

  const response = await client.get<unknown>('/rest/positions', {
    query: { filter: `workPhone.primaryPhoneNumber[eq]:"${phone}"`, limit: 3 },
  });

  const positions = dataOf<PositionRecord>(response, 'positions');

  return positions.length === 1 ? positions[0] : undefined;
};

/** Сотрудник, занимающий должность. */
export const findMemberByPosition = async (positionId: string): Promise<MemberRecord | undefined> => {
  if (!positionId) return undefined;

  const response = await client.get<unknown>('/rest/workspaceMembers', {
    query: { filter: `memberPositionId[eq]:"${positionId}"`, limit: 3 },
  });

  const members = dataOf<MemberRecord>(response, 'workspaceMembers');

  return members.length === 1 ? members[0] : undefined;
};

/** Резерв: сотрудник, у которого этот номер указан личным телефоном. */
export const findMemberByPersonalPhone = async (phone: string): Promise<MemberRecord | undefined> => {
  if (!phone) return undefined;

  const response = await client.get<unknown>('/rest/workspaceMembers', {
    query: { filter: `telefon.primaryPhoneNumber[eq]:"${phone}"`, limit: 3 },
  });

  const members = dataOf<MemberRecord>(response, 'workspaceMembers');

  return members.length === 1 ? members[0] : undefined;
};

/** Полный поиск сотрудника по нашему номеру: должность → сотрудник, потом личный телефон. */
export const lookupEmployeeByOurNumber = async (ourNumber: string): Promise<EmployeeLookup> => {
  const result = emptyEmployee();

  if (!ourNumber) return result;

  const position = await findPositionByWorkPhone(ourNumber);

  if (position) {
    const member = await findMemberByPosition(position.id);

    if (member) {
      result.employeeId = member.id;
      result.employeeName = memberDisplayName(member);
      result.positionName = String(position.name ?? '');
      result.source = 'должность';

      return result;
    }
  }

  const member = await findMemberByPersonalPhone(ourNumber);

  if (member) {
    result.employeeId = member.id;
    result.employeeName = memberDisplayName(member);
    result.source = 'телефон';
  }

  return result;
};
