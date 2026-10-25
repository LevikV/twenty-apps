import { defineLogicFunction } from 'twenty-sdk/define';

import { ROOM_TENDER_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handleDealCreated } from 'src/shared/create-room';

/** Создание Тендера → комната чата по сделке. */
export default defineLogicFunction({
  universalIdentifier: ROOM_TENDER_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'room-tender-created',
  description: 'Комната чата при создании Тендера',
  timeoutSeconds: 120,
  handler: async (event) => handleDealCreated('tender', event),
  databaseEventTriggerSettings: { eventName: 'tender.created' },
});
