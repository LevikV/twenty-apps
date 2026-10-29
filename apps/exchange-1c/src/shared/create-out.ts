import { createHash, randomUUID } from 'node:crypto';

import { createOne, findFirst, updateOne } from 'src/shared/crm';
import { REESTR_STATUS, REESTR_TYPE, TASK_STATUS } from 'src/shared/payload';
import { upsertReestrRow } from 'src/shared/people';

/**
 * Обратный поток: создание карточки в CRM → задача `OUT` для 1С.
 *
 * Решения (Obsidian «Обратная синхронизация контрагентов и контактных лиц»):
 *   person.created          -> контрагент-физлицо (`company` + `type=contact`)
 *   company.created         -> контрагент (`company`, тип по правовой форме)
 *   kontaktKlienta.created  -> контактное лицо (`contact` + `owner_guid`)
 *   kontaktKlienta.deleted  -> `DELETE` по guid этой записи
 *
 * Правила:
 *  - **guid на записи.** Если `objectGuid` уже заполнен — запись пришла из 1С
 *    (или уже отправлялась), событие её пропускает. Это же и анти-эхо.
 *  - **Детерминированный guid.** Новый guid не случайный, а производный от id
 *    записи (`uuidv5`): повторное событие и параллельные триггеры дают один и тот
 *    же ключ, дубля не будет.
 *  - **Одна открытая задача на guid** — обновляем payload, а не создаём вторую.
 */

const NAMESPACE = '5aeb3683-24b9-413b-9c2b-048122d0cd61';

const QUEUE_PLURAL = 'queueTasks';
const QUEUE_SINGULAR = 'queueTask';

type Row = { id: string } & Record<string, unknown>;

export type SyncResult = Record<string, unknown>;

const uuidV5 = (name: string): string => {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(Buffer.concat([ns, Buffer.from(name, 'utf8')]))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
};

const readRow = async (
  plural: string,
  singular: string,
  id: string,
): Promise<Row | undefined> =>
  (await findFirst(plural, singular, `id[eq]:${id}`)) as Row | undefined;

const guidOf = (row: Row | undefined): string =>
  String(row?.objectGuid ?? '').trim();

/** Телефоны карточки: основной + дополнительные (в базе дополнительные бывают строкой). */
const phonesOf = (value: unknown): string[] => {
  const phones = value as
    | { primaryPhoneNumber?: string; additionalPhones?: unknown }
    | undefined;
  const out: string[] = [];

  if (phones?.primaryPhoneNumber) {
    out.push(String(phones.primaryPhoneNumber));
  }

  let extra: unknown = phones?.additionalPhones;

  if (typeof extra === 'string') {
    try {
      extra = JSON.parse(extra);
    } catch {
      extra = [];
    }
  }

  if (Array.isArray(extra)) {
    for (const item of extra) {
      const number =
        item && typeof item === 'object'
          ? (item as { number?: string }).number
          : String(item ?? '');

      if (number) {
        out.push(String(number));
      }
    }
  }

  return out;
};

const addressText = (value: unknown): string => {
  const address = value as { addressStreet1?: string } | undefined;

  return String(address?.addressStreet1 ?? '').trim();
};

