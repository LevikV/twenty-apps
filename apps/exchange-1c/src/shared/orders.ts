import { fmtNum, money, parseServiceDocDate } from 'src/shared/service-docs';

/**
 * Заказ покупателя 1С (`objectType = "ЗаказПокупателя"`) → Twenty `opportunity`.
 * Маппинг и правила — как в разовом загрузчике `load_orders.py` (проверен на 515 заказах),
 * см. заметку «Первичная загрузка Заказов из 1С», раздел 3.
 */

export type OrderGood = {
  kind?: string;
  name?: string;
  unit?: string;
  price?: number | string;
  quantity?: number | string;
  amount?: number | string;
  discount_percent?: number | string;
  accounting_price?: number | string;
};

export type OrderPayment = {
  date?: string;
  amount?: number | string;
  percent?: number | string;
};

export type OrderPayload = {
  guid: string;
  native_guid?: string;
  number?: string;
  date?: string;
  change_date?: string;
  deleted?: boolean;
  posted?: boolean;
  status?: string;
  completion?: string;
  completion_comment?: string;
  cancel_reason?: string;
  cancel_reason_native_guid?: string;
  comment?: string;
  counterparty_guid?: string;
  counterparty?: string;
  agreement_guid?: string;
  agreement?: string;
  responsible_guid?: string;
  contact_person_guid?: string;
  contact_person?: string;
  payment_type?: string;
  amount?: number | string;
  date_delivery?: string;
  payments?: OrderPayment[];
  goods?: OrderGood[];
};

/** Стадии заказа: название в 1С → значение опции в Twenty. */
export const ORDER_STADIYA: Record<string, string> = {
  Новый: 'NOVYY',
  'В работе': 'V_RABOTE',
  'Готов к выдаче': 'GOTOV_K_VYDACHE',
  'Ожидает предоплаты': 'OZHIDAET_PREDOPLATY',
  'Ожидает отгрузки поставщика': 'OZHIDAET_OTGRUZKI_POSTAVSHCHIKA',
  // в 1С название обрезано до 23 символов — встречается именно так
  'Ожидает отгрузки поставщи': 'OZHIDAET_OTGRUZKI_POSTAVSHCHIKA',
  // в объекте опция названа «Готов к выдаче», в 1С статус — «Готово к выдаче»
  'Готово к выдаче': 'GOTOV_K_VYDACHE',
  'Требует согласования с заказчиком': 'TREBUET_SOGLASOVANIYA_S_ZAKAZCHIKOM',
  'Ожидает решения заказчика': 'OZHIDAET_RESHENIYA_ZAKAZCHIKA',
  'Отгружен от поставщика': 'OTGRUZHEN_OT_POSTVSHCHIKA',
  'Ожидает поступ. к поставщику (ч/в)': 'OZHIDAET_POSTUP_K_POSTAVSHCHIKU_CH_V',
  'Ожидает поступ. к поставщику': 'OZHIDAET_POSTUP_K_POSTAVSHCHIKU',
  'Готово к выдаче (частично)': 'GOTOVO_K_VYDACHE_CHASTICHNO',
  'Ожидает оплаты (выдан)': 'OZHIDAET_OPLATY_VYDAN',
  Завершен: 'ZAVERSHEN',
};

export const ORDER_CLOSED_STADIYA = 'ZAVERSHEN';
export const ORDER_STATUS_ACTIVE = 'V_RABOTE';
export const ORDER_STATUS_DONE = 'ZAVERSHENO';

/** Результат завершения: текст 1С → значение опции. */
export const ORDER_RESULT: Record<string, string> = {
  Успешно: 'USPESHNO',
  Отменен: 'OTMENEN',
};

