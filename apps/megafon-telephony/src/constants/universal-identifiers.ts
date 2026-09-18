export const APP_DISPLAY_NAME = 'Телефония МегаФон';
export const APP_DESCRIPTION =
  'Приём вебхуков ВАТС МегаФон: звонки, записи, связи и лента в Twenty CRM';

export const APPLICATION_UNIVERSAL_IDENTIFIER =
  '8af2cfd1-24fd-4f1e-ad48-12c1607210bb';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER =
  'be8ee981-1a4c-46ae-839d-3f64204c33d3';

export const MEGAFON_WEBHOOK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'e734332f-3e64-4a49-a9e3-bbc308f35a32';

/**
 * Свой тип активности приложения для ленты (timeline).
 *
 * Штатный системный тип `calendarEventLinked` приложению недоступен: ядро
 * разрешает приложению писать в ленту только своими типами. Тип объявляется
 * манифестом приложения (`defineTimelineActivityType`) и создаётся при `apply`.
 */
export const TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER =
  'c1a4d8f2-5b7e-4a93-9d21-6f0e2b8c4a77';

/** Название типа активности (техническое) и подпись в интерфейсе. */
export const TIMELINE_ACTIVITY_TYPE_NAME = 'megafonCallLinked';
export const TIMELINE_ACTIVITY_TYPE_LABEL = 'звонок МегаФон';

/**
 * Свой рендерер строки ленты (фронт-компонент приложения).
 *
 * Чужой (штатный) рендерер приложению запрещён — ядро отвечает
 * «references front component …, which is not defined by this application».
 */
export const TIMELINE_ACTIVITY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  'd4b1f0a7-2f5c-4a3e-9c48-71b6d5e0a912';

/** Путь маршрута: публичный URL будет https://crm.kplus79.ru/s<WEBHOOK_ROUTE_PATH> */
export const WEBHOOK_ROUTE_PATH = '/megafon';

/**
 * UID стандартных объектов Twenty (одинаковы во всех воркспейсах) — нужны,
 * чтобы привязать запись ленты к компании и к событию календаря.
 */
export const COMPANY_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-b374-4779-a561-80086cb2e17f';
export const CALENDAR_EVENT_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-8f1d-4eef-9f85-0d1965e27221';

/**
 * UID объекта «Записи звонков» (наш кастомный объект в этом воркспейсе).
 *
 * Связанной записью в ленте компании ставим сам звонок, а не событие календаря:
 * так клик по строке ленты открывает карточку звонка (с записью, расшифровкой),
 * а не пустое событие.
 */
export const CALL_RECORDING_OBJECT_UNIVERSAL_IDENTIFIER =
  'ce19efb9-710f-45b2-b141-473abbeea60b';
