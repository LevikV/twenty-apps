import { defineLogicFunction } from 'twenty-sdk/define';

import { PUSH_PERSON_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handlePersonCreated as handlerFn } from 'src/shared/create-out';

/**
 * `person.created`: новая карточка человека → контрагент-физлицо в 1С.
 * Записи с уже заполненным `objectGuid` (пришедшие из 1С) пропускаются.
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
  universalIdentifier: PUSH_PERSON_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'push-person-created',
  description: 'push-person-created: задача OUT в 1С',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'person.created',
  },
});
