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
  hasKey,
  isBlank,
  type ServiceDocRefs,
} from 'src/shared/service-docs';
import type { ServiceDocPayload } from 'src/shared/payload-service-doc';
import {
  buildOrderFields,
  diffOrderFields,
  type OrderPayload,
  type OrderRefs,
} from 'src/shared/orders';

export type ProcessOutcome = {
  status: 'done' | 'error' | 'pending';
  note?: string;
  /** Повтор из-за ожидания данных (а не ошибки) — считать попытку, чтобы не ждать вечно. */
  retry?: boolean;
};

const DONE: ProcessOutcome = { status: 'done' };

const pending = (note: string): ProcessOutcome => ({ status: 'pending', note });

/**
 * Сколько раз задача может ждать данных (договор по умолчанию, ссылки заказа),
 * прежде чем закрыться с пометкой. Обычно всё приходит в той же порции — лимит страховка.
 */
const WAIT_ATTEMPTS = 10;

type OwnerRef = { kind: 'company' | 'person'; id: string; name?: string };

const findCompanyByGuid = async (guid: string) =>
  (await findFirst('companies', 'company', `objectGuid[eq]:${guid}`)) as
    | (Record<string, unknown> & { id: string; name?: string })
    | undefined;

const findDogovorByGuid = async (guid: string) =>
  (await findFirst('dogovora', 'dogovor', `guid[eq]:${guid}`)) as
    | (Record<string, unknown> & { id: string })
    | undefined;

/** Данных ещё нет в CRM: ждём с повтором, но не бесконечно. */
const waitForData = (note: string, attempts: number): ProcessOutcome => {
  if (attempts >= WAIT_ATTEMPTS) {
    return {
      status: 'done',
      note: `${note} — ссылка не проставлена (попыток: ${attempts})`,
    };
  }

  return { status: 'pending', note, retry: true };
};

/**
 * Гонка при выгрузке: контрагент и его договор пришли одной порцией, но задача договора
 * ещё лежит в очереди. Обрабатываем её сразу, не дожидаясь следующего прогона крона.
 */
const pullContractFromQueue = async (contractGuid: string) => {
  const task = (await findFirst(
    'queueTasks',
    'queueTask',
    `direction[eq]:IN,status[eq]:${TASK_STATUS.pending},objectType[eq]:contract,objectGuid[eq]:${contractGuid}`,
  )) as unknown as QueueTask | undefined;

  if (!task?.id) {
    return undefined;
  }

  await updateOne('queueTasks', 'queueTask', task.id, {
    status: TASK_STATUS.processing,
  });

  try {
    const outcome = await processContract(task.payload as ContractPayload);

    await updateOne('queueTasks', 'queueTask', task.id, {
      status:
        outcome.status === 'pending' ? TASK_STATUS.pending : TASK_STATUS.done,
      errorText: outcome.note ?? null,
    });
  } catch (error) {
    // договор не обработался — вернём задачу в очередь, ею займётся обычный прогон
    await updateOne('queueTasks', 'queueTask', task.id, {
      status: TASK_STATUS.pending,
      errorText: String(error instanceof Error ? error.message : error).slice(
        0,
        400,
      ),
    });

    return undefined;
  }

  return findDogovorByGuid(contractGuid);
};

/**
 * Договор по умолчанию контрагента (компании или физлица): ссылка ставится,
 * как только договор есть в CRM. Не найден — исход `waiting`, задача вернётся на повтор.
 */
