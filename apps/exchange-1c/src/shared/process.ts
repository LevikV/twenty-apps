import {
  compact,
  createOne,
  findFirst,
  findMany,
  pluralOf,
  softDeleteOne,
  updateOne,
} from 'src/shared/crm';
import {
  addressFields,
  companyFields,
  contractFields,
  linkFields,
  personFields,
  relationValues,
} from 'src/shared/fields';
import {
  normEmails,
  normPhones,
  pickLegalAddress,
  pickNonlegalAddresses,
} from 'src/shared/normalize';
import {
  REESTR_STATUS,
  REESTR_TYPE,
  TASK_STATUS,
  type CompanyPayload,
  type ContactPayload,
  type ContractPayload,
  type QueueTask,
} from 'src/shared/payload';
import {
  createPerson,
  findCandidateByPhoneAndName,
  findPersonById,
  findPersonByObjectGuid,
  findPersonByReestr,
  updatePerson,
  upsertReestrRow,
  type PersonRecord,
} from 'src/shared/people';
import {
  buildServiceDocFields,
  CARTRIDGE_TYPE,
  DEVICE_TYPE,
  type ServiceDocRefs,
} from 'src/shared/service-docs';
import type { ServiceDocPayload } from 'src/shared/payload-service-doc';

export type ProcessOutcome = {
  status: 'done' | 'error' | 'pending';
  note?: string;
};

const DONE: ProcessOutcome = { status: 'done' };

const pending = (note: string): ProcessOutcome => ({ status: 'pending', note });

type OwnerRef = { kind: 'company' | 'person'; id: string; name?: string };

const findCompanyByGuid = async (guid: string) =>
  (await findFirst('companies', 'company', `objectGuid[eq]:${guid}`)) as
    | (Record<string, unknown> & { id: string; name?: string })
    | undefined;

/** Владелец записи 1С: компания по objectGuid, иначе человек по реестру. */
const findOwner = async (ownerGuid?: string): Promise<OwnerRef | null> => {
  if (!ownerGuid) {
    return null;
  }

  const company = await findCompanyByGuid(ownerGuid);

  if (company?.id) {
    return { kind: 'company', id: company.id, name: company.name };
  }

  const byReestr = await findPersonByReestr(ownerGuid);

  if (byReestr?.personId) {
    return { kind: 'person', id: byReestr.personId };
  }

  const person = await findPersonByObjectGuid(ownerGuid);

  if (person?.id) {
    return { kind: 'person', id: person.id };
  }

  return null;
};

/** Компания: upsert по objectGuid + договор по умолчанию (если договор уже есть). */
const processCompany = async (payload: CompanyPayload): Promise<ProcessOutcome> => {
  const fields = companyFields(payload);
  const existing = await findCompanyByGuid(payload.guid);

  let companyId: string;

  if (existing?.id) {
    if (payload.deleted) {
      const unlinked = await unlinkContactsOfOwner({
        kind: 'company',
        id: existing.id,
      });

      await softDeleteOne('companies', existing.id);

      return {
        status: 'done',
        note: `контрагент удалён, снято связей с контактными лицами: ${unlinked}`,
      };
    }

    if (Object.keys(fields).length) {
      await updateOne('companies', 'company', existing.id, fields);
    }

    companyId = existing.id;
  } else if (payload.deleted) {
    return {
      status: 'done',
      note: 'запись на удаление не найдена в CRM — удалять нечего',
    };
  } else {
    const created = await createOne('companies', 'company', fields);

    if (!created?.id) {
      throw new Error('компания не создана');
    }

    companyId = String(created.id);
  }

  // адреса, кроме юридического (оно живёт в поле карточки)
  const owner: OwnerRef = { kind: 'company', id: companyId };
  const existingAddresses = (await findMany(
    'companyAddresses',
    `companyId[eq]:${companyId}`,
    200,
  )) as Record<string, unknown>[];

  for (const address of pickNonlegalAddresses(payload.addresses)) {
    const fieldsForAddress = addressFields(address, owner);
    const street = (fieldsForAddress.addressStructured as { addressStreet1?: string })
      ?.addressStreet1;
    const isDuplicate = existingAddresses.some(
      (row) =>
        row.addressType === fieldsForAddress.addressType &&
        ((row.addressStructured as { addressStreet1?: string })?.addressStreet1 ??
          '') === (street ?? ''),
    );

    if (!isDuplicate) {
      await createOne('companyAddresses', 'companyAddress', fieldsForAddress);
    }
  }

  // договор по умолчанию: ставим, если он уже загружен
  if (payload.default_contract_guid) {
    const contract = await findFirst(
      'dogovora',
      'dogovor',
      `guid[eq]:${payload.default_contract_guid}`,
    );

    if (contract?.id) {
      await updateOne('companies', 'company', companyId, {
        dogovorPoUmolchaniyuId: String(contract.id),
      });
    }
  }

  return DONE;
};

