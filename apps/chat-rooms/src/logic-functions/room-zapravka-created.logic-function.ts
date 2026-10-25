import { defineLogicFunction } from 'twenty-sdk/define';

import { ROOM_ZAPRAVKA_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handleDealCreated } from 'src/shared/create-room';

/** Создание Заправки картриджей → комната чата по сделке. */
export default defineLogicFunction({
  universalIdentifier: ROOM_ZAPRAVKA_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'room-zapravka-created',
  description: 'Комната чата при создании Заправки картриджей',
  timeoutSeconds: 120,
  handler: async (event) => handleDealCreated('zapravkaKartridzhey', event),
  databaseEventTriggerSettings: { eventName: 'zapravkaKartridzhey.created' },
});
