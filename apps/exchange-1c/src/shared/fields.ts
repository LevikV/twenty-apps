import {
  ADDRESS_TYPE_MAP,
  COMPANY_TYPE_TO_LEGAL_FORM,
  RELATION_TYPE_MAP,
  normEmails,
  normPhones,
  pickLegalAddress,
  normalizeSite,
  splitFio,
} from 'src/shared/normalize';
import type {
  AddressItem,
  CompanyPayload,
  ContactPayload,
  ContractPayload,
} from 'src/shared/payload';
import { compact } from 'src/shared/crm';

export const relationValues = (relationTypes?: string[]): string[] | undefined => {
  const values = (relationTypes ?? [])
    .map((type) => RELATION_TYPE_MAP[type])
    .filter(Boolean);

  return values.length ? values : undefined;
};

const linkValue = (url: string | null) =>
  url ? { primaryLinkUrl: url } : undefined;

const addressValue = (value?: string | null) =>
  value ? { addressStreet1: value } : undefined;

/** Контрагент (юрлицо / ИП / госорган) -> поля Company. */
export const companyFields = (payload: CompanyPayload) => {
  const site = normalizeSite(payload.site);

  return compact({
    name: payload.name,
    objectGuid: payload.guid,
    pravovayaForma: COMPANY_TYPE_TO_LEGAL_FORM[payload.type ?? ''] ?? undefined,
    tipOtnosheniy: relationValues(payload.relation_types),
    domainName: linkValue(site),
    fullName: payload.full_name,
    inn: payload.inn,
    kpp: payload.kpp,
    kommentariy: payload.comment,
    telefony: normPhones(payload.phones),
    eMails: normEmails(payload.emails),
    address: addressValue(pickLegalAddress(payload.addresses)),
  });
};

export type PersonSource = {
  objectGuid: string;
  name?: string;
  comment?: string;
  phones?: string[];
  emails?: string[];
  relationTypes?: string[];
  legalAddress?: string | null;
};

/** Запись-человек -> поля Person (телефоны/почты объединяются по всей группе склейки). */
export const personFields = (source: PersonSource) =>
  compact({
    objectGuid: source.objectGuid,
    name: splitFio(source.name),
    kommentariy: source.comment,
    phones: normPhones(source.phones),
    emails: normEmails(source.emails),
    tipOtnosheniy: relationValues(source.relationTypes),
    adresYuridicheskiy: addressValue(source.legalAddress),
  });

export type OwnerRef = { kind: 'company' | 'person'; id: string };

/** Договор -> поля Договор. Поле-идентификатор у договора называется `guid`. */
export const contractFields = (
  payload: ContractPayload,
  owner: OwnerRef,
) =>
  compact({
    guid: payload.guid,
    ownerGuid: payload.owner_guid,
    name: payload.name,
    nomerDogovora: payload.number,
    dataDogovora: payload.date,
    zaklyuchenSCompanyId: owner.kind === 'company' ? owner.id : undefined,
    zaklyuchenSPersonId: owner.kind === 'person' ? owner.id : undefined,
  });

/** Связь «Контакт клиента»: человек <-> компания или человек. */
export const linkFields = ({
  guid,
  personId,
  owner,
  personName,
  ownerName,
  position,
}: {
  guid: string;
  personId: string;
  owner: OwnerRef;
  personName?: string;
  ownerName?: string;
  position?: string;
}) => {
  const name = `${personName ?? ''} — ${ownerName ?? ''}`.replace(/^ —| —$/g, '').trim();

  return compact({
    objectGuid: guid,
    kontaktnoeLicoId: personId,
    klientCompanyId: owner.kind === 'company' ? owner.id : undefined,
    klientPersonId: owner.kind === 'person' ? owner.id : undefined,
    dolzhnost: position,
    name: name || undefined,
  });
};

/** Адрес (факт/почта/доставка) -> объект companyAddress. */
export const addressFields = (
  address: AddressItem,
  owner: OwnerRef,
) =>
  compact({
    addressStructured: addressValue(address.value),
    addressType: ADDRESS_TYPE_MAP[address.type ?? ''] ?? 'ACTUAL',
    companyId: owner.kind === 'company' ? owner.id : undefined,
    personId: owner.kind === 'person' ? owner.id : undefined,
  });

export type { ContactPayload };
