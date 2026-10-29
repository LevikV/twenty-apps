import { defineLogicFunction } from 'twenty-sdk/define';

import { PUSH_COMPANY_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handleCompanyCreated as handlerFn } from 'src/shared/create-out';

/**
 * `company.created`: новая компания → контрагент в 1С.
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
  universalIdentifier: PUSH_COMPANY_CREATED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'push-company-created',
  description: 'push-company-created: задача OUT в 1С',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'company.created',
  },
});
