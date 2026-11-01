export const APP_DISPLAY_NAME = 'SMS-канал';
export const APP_DESCRIPTION =
  'Приём входящих SMS с Android-шлюза и запись в «Центр коммуникации»';

export const APPLICATION_UNIVERSAL_IDENTIFIER = '2ab71610-5699-4e6b-9160-29e15531d843';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER = 'ba5374bc-0051-454e-97c6-f39f3199a506';

/** Публичный маршрут приёма: https://crm.kplus79.ru/s/sms-inbound */
export const INBOUND_ROUTE_PATH = '/sms-inbound';

/** Логик-функция приёма входящих SMS. */
export const SMS_INBOUND_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'a4272584-eca6-44c1-9291-458dc480cec3';
/** Постановка исходящего сообщения в очередь отправки (событие создания сообщения). */
export const SMS_OUTBOX_QUEUE_FUNCTION_UNIVERSAL_IDENTIFIER =
  'bea95bca-aa3e-4af2-b1f7-9a0d8a38b9a9';

/** Крон-движок отправки SMS и статусов доставки. */
export const SMS_OUTBOX_SEND_FUNCTION_UNIVERSAL_IDENTIFIER =
  '2e556c99-6c4c-4865-b4ca-53c8fe004dde';
/** Мои каналы: список подключённых телефонов сотрудника. */
export const SMS_CHANNELS_FUNCTION_UNIVERSAL_IDENTIFIER =
  'b42085c7-0923-4dcb-85af-e1c8d7c93fae';

/** Подключение телефона сотрудником. */
export const SMS_CHANNEL_CONNECT_FUNCTION_UNIVERSAL_IDENTIFIER =
  '7ffc6061-a066-405d-b3a6-1e4f47f2bab7';

/** Данные для инструкции подключения. */
export const SMS_CHANNEL_INFO_FUNCTION_UNIVERSAL_IDENTIFIER =
  '963a7fc1-1f45-4890-9bed-27e6d3a35477';