const fullName = (person: Row): string => {
  const name = person.name as
    | { firstName?: string; lastName?: string }
    | undefined;

  return [name?.lastName, name?.firstName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
};

/** Значения CRM (POKUPATEL) → коды 1С (buyer). */
const relationCodes = (values: unknown): string[] => {
  const map: Record<string, string> = {
    POKUPATEL: 'buyer',
    POSTAVSHCHIK: 'supplier',
    PROCHEE: 'other',
  };

  return (Array.isArray(values) ? values : [])
    .map((value) => map[String(value)])
    .filter(Boolean);
};

const companyType = (pravovayaForma: unknown): string =>
  String(pravovayaForma ?? '') === 'IP' ? 'ip' : 'legal';

const changeDate = (row: Row): string =>
  row.updatedAt
    ? new Date(String(row.updatedAt)).toISOString()
    : new Date().toISOString();

/** Одна открытая задача на guid: создаём или обновляем payload. */
const upsertOutTask = async (params: {
  objectType: string;
  objectGuid: string;
  action: 'CREATE' | 'DELETE';
  payload: Record<string, unknown>;
}): Promise<'created' | 'updated'> => {
  const open = (await findFirst(
    QUEUE_PLURAL,
    QUEUE_SINGULAR,
    `direction[eq]:OUT,objectGuid[eq]:${params.objectGuid},status[in]:[PENDING,PROCESSING]`,
  )) as Row | undefined;

  if (open?.id) {
    await updateOne(QUEUE_PLURAL, QUEUE_SINGULAR, String(open.id), {
      action: params.action,
      status: TASK_STATUS.pending,
      payload: params.payload,
      errorText: null,
    });

    return 'updated';
  }

  await createOne(QUEUE_PLURAL, QUEUE_SINGULAR, {
    taskId: randomUUID(),
    direction: 'OUT',
    objectType: params.objectType,
    objectGuid: params.objectGuid,
    action: params.action,
    status: TASK_STATUS.pending,
    attemptCount: 0,
    payload: params.payload,
  });

  return 'created';
};

/** Записывает производный guid на карточку и возвращает его. */
const stampGuid = async (
  plural: string,
  singular: string,
  row: Row,
  key: string,
): Promise<string> => {
  const existing = guidOf(row);

  if (existing) {
    return existing;
  }

  const guid = uuidV5(key);

  await updateOne(plural, singular, row.id, { objectGuid: guid });

  return guid;
};

/** Человек → контрагент-физлицо. */
const syncPerson = async (person: Row): Promise<SyncResult> => {
  const already = guidOf(person);

  if (already) {
    return { skipped: 'уже синхронизирована', guid: already };
  }

  // Обязательные поля проверяем ДО записи guid: неполную карточку не помечаем
  // синхронизированной, иначе дозаполнение уже не подхватится.
  const name = fullName(person);

  if (!name) {
    return { skipped: 'у карточки нет имени' };
  }

  const phones = phonesOf(person.phones);

  if (phones.length === 0) {
    return { skipped: 'у контакта нет телефона — в 1С не отправляем' };
  }

  const guid = await stampGuid('people', 'person', person, `person:${person.id}`);

  const payload = {
    guid,
    type: 'contact',
    name,
    phones,
    relation_types: relationCodes(person.tipOtnosheniy),
    comment: String(person.kommentariy ?? ''),
    address: addressText(person.adresYuridicheskiy),
    source: 'crm',
    created_by: 'crm',
    crm_record_id: person.id,
    change_date: changeDate(person),
  };

  const result = await upsertOutTask({
    objectType: 'company',
    objectGuid: guid,
    action: 'CREATE',
    payload,
  });

  await upsertReestrRow({
    guid1c: guid,
    personId: person.id,
    tipZapisi: REESTR_TYPE.physicalPerson,
    status: REESTR_STATUS.main,
    payload,
  });

  return { guid, task: result, objectType: 'company', kind: 'contact-fizlico' };
};

/** Компания → контрагент. */
const syncCompany = async (company: Row): Promise<SyncResult> => {
  const already = guidOf(company);

  if (already) {
    return { skipped: 'уже синхронизирована', guid: already };
  }

  const name = String(company.name ?? '').trim();

  if (!name) {
    return { skipped: 'у компании нет названия' };
  }

  const guid = await stampGuid(
    'companies',
    'company',
    company,
    `company:${company.id}`,
  );

  const address = addressText(company.address);

  const payload = {
    guid,
    name,
    type: companyType(company.pravovayaForma),
    relation_types: relationCodes(company.tipOtnosheniy),
    phones: phonesOf(company.telefony),
    comment: String(company.kommentariy ?? ''),
    addresses: address ? [{ type: 'legal', value: address }] : [],
    source: 'crm',
    created_by: 'crm',
    crm_record_id: company.id,
    change_date: changeDate(company),
  };

  const result = await upsertOutTask({
    objectType: 'company',
    objectGuid: guid,
    action: 'CREATE',
    payload,
  });

  return { guid, task: result, objectType: 'company', kind: 'company' };
};

/** `person.created` */
export const handlePersonCreated = async (
  recordId?: string,
): Promise<SyncResult> => {
  if (!recordId) {
    return { skipped: 'в событии нет recordId' };
  }

  const person = await readRow('people', 'person', recordId);

  if (!person) {
    return { skipped: 'карточка не найдена' };
  }

  return syncPerson(person);
};

/** `company.created` */
export const handleCompanyCreated = async (
  recordId?: string,
): Promise<SyncResult> => {
  if (!recordId) {
    return { skipped: 'в событии нет recordId' };
  }

  const company = await readRow('companies', 'company', recordId);

  if (!company) {
    return { skipped: 'компания не найдена' };
  }

  return syncCompany(company);
};

/** Владелец связи: guid карточки, а при его отсутствии — синхронизируем владельца. */
const ensureOwner = async (
  companyId?: unknown,
  personId?: unknown,
): Promise<{ guid: string; kind: 'company' | 'person' } | null> => {
  if (companyId) {
    const company = await readRow('companies', 'company', String(companyId));

    if (!company) {
      return null;
    }

    const guid = guidOf(company);

    if (guid) {
      return { guid, kind: 'company' };
    }

    const synced = await syncCompany(company);

    return synced.guid ? { guid: String(synced.guid), kind: 'company' } : null;
  }

  if (personId) {
    const person = await readRow('people', 'person', String(personId));

    if (!person) {
      return null;
    }

    const guid = guidOf(person);

    if (guid) {
      return { guid, kind: 'person' };
    }

    const synced = await syncPerson(person);

    return synced.guid ? { guid: String(synced.guid), kind: 'person' } : null;
  }

  return null;
};

/** `kontaktKlienta.created` */
export const handleContactLinkCreated = async (
  recordId?: string,
): Promise<SyncResult> => {
  if (!recordId) {
    return { skipped: 'в событии нет recordId' };
  }

  const link = await readRow('kontaktyKlientov', 'kontaktKlienta', recordId);

  if (!link) {
    return { skipped: 'связь не найдена' };
  }

  if (guidOf(link)) {
    return { skipped: 'связь уже синхронизирована', guid: guidOf(link) };
  }

  const owner = await ensureOwner(link.klientCompanyId, link.klientPersonId);

  if (!owner) {
    return { skipped: 'у связи нет владельца' };
  }

  const contactId = String(link.kontaktnoeLicoId ?? '');
  const contact = contactId
    ? await readRow('people', 'person', contactId)
    : undefined;

  if (!contact) {
    return { skipped: 'контактное лицо не найдено' };
  }

  // Контактное лицо тоже физлицо: без телефона в 1С не отправляем.
  if (phonesOf(contact.phones).length === 0) {
    return { skipped: 'у контактного лица нет телефона — в 1С не отправляем' };
  }

  const guid = uuidV5(`kontakt:${link.id}`);

  await updateOne('kontaktyKlientov', 'kontaktKlienta', link.id, {
    objectGuid: guid,
  });

  const payload = {
    guid,
    owner_guid: owner.guid,
    name: fullName(contact),
    phones: phonesOf(contact.phones),
    comment: String(contact.kommentariy ?? ''),
    address: addressText(contact.adresYuridicheskiy),
    source: 'crm',
    created_by: 'crm',
    crm_record_id: contact.id,
    change_date: changeDate(link),
  };

  const result = await upsertOutTask({
    objectType: 'contact',
    objectGuid: guid,
    action: 'CREATE',
    payload,
  });

  return { guid, task: result, objectType: 'contact', owner: owner.kind };
};

/** `kontaktKlienta.deleted` */
export const handleContactLinkDeleted = async (
  recordId?: string,
  before?: Record<string, unknown>,
): Promise<SyncResult> => {
  const row = recordId
    ? await readRow('kontaktyKlientov', 'kontaktKlienta', recordId)
    : undefined;

  const guid = String(row?.objectGuid ?? before?.objectGuid ?? '').trim();

  if (!guid) {
    return { skipped: 'связь в 1С не уходила — удалять нечего' };
  }

  const result = await upsertOutTask({
    objectType: 'contact',
    objectGuid: guid,
    action: 'DELETE',
    payload: {
      guid,
      source: 'crm',
      change_date: new Date().toISOString(),
    },
  });

  return { guid, task: result, objectType: 'contact', action: 'DELETE' };
};
