export const CARD_FIELDS_VARIABLE_KEY = 'CARD_FIELDS';
export const SHOW_AVATAR_VARIABLE_KEY = 'SHOW_AVATAR';
export const SORT_ORDER_VARIABLE_KEY = 'SORT_ORDER';

export const DEFAULT_CARD_FIELDS: string[] = [
  'name',
  'phones',
  'emails',
  'kommentariy',
];

export const CARD_FIELD_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'ФИО', value: 'name' },
  { label: 'Телефоны', value: 'phones' },
  { label: 'Email', value: 'emails' },
  { label: 'Комментарий', value: 'kommentariy' },
  { label: 'Должность', value: 'jobTitle' },
  { label: 'Адрес юридический', value: 'adresYuridicheskiy' },
  { label: 'Тип отношений', value: 'tipOtnosheniy' },
];

export const SORT_ORDER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'По алфавиту', value: 'name' },
  { label: 'Сначала новые', value: 'newest' },
];