/** Причина отмены: гуид 1С (нижний регистр) → значение опции. */
export const ORDER_CANCEL_REASON: Record<string, string> = {
  '66397380-58f6-11ea-b566-0025900c6384': 'OPT66397380_58F6_11EA_B566_0025900C6384',
  'e380401d-e35f-11e6-8e18-bc5ff4ebbc09': 'E380401D_E35F_11E6_8E18_BC5FF4EBBC09',
  'ed15cd4a-4345-11eb-82fa-0025900c6384': 'ED15CD4A_4345_11EB_82FA_0025900C6384',
};

/** Вид оплаты: название в 1С → значение опции. */
export const ORDER_VID_OPLATY: Record<string, string> = {
  'Оплата по банку': 'PO_SCHETU',
  'Наличный расчет': 'NALICHNYMI',
  'Оплата картой': 'KARTOY',
};

/** Накрутка на товар 50 % → учётная цена = цена продажи / 1.5. */
const MARKUP_DIVISOR = 1.5;

export type OrderRefs = {
  pokupatelCompanyId?: string;
  pokupatelPersonId?: string;
  pointOfContactId?: string;
  dogovorId?: string;
  otvetstvennyyId?: string;
};

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
};

const fmtMoney = (value: unknown): string => `${fmtNum(num(value))} ₽`;

/** «2026-10-22 18:04:49» (местное время 1С) → ISO со смещением +10. */
export const parseOrderDate = (value?: string | null): string | undefined =>
  parseServiceDocDate(value);

/** Сумма строки БЕЗ скидки: без скидки — как в 1С, со скидкой — восстанавливаем из процента. */
const lineSumWithoutDiscount = (good: OrderGood): number => {
  const amount = num(good.amount);
  const percent = num(good.discount_percent);

  if (percent > 0 && percent < 100) {
    return Math.round((amount / (1 - percent / 100)) * 100) / 100;
  }

  return Math.round(amount * 100) / 100;
};

/** Учётная цена строки: из 1С; у товара без неё — цена / 1.5; у услуг — 0. */
const unitCost = (good: OrderGood): number => {
  const acc = num(good.accounting_price);

  if (acc) {
    return acc;
  }

  if (String(good.kind ?? '').trim() === 'Запас') {
    return num(good.price) / MARKUP_DIVISOR;
  }

  return 0;
};

export const orderLineTotals = (payload: OrderPayload) => {
  let withDisc = 0;
  let withoutDisc = 0;
  let accSum = 0;
  let hasDisc = false;

  for (const good of payload.goods ?? []) {
    withDisc += num(good.amount);
    withoutDisc += lineSumWithoutDiscount(good);
    accSum += unitCost(good) * num(good.quantity);

    if (num(good.discount_percent)) {
      hasDisc = true;
    }
  }

  const round = (value: number) => Math.round(value * 100) / 100;

  return {
    withDisc: round(withDisc),
    withoutDisc: round(withoutDisc),
    accSum: round(accSum),
    hasDisc,
  };
};

/** Суммы строк со скидкой: товары («Запас») и услуги (все остальные виды). */
const orderLineSumsByKind = (payload: OrderPayload) => {
  let goodsSum = 0;
  let servicesSum = 0;

  for (const good of payload.goods ?? []) {
    const amount = num(good.amount);

    if (String(good.kind ?? '').trim() === 'Запас') {
      goodsSum += amount;
    } else {
      servicesSum += amount;
    }
  }

  const round = (value: number) => Math.round(value * 100) / 100;

  return { goodsSum: round(goodsSum), servicesSum: round(servicesSum) };
};

