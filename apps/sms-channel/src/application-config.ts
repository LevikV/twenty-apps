import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/**
 * Приложение «SMS-канал».
 *
 * Держит только приём входящих сообщений от Android-шлюза и запись их в общий
 * диалог «Центра коммуникации». Отправка, статусы доставки и экран «Мои каналы»
 * появятся следующими этапами — отдельными маршрутами этого же приложения.
 */
export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
});
