import { createOne, findFirst, findMany, updateOne } from 'src/shared/crm';
import { normName, normPhones } from 'src/shared/normalize';
import {
  REESTR_STATUS,
  REESTR_TYPE,
  type ReestrRecord,
} from 'src/shared/payload';

export type PersonRecord = {
  id: string;
  objectGuid?: string;
  name?: { firstName?: string; lastName?: string };
  phones?: { primaryPhoneNumber?: string; additionalPhones?: string };
  emails?: { primaryEmail?: string };
};

const fullNameOf = (person: PersonRecord): string =>
  `${person.name?.lastName ?? ''} ${person.name?.firstName ?? ''}`.trim();

/** Ищем запись 1С в реестре сопоставлений: guid1c -> карточка человека. */
export const findPersonByReestr = async (
  guid1c: string,
): Promise<{ personId: string; reestr: ReestrRecord } | null> => {
  const row = (await findFirst(
    'reestrySopostavleniy',
    'reestrSopostavleniy',
    `guid1c[eq]:${guid1c}`,
  )) as ReestrRecord | undefined;

  if (!row?.id) {
    return null;
  }

  const personId = row.chelovekId;

  return personId ? { personId, reestr: row } : null;
};

/**
 * Варианты записи номера в Twenty: сервер хранит номер нормализованно,
 * поэтому кроме «+7XXXXXXXXXX» пробуем цифры и последние 10.
 */
const phoneVariants = (rawPhone: string): string[] => {
  const digits = rawPhone.replace(/\D/g, '');
  const variants = new Set<string>();

  if (rawPhone.startsWith('+')) {
    variants.add(rawPhone);
  }

  if (digits) {
    variants.add(digits);
  }

  if (digits.length > 10) {
    variants.add(digits.slice(-10));
  }

  return [...variants];
};

/**
 * Поиск кандидата для склейки: телефон (10 цифр) + ФИО.
 * Разные ФИО на одном номере — не сливаем (семья, офис, приёмная).
 */
export const findCandidateByPhoneAndName = async (
  phones: string[] | undefined,
  name: string | undefined,
): Promise<PersonRecord | null> => {
  const normalized = normPhones(phones);
  const rawPhones = (phones ?? []).flatMap((phone) => phoneVariants(phone));
  const normalizedDigits = (normalized?.primaryPhoneNumber ?? '').replace(/\D/g, '');
  const localVariants =
    normalizedDigits.length > 10
      ? [normalizedDigits.slice(-10), normalizedDigits.slice(1)]
      : [];
  const candidatesToTry = [
    ...(normalized?.primaryPhoneNumber ? [normalized.primaryPhoneNumber] : []),
    ...rawPhones,
    ...localVariants,
  ];
  const targetName = normName(name);

  if (!candidatesToTry.length || !targetName) {
    return null;
  }

  const seen = new Set<string>();

  for (const candidatePhone of candidatesToTry) {
    if (!candidatePhone || seen.has(candidatePhone)) {
      continue;
    }

    seen.add(candidatePhone);

    const candidates = (await findMany(
      'people',
      `phones.primaryPhoneNumber[eq]:${candidatePhone}`,
      5,
    )) as unknown as PersonRecord[];

    for (const candidate of candidates) {
      if (!candidate?.id) {
        continue;
      }

      if (normName(fullNameOf(candidate)) === targetName) {
        return candidate;
      }
    }
  }

  return null;
};

export const findPersonByObjectGuid = async (
  objectGuid: string,
): Promise<PersonRecord | null> => {
  const found = (await findFirst(
    'people',
    'person',
    `objectGuid[eq]:${objectGuid}`,
  )) as unknown as PersonRecord | undefined;

  return found?.id ? found : null;
};

export const updatePerson = async (
  id: string,
  data: Record<string, unknown>,
): Promise<void> => {
  await updateOne('people', 'person', id, data);
};

export const createPerson = async (
  data: Record<string, unknown>,
): Promise<PersonRecord> => {
  const created = (await createOne(
    'people',
    'person',
    data,
  )) as unknown as PersonRecord;

  if (!created?.id) {
    throw new Error('карточка человека не создана');
  }

  return created;
};

/** Строка реестра сопоставлений: одна запись 1С -> карточка человека. */
export const upsertReestrRow = async ({
  guid1c,
  personId,
  tipZapisi,
  status,
  payload,
}: {
  guid1c: string;
  personId: string;
  tipZapisi: string;
  status: string;
  payload: unknown;
}): Promise<void> => {
  const existing = (await findFirst(
    'reestrySopostavleniy',
    'reestrSopostavleniy',
    `guid1c[eq]:${guid1c}`,
  )) as ReestrRecord | undefined;

  const data = {
    guid1c,
    chelovekId: personId,
    tipZapisi,
    status,
    data: new Date(),
    dannye1c: payload,
  };

  if (existing?.id) {
    await updateOne(
      'reestrySopostavleniy',
      'reestrSopostavleniy',
      existing.id,
      data,
    );

    return;
  }

  await createOne('reestrySopostavleniy', 'reestrSopostavleniy', data);
};

export const REESTR_TYPES = REESTR_TYPE;
export const REESTR_STATUSES = REESTR_STATUS;