/** Ричтекст «Состав заказа»: в строке видны цена и сумма без скидки (как в разовой загрузке). */
export const buildOrderMarkdown = (payload: OrderPayload): string => {
  const goods = payload.goods ?? [];

  if (!goods.length) {
    return '';
  }

  const lines: string[] = ['**Товары и услуги**'];

  for (const good of goods) {
    const qty = fmtNum(num(good.quantity) || 1);
    const price = fmtMoney(good.price);
    const unit = String(good.unit ?? '').trim();
    const sumWithoutDiscount = lineSumWithoutDiscount(good);
    const name = String(good.name ?? '').trim() || '(без названия)';

    let row = `- ${name} — ${qty} ${unit} × ${price} = ${fmtMoney(sumWithoutDiscount)}`;
    const percent = num(good.discount_percent);

    if (percent) {
      row += ` (со скидкой ${fmtNum(percent)} % — ${fmtMoney(good.amount)})`;
    }

    lines.push(row);
  }

  const headerSum = num(payload.amount);
  const { withoutDisc, hasDisc } = orderLineTotals(payload);
  let total = `**Итого: ${fmtMoney(headerSum)}**`;

  if (hasDisc) {
    const percent = withoutDisc ? ((withoutDisc - headerSum) / withoutDisc) * 100 : 0;

    total += ` (без скидки ${fmtMoney(withoutDisc)}, скидка ${fmtNum(
      Math.round(percent * 100) / 100,
    )} %)`;
  }

  lines.push('');
  lines.push(total);

  return lines.join('\n');
};

export type OrderFields = Record<string, unknown>;

/**
 * Поля карточки заказа. Пустые значения не пишем (не затираем заполненное),
 * суммы — в микроединицах, даты — ISO со смещением +10.
 */
export const buildOrderFields = (
  payload: OrderPayload,
  refs: OrderRefs,
  notes: string[],
): OrderFields => {
  const number = String(payload.number ?? '').trim();
  const { withDisc, withoutDisc, accSum, hasDisc } = orderLineTotals(payload);
  const { goodsSum, servicesSum } = orderLineSumsByKind(payload);

  // скидок нет → «сумма без скидки» равна сумме документа (в выгрузке цена округлена
  // до 2 знаков, произведение «кол-во × цена» расходится с суммой строки на копейки)
  const withoutDiscount = hasDisc ? withoutDisc : Math.round(num(payload.amount) * 100) / 100;

  const fields: OrderFields = {
    name: number,
    guid: payload.guid,
    nomerV1S: number,
    aktiven: !payload.deleted,
    amount: money(num(payload.amount)),
    summaBezSkidki: money(withoutDiscount),
    stoimostTovarov: money(goodsSum),
    stoimostUslug: money(servicesSum),
    stoimostTovarovUchet: money(accSum),
  };

  if (refs.pokupatelCompanyId) {
    fields.pokupatelCompanyId = refs.pokupatelCompanyId;
  }

  if (refs.pokupatelPersonId) {
    fields.pokupatelPersonId = refs.pokupatelPersonId;
  }

  if (refs.pointOfContactId) {
    fields.pointOfContactId = refs.pointOfContactId;
  }

  if (refs.dogovorId) {
    fields.dogovorId = refs.dogovorId;
  }

  if (refs.otvetstvennyyId) {
    fields.otvetstvennyyId = refs.otvetstvennyyId;
  }

  // --- стадия и статус
  const stageName = String(payload.status ?? '').trim();
  const stage = ORDER_STADIYA[stageName];

  if (stage) {
    fields.stage = stage;
    fields.status = stage === ORDER_CLOSED_STADIYA ? ORDER_STATUS_DONE : ORDER_STATUS_ACTIVE;
  } else {
    notes.push(`неизвестная стадия 1С: «${stageName}» — стадия не проставлена`);
  }

  // --- результат завершения
  const completion = String(payload.completion ?? '').trim();

  if (completion) {
    const result = ORDER_RESULT[completion];

    if (result) {
      fields.rezultatZaversheniya = result;
    } else {
      notes.push(`неизвестный результат завершения 1С: «${completion}»`);
    }
  }

  // --- причина отмены (жёсткий матч по гуиду)
  const cancelGuid = String(payload.cancel_reason_native_guid ?? '').trim().toLowerCase();

  if (cancelGuid) {
    const reason = ORDER_CANCEL_REASON[cancelGuid];

    if (reason) {
      fields.prichinaOtmeny = reason;
    } else {
      notes.push(`неизвестная причина отмены 1С: «${payload.cancel_reason ?? ''}»`);
    }
  }

  const completionComment = String(payload.completion_comment ?? '').trim();

  if (completionComment) {
    fields.kommentariyZaversheniya = completionComment;
  }

  const comment = String(payload.comment ?? '').trim();

  if (comment) {
    fields.kommentariy = comment;
  }

  // --- даты
  const createdAt = parseOrderDate(payload.date);

  if (createdAt) {
    fields.createdAt = createdAt;
  }

  const shipment = parseOrderDate(payload.date_delivery);

  if (shipment) {
    fields.dataOtgruzki = shipment;
  }

  const paymentDate = parseOrderDate((payload.payments ?? [])[0]?.date);

  if (paymentDate) {
    fields.dataOplatyPlan = paymentDate;
  }

  if (payload.posted) {
    if (createdAt) {
      fields.proveden = createdAt;
    }
  }

  if (stageName === 'Завершен' && createdAt) {
    fields.closeDate = createdAt;
  }

  // --- вид оплаты
  const paymentType = String(payload.payment_type ?? '').trim();

  if (paymentType) {
    const vid = ORDER_VID_OPLATY[paymentType];

    if (vid) {
      fields.vidOplaty = vid;
    } else {
      notes.push(`неизвестный вид оплаты 1С: «${paymentType}»`);
    }
  }

  // --- скидка (Twenty хранит долей: 5 % = 0.05); только если скидка есть
  if (hasDisc && withoutDiscount) {
    fields.skidka = Math.round(((withoutDiscount - withDisc) / withoutDiscount) * 1e6) / 1e6;
  }

  // --- состав заказа (ричтекст)
  const markdown = buildOrderMarkdown(payload);

  if (markdown) {
    fields.sostavZakaza = { markdown };
  }

  return fields;
};