/**
 * Удаление владельца: связи «Контакт клиента» теряют смысл вместе с клиентом,
 * а сами контактные лица остаются — они самостоятельные записи.
 */
const unlinkContactsOfOwner = async (owner: OwnerRef): Promise<number> => {
  const filter =
    owner.kind === 'company'
      ? `klientCompanyId[eq]:${owner.id}`
      : `klientPersonId[eq]:${owner.id}`;

  const links = await findMany('kontaktyKlientov', filter, 200);
  let removed = 0;

  for (const link of links) {
    await softDeleteOne('kontaktyKlientov', String(link.id));
    removed += 1;
  }

  return removed;
};

/** Удаление контактного лица: его связи с клиентами снимаем. */
const unlinkPersonLinks = async (personId: string): Promise<number> => {
  const links = await findMany(
    'kontaktyKlientov',
    `kontaktnoeLicoId[eq]:${personId}`,
    200,
  );
  let removed = 0;

  for (const link of links) {
    await softDeleteOne('kontaktyKlientov', String(link.id));
    removed += 1;
  }

  return removed;
};

type PersonInput = {
  objectGuid: string;
  name?: string;
  comment?: string;
  phones?: string[];
  emails?: string[];
  relationTypes?: string[];
  addresses?: { type?: string; value?: string }[];
  tipZapisi: string;
  payload: unknown;
  ownerGuid?: string;
  deleted?: boolean;
};

/** Телефоны карточки: основной + дополнительные (в базе дополнительные бывают строкой JSON). */
const phonesOfRecord = (record: PersonRecord): string[] => {
  const out: string[] = [];
  const primary = record.phones?.primaryPhoneNumber;

  if (primary) {
    out.push(primary);
  }

  let extra: unknown = record.phones?.additionalPhones;

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
        out.push(number);
      }
    }
  }

  return out;
};

/** Почты карточки: основная + дополнительные. */
const emailsOfRecord = (record: PersonRecord): string[] => {
  const out: string[] = [];
  const primary = record.emails?.primaryEmail;

  if (primary) {
    out.push(primary);
  }

  for (const mail of record.emails?.additionalEmails ?? []) {
    if (mail) {
      out.push(mail);
    }
  }

  return out;
};

const buildPersonFields = (input: PersonInput, merge?: PersonRecord) => {
  // Существующие телефоны и почты карточки идут первыми: основной номер не смещаем,
  // а номера записи добавляются к ним (normPhones/normEmails сами убирают дубли).
  const existingPhones = merge ? phonesOfRecord(merge) : [];
  const existingEmails = merge ? emailsOfRecord(merge) : [];
  const phones = [...existingPhones, ...(input.phones ?? [])];
  const emails = [...existingEmails, ...(input.emails ?? [])];

  return personFields({
    // objectGuid ставим только своей карточке: у найденной по склейке он свой,
    // а поле уникальное — перезапись даст конфликт
    objectGuid: merge ? '' : input.objectGuid,
    name: input.name,
    comment: input.comment,
    phones,
    emails,
    relationTypes: input.relationTypes,
    legalAddress: pickLegalAddress(input.addresses),
  });
};

