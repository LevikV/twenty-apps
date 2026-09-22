import { normalizePhone } from 'src/shared/megafon/parse';

/**
 * Наши общие (групповые) номера — из настроек приложения
 * (`SHARED_PHONE_NUMBERS`, список через запятую, например `79247420908`).
 *
 * Нужны, чтобы отличить звонок на группу (отдел продаж) от звонка конкретному
 * сотруднику: на групповом звонке ВАТС шлёт отдельное событие каждому, кому
 * звонило, и участником должен стать только тот, кто ответил.
 */
export const sharedNumbers = (): string[] =>
  String(process.env.SHARED_PHONE_NUMBERS ?? '')
    .split(',')
    .map((value) => normalizePhone(value))
    .filter(Boolean);

export const isSharedNumber = (phone: string): boolean => {
  const normalized = normalizePhone(phone);

  return Boolean(normalized) && sharedNumbers().includes(normalized);
};
