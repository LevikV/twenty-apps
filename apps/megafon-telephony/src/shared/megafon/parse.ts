import type {
  CallDirection,
  CallOutcome,
  CallStage,
  MegafonCommand,
  ParsedCall,
  RecordingStatus,
} from 'src/shared/megafon/types';

/** Только цифры из значения. */
export const digitsOnly = (value: unknown): string => String(value ?? '').replace(/\D+/g, '');

/** Номер в виде последних 10 цифр (в CRM телефоны хранятся без кода страны). */
export const normalizePhone = (value: unknown): string => {
  const digits = digitsOnly(value);

  return digits.length > 10 ? digits.slice(-10) : digits;
};

/** Время ВАТС `20260918T082919Z` → ISO-строка. */
export const parseVatsDate = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(raw);

  if (!match) return '';

  const [, y, mo, d, h, mi, s] = match;

  return `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
};

/** Прибавить секунды к ISO-времени (для времени окончания звонка). */
export const addSeconds = (iso: string, seconds: number): string => {
  if (!iso) return '';

  const base = Date.parse(iso);
  if (Number.isNaN(base)) return '';

  return new Date(base + Math.max(0, seconds) * 1000).toISOString();
};

const toSeconds = (value: unknown): number => {
  const n = Number.parseInt(digitsOnly(value) || '0', 10);

  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Нормализация направления из `direction` (event) или `type` (history). */
export const resolveDirection = (payload: Record<string, unknown>): CallDirection => {
  const candidates = [payload.direction, payload.type].map((v) => String(v ?? '').trim().toLowerCase());

  if (candidates.includes('in') || candidates.includes('incoming')) return 'INCOMING';
  if (candidates.includes('out') || candidates.includes('outgoing')) return 'OUTGOING';

  return '';
};

/** Итог звонка из `status` хука history. */
export const resolveOutcome = (command: string, payload: Record<string, unknown>): CallOutcome => {
  if (command !== 'history') return '';

  switch (String(payload.status ?? '').trim().toLowerCase()) {
    case 'success':
    case 'answered':
      return 'ANSWERED';
    case 'missed':
      return 'MISSED';
    case 'busy':
    case 'noanswer':
    case 'notavailable':
      return 'NOANSWER';
    default:
      return '';
  }
};

/** Состояние записи: history с ссылкой — обрабатывается, без ссылки — записи нет. */
export const resolveRecordingStatus = (
  command: string,
  payload: Record<string, unknown>,
): RecordingStatus => {
  if (command !== 'history') return 'RECORDING';

  return String(payload.link ?? '').trim() ? 'PROCESSING' : 'NOT_RECORDED';
};

/** Стадия жизни звонка по типу хука и событию. */
export const resolveStage = (command: string, payload: Record<string, unknown>): CallStage => {
  if (command === 'contact') return 'START';
  if (command === 'history') return 'FINISHED';

  if (command === 'event') {
    switch (String(payload.type ?? '').trim().toUpperCase()) {
      case 'INCOMING':
      case 'OUTGOING':
        return 'RINGING';
      case 'ACCEPTED':
        return 'ACCEPTED';
      case 'COMPLETED':
        return 'COMPLETED';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'UNKNOWN';
    }
  }

  return 'UNKNOWN';
};

/** Заголовок карточки звонка: `📞 Входящий: <кто>`. */
export const buildCallTitle = (direction: CallDirection, who: string): string => {
  const label = direction === 'INCOMING' ? 'Входящий' : direction === 'OUTGOING' ? 'Исходящий' : 'Звонок';

  return `📞 ${label}: ${who}`;
};

/**
 * Разбор тела вебхука ВАТС МегаФон в структуру карточки звонка.
 * Чистая функция — без обращений к CRM, проверяется на сохранённых телах.
 */
export const parseMegafonPayload = (body: Record<string, unknown>): ParsedCall => {
  const command = String(body.cmd ?? '').trim().toLowerCase() as MegafonCommand | 'unknown';
  const durationSeconds = toSeconds(body.duration);

  const startedAtIso = parseVatsDate(body.start)
    || (command === 'history' ? '' : new Date().toISOString());
  const endedAtIso = parseVatsDate(body.end)
    || addSeconds(startedAtIso, durationSeconds);

  return {
    command: ['contact', 'event', 'history'].includes(command) ? command : 'unknown',
    stage: resolveStage(command, body),
    callid: String(body.callid ?? '').trim(),
    direction: resolveDirection(body),
    outcome: resolveOutcome(command, body),
    recordingStatus: resolveRecordingStatus(command, body),
    clientPhone: normalizePhone(body.phone),
    clientPhoneRaw: String(body.phone ?? '').trim(),
    // ВАТС: для звонка на общий номер `telnum` — номер ответившего сотрудника,
    // а `diversion` — общий номер компании. Поэтому приоритет у `telnum`.
    ourNumber: normalizePhone(body.telnum ?? body.diversion),
    extension: String(body.ext ?? '').trim(),
    user: String(body.user ?? '').trim(),
    startedAtIso,
    endedAtIso,
    durationSeconds,
    waitSeconds: toSeconds(body.wait),
    recordingUrl: String(body.link ?? '').trim(),
  };
};
