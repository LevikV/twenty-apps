/** Формат payload очереди обмена — зафиксирован по факту 17.09.2026. */

export type AddressItem = { type?: string; value?: string };

export type CompanyPayload = {
  guid: string;
  native_guid?: string;
  name?: string;
  full_name?: string;
  code?: string;
  inn?: string;
  kpp?: string;
  type?: string;
  relation_types?: string[];
  phone?: string;
  site?: string;
  comment?: string;
  deleted?: boolean;
  default_contract_guid?: string;
  default_contract_native_guid?: string;
  phones?: string[];
  emails?: string[];
  addresses?: AddressItem[];
};

export type ContactPayload = {
  guid: string;
  native_guid?: string;
  owner_guid?: string;
  owner_native_guid?: string;
  name?: string;
  position?: string;
  comment?: string;
  phones?: string[];
  emails?: string[];
  deleted?: boolean;
};

export type ContractPayload = {
  guid: string;
  native_guid?: string;
  owner_guid?: string;
  owner_native_guid?: string;
  name?: string;
  number?: string;
  date?: string;
  type?: string;
  currency?: string;
  organization?: string;
  buyer_payment_days?: number;
  supplier_payment_days?: number;
  deleted?: boolean;
};

export type QueueTask = {
  id: string;
  taskId: string;
  direction?: string;
  objectType: string;
  objectGuid: string;
  action?: string;
  status: string;
  attemptCount?: number;
  errorText?: string | null;
  payload?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

export type ReestrRecord = {
  id: string;
  guid1c?: string;
  chelovekId?: string;
  status?: string;
  tipZapisi?: string;
};

export const TASK_STATUS = {
  pending: 'PENDING',
  processing: 'PROCESSING',
  done: 'OBRABOTANO',
  error: 'ERROR',
} as const;

export const REESTR_STATUS = {
  main: 'OSNOVNAYA',
  merged: 'SLITA',
} as const;

export const REESTR_TYPE = {
  contactFace: 'KONTAKTNOE_LICO',
  physicalPerson: 'KONTRAGENT_FIZLICO',
} as const;
