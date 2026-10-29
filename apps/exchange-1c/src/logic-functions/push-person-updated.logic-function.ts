import { defineLogicFunction } from 'twenty-sdk/define';

import { PUSH_PERSON_UPDATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handlePersonCreated as handlerFn } from 'src/shared/create-out';

/**
 * `person.updated`: карточку создали пустой и дозаполнили имя позже.
 * Если `objectGuid` уже стоит — обработчик выходит сразу, поэтому событие дешёвое.
 */

type DatabaseEventPayload = {
  recordId?: string;
  properties?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
};

const handler = async (payload?: DatabaseEventPayload) => {
  const recordId = payload?.recordId ?? payload?.properties?.after?.id;

  return handlerFn(String(recordId ?? ''));
};

export default defineLogicFunction({
  universalIdentifier: PUSH_PERSON_UPDATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'push-person-updated',
  description: 'push-person-updated: дозаполнение карточки → задача OUT в 1С',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'person.updated',
    updatedFields: ["name"],
  },
});
