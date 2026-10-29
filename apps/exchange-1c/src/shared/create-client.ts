import { compact, createOne, findFirst, findMany } from 'src/shared/crm';
import { linkFields } from 'src/shared/fields';
import { normPhones, normalizeNumber, ph10, splitFio } from 'src/shared/normalize';

/**
 * Создание контакта или компании из звонка — только клиентская часть.
 *
 * С 28.10.2026 в 1С уходит **не отсюда**: задачи в очередь ставят триггеры событий
 * (`person.created`, `company.created`, `kontaktKlienta.created/deleted`) в
 * `src/shared/create-out.ts`. Маршрут создаёт карточку и связь, и всё.
 *
 * Решения по форме (Obsidian «Создание контакта или компании из звонка»):
 *  - вид объекта в 1С задаёт событие: карточка человека → контрагент-физлицо,
 *    строка «Контакт клиента» → контактное лицо с владельцем;
 *  - правовую форму и тип отношений присылает форма, дефолтов не ставим;
 *  - договор не создаём.
 */

export type ClientKind = 'contact' | 'company';
export type OwnerKind = 'company' | 'person';

export type CreateClientInput = {
  kind: ClientKind;
  phone: string;
  name: string;
  pravovayaForma?: string;
  tipOtnosheniy?: string[];
  address?: string;
  comment?: string;
  link?: { kind: OwnerKind; id: string } | null;
  createdBy?: string;
};

type CrmRow = { id: string } & Record<string, unknown>;

const fullNameOf = (person: CrmRow): string => {
  const name = person.name as
    | { firstName?: string; lastName?: string }
    | undefined;

  return [name?.lastName, name?.firstName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
};

/**
 * Поиск по номеру перед созданием: контакт (основной + дополнительные) и компания.
 *
 * ⚠️ Twenty хранит номер нормализованно: «+79991112233» лежит как
 * `primaryPhoneNumber = 9991112233` + `callingCode = +7`. Поэтому ищем по
 * последним 10 цифрам, а не по строке с «+» (иначе дубль при повторном вызове).
 */
const findExistingByPhone = async (
  phone: string,
): Promise<{ id: string; kind: ClientKind; name: string } | null> => {
  const ten = ph10(phone);

  if (!ten) {
    return null;
  }

  const personHit = (await findMany(
    'people',
    `phones.primaryPhoneNumber[eq]:${ten}`,
    3,
  )) as CrmRow[];

  if (personHit[0]?.id) {
    return {
      id: String(personHit[0].id),
      kind: 'contact',
      name: fullNameOf(personHit[0]) || 'контакт',
    };
  }

  const companyHit = (await findMany(
    'companies',
    `telefony.primaryPhoneNumber[eq]:${ten}`,
    3,
  )) as CrmRow[];

  if (companyHit[0]?.id) {
    return {
      id: String(companyHit[0].id),
      kind: 'company',
      name: String(companyHit[0].name ?? '') || 'компания',
    };
  }

  const personExtra = (await findMany(
    'people',
    `phones.additionalPhones[like]:%${ten}%`,
    3,
  )) as CrmRow[];

  if (personExtra[0]?.id) {
    return {
      id: String(personExtra[0].id),
      kind: 'contact',
      name: fullNameOf(personExtra[0]) || 'контакт',
    };
  }

  const companyExtra = (await findMany(
    'companies',
    `telefony.additionalPhones[like]:%${ten}%`,
    3,
  )) as CrmRow[];

  if (companyExtra[0]?.id) {
    return {
      id: String(companyExtra[0].id),
      kind: 'company',
      name: String(companyExtra[0].name ?? '') || 'компания',
    };
  }

  return null;
};

const addressValue = (address?: string) =>
  address && address.trim() ? { addressStreet1: address.trim() } : undefined;

/**
 * Создаёт карточку (и строку «Контакт клиента», если указана связь).
 * Дубль по номеру не создаёт: при совпадении возвращает существующую карточку.
 */
export const createClient = async (
  input: CreateClientInput,
): Promise<Record<string, unknown>> => {
  const phone = normalizeNumber(String(input.phone ?? ''));

  if (!phone) {
    throw new Error('номер телефона не разобран');
  }

  const name = String(input.name ?? '').trim();

  if (!name) {
    throw new Error(
      input.kind === 'contact' ? 'не указано ФИО' : 'не указано название',
    );
  }

  const existing = await findExistingByPhone(phone);

  if (existing) {
    return { created: false, ...existing };
  }

  const comment = String(input.comment ?? '').trim();
  const tipOtnosheniy = (input.tipOtnosheniy ?? []).filter(Boolean);
  const address = String(input.address ?? '').trim();

  if (input.kind === 'company') {
    const created = await createOne(
      'companies',
      'company',
      compact({
        name,
        pravovayaForma: input.pravovayaForma,
        tipOtnosheniy,
        telefony: normPhones([phone]),
        kommentariy: comment,
        address: addressValue(address),
      }),
    );

    if (!created?.id) {
      throw new Error('компания не создана');
    }

    return {
      created: true,
      id: String(created.id),
      kind: 'company',
      name,
    };
  }

  // ── контакт ────────────────────────────────────────────────────────────────
  const owner = input.link && input.link.id ? input.link : null;
  let ownerName = '';

  if (owner?.kind === 'company') {
    const company = (await findFirst(
      'companies',
      'company',
      `id[eq]:${owner.id}`,
    )) as CrmRow | undefined;

    if (!company?.id) {
      throw new Error('связанная компания не найдена');
    }

    ownerName = String(company.name ?? '');
  } else if (owner?.kind === 'person') {
    const person = (await findFirst(
      'people',
      'person',
      `id[eq]:${owner.id}`,
    )) as CrmRow | undefined;

    if (!person?.id) {
      throw new Error('связанный контакт не найден');
    }

    ownerName = fullNameOf(person);
  }

  const created = await createOne(
    'people',
    'person',
    compact({
      name: splitFio(name),
      kommentariy: comment,
      phones: normPhones([phone]),
      tipOtnosheniy,
      adresYuridicheskiy: addressValue(address),
    }),
  );

  if (!created?.id) {
    throw new Error('карточка человека не создана');
  }

  const personId = String(created.id);

  if (owner) {
    await createOne(
      'kontaktyKlientov',
      'kontaktKlienta',
      linkFields({
        guid: '',
        personId,
        owner,
        personName: name,
        ownerName,
      }),
    );
  }

  return {
    created: true,
    id: personId,
    kind: 'contact',
    name,
    link: owner ? { kind: owner.kind, id: owner.id } : null,
  };
};
