import { defineLogicFunction } from 'twenty-sdk/define';

import { PUSH_COMPANY_UPDATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handleCompanyCreated as handlerFn } from 'src/shared/create-out';

/**
 * `company.updated`: и дозаполнение пустой карточки, и правки руками по белым полям.
 * Правки не от `MANUAL` (наши записи и приём из 1С) не отправляем.
 */

type DatabaseEventPayload = {
  recordId?: string;
  properties?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    updatedFields?: string[];
  };
};

const handler = async (payload?: DatabaseEventPayload) => {
  const recordId = payload?.recordId ?? payload?.properties?.after?.id;
  const updatedFields = payload?.properties?.updatedFields ?? [];

  return handlerFn(String(recordId ?? ''), updatedFields);
};

export default defineLogicFunction({
  universalIdentifier: PUSH_COMPANY_UPDATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'push-company-updated',
  description: 'push-company-updated: дозаполнение карточки → задача OUT в 1С',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'company.updated',
    updatedFields: [
      "name",
      "telefony",
      "kommentariy",
      "address",
      "tipOtnosheniy",
      "pravovayaForma",
    ],
  },
});
