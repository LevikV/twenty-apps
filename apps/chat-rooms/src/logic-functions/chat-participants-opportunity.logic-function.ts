import { defineLogicFunction } from 'twenty-sdk/define';

import { CHAT_PARTICIPANTS_OPPORTUNITY_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { RecordRoomService } from 'src/shared/record-room';

/** Смена ответственного в заказе — досыпает в комнату новых участников, если она уже создана. */
const handler = async (event: unknown) => {
  const recordId = (event as { recordId?: string })?.recordId;

  if (!recordId) {
    return { skipped: true };
  }

  const service = new RecordRoomService();

  return service.syncParticipants(recordId);
};

export default defineLogicFunction({
  universalIdentifier: CHAT_PARTICIPANTS_OPPORTUNITY_UNIVERSAL_IDENTIFIER,
  name: 'chat-participants-opportunity',
  description: 'Смена ответственного в заказе',
  timeoutSeconds: 120,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'opportunity.updated',
    updatedFields: ['otvetstvennyy'],
  },
});
