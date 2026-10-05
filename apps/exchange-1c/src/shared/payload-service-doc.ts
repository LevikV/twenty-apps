/**
 * Формат payload документов сервиса (ДС) в очереди обмена.
 * Тип задачи — `objectType = "УниверсальныйСервис"`.
 * Зафиксирован по факту 02.10.2026: создание/изменение — 64 ключа, тот же состав,
 * что в файле выгрузки; удаление — 4 ключа (guid, deleted, change_date, native_guid).
 * 05.10.2026 добавлены 4 ключа подрядчика (64 → 68): contractor, contractor_guid,
 * contractor_native_guid, contractor_cost.
 */

export type ServiceDocGood = {
  kind?: string;
  name?: string;
  quantity?: number;
  price?: number;
  amount?: number;
  amount_without_discount?: number;
};

export type ServiceDocCartridge = {
  cartridge?: string;
  serial_number?: string;
};

export type ServiceDocPayload = {
  guid: string;
  native_guid?: string;
  number?: string;
  date?: string;
  posted?: boolean;
  deleted?: boolean;
  /** «Оборудование» / «Картриджи»; у задачи-удаления отсутствует */
  equipment_type?: string;
  service_status?: string;
  service_status_code?: string;
  counterparty?: string;
  counterparty_guid?: string;
  contact_person?: string;
  contact_person_guid?: string;
  master?: string;
  master_guid?: string;
  receiver?: string;
  receiver_guid?: string;
  responsible?: string;
  responsible_guid?: string;
  /** Подрядчик — контрагент 1С (компания или физлицо); добавлено 05.10.2026 */
  contractor?: string;
  contractor_guid?: string;
  contractor_native_guid?: string;
  /** Стоимость подрядчика, руб. (2 знака); 0 — реквизит не заполнен */
  contractor_cost?: number;
  agreement?: string;
  agreement_guid?: string;
  malfunction?: string;
  diagnostics_results?: string;
  repair_recommendations?: string;
  date_acceptance?: string;
  date_repair?: string;
  date_delivery?: string;
  date_pickup?: string;
  discount?: number;
  payment_type?: string;
  payment_type_code?: string;
  payment_sign?: boolean;
  by_warranty?: boolean;
  invoice_issued?: boolean;
  goods?: ServiceDocGood[];
  cartridges?: ServiceDocCartridge[];
  amount?: number;
  amount_without_discount?: number;
};
