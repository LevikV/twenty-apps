import { RestApiClient } from 'twenty-client-sdk/rest';

/**
 * Поиск активных сделок клиента — это цель события-звонка.
 *
 * Решение 22.09.2026: целью автоматически становится **только сделка**, причём
 * только «в работе» (общее поле «Статус» = `V_RABOTE`). Порядок поиска:
 * активные сделки **контакта**, если их нет — активные сделки **его компании**.
 * Контакт и компания целями больше не ставятся (они — участники события).
 *
 * Сделки — четыре объекта: «Заказы» (`opportunity`), «Ремонт оборудования»,
 * «Заправка картриджей», «Тендер». Связь с клиентом у всех — поле
 * «Покупатель» (морф-связь: контакт / компания).
 */

const client = new RestApiClient();

export type DealKind = 'opportunity' | 'remontOborudovaniya' | 'zapravkaKartridzhey' | 'tender';

export type DealRef = {
  kind: DealKind;
  id: string;
  name: string;
};

/** Значение опции «В работе» в общем поле «Статус» сделок. */
export const ACTIVE_DEAL_STATUS = 'V_RABOTE';

const DEALS: { kind: DealKind; path: string; key: string }[] = [
  { kind: 'opportunity', path: '/rest/opportunities', key: 'opportunities' },
  { kind: 'remontOborudovaniya', path: '/rest/remontOborudovaniyas', key: 'remontOborudovaniyas' },
  { kind: 'zapravkaKartridzhey', path: '/rest/zapravkaKartridzheys', key: 'zapravkaKartridzheys' },
  { kind: 'tender', path: '/rest/tendery', key: 'tendery' },
];

type DealRecord = { id?: string; name?: string | null };

const rowsOf = (response: unknown, key: string): DealRecord[] => {
  const data = (response as { data?: Record<string, unknown> })?.data;
  const value = data?.[key];

  return Array.isArray(value) ? (value as DealRecord[]) : [];
};

/** Активные сделки по одной из ног «Покупателя» (контакт или компания). */
const findBy = async (relationField: string, targetId: string): Promise<DealRef[]> => {
  if (!targetId) return [];

  const found: DealRef[] = [];

  for (const deal of DEALS) {
    try {
      const response = await client.get<unknown>(deal.path, {
        query: {
          filter: `${relationField}Id[eq]:"${targetId}",status[eq]:"${ACTIVE_DEAL_STATUS}"`,
          limit: 20,
        },
      });

      for (const row of rowsOf(response, deal.key)) {
        if (row.id) found.push({ kind: deal.kind, id: String(row.id), name: String(row.name ?? '') });
      }
    } catch {
      // недоступный объект не должен ломать обработку звонка
    }
  }

  return found;
};

/** Активные сделки контакта (поле «Покупатель» = контакт). */
export const findActiveDealsByPerson = (personId: string): Promise<DealRef[]> =>
  findBy('pokupatelPerson', personId);

/** Активные сделки компании (поле «Покупатель» = компания). */
export const findActiveDealsByCompany = (companyId: string): Promise<DealRef[]> =>
  findBy('pokupatelCompany', companyId);

/**
 * Сделки-цели для звонка: сначала у контакта, если нет — у его компании.
 * Неоднозначный контакт (несколько компаний) приходит с `companyId = ''` —
 * значит цели не будет (не гадаем).
 */
export const findCallDeals = async (params: {
  personId: string;
  companyId: string;
}): Promise<DealRef[]> => {
  const ownDeals = await findActiveDealsByPerson(params.personId);

  if (ownDeals.length > 0) return ownDeals;

  return findActiveDealsByCompany(params.companyId);
};
