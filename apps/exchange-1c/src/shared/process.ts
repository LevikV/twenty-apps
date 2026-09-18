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
  findPersonByObjectGuid,
  findPersonByReestr,
  updatePerson,
  upsertReestrRow,
  type PersonRecord,
} from 'src/shared/people';

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

const buildPersonFields = (input: PersonInput, merge?: PersonRecord) => {
  const phones = [...(input.phones ?? [])];
  const emails = [...(input.emails ?? [])];

  if (merge) {
    const existing = normPhones(
      merge.phones?.primaryPhoneNumber ? [merge.phones.primaryPhoneNumber] : [],
    );

    if (existing?.primaryPhoneNumber) {
      phones.push(existing.primaryPhoneNumber);
    }

    const existingEmail = merge.emails?.primaryEmail;

    if (existingEmail) {
      emails.push(existingEmail);
    }
  }

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
    merge = (await findPersonByObjectGuid(input.objectGuid)) ?? undefined;
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

  throw new Error(`неизвестный objectType: ${task.objectType}`);
};

export { TASK_STATUS, relationValues, compact, pluralOf };
