import { createHash, randomUUID } from 'node:crypto';

import { createOne, findFirst, findMany, updateOne } from 'src/shared/crm';
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

/** Автор последнего изменения карточки: `MANUAL`, `API`, `APPLICATION`, … */
const updatedBySource = (row: Row): string | null =>
  (row.updatedBy as { source?: string | null } | undefined)?.source ?? null;

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

/**
 * Белые списки: какие поля карточки уходят в 1С при обновлении
 * (метаданное имя поля Twenty → поле payload).
 * Согласовано 30.10.2026; приём в 1С — отдельная сторона.
 */
const OUT_FIELDS_PERSON: Record<string, string> = {
  name: 'name',
  phones: 'phones',
  kommentariy: 'comment',
  adresYuridicheskiy: 'address',
  tipOtnosheniy: 'relation_types',
};

const OUT_FIELDS_COMPANY: Record<string, string> = {
  name: 'name',
  telefony: 'phones',
  kommentariy: 'comment',
  address: 'addresses',
  tipOtnosheniy: 'relation_types',
  pravovayaForma: 'type',
};

/** changedFields → поля payload (без повторов). */
const fieldsOf = (
  updatedFields: string[],
  map: Record<string, string>,
): string[] =>
  Array.from(
    new Set(updatedFields.map((field) => map[field]).filter(Boolean)),
  );

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
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
}): Promise<'created' | 'updated'> => {
  const open = (await findFirst(
    QUEUE_PLURAL,
    QUEUE_SINGULAR,
    `direction[eq]:OUT,objectGuid[eq]:${params.objectGuid},status[in]:[PENDING,PROCESSING]`,
  )) as (Row & { action?: string; payload?: { fields?: unknown } }) | undefined;

  if (open?.id) {
    // Слияние как у ремонтов: вторая правка не должна затирать список полей первой —
    // 1С пишет только то, что перечислено в `fields`, а значения берутся свежие.
    const previousFields = Array.isArray(open.payload?.fields)
      ? (open.payload.fields as unknown[]).filter(
          (field): field is string => typeof field === 'string',
        )
      : [];

    const nextFields = Array.isArray(params.payload.fields)
      ? (params.payload.fields as string[])
      : [];

    const fields = Array.from(new Set([...previousFields, ...nextFields]));

    // `CREATE` не превращаем в `UPDATE`: в 1С записи ещё нет, обновлять нечего.
    const action =
      open.action === 'DELETE'
        ? 'DELETE'
        : open.action === 'CREATE' && params.action !== 'DELETE'
          ? 'CREATE'
          : params.action;

    await updateOne(QUEUE_PLURAL, QUEUE_SINGULAR, String(open.id), {
      action,
      status: TASK_STATUS.pending,
      payload: fields.length > 0 ? { ...params.payload, fields } : params.payload,
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

/**
 * Обновление уже синхронизированного человека: правка руками → задача `UPDATE`.
 * Анти-эхо как у ремонтов: изменения не от `MANUAL` (наши записи, приём из 1С) не отправляем.
 */
const syncPersonUpdate = async (
  person: Row,
  updatedFields: string[],
): Promise<SyncResult> => {
  const source = updatedBySource(person);

  if (source !== 'MANUAL') {
    return {
      skipped: `изменение не ручное (${source ?? 'неизвестен'}) — в 1С не отправляем`,
    };
  }

  const fields = fieldsOf(updatedFields, OUT_FIELDS_PERSON);

  if (fields.length === 0) {
    return { skipped: 'изменены поля вне белого списка' };
  }

  const name = fullName(person);

  if (!name) {
    return { skipped: 'у карточки нет имени' };
  }

  const phones = phonesOf(person.phones);

  if (phones.length === 0) {
    return { skipped: 'у контакта нет телефона — в 1С не отправляем' };
  }

  const guid = guidOf(person);

  const payload = {
    guid,
    type: 'contact',
    name,
    phones,
    relation_types: relationCodes(person.tipOtnosheniy),
    comment: String(person.kommentariy ?? ''),
    address: addressText(person.adresYuridicheskiy),
    source: 'crm',
    crm_record_id: person.id,
    change_date: changeDate(person),
    fields,
  };

  const task = await upsertOutTask({
    objectType: 'company',
    objectGuid: guid,
    action: 'UPDATE',
    payload,
  });

  return {
    guid,
    task,
    action: 'UPDATE',
    fields,
    objectType: 'company',
    kind: 'contact-fizlico',
  };
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

/** Обновление уже синхронизированной компании (анти-эхо как у ремонтов). */
const syncCompanyUpdate = async (
  company: Row,
  updatedFields: string[],
): Promise<SyncResult> => {
  const source = updatedBySource(company);

  if (source !== 'MANUAL') {
    return {
      skipped: `изменение не ручное (${source ?? 'неизвестен'}) — в 1С не отправляем`,
    };
  }

  const fields = fieldsOf(updatedFields, OUT_FIELDS_COMPANY);

  if (fields.length === 0) {
    return { skipped: 'изменены поля вне белого списка' };
  }

  const name = String(company.name ?? '').trim();

  if (!name) {
    return { skipped: 'у компании нет названия' };
  }

  const address = addressText(company.address);
  const guid = guidOf(company);

  const payload = {
    guid,
    name,
    type: companyType(company.pravovayaForma),
    relation_types: relationCodes(company.tipOtnosheniy),
    phones: phonesOf(company.telefony),
    comment: String(company.kommentariy ?? ''),
    addresses: address ? [{ type: 'legal', value: address }] : [],
    source: 'crm',
    crm_record_id: company.id,
    change_date: changeDate(company),
    fields,
  };

  const task = await upsertOutTask({
    objectType: 'company',
    objectGuid: guid,
    action: 'UPDATE',
    payload,
  });

  return { guid, task, action: 'UPDATE', fields, objectType: 'company' };
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

/** Догон связей, по которым задача не создавалась (у человека не было телефона). */
const catchUpLinks = async (personId: string): Promise<number> => {
  const links = (await findMany(
    'kontaktyKlientov',
    `kontaktnoeLicoId[eq]:${personId}`,
    50,
  )) as Row[];

  let synced = 0;

  for (const link of links) {
    if (guidOf(link)) {
      continue;
    }

    const result = await handleContactLinkCreated(link.id);

    if (result.guid) {
      synced += 1;
    }
  }

  return synced;
};

/**
 * Правка человека → `UPDATE` по каждой связи, где он контактное лицо.
 * Связи без guid (ещё не уезжали в 1С) добираем как при создании.
 */
const syncPersonLinks = async (
  person: Row,
  fields: string[],
): Promise<{ updated: number; caughtUp: number }> => {
  const links = (await findMany(
    'kontaktyKlientov',
    `kontaktnoeLicoId[eq]:${person.id}`,
    50,
  )) as Row[];

  let updated = 0;
  let caughtUp = 0;

  for (const link of links) {
    const guid = guidOf(link);

    if (!guid) {
      const result = await handleContactLinkCreated(link.id);

      if (result.guid) {
        caughtUp += 1;
      }

      continue;
    }

    const owner = await ensureOwner(link.klientCompanyId, link.klientPersonId);

    if (!owner) {
      continue;
    }

    const address = addressText(person.adresYuridicheskiy);

    await upsertOutTask({
      objectType: 'contact',
      objectGuid: guid,
      action: 'UPDATE',
      payload: {
        guid,
        owner_guid: owner.guid,
        name: fullName(person),
        phones: phonesOf(person.phones),
        comment: String(person.kommentariy ?? ''),
        address,
        source: 'crm',
        crm_record_id: person.id,
        change_date: changeDate(person),
        fields,
      },
    });

    updated += 1;
  }

  return { updated, caughtUp };
};

/** `person.created` и `person.updated` */
export const handlePersonCreated = async (
  recordId?: string,
  updatedFields: string[] = [],
): Promise<SyncResult> => {
  if (!recordId) {
    return { skipped: 'в событии нет recordId' };
  }

  const person = await readRow('people', 'person', recordId);

  if (!person) {
    return { skipped: 'карточка не найдена' };
  }

  // Карточка уже в 1С — дальше только правки руками.
  if (guidOf(person)) {
    const result = await syncPersonUpdate(person, updatedFields);

    if (result.action !== 'UPDATE') {
      return result;
    }

    const links = await syncPersonLinks(
      person,
      (result.fields as string[] | undefined) ?? [],
    );

    return links.updated || links.caughtUp ? { ...result, links } : result;
  }

  const result = await syncPerson(person);

  if (!result.guid) {
    return result;
  }

  // Человек уехал — добираем связи, застрявшие без телефона.
  const linksSynced = await catchUpLinks(String(person.id));

  return linksSynced ? { ...result, linksSynced } : result;
};

/** `company.created` и `company.updated` */
export const handleCompanyCreated = async (
  recordId?: string,
  updatedFields: string[] = [],
): Promise<SyncResult> => {
  if (!recordId) {
    return { skipped: 'в событии нет recordId' };
  }

  const company = await readRow('companies', 'company', recordId);

  if (!company) {
    return { skipped: 'компания не найдена' };
  }

  if (guidOf(company)) {
    return syncCompanyUpdate(company, updatedFields);
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
