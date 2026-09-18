/** Типы разбора вебхуков ВАТС МегаФон. */

/** Тип хука: предзвонок, событие в реальном времени, итог после звонка. */
export type MegafonCommand = 'contact' | 'event' | 'history';

/** Направление звонка в терминах CRM. */
export type CallDirection = 'INCOMING' | 'OUTGOING' | '';

/** Итог звонка (только хук history). */
export type CallOutcome = 'ANSWERED' | 'MISSED' | 'NOANSWER' | '';

/** Состояние записи разговора. */
export type RecordingStatus = 'RECORDING' | 'PROCESSING' | 'NOT_RECORDED';

/** Что хук означает для карточки звонка. */
export type CallStage =
  | 'START' // contact: предзвонок, ВАТС ждёт ответ
  | 'RINGING' // event INCOMING/OUTGOING: начался
  | 'ACCEPTED' // event ACCEPTED: ответили
  | 'COMPLETED' // event COMPLETED: разговор окончен
  | 'CANCELLED' // event CANCELLED: отменён до соединения
  | 'FINISHED' // history: итог со ссылкой на запись
  | 'UNKNOWN';

/** Разобранный вебхук — вход для бизнес-логики звонка. */
export type ParsedCall = {
  command: MegafonCommand | 'unknown';
  stage: CallStage;
  callid: string;
  direction: CallDirection;
  outcome: CallOutcome;
  recordingStatus: RecordingStatus;
  /** Номер клиента в виде 10 цифр (последние 10), для поиска в CRM. */
  clientPhone: string;
  /** Номер клиента как пришёл от ВАТС. */
  clientPhoneRaw: string;
  /** Наш номер (ВАТС), 10 цифр — по нему ищем сотрудника. */
  ourNumber: string;
  /** Внутренний номер сотрудника (ext). */
  extension: string;
  /** Логин оператора в ВАТС (user). */
  user: string;
  startedAtIso: string;
  endedAtIso: string;
  durationSeconds: number;
  waitSeconds: number;
  recordingUrl: string;
};
