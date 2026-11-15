import { defineApplicationRole } from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/**
 * Роль приложения.
 *
 * `canSoftDeleteAllObjectRecords` действует только на объекты самого приложения,
 * поэтому для «Связи сообщения» права выданы явно: приложение привязывает и
 * отвязывает записи, а без objectPermission сервер отвечает
 * «Entity performing the request does not have permission».
 */
export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: `${APP_DISPLAY_NAME} default function role`,
  description: `${APP_DISPLAY_NAME} default function role`,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: true,
  canDestroyAllObjectRecords: false,
  // Право загружать файлы (PermissionFlagType.UPLOAD_FILE). Без него Twenty
  // отвечает «Entity performing the request does not have permission» на любую
  // загрузку в файловое поле — именно так грузят вложения почты и заметок.
  permissionFlagUniversalIdentifiers: ['dc6931a9-44bd-5164-a983-3db5db837f54'],
  objectPermissions: [
    {
      objectUniversalIdentifier: '062d14d7-7280-4fae-970f-3e9a8cb88de2',
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: true,
      canDestroyObjectRecords: true,
    },
  ],
});
