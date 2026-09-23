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
 *
 * Смотрим **и основное, и дополнительные** телефоны карточки (23.09.2026):
 * в Twenty телефоны — составное поле, где дополнительных может быть несколько.
 * Оператор `eq` для них запрещён (`RAW_JSON`, разрешены `is` и `like`), поэтому
 * дополнительные ищем через `like` по 10 цифрам.
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

/**
 * Записи, у которых номер указан основным **или** дополнительным телефоном.
 *
 * Основное поле в приоритете: если номер нашёлся там, дополнительные не смотрим —
 * иначе номер, продублированный в чужой карточке как дополнительный, дал бы
 * «неоднозначность» и клиент перестал бы привязываться (таких номеров в базе 66).
 */
const findByPhone = async <T extends { id: string }>(params: {
  path: string;
  key: string;
  field: 'phones' | 'telefony';
  phone: string;
}): Promise<T[]> => {
  const { path, key, field, phone } = params;

  const byPrimary = dataOf<T>(
    await client.get<unknown>(path, {
      query: { filter: `${field}.primaryPhoneNumber[eq]:"${phone}"`, limit: 3 },
    }),
    key,
  );

  if (byPrimary.length > 0) return byPrimary;

  // для RAW_JSON доступен только `like`; результаты объединяем по id
  const byAdditional = dataOf<T>(
    await client.get<unknown>(path, {
      query: { filter: `${field}.additionalPhones[like]:"%${phone}%"`, limit: 3 },
    }),
    key,
  );

  const byId = new Map<string, T>();

  for (const record of byAdditional) byId.set(record.id, record);

  return [...byId.values()];
};

/** Контакт по номеру (10 цифр): основное поле + дополнительные. Несколько совпадений — неоднозначность. */
export const findPersonByPhone = async (
  phone: string,
): Promise<{ person?: PersonRecord; ambiguous: boolean }> => {
  if (!phone) return { ambiguous: false };

  const people = await findByPhone<PersonRecord>({
    path: '/rest/people',
    key: 'people',
    field: 'phones',
    phone,
  });

  if (people.length === 1) return { person: people[0], ambiguous: false };

  return { ambiguous: people.length > 1 };
};

/** Компания, у которой этот номер указан телефоном: основное поле + дополнительные. */
export const findCompanyByPhone = async (
  phone: string,
): Promise<{ company?: CompanyRecord; ambiguous: boolean }> => {
  if (!phone) return { ambiguous: false };

  const companies = await findByPhone<CompanyRecord>({
    path: '/rest/companies',
    key: 'companies',
    field: 'telefony',
    phone,
  });

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
