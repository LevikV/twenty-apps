import { defineLogicFunction } from 'twenty-sdk/define';

import { ROOM_OPPORTUNITY_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handleDealCreated } from 'src/shared/create-room';

/** Создание Заказа → комната чата по сделке. */
export default defineLogicFunction({
  universalIdentifier: ROOM_OPPORTUNITY_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'room-opportunity-created',
  description: 'Комната чата при создании Заказа',
  timeoutSeconds: 120,
  handler: async (event) => handleDealCreated('opportunity', event),
  databaseEventTriggerSettings: { eventName: 'opportunity.created' },
});
