import { FieldType, defineObject } from 'twenty-sdk/define';

import { RECORDING_QUEUE_TASK_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export enum RecordingQueueStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  READY = 'READY',
  FAILED = 'FAILED',
}

/**
 * Очередь расшифровки записей звонков.
 *
 * Источник правды конвейера: задача живёт в объекте (видна в UI), движок — cron
 * раз в минуту. Так задача переживает перезапуск Redis и её видно глазами.
 *
 * Путь задачи: PENDING (запись готова к отправке) → SENT (Яндекс принял, есть
 * operationId) → READY (расшифровка записана в звонок) либо FAILED (+ errorText).
 */
export default defineObject({
  universalIdentifier: RECORDING_QUEUE_TASK_UNIVERSAL_IDENTIFIER,
  nameSingular: 'recordingQueueTask',
  namePlural: 'recordingQueueTasks',
  labelSingular: 'Задача расшифровки',
  labelPlural: 'Очередь расшифровки',
  description: 'Очередь расшифровки записей звонков (Яндекс SpeechKit)',
  icon: 'IconMicrophone',
  fields: [
    {
      universalIdentifier: '3a13e743-f145-44e2-9666-4c67c1d57c76',
      name: 'status',
      type: FieldType.SELECT,
      label: 'Статус',
      icon: 'IconProgress',
      defaultValue: `'${RecordingQueueStatus.PENDING}'`,
      options: [
        { value: RecordingQueueStatus.PENDING, label: 'Ждёт отправки', position: 0, color: 'gray' },
        { value: RecordingQueueStatus.SENT, label: 'Отправлено в Яндекс', position: 1, color: 'orange' },
        { value: RecordingQueueStatus.READY, label: 'Расшифровано', position: 2, color: 'green' },
        { value: RecordingQueueStatus.FAILED, label: 'Ошибка', position: 3, color: 'red' },
      ],
    },
    {
      universalIdentifier: 'e1b3981d-8232-4959-829c-73252d2061fd',
      name: 'uid',
      type: FieldType.TEXT,
      label: 'UID звонка ВАТС',
      icon: 'IconHash',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: '2ca59d76-283a-471d-a057-2206d6557d19',
      name: 'attempts',
      type: FieldType.NUMBER,
      label: 'Попыток',
      icon: 'IconRefresh',
      defaultValue: 0,
    },
    {
      universalIdentifier: '9c1f4b7e-2d38-4a51-8f60-3b7e5c1a9d24',
      name: 'direction',
      type: FieldType.TEXT,
      label: 'Направление',
      description: 'in / out — из хука ВАТС; нужно для подписи ролей в расшифровке',
      icon: 'IconArrowsExchange',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: '5df35e3b-65c3-4c47-bcff-2830a3be46d4',
      name: 'operationId',
      type: FieldType.TEXT,
      label: 'Операция Яндекса',
      icon: 'IconKey',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: '31755ec4-569c-43d6-8d56-f6dadfe2df07',
      name: 'nextCheckAt',
      type: FieldType.DATE_TIME,
      label: 'Следующая проверка',
      icon: 'IconClock',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: 'd2d10d8a-2cec-440a-ad28-6ece0289a2c3',
      name: 'sentAt',
      type: FieldType.DATE_TIME,
      label: 'Отправлено',
      icon: 'IconSend',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: '187261a1-47a2-4005-9151-5a79118792c3',
      name: 'startedAt',
      type: FieldType.DATE_TIME,
      label: 'Начало звонка',
      icon: 'IconPhone',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: '87ba7812-7712-4ef1-a8df-889463f214fb',
      name: 'completedAt',
      type: FieldType.DATE_TIME,
      label: 'Расшифровано',
      icon: 'IconCheck',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: '68dcb066-35d3-4334-bc79-592284ccea1e',
      name: 'errorText',
      type: FieldType.TEXT,
      label: 'Текст ошибки',
      icon: 'IconAlertTriangle',
      isNullable: true,
      defaultValue: null,
    },
  ],
});