const MONEY_KEYS = ['amount', 'summaBezSkidki', 'stoimostTovarov', 'stoimostUslug', 'stoimostTovarovUchet'];
const DATE_KEYS = ['createdAt', 'dataOtgruzki', 'dataOplatyPlan', 'closeDate', 'proveden'];

const normMarkdown = (value: unknown): string =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/^[ \t]*[*+-][ \t]+/gm, '- ')
    .replace(/\n{2,}/g, '\n')
    .trim();

const sameMoment = (left: unknown, right: unknown): boolean => {
  const a = left ? Date.parse(String(left)) : NaN;
  const b = right ? Date.parse(String(right)) : NaN;

  if (Number.isNaN(a) || Number.isNaN(b)) {
    return String(left ?? '') === String(right ?? '');
  }

  return a === b;
};

/** Что из полей реально изменилось относительно карточки (идемпотентность: лишнего не пишем). */
export const diffOrderFields = (
  fields: OrderFields,
  current: Record<string, unknown>,
): OrderFields => {
  const diff: OrderFields = {};

  for (const [key, value] of Object.entries(fields)) {
    const cur = current[key];

    if (MONEY_KEYS.includes(key)) {
      const nextMicros = Number((value as { amountMicros?: number })?.amountMicros ?? 0);
      const curMicros = Number((cur as { amountMicros?: number })?.amountMicros ?? 0);

      if (nextMicros !== curMicros) {
        diff[key] = value;
      }

      continue;
    }

    if (key === 'sostavZakaza') {
      const nextMd = normMarkdown((value as { markdown?: string })?.markdown);
      const curMd = normMarkdown((cur as { markdown?: string })?.markdown);

      if (nextMd !== curMd) {
        diff[key] = value;
      }

      continue;
    }

    if (DATE_KEYS.includes(key)) {
      if (!sameMoment(value, cur)) {
        diff[key] = value;
      }

      continue;
    }

    if ((cur ?? null) !== (value ?? null)) {
      diff[key] = value;
    }
  }

  return diff;
};
