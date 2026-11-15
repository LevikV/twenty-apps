export const APP_DISPLAY_NAME = 'MAX-канал';
export const APP_DESCRIPTION =
  'Приём и отправка сообщений мессенджера MAX через мост личных аккаунтов';

export const APPLICATION_UNIVERSAL_IDENTIFIER = 'ee5090a8-426f-453e-8865-734e5f6bbc0b';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER = 'ae895cb9-71c1-4be3-94d7-a7de7951ef46';

/** Публичный маршрут приёма: https://crm.kplus79.ru/s/max-inbound */
export const INBOUND_ROUTE_PATH = '/max-inbound';

/** Логик-функция приёма входящих сообщений MAX. */
export const MAX_INBOUND_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  '481b1d28-2c9f-4c9d-bb81-cc5e4b3e372b';

/** Постановка исходящего сообщения в очередь отправки (событие создания сообщения). */
export const MAX_OUTBOX_QUEUE_FUNCTION_UNIVERSAL_IDENTIFIER =
  'be6bc1e1-51f2-4b39-b3e4-c09e2676c891';

/** Маршрут моста: забрать задачи отправки и вернуть результат. */
export const MAX_OUTBOX_API_ROUTE_PATH = '/max-outbox';
export const MAX_OUTBOX_API_FUNCTION_UNIVERSAL_IDENTIFIER =
  '10873ca3-128f-4f53-b624-f3c36d6d07b3';

/** Подключение аккаунта MAX сотрудником. */
export const MAX_CONNECT_ROUTE_PATH = '/max-connect';
export const MAX_CONNECT_FUNCTION_UNIVERSAL_IDENTIFIER =
  '491cbbf4-c1ed-4228-9122-85a265d8fb0f';
