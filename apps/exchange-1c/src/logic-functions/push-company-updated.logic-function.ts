import { defineLogicFunction } from 'twenty-sdk/define';

import { PUSH_COMPANY_UPDATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handleCompanyCreated as handlerFn } from 'src/shared/create-out';

/**
 * `company.updated`: компанию создали без названия и дозаполнили позже.
 * Если `objectGuid` уже стоит — обработчик выходит сразу.
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
  universalIdentifier: PUSH_COMPANY_UPDATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'push-company-updated',
  description: 'push-company-updated: дозаполнение карточки → задача OUT в 1С',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'company.updated',
    updatedFields: ["name"],
  },
});
