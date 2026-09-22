import { FieldType, defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  // Секреты конвейера записей (этап 1). Значения в манифесте не хранятся:
  // вводятся в настройках приложения и приходят в логик-функции как process.env.
  serverVariables: {
    VATS_API_TOKEN: {
      description: 'Токен API ВАТС МегаФон (заголовок X-API-KEY)',
      isSecret: true,
      isRequired: true,
      type: FieldType.TEXT,
    },
    YANDEX_SA_KEY: {
      description:
        'Ключ сервисного аккаунта Яндекс (JSON: service_account_id, key_id, private_key)',
      isSecret: true,
      isRequired: true,
      type: FieldType.RAW_JSON,
    },
    // Наши общие (групповые) номера — например номер отдела продаж, на который
    // звонок распределяется между сотрудниками. Список через запятую в любом
    // формате (7914…, +7 914…, 8 914…). Нужен, чтобы обработчик понимал, что
    // звонок идёт на группу, и не записывал участниками всех, кому звонило.
    SHARED_PHONE_NUMBERS: {
      description:
        'Общие (групповые) номера компании через запятую — например 79247420908',
      isSecret: false,
      isRequired: false,
      type: FieldType.TEXT,
    },
  },
});
