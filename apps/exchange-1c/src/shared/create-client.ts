import { createHash, randomUUID } from 'node:crypto';

import { compact, createOne, findFirst, findMany } from 'src/shared/crm';
import { linkFields } from 'src/shared/fields';
import { normPhones, normalizeNumber, ph10, splitFio } from 'src/shared/normalize';
import { REESTR_STATUS, REESTR_TYPE, TASK_STATUS } from 'src/shared/payload';
import { upsertReestrRow } from 'src/shared/people';

/**
 * Создание контакта или компании из звонка.
 *
 * Решения 28.10.2026 (Obsidian «Создание контакта или компании из звонка»):
 *  - вид объекта в очереди задаёт поле связи: связь есть -> `contact` (контактное
 *    лицо с `owner_guid`), связи нет («Как физ.лицо») -> `company` + `payload.type=contact`;
 *  - guid генерируем у нас и сразу пишем строку «Реестра сопоставлений», иначе первое
 *    же изменение из 1С заведёт второго человека;
 *  - договор не создаём (пока).
 *
 * Для владельца-человека действует правило значимых ролей (Правила обмена, раздел 6):
 * у человека обязан быть свой контрагент-физлицо; если его нет — создаём задачей,
 * guid контрагента производный от id карточки (uuidv5), поэтому ссылку можно
 * проставить сразу, не дожидаясь ответа 1С.
 */

const NAMESPACE = '5aeb3683-24b9-413b-9c2b-048122d0cd61';

const QUEUE_PLURAL = 'queueTasks';
const QUEUE_SINGULAR = 'queueTask';

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