const applyDefaultContract = async (
  kind: OwnerRef['kind'],
  recordId: string,
  contractGuid: string,
  currentContractId?: unknown,
): Promise<{ status: 'linked' } | { status: 'waiting'; note: string }> => {
  const contract =
    (await findDogovorByGuid(contractGuid)) ??
    (await pullContractFromQueue(contractGuid));

  if (!contract?.id) {
    return {
      status: 'waiting',
      note: `договор по умолчанию ${contractGuid} ещё не загружен в CRM`,
    };
  }

  const targetId = String(contract.id);

  // уже стоит — не пишем повторно (лишнее обновление карточки = лишнее событие)
  if (
    currentContractId !== undefined &&
    String(currentContractId ?? '') === targetId
  ) {
    return { status: 'linked' };
  }

  if (kind === 'company') {
    await updateOne('companies', 'company', recordId, {
      dogovorPoUmolchaniyuId: targetId,
    });
  } else {
    await updateOne('people', 'person', recordId, {
      dogovorPoUmolchaniyuId: targetId,
    });
  }

  return { status: 'linked' };
};

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
const processCompany = async (
  payload: CompanyPayload,
  attempts = 0,
): Promise<ProcessOutcome> => {
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

  // договор по умолчанию: если договор ещё не в CRM, задача ждёт его и вернётся на повтор
  if (payload.default_contract_guid) {
    const link = await applyDefaultContract(
      'company',
      companyId,
      payload.default_contract_guid,
      existing?.dogovorPoUmolchaniyuId,
    );

    if (link.status === 'waiting') {
      return waitForData(link.note, attempts);
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
  /** Договор по умолчанию из 1С (только у контрагента-физлица). */
  defaultContractGuid?: string;
  /** Номер попытки задачи очереди — чтобы ожидание договора не длилось вечно. */
  attempts?: number;
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

  // Договор по умолчанию у контрагента-физлица (у контактных лиц 1С его не передаёт)
  if (input.defaultContractGuid) {
    const link = await applyDefaultContract(
      'person',
      personId,
      input.defaultContractGuid,
      merge?.dogovorPoUmolchaniyuId,
    );

    if (link.status === 'waiting') {
      return waitForData(link.note, input.attempts ?? 0);
    }
  }

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
      defaultContractGuid: payload.default_contract_guid,
      attempts: task.attemptCount,
    });
  }

  return processCompany(payload, task.attemptCount);
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
      attempts: task.attemptCount,
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
    attempts: task.attemptCount,
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

  // Покупатель (морф-связь: компания или человек).
  // «Зеркало»: ключ есть, значение пустое → связь снимаем; ключа нет → не трогаем.
  if (hasKey(payload, 'counterparty_guid')) {
    if (isBlank(payload.counterparty_guid)) {
      refs.pokupatelCompanyId = null;
      refs.pokupatelPersonId = null;
    } else {
      const buyer = await findCounterparty(String(payload.counterparty_guid));

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
  }

  // Подрядчик (морф-связь: компания или человек) — в 1С это тоже контрагент,
  // поэтому ищем тем же способом, что покупателя.
  if (hasKey(payload, 'contractor_guid')) {
    if (isBlank(payload.contractor_guid)) {
      refs.podryadchikCompanyId = null;
      refs.podryadchikPersonId = null;
    } else {
      const contractor = await findCounterparty(String(payload.contractor_guid));

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
  }

  // Контактное лицо — только человек.
  if (hasKey(payload, 'contact_person_guid')) {
    if (isBlank(payload.contact_person_guid)) {
      refs.kontaktnoeLicoId = null;
    } else {
      const guid = String(payload.contact_person_guid);
      const byReestr = await findPersonByReestr(guid);
      const person = byReestr?.personId ? null : await findPersonByObjectGuid(guid);

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
          `контактное лицо «${(payload.contact_person ?? '').trim() || guid}» не найдено`,
        );
      }
    }
  }

  // Сотрудники: мастер, приёмщик, ответственный.
  const resolveEmployee = async (
    key: 'master_guid' | 'receiver_guid' | 'responsible_guid',
    ref: keyof ServiceDocRefs,
    label: string,
  ): Promise<void> => {
    if (!hasKey(payload, key)) {
      return;
    }

    const guid = String(payload[key] ?? '').trim();

    if (!guid) {
      refs[ref] = null;
      return;
    }

    const sotrudnik = await findSotrudnikByGuid(guid);

    if (sotrudnik?.id) {
      refs[ref] = String(sotrudnik.id);
    } else {
      missing.push(`${label} (guid ${guid}) не найден в «Сотрудниках»`);
    }
  };

  await resolveEmployee('master_guid', 'masterId', 'мастер');
  await resolveEmployee('receiver_guid', 'priyomshchikId', 'приёмщик');
  await resolveEmployee('responsible_guid', 'otvetstvennyyId', 'ответственный');

  // Договор
  if (hasKey(payload, 'agreement_guid')) {
    if (isBlank(payload.agreement_guid)) {
      refs.dogovorId = null;
    } else {
      const dogovor = await findDogovorByGuid(String(payload.agreement_guid));

      if (dogovor?.id) {
        refs.dogovorId = String(dogovor.id);
      } else {
        missing.push(
          `договор «${(payload.agreement ?? '').trim() || payload.agreement_guid}» не найден`,
        );
      }
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

const ORDER_PLURAL = 'opportunities';
const ORDER_SINGULAR = 'opportunity';

/** «Заказ» 1С по guid — нативный объект `opportunity`. */
const findOrderByGuid = async (guid: string) =>
  (await findFirst(ORDER_PLURAL, ORDER_SINGULAR, `guid[eq]:${guid}`)) as
    | (Record<string, unknown> & { id: string })
    | undefined;

/**
 * Заказ покупателя (`objectType = "ЗаказПокупателя"`) → «Заказ / Заказы».
 * Маппинг и правила — как в разовой загрузке `load_orders.py`; удаление — как у ДС:
 * карточка не удаляется, а помечается «Активен» = нет.
 */
const processOrder = async (
  payload: OrderPayload,
  attempts = 0,
): Promise<ProcessOutcome> => {
  const existing = await findOrderByGuid(payload.guid);

  if (payload.deleted === true) {
    if (!existing?.id) {
      return {
        status: 'done',
        note: 'заказ на удаление не найден в CRM — удалять нечего',
      };
    }

    if (existing.aktiven === false) {
      return DONE;
    }

    await updateOne(ORDER_PLURAL, ORDER_SINGULAR, String(existing.id), {
      aktiven: false,
    });

    return { status: 'done', note: 'заказ помечен неактивным («Активен» = нет)' };
  }

  const refs: OrderRefs = {};
  const missing: string[] = [];
  const notes: string[] = [];

  // Покупатель (морф-связь: компания или человек)
  const buyerGuid = String(payload.counterparty_guid ?? '').trim();

  if (buyerGuid) {
    const company = await findCompanyByGuid(buyerGuid);
    const byReestr = company?.id ? null : await findPersonByReestr(buyerGuid);
    const person =
      company?.id || byReestr?.personId
        ? null
        : await findPersonByObjectGuid(buyerGuid);

    if (company?.id) {
      refs.pokupatelCompanyId = String(company.id);
    } else if (byReestr?.personId) {
      refs.pokupatelPersonId = byReestr.personId;
    } else if (person?.id) {
      refs.pokupatelPersonId = String(person.id);
    } else {
      missing.push(
        `покупатель «${(payload.counterparty ?? '').trim() || buyerGuid}» не найден в CRM`,
      );
    }
  }

  // Контактное лицо — только по гуиду (тексты из шапки и доставки не используем)
  const contactGuid = String(payload.contact_person_guid ?? '').trim();

  if (contactGuid) {
    const byReestr = await findPersonByReestr(contactGuid);
    const person = byReestr?.personId
      ? null
      : await findPersonByObjectGuid(contactGuid);

    if (byReestr?.personId) {
      refs.pointOfContactId = byReestr.personId;
    } else if (person?.id) {
      refs.pointOfContactId = String(person.id);
    } else if (contactGuid === buyerGuid) {
      notes.push(
        'контактное лицо = сам покупатель (организация) — поле оставлено пустым',
      );
    } else {
      missing.push(
        `контактное лицо «${(payload.contact_person ?? '').trim() || contactGuid}» не найдено`,
      );
    }
  }

  // Договор
  const agreementGuid = String(payload.agreement_guid ?? '').trim();

  if (agreementGuid) {
    const dogovor = await findDogovorByGuid(agreementGuid);

    if (dogovor?.id) {
      refs.dogovorId = String(dogovor.id);
    } else {
      missing.push(
        `договор «${(payload.agreement ?? '').trim() || agreementGuid}» не найден`,
      );
    }
  }

  // Ответственный
  const responsibleGuid = String(payload.responsible_guid ?? '').trim();

  if (responsibleGuid) {
    const sotrudnik = await findSotrudnikByGuid(responsibleGuid);

    if (sotrudnik?.id) {
      refs.otvetstvennyyId = String(sotrudnik.id);
    } else {
      missing.push(
        `ответственный (guid ${responsibleGuid}) не найден в «Сотрудниках»`,
      );
    }
  } else {
    notes.push('ответственный не заполнен в 1С');
  }

  // Ссылки могут прийти в той же порции — возвращаем задачу на повтор
  if (missing.length) {
    return waitForData(missing.join('; '), attempts);
  }

  const fields = buildOrderFields(payload, refs, notes);
  const note = notes.length ? notes.join('; ') : undefined;

  if (existing?.id) {
    const diff = diffOrderFields(fields, existing);

    if (Object.keys(diff).length) {
      await updateOne(ORDER_PLURAL, ORDER_SINGULAR, String(existing.id), diff);
    }

    return { status: 'done', note };
  }

  const created = await createOne(ORDER_PLURAL, ORDER_SINGULAR, fields);

  if (!created?.id) {
    throw new Error('заказ не создан');
  }

  return { status: 'done', note };
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
      attempts: task.attemptCount,
    });
  }

  if (task.objectType === 'УниверсальныйСервис') {
    return processServiceDoc(task);
  }

  if (task.objectType === 'ЗаказПокупателя') {
    const payload = task.payload as OrderPayload;

    if (!payload?.guid) {
      throw new Error('в задаче нет payload.guid');
    }

    return processOrder(payload, task.attemptCount);
  }

  throw new Error(`неизвестный objectType: ${task.objectType}`);
};

export { TASK_STATUS, relationValues, compact, pluralOf };
