import { defineLogicFunction } from 'twenty-sdk/define';

import { PUSH_CONTACT_LINK_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handleContactLinkCreated as handlerFn } from 'src/shared/create-out';

/**
 * `kontaktKlienta.created`: связь «Контакт клиента» → контактное лицо в 1С
 * под этим владельцем (`owner_guid`).
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
  universalIdentifier: PUSH_CONTACT_LINK_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'push-contact-link-created',
  description: 'push-contact-link-created: задача OUT в 1С',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'kontaktKlienta.created',
  },
});
