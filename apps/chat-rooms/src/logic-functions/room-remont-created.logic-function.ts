import { defineLogicFunction } from 'twenty-sdk/define';

import { ROOM_REMONT_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handleDealCreated } from 'src/shared/create-room';

/** Создание Ремонта оборудования → комната чата по сделке. */
export default defineLogicFunction({
  universalIdentifier: ROOM_REMONT_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'room-remont-created',
  description: 'Комната чата при создании Ремонта оборудования',
  timeoutSeconds: 120,
  handler: async (event) => handleDealCreated('remontOborudovaniya', event),
  databaseEventTriggerSettings: { eventName: 'remontOborudovaniya.created' },
});
