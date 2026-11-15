import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/**
 * Приложение «MAX-канал».
 *
 * Связка между мостом личных аккаунтов MAX и «Центром коммуникации»:
 * приём входящих, очередь исходящих и подключение аккаунта сотрудника.
 */
export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
});
