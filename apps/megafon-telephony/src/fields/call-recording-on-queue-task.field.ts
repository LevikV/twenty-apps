import { FieldType, OnDeleteAction, RelationType, defineField } from 'twenty-sdk/define';

import {
  CALL_RECORDING_OBJECT_UNIVERSAL_IDENTIFIER,
  RECORDING_QUEUE_TASK_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

import { CALL_RECORDING_QUEUE_TASKS_FIELD_UNIVERSAL_IDENTIFIER } from './call-recording-queue-tasks.field';

/** Сторона MANY_TO_ONE: у задачи расшифровки — один звонок (держит внешний ключ). */
export const CALL_RECORDING_FIELD_UNIVERSAL_IDENTIFIER = 'a08d63e4-9508-44a8-b921-d5354269cdc1';

export default defineField({
  universalIdentifier: CALL_RECORDING_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: RECORDING_QUEUE_TASK_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'callRecording',
  label: 'Звонок',
  icon: 'IconPhone',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: CALL_RECORDING_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier: CALL_RECORDING_QUEUE_TASKS_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'callRecordingId',
  },
});