/** Человек: реестр -> склейка по телефону+ФИО -> создание; далее связь и реестр. */
const processPerson = async (input: PersonInput): Promise<ProcessOutcome> => {
  if (input.deleted) {
    const row = await findPersonByReestr(input.objectGuid);

    if (!row?.personId) {
      return {
        status: 'done',
        note: 'запись на удаление не найдена в CRM — удалять нечего',
      };
    }

    const linked = await findMany(
      'reestrySopostavleniy',
      `chelovekId[eq]:${row.personId}`,
      5,
    );
    const unlinked = await unlinkPersonLinks(row.personId);

    if (linked.length <= 1) {
      await softDeleteOne('people', row.personId);

      return {
        status: 'done',
        note: `карточка удалена, снято связей: ${unlinked}`,
      };
    }

    return {
      status: 'done',
      note: `карточка склеена с другими записями 1С — не удалена, снято связей: ${unlinked}`,
    };
  }

  const byReestr = await findPersonByReestr(input.objectGuid);

  let personId: string;
  let status: string;
  let merge: PersonRecord | undefined;

  if (byReestr?.personId) {
    personId = byReestr.personId;
    status = byReestr.reestr.status ?? REESTR_STATUS.main;
    // У карточки бывает несколько записей 1С: читаем саму карточку,
    // чтобы дополнить её поля, а не заменить полями одной записи
    merge = (await findPersonById(personId)) ?? undefined;
  } else {
    // Карточка могла быть создана раньше, а строка реестра — не успеть (падение в прошлом прогоне)
    const byObjectGuid = await findPersonByObjectGuid(input.objectGuid);
    const candidate =
      byObjectGuid ?? (await findCandidateByPhoneAndName(input.phones, input.name));

    if (candidate?.id) {
      personId = candidate.id;
      // Если это карточка той же самой записи 1С — запись основная, иначе приехала в чужую
      status =
        candidate.objectGuid && candidate.objectGuid === input.objectGuid
          ? REESTR_STATUS.main
          : REESTR_STATUS.merged;
      merge = candidate;
    } else {
      const created = await createPerson(buildPersonFields(input));

      personId = created.id;
      status = REESTR_STATUS.main;
    }
  }

  const fields = buildPersonFields(input, merge);

  if (Object.keys(fields).length > 1) {
    await updatePerson(personId, fields);
  }

  await upsertReestrRow({
    guid1c: input.objectGuid,
    personId,
    tipZapisi: input.tipZapisi,
    status,
    payload: input.payload,
  });

  if (!input.ownerGuid) {
    return DONE;
  }

  const owner = await findOwner(input.ownerGuid);

  if (!owner) {
    return pending(`владелец ${input.ownerGuid} ещё не загружен`);
  }

  const existingLink = await findFirst(
    'kontaktyKlientov',
    'kontaktKlienta',
    `objectGuid[eq]:${input.objectGuid}`,
  );

  const linkData = linkFields({
    guid: input.objectGuid,
    personId,
    owner,
    personName: input.name,
    ownerName: owner.name,
    position: undefined,
  });

  if (existingLink?.id) {
    await updateOne('kontaktyKlientov', 'kontaktKlienta', String(existingLink.id), linkData);
  } else {
    await createOne('kontaktyKlientov', 'kontaktKlienta', linkData);
  }

  return DONE;
};

const processContract = async (payload: ContractPayload): Promise<ProcessOutcome> => {
  const existing = await findFirst('dogovora', 'dogovor', `guid[eq]:${payload.guid}`);

  if (payload.deleted) {
    if (existing?.id) {
      await softDeleteOne('dogovora', String(existing.id));

      return { status: 'done', note: 'договор удалён' };
    }

    return {
      status: 'done',
      note: 'запись на удаление не найдена в CRM — удалять нечего',
    };
  }

  const owner = await findOwner(payload.owner_guid);

  if (!owner) {
    return pending(`владелец ${payload.owner_guid} ещё не загружен`);
  }

  const fields = contractFields(payload, owner);

  if (existing?.id) {
    await updateOne('dogovora', 'dogovor', String(existing.id), fields);
  } else {
    await createOne('dogovora', 'dogovor', fields);
  }

  return DONE;
};

const handleCompanyTask = async (task: QueueTask): Promise<ProcessOutcome> => {
  const payload = task.payload as CompanyPayload;

  if (!payload?.guid) {
    throw new Error('в задаче нет payload.guid');
  }

  // Контрагент-физлицо: в 1С это справочник контрагентов, но человек
  if (payload.type === 'contact') {
    return processPerson({
      objectGuid: payload.guid,
      name: payload.name,
      comment: payload.comment,
      phones: payload.phones,
      emails: payload.emails,
      relationTypes: payload.relation_types,
      addresses: payload.addresses,
      tipZapisi: REESTR_TYPE.physicalPerson,
      payload,
      deleted: payload.deleted,
    });
  }

  return processCompany(payload);
};

