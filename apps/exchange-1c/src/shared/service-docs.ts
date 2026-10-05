/**
 * Документы сервиса (ДС) 1С → объект «Ремонт оборудования» (`remontOborudovaniya`).
 *
 * Маппинг перенесён из разового загрузчика `load_service_docs.py` (kplus-scripts,
 * `crm-builder/1c-import/`), чтобы обмен и заливка раскладывали ДС одинаково.
 *
 * Правила (согласованы 02.10.2026):
 *  - суммы считаются из строк `goods[]`, а не из шапки документа;
 *  - скидка пишется долей: поле-процент в Twenty хранит 10 % как 0.1;
 *  - «Статус» = «Завершено» только при стадии «Выдан»;
 *  - подрядчик (`contractor_guid`) ищется как контрагент (компания или человек),
 *    стоимость (`contractor_cost`) пишется в «Стоимость подрядчика» как есть (0 — тоже значение);
 *  - «зеркало» ДС (05.10.2026): если ключ в payload ЕСТЬ, поле пишется как есть — пустое
 *    значение очищает поле в CRM; если ключа нет вовсе, поле не трогаем. Карточка ДС —
 *    одна на документ (`guid` уникален), поэтому «дополнять» тут нечего.
 */

import { compact } from 'src/shared/crm';
import type { ServiceDocPayload } from 'src/shared/payload-service-doc';

/** 1С живёт по местному времени (+10), сервер — по UTC. Даём явное смещение. */
const TZ_OFFSET = '+10:00';
const CURRENCY = 'RUB';

export const DEVICE_TYPE = 'Оборудование';
export const CARTRIDGE_TYPE = 'Картриджи';

/** Стадии: название в 1С → значение опции в Twenty. */
export const STADIYA: Record<string, string> = {
  'На приемке': 'NA_PRIEMKE',
  'В очереди': 'V_OCHEREDI',
  'В работе': 'V_RABOTE',
  'Требует согласования с заказчиком': 'TREBUET_SOGLASOVANIYA_S_ZAKAZCHIKOM',
  'Ожидает решения заказчика': 'OZHIDAET_RESHENIYA_ZAKAZCHIKA',
  'Ожидание предоплаты': 'OZHIDANIE_PREDOPLATY',
  'Поиск деталей': 'POISK_DETALEY',
  'Ожидает деталей': 'OZHIDAET_DETALEY',
  'Требует отклика (готово)': 'TREBUET_OTKLIKA_GOTOVO',
  'Готово к выдаче': 'GOTOVO_K_VYDACHE',
  Выдан: 'VYDAN',
  Забрать: 'ZABRAT',
  'На проверке': 'NA_PROVERKE',
  'Требует отклика администратора': 'TREBUET_OTKLIKA_ADMINISTRATORA',
  'Требует отклика мастера': 'TREBUET_OTKLIKA_MASTERA',
  'Требует отклика менеджера': 'TREBUET_OTKLIKA_MENEDZHERA',
};

export const CLOSED_STADIYA = 'VYDAN';
export const STATUS_ACTIVE = 'V_RABOTE';
export const STATUS_DONE = 'ZAVERSHENO';

/** Вид оплаты: название в 1С → значение опции в Twenty. */
export const VID_OPLATY: Record<string, string> = {
  'Оплата по банку': 'PO_SCHETU',
  'Наличный расчет': 'NALICHNYMI',
};

/** Ссылки на записи CRM, которые обработчик должен найти до раскладки.
 *  `null` означает «в 1С поле очищено — снять связь в CRM» («зеркало» ДС). */
export type ServiceDocRefs = {
  pokupatelCompanyId?: string | null;
  pokupatelPersonId?: string | null;
  podryadchikCompanyId?: string | null;
  podryadchikPersonId?: string | null;
  kontaktnoeLicoId?: string | null;
  masterId?: string | null;
  priyomshchikId?: string | null;
  otvetstvennyyId?: string | null;
  dogovorId?: string | null;
};

