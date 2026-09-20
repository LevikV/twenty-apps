import { FieldType, STANDARD_OBJECT, defineField } from 'twenty-sdk/define';

/**
 * Разведка: можно ли приложению добавить поле на системный объект «Сотрудник».
 *
 * Смысл поля: у сотрудника — список id сотрудников, чьи звонки он видит в журнале.
 * Пусто = видит только свои (поведение по умолчанию).
 *
 * Тип RAW_JSON, а не связь: Twenty 2.37 не поддерживает связи «многие-ко-многим»,
 * а именно она нужна (сотрудника могут видеть сразу несколько человек).
 */
export const VISIBLE_CALL_MEMBER_IDS_FIELD_UNIVERSAL_IDENTIFIER =
  '5047ca49-09b7-4912-b460-c811c59932f4';

export default defineField({
  universalIdentifier: VISIBLE_CALL_MEMBER_IDS_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT.workspaceMember.universalIdentifier,
  type: FieldType.RAW_JSON,
  name: 'visibleCallMemberIds',
  label: 'Видит звонки сотрудников',
  description: 'Список id сотрудников, чьи звонки видит этот сотрудник в журнале',
  icon: 'IconPhoneCheck',
  isNullable: true,
});
