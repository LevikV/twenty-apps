import { defineLogicFunction } from 'twenty-sdk/define';

import { CHAT_PARTICIPANTS_TASK_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { RecordRoomService } from 'src/shared/record-room';

/** Смена исполнителя в задаче — досыпает в комнату новых участников, если она уже создана. */
const handler = async (event: unknown) => {
  const recordId = (event as { recordId?: string })?.recordId;

  if (!recordId) {
    return { skipped: true };
  }

  const service = new RecordRoomService();

  return service.syncParticipants(recordId);
};

export default defineLogicFunction({
  universalIdentifier: CHAT_PARTICIPANTS_TASK_UNIVERSAL_IDENTIFIER,
  name: 'chat-participants-task',
  description: 'Смена исполнителя в задаче',
  timeoutSeconds: 120,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'task.updated',
    updatedFields: ['assignee'],
  },
});