/** «2026-10-02 19:27:10» (местное время 1С) → ISO со смещением +10. */
export const parseServiceDocDate = (value?: string | null): string | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(
    String(value ?? '').trim(),
  );

  if (!match) {
    return undefined;
  }

  const [, year, month, day, hours, minutes, seconds] = match;

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${TZ_OFFSET}`;
};

const groupThousands = (value: string): string =>
  value.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Число для строки состава работ: 1234 → «1 234», 1234.5 → «1 234.50». */
export const fmtNum = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    return '';
  }

  const text = Number.isInteger(num) ? String(num) : num.toFixed(2);
  const [intPart, fracPart] = text.split('.');

  return fracPart ? `${groupThousands(intPart)}.${fracPart}` : groupThousands(intPart);
};

/** Суммы по строкам документа: работы («Услуга»), материалы («Запас»), со скидкой и без. */
export const lineAmounts = (payload: ServiceDocPayload) => {
  let works = 0;
  let mats = 0;
  let worksWithoutDiscount = 0;
  let matsWithoutDiscount = 0;

  for (const good of payload.goods ?? []) {
    const amount = Number(good.amount ?? 0) || 0;
    const amountWithoutDiscount = Number(good.amount_without_discount ?? 0) || 0;

    if (good.kind === 'Запас') {
      mats += amount;
      matsWithoutDiscount += amountWithoutDiscount;
    } else {
      works += amount;
      worksWithoutDiscount += amountWithoutDiscount;
    }
  }

  return { works, mats, worksWithoutDiscount, matsWithoutDiscount };
};

/** Денежное поле Twenty: пишем amountMicros и валюту. */
export const money = (value: number) => ({
  amountMicros: Math.round(value * 1_000_000),
  currencyCode: CURRENCY,
});

/** Ричтекст «Состав работ»: разделы «Работы» («Услуга») и «Материалы» («Запас»). */
export const buildSostavRabot = (payload: ServiceDocPayload): string => {
  const goods = payload.goods ?? [];
  const sections: [string, typeof goods][] = [
    ['Работы', goods.filter((good) => good.kind !== 'Запас')],
    ['Материалы', goods.filter((good) => good.kind === 'Запас')],
  ];
  const blocks: string[] = [];

  for (const [title, lines] of sections) {
    if (!lines.length) {
      continue;
    }

    const body = lines.map((good) => {
      const name = String(good.name ?? '').trim() || '(без названия)';

      return `- ${name} — ${fmtNum(good.quantity ?? 1)} × ${fmtNum(good.price)} ₽`;
    });

    blocks.push(`**${title}**\n${body.join('\n')}`);
  }

  return blocks.join('\n\n');
};

/** Ключ присутствует в payload — даже если значение пустое. */
export const hasKey = (payload: ServiceDocPayload, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(payload, key);

/** Пустое значение 1С: '', null, undefined или пустой массив. */
export const isBlank = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

const boolOrUndefined = (value: unknown): boolean | undefined =>
  value === undefined || value === null ? undefined : Boolean(value);

/**
 * Поля карточки «Ремонт оборудования» из payload ДС.
 * Ссылки (покупатель, контакт, мастер, приёмщик, ответственный, договор) передаются
 * готовыми id в `refs`. Возвращает поля и список пометок для `errorText` задачи.
 */
export const buildServiceDocFields = (
  payload: ServiceDocPayload,
  refs: ServiceDocRefs = {},
): { fields: Record<string, unknown>; notes: string[] } => {
  const notes: string[] = [];
  const number = String(payload.number ?? '').trim();
  const stadiyaName = String(payload.service_status ?? '').trim();
  const stadiya = STADIYA[stadiyaName];

  if (!stadiya) {
    notes.push(`неизвестная стадия 1С: «${stadiyaName}»`);
  }

  // --- дата проведения: только у проведённого документа
  let proveden: string | undefined;

  if (payload.posted) {
    proveden = parseServiceDocDate(payload.date);

    if (!proveden) {
      notes.push('не разобрана дата документа');
    }
  } else {
    notes.push('документ не проведён — «Проведен» пустое');
  }

  const dataPriyomki = parseServiceDocDate(payload.date_acceptance);

  if (!dataPriyomki) {
    notes.push('в 1С не заполнена дата приёмки');
  }

  const dataRemonta = parseServiceDocDate(payload.date_repair);

  if (!dataRemonta) {
    notes.push('в 1С не заполнена дата ремонта');
  }

  // --- оборудование: только модель текстом
  const model = String(payload.cartridges?.[0]?.cartridge ?? '').trim();

  if (!model) {
    notes.push('не заполнена модель оборудования');
  }

  const paymentType = String(payload.payment_type ?? '').trim();
  const vidOplaty = VID_OPLATY[paymentType];

  if (!vidOplaty) {
    notes.push(`неизвестный вид оплаты 1С: «${paymentType}»`);
  }

  const { works, mats, worksWithoutDiscount, matsWithoutDiscount } = lineAmounts(payload);
  const sostavRabot = buildSostavRabot(payload);

  const discount = Number(payload.discount ?? 0);

  // Стоимость подрядчика — информационный реквизит 1С, ноль здесь законное значение.
  const contractorCost = Number(payload.contractor_cost ?? 0) || 0;

  // --- «зеркало» ДС (05.10.2026): очистили поле в 1С — очищаем и в CRM.
  // Ключ ЕСТЬ в payload → пишем значение как есть (пусто → null);
  // ключа нет вовсе → поле не трогаем (старый формат или другой поток).
  const clears: Record<string, unknown> = {};

  const clearIfBlank = (key: keyof ServiceDocPayload, field: string): void => {
    if (hasKey(payload, key) && isBlank(payload[key])) {
      clears[field] = null;
    }
  };

  clearIfBlank('malfunction', 'neispravnost');
  clearIfBlank('diagnostics_results', 'rezultatDiagnostiki');
  clearIfBlank('repair_recommendations', 'rekomendaciiPoRemontu');
  clearIfBlank('date_acceptance', 'dataPriyomki');
  clearIfBlank('date_repair', 'dataRemonta');
  clearIfBlank('payment_type', 'vidOplaty');
  clearIfBlank('cartridges', 'oborudovanie');
  clearIfBlank('goods', 'sostavRabot');
  clearIfBlank('service_status', 'stadiya');
  clearIfBlank('service_status', 'status');

  // документ распроведён → «Проведен» очищаем
  if (hasKey(payload, 'posted') && !payload.posted) {
    clears.proveden = null;
  }

  // связи: строковый id — пишем, null — снимаем
  const refValues: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(refs ?? {})) {
    if (value !== undefined) {
      refValues[field] = value;
    }
  }

  const fields = {
    ...compact({
      name: number ? `ДС${number}` : undefined,
      guid: payload.guid,
      aktiven: payload.deleted === true ? false : true,
      priznakOplaty: boolOrUndefined(payload.payment_sign),
      poGarantii: boolOrUndefined(payload.by_warranty),
      vypisanSchet: boolOrUndefined(payload.invoice_issued),
      stadiya,
      status: stadiya ? (stadiya === CLOSED_STADIYA ? STATUS_DONE : STATUS_ACTIVE) : undefined,
      proveden,
      dataPriyomki,
      dataRemonta,
      oborudovanie: model || undefined,
      neispravnost: String(payload.malfunction ?? '').trim() || undefined,
      rezultatDiagnostiki: String(payload.diagnostics_results ?? '').trim() || undefined,
      rekomendaciiPoRemontu:
        String(payload.repair_recommendations ?? '').trim() || undefined,
      sostavRabot: sostavRabot ? { markdown: sostavRabot } : undefined,
      summa: money(works + mats),
      summaBezSkidki: money(worksWithoutDiscount + matsWithoutDiscount),
      stoimostRabot: money(works),
      stoimostMaterialov: money(mats),
      stoimostPodryadchika: money(contractorCost),
      // поле-процент: Twenty хранит долю (10 % → 0.1)
      skidka: Math.round((discount / 100) * 1_000_000) / 1_000_000,
      vidOplaty,
    }),
    ...refValues,
    // очистки идут последними: null не должен быть выброшен `compact`
    ...clears,
  };

  return { fields, notes };
};