/** UUIDv5 (sha1) от id карточки — детерминированный guid контрагента. */
const uuidV5 = (name: string, namespace = NAMESPACE): string => {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
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

/** guid собственного контрагента-физлица человека (производный от карточки). */
export const contragentGuidOf = (personId: string): string => uuidV5(personId);

const fullNameOf = (person: CrmRow): string => {
  const name = person.name as
    | { firstName?: string; lastName?: string }
    | undefined;

  return [name?.lastName, name?.firstName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
};

/** Есть ли контрагент-физлицо у человека: строка реестра -> её guid. */
const findContragentGuid = async (personId: string): Promise<string | null> => {
  const row = await findFirst(
    'reestrySopostavleniy',
    'reestrSopostavleniy',
    `chelovekId[eq]:${personId},tipZapisi[eq]:${REESTR_TYPE.physicalPerson}`,
  );

  const guid = String(row?.guid1c ?? '').trim();

  return guid || null;
};

/** Уже отправляли создание контрагента с этим guid? (любой статус задачи) */
const hasContragentTask = async (guid: string): Promise<boolean> => {
  const task = await findFirst(
    QUEUE_PLURAL,
    QUEUE_SINGULAR,
    `objectGuid[eq]:${guid}`,
  );

  return Boolean(task?.id);
};

const putQueueTask = async (params: {
  objectType: string;
  objectGuid: string;
  action: 'CREATE';
  payload: Record<string, unknown>;
}): Promise<string> => {
  const created = await createOne(QUEUE_PLURAL, QUEUE_SINGULAR, {
    taskId: randomUUID(),
    direction: 'OUT',
    objectType: params.objectType,
    objectGuid: params.objectGuid,
    action: params.action,
    status: TASK_STATUS.pending,
    attemptCount: 0,
    payload: params.payload,
  });

  const taskId = String(created?.id ?? '');

  if (!taskId) {
    throw new Error('задача в очередь обмена не создана');
  }

  return taskId;
};

/**
 * Правило значимых ролей: владельцем контактного лица в 1С может быть только
 * контрагент. Возвращает guid контрагента человека; если его ещё нет — заводит
 * задачу на создание (идемпотентно по производному guid).
 */
const ensureContragentForPerson = async (person: CrmRow): Promise<string> => {
  const existing = await findContragentGuid(person.id);

  if (existing) {
    return existing;
  }

  const guid = contragentGuidOf(person.id);

  if (await hasContragentTask(guid)) {
    return guid;
  }

  const phones = person.phones as
    | { primaryPhoneNumber?: string; additionalPhones?: unknown }
    | undefined;
  const phoneNumbers: string[] = [];

  if (phones?.primaryPhoneNumber) {
    phoneNumbers.push(String(phones.primaryPhoneNumber));
  }

  await putQueueTask({
    objectType: 'company',
    objectGuid: guid,
    action: 'CREATE',
    payload: {
      guid,
      type: 'contact',
      name: fullNameOf(person) || String(person.name ?? ''),
      phones: phoneNumbers,
      comment: String(person.kommentariy ?? ''),
      source: 'crm',
      created_from_call: true,
      crm_record_id: person.id,
    },
  });

  return guid;
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
 * Создаёт карточку, связь «Контакт клиента», строку реестра и задачу OUT.
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

  const guid = randomUUID();
  const comment = String(input.comment ?? '').trim();
  const tipOtnosheniy = (input.tipOtnosheniy ?? []).filter(Boolean);
  const address = String(input.address ?? '').trim();

  if (input.kind === 'company') {
    const created = await createOne(
      'companies',
      'company',
      compact({
        objectGuid: guid,
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

    const payload = {
      guid,
      name,
      type: input.pravovayaForma === 'IP' ? 'ip' : 'legal',
      relation_types: reverseRelations(tipOtnosheniy),
      phones: [phone],
      comment,
      addresses: address ? [{ type: 'legal', value: address }] : [],
      source: 'crm',
      created_from_call: true,
      created_by: input.createdBy ?? null,
      crm_record_id: String(created.id),
      change_date: new Date().toISOString(),
    };

    const taskId = await putQueueTask({
      objectType: 'company',
      objectGuid: guid,
      action: 'CREATE',
      payload,
    });

    return {
      created: true,
      id: String(created.id),
      kind: 'company',
      name,
      guid,
      taskId,
      owner: null,
    };
  }

  // ── контакт ────────────────────────────────────────────────────────────────
  const owner = input.link && input.link.id ? input.link : null;
  let ownerGuid: string | null = null;
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

    ownerGuid = String(company.objectGuid ?? '').trim();

    if (!ownerGuid) {
      throw new Error('у связанной компании нет guid 1С — связь невозможна');
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

    ownerGuid = await ensureContragentForPerson(person);
    ownerName = fullNameOf(person);
  }

  const created = await createOne(
    'people',
    'person',
    compact({
      objectGuid: guid,
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

  if (owner && ownerGuid) {
    await createOne(
      'kontaktyKlientov',
      'kontaktKlienta',
      linkFields({
        guid,
        personId,
        owner,
        personName: name,
        ownerName,
      }),
    );
  }

  const payload: Record<string, unknown> = {
    guid,
    name,
    phones: [phone],
    comment,
    address,
    relation_types: reverseRelations(tipOtnosheniy),
    source: 'crm',
    created_from_call: true,
    created_by: input.createdBy ?? null,
    crm_record_id: personId,
    change_date: new Date().toISOString(),
  };

  if (ownerGuid) {
    payload.owner_guid = ownerGuid;
  }

  const objectType = ownerGuid ? 'contact' : 'company';

  if (!ownerGuid) {
    payload.type = 'contact';
  }

  await upsertReestrRow({
    guid1c: guid,
    personId,
    tipZapisi: ownerGuid ? REESTR_TYPE.contactFace : REESTR_TYPE.physicalPerson,
    status: REESTR_STATUS.main,
    payload,
  });

  const taskId = await putQueueTask({
    objectType,
    objectGuid: guid,
    action: 'CREATE',
    payload,
  });

  return {
    created: true,
    id: personId,
    kind: 'contact',
    name,
    guid,
    taskId,
    objectType,
    owner: owner ? { kind: owner.kind, id: owner.id, guid: ownerGuid } : null,
  };
};

/** Значения CRM (POKUPATEL) -> коды 1С (buyer) для payload. */
const reverseRelations = (values: string[]): string[] => {
  const map: Record<string, string> = {
    POKUPATEL: 'buyer',
    POSTAVSHCHIK: 'supplier',
    PROCHEE: 'other',
  };

  return values.map((value) => map[value]).filter(Boolean);
};
