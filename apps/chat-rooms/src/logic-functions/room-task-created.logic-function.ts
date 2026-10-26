import { defineLogicFunction } from 'twenty-sdk/define';

import { ROOM_TASK_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handleDealCreated } from 'src/shared/create-room';

/** Создание задачи → комната чата по задаче. */
export default defineLogicFunction({
  universalIdentifier: ROOM_TASK_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'room-task-created',
  description: 'Комната чата при создании задачи',
  timeoutSeconds: 120,
  handler: async (event) => handleDealCreated('task', event),
  databaseEventTriggerSettings: { eventName: 'task.created' },
});
