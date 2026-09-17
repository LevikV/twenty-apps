import { FieldType, defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  MAX_ATTEMPTS_VARIABLE_UNIVERSAL_IDENTIFIER,
  MAX_TASKS_VARIABLE_UNIVERSAL_IDENTIFIER,
  STUCK_MINUTES_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export const SETTING_KEYS = {
  maxTasksPerRun: 'MAX_TASKS_PER_RUN',
  stuckMinutes: 'STUCK_MINUTES',
  maxAttempts: 'MAX_ATTEMPTS',
} as const;

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  applicationVariables: {
    [SETTING_KEYS.maxTasksPerRun]: {
      universalIdentifier: MAX_TASKS_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Задач за прогон',
      description: 'Сколько задач очереди обрабатывать за один запуск (лимит API)',
      type: FieldType.NUMBER,
      value: 20,
    },
    [SETTING_KEYS.stuckMinutes]: {
      universalIdentifier: STUCK_MINUTES_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Минут до «зависла»',
      description:
        'Через сколько минут задача в статусе PROCESSING возвращается в очередь',
      type: FieldType.NUMBER,
      value: 10,
    },
    [SETTING_KEYS.maxAttempts]: {
      universalIdentifier: MAX_ATTEMPTS_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Максимум попыток',
      description: 'После скольких попыток задача помечается ошибкой',
      type: FieldType.NUMBER,
      value: 3,
    },
  },
});
