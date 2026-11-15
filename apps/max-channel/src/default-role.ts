import { defineApplicationRole } from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/**
 * Роль приложения: маршруты работают от его имени (`runAs: 'application'`).
 *
 * Объекты «Центра коммуникации» — кастомные, у ролей сотрудников прав на них нет,
 * поэтому приёмник входящих читает и пишет их именно этой ролью.
 */
export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: `${APP_DISPLAY_NAME} — роль`,
  description: `${APP_DISPLAY_NAME} — роль`,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: true,
  canDestroyAllObjectRecords: false,
});
