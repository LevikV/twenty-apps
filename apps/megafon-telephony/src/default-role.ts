import { defineApplicationRole } from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: `${APP_DISPLAY_NAME} — роль`,
  description: `${APP_DISPLAY_NAME} — роль`,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: true,
  canDestroyAllObjectRecords: false,
  // UPLOAD_FILE — заливка mp3 в файловые поля записи звонка (конвейер записей).
  permissionFlagUniversalIdentifiers: ['dc6931a9-44bd-5164-a983-3db5db837f54'],
});
