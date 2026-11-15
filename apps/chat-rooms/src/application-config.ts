import { FieldType, defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  CHANNELS_ADMIN_EMAILS_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/** Ключи настроек приложения (читаются в логик-функциях как process.env). */
export const SETTING_KEYS = {
  channelAdmins: 'CHANNELS_ADMIN_EMAILS',
} as const;

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    [SETTING_KEYS.channelAdmins]: {
      universalIdentifier: CHANNELS_ADMIN_EMAILS_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Кто может отправлять с чужих каналов',
      description:
        'Почта сотрудников через запятую. Эти сотрудники видят каналы (SMS и MAX) друг друга и могут отправлять от чужого имени. Остальные — только свои каналы.',
      type: FieldType.TEXT,
      value: 'alex@kplus79.ru',
    },
  },
});
