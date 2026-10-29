import { defineLogicFunction } from 'twenty-sdk/define';

import { PUSH_CONTACT_LINK_DELETED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handleContactLinkDeleted as handlerFn } from 'src/shared/create-out';

/**
 * `kontaktKlienta.deleted`: удаление связи → `DELETE` записи контактного лица в 1С.
 * Если связь в 1С не уходила (нет `objectGuid`), задачи нет.
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

  return handlerFn(String(recordId ?? ''), payload?.properties?.before);
};

export default defineLogicFunction({
  universalIdentifier: PUSH_CONTACT_LINK_DELETED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'push-contact-link-deleted',
  description: 'push-contact-link-deleted: задача OUT в 1С',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'kontaktKlienta.deleted',
  },
});