const handleContactTask = async (task: QueueTask): Promise<ProcessOutcome> => {
  const payload = task.payload as ContactPayload;

  if (!payload?.guid) {
    throw new Error('в задаче нет payload.guid');
  }

  const hasContacts = Boolean(payload.phones?.length) || Boolean(payload.emails?.length);
  const byReestr = await findPersonByReestr(payload.guid);

  // Правило: контактное лицо без телефона и email не грузим — но пропуск должен быть видимым
  if (!hasContacts && !byReestr) {
    return { status: 'done', note: 'контактное лицо без телефона и email — пропущено по правилу' };
  }

  if (payload.deleted) {
    return processPerson({
      objectGuid: payload.guid,
      name: payload.name,
      comment: payload.comment,
      phones: payload.phones,
      emails: payload.emails,
      tipZapisi: REESTR_TYPE.contactFace,
      payload,
      ownerGuid: payload.owner_guid,
      deleted: true,
    });
  }

  return processPerson({
    objectGuid: payload.guid,
    name: payload.name,
    comment: payload.comment,
    phones: payload.phones,
    emails: payload.emails,
    tipZapisi: REESTR_TYPE.contactFace,
    payload,
    ownerGuid: payload.owner_guid,
  });
};

const handleContractTask = async (task: QueueTask): Promise<ProcessOutcome> => {
  const payload = task.payload as ContractPayload;

  if (!payload?.guid) {
    throw new Error('в задаче нет payload.guid');
  }

  return processContract(payload);
};

const REMONT_PLURAL = 'remontOborudovaniyas';
const REMONT_SINGULAR = 'remontOborudovaniya';

const findRemontByGuid = async (guid: string) =>
  (await findFirst(REMONT_PLURAL, REMONT_SINGULAR, `guid[eq]:${guid}`)) as
    | (Record<string, unknown> & { id: string })
    | undefined;

/** «Сотрудники» 1С по guid. */
const findSotrudnikByGuid = async (guid: string) =>
  (await findFirst('sotrudniki', 'sotrudnik', `guid[eq]:${guid}`)) as
    | (Record<string, unknown> & { id: string })
    | undefined;

const findDogovorByGuid = async (guid: string) =>
  (await findFirst('dogovora', 'dogovor', `guid[eq]:${guid}`)) as
    | (Record<string, unknown> & { id: string })
    | undefined;

/**
 * Контрагент 1С (покупатель ДС или подрядчик): компания по objectGuid,
 * иначе человек — сначала через «Реестр сопоставлений», затем по objectGuid.
 */
const findCounterparty = async (
  guid: string,
): Promise<{ companyId?: string; personId?: string } | null> => {
  const company = await findCompanyByGuid(guid);

  if (company?.id) {
    return { companyId: company.id };
  }

  const byReestr = await findPersonByReestr(guid);

  if (byReestr?.personId) {
    return { personId: byReestr.personId };
  }

  const person = await findPersonByObjectGuid(guid);

  return person?.id ? { personId: person.id } : null;
};

/**
 * Документ сервиса (`objectType = "УниверсальныйСервис"`) → «Ремонт оборудования».
 * Картриджи на этом этапе не раскладываются — задача закрывается с пояснением.
 * Удаление: карточка не удаляется, а помечается «Активен» = false.
 */
