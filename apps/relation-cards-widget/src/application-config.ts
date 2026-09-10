import { FieldType, defineApplication } from 'twenty-sdk/define';

import {
  CARD_FIELD_OPTIONS,
  CARD_FIELDS_VARIABLE_KEY,
  DEFAULT_CARD_FIELDS,
  SHOW_AVATAR_VARIABLE_KEY,
  SORT_ORDER_OPTIONS,
  SORT_ORDER_VARIABLE_KEY,
} from 'src/constants/application-variables';
import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    [CARD_FIELDS_VARIABLE_KEY]: {
      universalIdentifier: '77c8c179-fdf1-4b95-b595-4dfba721b30a',
      label: 'Поля в карточке',
      description:
        'Какие поля показывать в карточках связанных записей (галочки)',
      type: FieldType.MULTI_SELECT,
      options: CARD_FIELD_OPTIONS,
      value: DEFAULT_CARD_FIELDS,
    },
    [SHOW_AVATAR_VARIABLE_KEY]: {
      universalIdentifier: '2486601e-cfe4-4e79-9e31-5f0610c38fe3',
      label: 'Показывать аватар',
      description: 'Показывать аватар в карточках связанных записей',
      type: FieldType.BOOLEAN,
      value: true,
    },
    [SORT_ORDER_VARIABLE_KEY]: {
      universalIdentifier: 'a8cb1830-0c9c-4e8d-b576-529670961871',
      label: 'Сортировка',
      description: 'Порядок карточек в виджете',
      type: FieldType.SELECT,
      options: SORT_ORDER_OPTIONS,
      value: 'name',
    },
  },
});
