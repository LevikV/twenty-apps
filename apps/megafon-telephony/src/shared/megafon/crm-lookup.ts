import { RestApiClient } from 'twenty-client-sdk/rest';

import { lookupEmployeeByOurNumber } from 'src/shared/megafon/employee-lookup';

/**
 * Поиск клиента и компании по номеру телефона.
 *
 * Контакт — по номеру. Компания — **только** если номер звонка совпал с телефоном
 * компании (`company.telefony`). Связь «Контакт клиента» для привязки компании
 * не используем: звонок с личного номера человека не означает, что он про его
 * компанию (решение Алексея, 22.09.2026). Раньше компания подтягивалась по
 * «Контакту клиента» — это давало ложные привязки.
 */

const client = new RestApiClient();

type PersonRecord = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null };
};

type CompanyRecord = {
  id: string;
  name?: string | null;
};

export type ClientLookup = {
  personId: string;
  personName: string;
  companyId: string;
  companyName: string;
  /** Откуда взялась компания: связь «Контакт клиента» или телефон компании. */
  companySource: 'kontakt-klienta' | 'company-phone' | '';
  /** Неоднозначность: найдено несколько контактов или несколько связей. */
  ambiguous: boolean;
  /** Звонок внутри: вторая сторона — наш сотрудник (проверяем последней, после клиента и компании). */
  internalEmployeeId: string;
  internalEmployeeName: string;
};

export const emptyLookup = (): ClientLookup => ({
  personId: '',
  personName: '',
  companyId: '',
  companyName: '',
  companySource: '',
  ambiguous: false,
  internalEmployeeId: '',
  internalEmployeeName: '',
});

/** ФИО в формате CRM: «Фамилия Имя Отчество». */
export const personDisplayName = (person: PersonRecord): string =>
  [person.name?.lastName, person.name?.firstName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');

const dataOf = <T>(response: unknown, key: string): T[] => {
  const data = (response as { data?: Record<string, unknown> })?.data;
  const value = data?.[key];

  return Array.isArray(value) ? (value as T[]) : [];
};

/**
 * Последняя проверка: вторая сторона — наш сотрудник (внутренний звонок).
 * Делается только когда клиент и компания не нашлись: внутренних звонков мало,
 * и незачем искать «наших» на каждом обычном звонке.
 */
const applyInternalFallback = async (result: ClientLookup, phone: string): Promise<void> => {
  if (result.personId || result.companyId) return;

  const employee = await lookupEmployeeByOurNumber(phone);

  if (employee.employeeId) {
    result.internalEmployeeId = employee.employeeId;
    result.internalEmployeeName = employee.employeeName;
  }
};

/** Контакт по номеру телефона (10 цифр). Несколько совпадений — считаем неоднозначностью. */
export const findPersonByPhone = async (
  phone: string,
): Promise<{ person?: PersonRecord; ambiguous: boolean }> => {
  if (!phone) return { ambiguous: false };

  const response = await client.get<unknown>('/rest/people', {
    query: { filter: `phones.primaryPhoneNumber[eq]:"${phone}"`, limit: 3 },
  });

  const people = dataOf<PersonRecord>(response, 'people');

  if (people.length === 1) return { person: people[0], ambiguous: false };

  return { ambiguous: people.length > 1 };
};

/** Резерв: компания, у которой этот номер указан как телефон. */
export const findCompanyByPhone = async (
  phone: string,
): Promise<{ company?: CompanyRecord; ambiguous: boolean }> => {
  if (!phone) return { ambiguous: false };

  const response = await client.get<unknown>('/rest/companies', {
    query: { filter: `telefony.primaryPhoneNumber[eq]:"${phone}"`, limit: 3 },
  });

  const companies = dataOf<CompanyRecord>(response, 'companies');

  if (companies.length === 1) return { company: companies[0], ambiguous: false };

  return { ambiguous: companies.length > 1 };
};

/** Полный поиск клиента по номеру: контакт → компания через «Контакт клиента» → резерв по телефону. */
export const lookupClientByPhone = async (phone: string): Promise<ClientLookup> => {
  const result = emptyLookup();

  if (!phone) return result;

  const { person, ambiguous: personAmbiguous } = await findPersonByPhone(phone);

  if (personAmbiguous) {
    result.ambiguous = true;

    return result;
  }

  if (!person) {
    const { company, ambiguous } = await findCompanyByPhone(phone);

    if (company) {
      result.companyId = company.id;
      result.companyName = String(company.name ?? '');
      result.companySource = 'company-phone';
    }
    result.ambiguous = ambiguous;

    await applyInternalFallback(result, phone);

    return result;
  }

  result.personId = person.id;
  result.personName = personDisplayName(person);

  // Компания — клиент звонка ТОЛЬКО если номер звонка совпал с телефоном компании.
  // Связь «Контакт клиента» для привязки больше не используем: звонок с личного
  // номера человека не значит, что он про его компанию (решение Алексея, 22.09.2026).
  const companyByPhone = await findCompanyByPhone(phone);

  if (companyByPhone.company) {
    result.companyId = companyByPhone.company.id;
    result.companyName = String(companyByPhone.company.name ?? '');
    result.companySource = 'company-phone';
  }

  result.ambiguous = companyByPhone.ambiguous;

  await applyInternalFallback(result, phone);

  return result;
};
