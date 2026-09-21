import { RestApiClient } from 'twenty-client-sdk/rest';

import { lookupEmployeeByOurNumber } from 'src/shared/megafon/employee-lookup';

/**
 * Поиск клиента и компании по номеру телефона.
 *
 * Правило привязки компании (решение Алексея, 18.09): у человека должна быть
 * ровно одна запись «Контакт клиента» с компанией — тогда привязываем её.
 * Если связей несколько — не привязываем вовсе: ложная привязка в ленту чужой
 * компании хуже, чем её отсутствие. Резервный путь — компания по телефону.
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

type KontaktKlientaRecord = {
  id: string;
  klientCompanyId?: string | null;
  klientPersonId?: string | null;
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

/**
 * Компания человека через «Контакт клиента».
 * Ровно одна связь с компанией → привязываем; несколько связей → не привязываем.
 */
export const findCompanyForPerson = async (
  personId: string,
): Promise<{ companyId: string; ambiguous: boolean }> => {
  if (!personId) return { companyId: '', ambiguous: false };

  const response = await client.get<unknown>('/rest/kontaktyKlientov', {
    query: { filter: `kontaktnoeLicoId[eq]:"${personId}"`, limit: 50 },
  });

  const rows = dataOf<KontaktKlientaRecord>(response, 'kontaktyKlientov');

  if (rows.length === 0) return { companyId: '', ambiguous: false };

  if (rows.length === 1) {
    return { companyId: String(rows[0].klientCompanyId ?? ''), ambiguous: false };
  }

  return { companyId: '', ambiguous: true };
};

/** Компания по идентификатору — нужна, чтобы показать название в логе и заголовке. */
export const findCompanyById = async (companyId: string): Promise<CompanyRecord | undefined> => {
  if (!companyId) return undefined;

  const response = await client.get<unknown>(`/rest/companies/${companyId}`);

  const data = (response as { data?: Record<string, unknown> })?.data;
  const company = data?.company;

  return company && typeof company === 'object' ? (company as CompanyRecord) : undefined;
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

  const { companyId, ambiguous } = await findCompanyForPerson(person.id);

  if (companyId) {
    result.companyId = companyId;
    result.companySource = 'kontakt-klienta';

    const company = await findCompanyById(companyId);

    result.companyName = String(company?.name ?? '');
  } else if (ambiguous) {
    // связей несколько — компанию не привязываем вовсе (не гадаем)
    result.ambiguous = true;
  } else {
    const fallback = await findCompanyByPhone(phone);

    if (fallback.company) {
      result.companyId = fallback.company.id;
      result.companyName = String(fallback.company.name ?? '');
      result.companySource = 'company-phone';
    }
    result.ambiguous = fallback.ambiguous;
  }

  await applyInternalFallback(result, phone);

  return result;
};