const processServiceDoc = async (task: QueueTask): Promise<ProcessOutcome> => {
  const payload = task.payload as ServiceDocPayload;

  if (!payload?.guid) {
    throw new Error('в задаче нет payload.guid');
  }

  const existing = await findRemontByGuid(payload.guid);
  const deleted = payload.deleted === true || task.action === 'DELETE';

  if (deleted) {
    if (!existing?.id) {
      return {
        status: 'done',
        note: 'запись на удаление не найдена в CRM — удалять нечего',
      };
    }

    await updateOne(REMONT_PLURAL, REMONT_SINGULAR, String(existing.id), {
      aktiven: false,
    });

    return { status: 'done', note: 'ДС помечена неактивной («Активен» = нет)' };
  }

  const equipment = String(payload.equipment_type ?? '').trim();

  if (equipment === CARTRIDGE_TYPE) {
    return {
      status: 'done',
      note: 'тип «Картриджи» — не обрабатывается на этом этапе',
    };
  }

  if (equipment !== DEVICE_TYPE) {
    throw new Error(`неизвестный equipment_type: «${equipment}»`);
  }

  const refs: ServiceDocRefs = {};
  const missing: string[] = [];
  // пометки, которые не мешают закрыть задачу (видимый пропуск, а не тихий)
  const notices: string[] = [];

  // покупатель (морф-связь: компания или человек)
  if (payload.counterparty_guid) {
    const buyer = await findCounterparty(payload.counterparty_guid);

    if (buyer?.companyId) {
      refs.pokupatelCompanyId = buyer.companyId;
    } else if (buyer?.personId) {
      refs.pokupatelPersonId = buyer.personId;
    } else {
      missing.push(
        `покупатель «${(payload.counterparty ?? '').trim() || payload.counterparty_guid}» не найден в CRM`,
      );
    }
  }

  // подрядчик (морф-связь: компания или человек) — в 1С это тоже контрагент,
  // поэтому ищем тем же способом, что покупателя
  if (payload.contractor_guid) {
    const contractor = await findCounterparty(payload.contractor_guid);

    if (contractor?.companyId) {
      refs.podryadchikCompanyId = contractor.companyId;
    } else if (contractor?.personId) {
      refs.podryadchikPersonId = contractor.personId;
    } else {
      missing.push(
        `подрядчик «${(payload.contractor ?? '').trim() || payload.contractor_guid}» не найден в CRM`,
      );
    }
  }

  // контактное лицо — только человек
  if (payload.contact_person_guid) {
    const byReestr = await findPersonByReestr(payload.contact_person_guid);
    const person = byReestr?.personId
      ? null
      : await findPersonByObjectGuid(payload.contact_person_guid);

    if (byReestr?.personId) {
      refs.kontaktnoeLicoId = byReestr.personId;
    } else if (person?.id) {
      refs.kontaktnoeLicoId = String(person.id);
    } else if (payload.counterparty_guid === payload.contact_person_guid) {
      // в 1С в поле «контактное лицо» бывает подставлен сам контрагент (организация):
      // человека там нет — поле оставляем пустым, как в разовом загрузчике
      notices.push('контактное лицо = сам покупатель (организация) — поле оставлено пустым');
    } else {
      missing.push(
        `контактное лицо «${(payload.contact_person ?? '').trim() || payload.contact_person_guid}» не найдено`,
      );
    }
  }

  // сотрудники: мастер, приёмщик, ответственный
  const employees: [string | undefined, keyof ServiceDocRefs, string][] = [
    [payload.master_guid, 'masterId', 'мастер'],
    [payload.receiver_guid, 'priyomshchikId', 'приёмщик'],
    [payload.responsible_guid, 'otvetstvennyyId', 'ответственный'],
  ];

  for (const [guid, key, label] of employees) {
    if (!guid) {
      continue;
    }

    const sotrudnik = await findSotrudnikByGuid(guid);

    if (sotrudnik?.id) {
      refs[key] = String(sotrudnik.id);
    } else {
      missing.push(`${label} (guid ${guid}) не найден в «Сотрудниках»`);
    }
  }

  // договор
  if (payload.agreement_guid) {
    const dogovor = await findDogovorByGuid(payload.agreement_guid);

    if (dogovor?.id) {
      refs.dogovorId = String(dogovor.id);
    } else {
      missing.push(
        `договор «${(payload.agreement ?? '').trim() || payload.agreement_guid}» не найден`,
      );
    }
  }

  // Владелец не найден — задача возвращается в очередь (решение 02.10.2026).
  // Пустое поле в 1С (нет guid) сюда не попадает: поле просто не трогаем.
  if (missing.length) {
    return pending(missing.join('; '));
  }

  const { fields, notes } = buildServiceDocFields(payload, refs);
  const allNotes = [...notices, ...notes];

  if (existing?.id) {
    await updateOne(REMONT_PLURAL, REMONT_SINGULAR, String(existing.id), fields);
  } else {
    const created = await createOne(REMONT_PLURAL, REMONT_SINGULAR, fields);

    if (!created?.id) {
      throw new Error('карточка ДС не создана');
    }
  }

  return { status: 'done', note: allNotes.length ? allNotes.join('; ') : undefined };
};

/** Обработка одной задачи очереди. */
export const processTask = async (task: QueueTask): Promise<ProcessOutcome> => {
  const payload = (task.payload ?? {}) as { deleted?: boolean };

  if (task.objectType === 'company') {
    return handleCompanyTask(task);
  }

  if (task.objectType === 'contact') {
    return handleContactTask(task);
  }

  if (task.objectType === 'contract') {
    return handleContractTask(task);
  }

  if (task.objectType === 'person') {
    const payload = task.payload as ContactPayload;

    return processPerson({
      objectGuid: payload?.guid,
      name: payload?.name,
      comment: payload?.comment,
      phones: payload?.phones,
      emails: payload?.emails,
      tipZapisi: REESTR_TYPE.contactFace,
      payload: task.payload,
      ownerGuid: payload?.owner_guid,
      deleted: payload?.deleted,
    });
  }

  if (task.objectType === 'УниверсальныйСервис') {
    return processServiceDoc(task);
  }

  throw new Error(`неизвестный objectType: ${task.objectType}`);
};

export { TASK_STATUS, relationValues, compact, pluralOf };
