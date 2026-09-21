export const APP_DISPLAY_NAME = 'Телефония МегаФон';
export const APP_DESCRIPTION =
  'Приём вебхуков ВАТС МегаФон: звонки, записи, связи и лента в Twenty CRM';

export const APPLICATION_UNIVERSAL_IDENTIFIER =
  '8af2cfd1-24fd-4f1e-ad48-12c1607210bb';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER =
  'be8ee981-1a4c-46ae-839d-3f64204c33d3';

export const MEGAFON_WEBHOOK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'e734332f-3e64-4a49-a9e3-bbc308f35a32';

/** Логик-функция приведения истории звонков (связи и лента) — работает по расписанию. */
export const HISTORY_BACKFILL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'a7c2e4f1-3b8d-4f56-8e19-2d4a6c9b1f03';

/** Объект «Очередь расшифровки» — источник правды конвейера записей (этап 3). */
export const RECORDING_QUEUE_TASK_UNIVERSAL_IDENTIFIER =
  'a24da95a-6867-4571-b0d5-3758d2c62b33';

/** Логик-функция конвейера записей: очередь → файл → Яндекс → расшифровка. */
export const RECORDING_PIPELINE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'b7e4c2a8-6f13-4d59-8a72-9c5e1f0d3b64';

/** Логик-функция сверки с ВАТС: дозаполнение пропущенных звонков и постановка в очередь. */
export const RECORDING_RECONCILE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'c51a7f39-2b84-4e16-9d07-8a3f6e5b2c48';

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

/** Наши объекты-сделки: пробуем связать событие с ними морф-связью (обход: Opportunity недоступен). */
export const REMONT_OBORUDOVANIYA_OBJECT_UNIVERSAL_IDENTIFIER =
  'f3353335-2e24-436e-98f6-9e3c5bf3d5d2';
export const ZAPRAVKA_KARTRIDZHEY_OBJECT_UNIVERSAL_IDENTIFIER =
  '3428a13d-eb18-4c42-bb46-50f63d2f90cd';
export const TENDER_OBJECT_UNIVERSAL_IDENTIFIER =
  '436cef8d-e02c-4a77-bb23-aeeb68037c09';

/** Объект «Цели события» — в него добавляем наши сделки как ещё один вид цели. */
export const CALENDAR_EVENT_TARGET_OBJECT_UNIVERSAL_IDENTIFIER =
  '6a9b9656-3e23-4234-94a4-b913c5dde668';

/** Признак штатной морф-группы целей (человек / компания / сделка) — наши поля входят в неё же. */
export const CALENDAR_EVENT_TARGETS_MORPH_ID = '676e9f68-7b5c-41e6-b46d-2fb9527b7051';

/**
 * UID объекта «Записи звонков» (наш кастомный объект в этом воркспейсе).
 *
 * Связанной записью в ленте компании ставим сам звонок, а не событие календаря:
 * так клик по строке ленты открывает карточку звонка (с записью, расшифровкой),
 * а не пустое событие.
 */
export const CALL_RECORDING_OBJECT_UNIVERSAL_IDENTIFIER =
  'ce19efb9-710f-45b2-b141-473abbeea60b';

/**
 * Экран «Звонки» (раздел в меню): страница, вкладка, виджет и сам компонент.
 *
 * Страница — тип STANDALONE_PAGE: рендерится внутри обычного лэйаута Twenty,
 * значит левое меню остаётся. Заголовок страницы берётся из пункта навигации,
 * поэтому название для пользователя задаётся в пункте меню, а не здесь.
 */
export const CALLS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '96d523d1-9def-4617-b142-ea4ee420d404';
export const CALLS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER =
  '0217141f-4628-4c21-9a85-cc33df96f112';
export const CALLS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER =
  'dcad7175-2e9b-4af5-8c0d-0a13377c1c2f';
export const CALLS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER =
  '2b8f51ca-6aec-46cc-9672-a2faa8d237a3';
export const CALLS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  '54280dc9-9b64-41ef-a901-5e5397f8b1ce';

/** Экран настроек приложения: доступ к журналу звонков (кто чьи звонки видит). */
export const CALLS_ACCESS_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '7b39ad25-666c-4ea4-918f-b36577855da5';

/**
 * Правила доступа к журналу звонков: хранятся в kv приложения,
 * читаются и пишутся через эти два маршрута.
 */
export const CALL_JOURNAL_ACCESS_GET_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  '9ff0d80a-9f85-4e17-b27b-1582751ba3f9';
export const CALL_JOURNAL_ACCESS_SAVE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER =
  'eb6267d7-3ce2-41ca-9670-f4417f36e835';
