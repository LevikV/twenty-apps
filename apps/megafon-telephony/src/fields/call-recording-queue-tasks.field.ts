import { FieldType, RelationType, defineField } from 'twenty-sdk/define';

import {
  CALL_RECORDING_OBJECT_UNIVERSAL_IDENTIFIER,
  RECORDING_QUEUE_TASK_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

import { CALL_RECORDING_FIELD_UNIVERSAL_IDENTIFIER } from './call-recording-on-queue-task.field';

/** Обратная сторона (ONE_TO_MANY): у звонка — свои задачи расшифровки. */
export const CALL_RECORDING_QUEUE_TASKS_FIELD_UNIVERSAL_IDENTIFIER =
  'e6e26051-926e-4c4a-88a9-66e7fe51b5b3';

export default defineField({
  universalIdentifier: CALL_RECORDING_QUEUE_TASKS_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CALL_RECORDING_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'recordingQueueTasks',
  label: 'Задачи расшифровки',
  icon: 'IconMicrophone',
  relationTargetObjectMetadataUniversalIdentifier: RECORDING_QUEUE_TASK_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier: CALL_RECORDING_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
