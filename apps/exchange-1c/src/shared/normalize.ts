/**
 * Нормализация данных 1С — порт с Python-загрузчика (crm-builder/1c-import/load_1c.py).
 * Правила согласованы с Алексеем; менять их нужно синхронно с обеих сторон.
 */

export type AddressItem = { type?: string; value?: string };

/** Адрес сайта -> валидный URL или null (в 1С встречается мусор вроде «http: www.site.ru»). */
export const normalizeSite = (raw?: string): string | null => {
  const cleaned = (raw ?? '').trim().replace(/\s/g, '');

  if (!cleaned) {
    return null;
  }

  const withoutScheme = cleaned.replace(/^[a-z]+:\/{0,2}/i, '').replace(/^\/+|\/+$/g, '');

  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/.*)?$/i.test(withoutScheme)) {
    return null;
  }

  return `https://${withoutScheme}`;
};

export const extractCandidates = (value: string): string[] => {
  const out: string[] = [];

  for (const part of String(value).split(/[;,]/)) {
    const trimmed = part.trim();

    if (!trimmed || trimmed.includes('@')) {
      continue;
    }

    if (trimmed.includes('+')) {
      out.push(...trimmed.split(/(?=\+)/).map((p) => p.trim()).filter(Boolean));
      continue;
    }

    if (trimmed.replace(/\D/g, '').length > 13) {
      const pieces: string[] = [];
      let current: string[] = [];

      for (const token of trimmed.split(/\s+/)) {
        if (/\d/.test(token)) {
          current.push(token);
        } else if (current.length) {
          pieces.push(current.join(' '));
          current = [];
        }
      }

      if (current.length) {
        pieces.push(current.join(' '));
      }

      out.push(...pieces.map((p) => p.trim()).filter(Boolean));
      continue;
    }

    out.push(trimmed);
  }

  return out;
};

/** Приводим номер к виду +7XXXXXXXXXX / +742622XXXXX; иначе null. */
export const normalizeNumber = (value: string): string | null => {
  const digits = (value ?? '').replace(/\D/g, '');

  if (digits.length === 11 && '78'.includes(digits[0])) {
    return `+7${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  if (digits.length === 12 && digits[0] === '7') {
    return `+${digits}`;
  }

  if (digits.length === 5 || digits.length === 6) {
    return `+742622${digits}`;
  }

  return null;
};

export type PhonesValue = {
  primaryPhoneNumber: string;
  additionalPhones?: string;
};

export const normPhones = (items?: string[]): PhonesValue | null => {
  const numbers: string[] = [];

  for (const item of items ?? []) {
    for (const candidate of extractCandidates(item)) {
      const normalized = normalizeNumber(candidate);

      if (normalized && !numbers.includes(normalized)) {
        numbers.push(normalized);
      }
    }
  }

  if (!numbers.length) {
    return null;
  }

  const result: PhonesValue = { primaryPhoneNumber: numbers[0] };

  if (numbers.length > 1) {
    result.additionalPhones = JSON.stringify(
      numbers.slice(1, 8).map((number) => ({ number })),
    );
  }

  return result;
};

export type EmailsValue = {
  primaryEmail: string;
  additionalEmails?: string[];
};

export const normEmails = (items?: string[]): EmailsValue | null => {
  const mails: string[] = [];

  for (const item of items ?? []) {
    for (const chunk of String(item).split(/[;,]/)) {
      const value = chunk.trim().toLowerCase();

      if (value && value.includes('@') && !mails.includes(value)) {
        mails.push(value);
      }
    }
  }

  if (!mails.length) {
    return null;
  }

  const result: EmailsValue = { primaryEmail: mails[0] };

  if (mails.length > 1) {
    result.additionalEmails = mails.slice(1, 6);
  }

  return result;
};

/** «Иванов Иван Иванович» -> { firstName: 'Иван Иванович', lastName: 'Иванов' } */
export const splitFio = (
  name?: string,
): { firstName: string; lastName: string } | null => {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return null;
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return { firstName: parts.slice(1).join(' '), lastName: parts[0] };
};

export const pickLegalAddress = (addresses?: AddressItem[]): string | null => {
  for (const address of addresses ?? []) {
    if (address?.type === 'legal' && address?.value) {
      return address.value;
    }
  }

  return null;
};

export const pickNonlegalAddresses = (addresses?: AddressItem[]): AddressItem[] =>
  (addresses ?? []).filter(
    (address) =>
      ['actual', 'postal', 'delivery'].includes(address?.type ?? '') &&
      Boolean(address?.value),
  );

/** Последние 10 цифр — ключ сравнения телефонов. */
export const ph10 = (value?: string): string => {
  let digits = (value ?? '').replace(/\D/g, '');

  if (digits.length === 11 && '78'.includes(digits[0])) {
    digits = digits.slice(1);
  }

  return digits.length >= 10 ? digits.slice(-10) : '';
};

/** Ключ сравнения ФИО: регистр, «ё/е», кавычки, скобки, знаки. */
export const normName = (value?: string): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`.,;:()\\/№-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Есть телефон или email — по ПУСТЫМ полям, не по «10 цифрам». */
export const hasContactInfo = (phones?: string[], emails?: string[]): boolean =>
  Boolean(phones?.length) || Boolean(emails?.length);

export const COMPANY_TYPES = ['legal', 'ip', 'government'] as const;

export const COMPANY_TYPE_TO_LEGAL_FORM: Record<string, string> = {
  legal: 'YUR_LICO',
  ip: 'IP',
  government: 'YUR_LICO',
};

export const RELATION_TYPE_MAP: Record<string, string> = {
  buyer: 'POKUPATEL',
  supplier: 'POSTAVSHCHIK',
  other: 'PROCHEE',
};

export const ADDRESS_TYPE_MAP: Record<string, string> = {
  actual: 'ACTUAL',
  postal: 'POSTAL',
  delivery: 'DELIVERY',
};
