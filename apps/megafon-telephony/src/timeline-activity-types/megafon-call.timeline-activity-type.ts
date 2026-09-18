import { defineTimelineActivityType } from 'twenty-sdk/define';

import {
  TIMELINE_ACTIVITY_TYPE_LABEL,
  TIMELINE_ACTIVITY_TYPE_NAME,
  TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/**
 * Тип активности приложения для ленты: «звонок МегаФон».
 *
 * Без своего типа приложение не может писать в ленту (timeline) — ядро
 * Twenty разрешает использовать только типы, объявленные самим приложением.
 */
export default defineTimelineActivityType({
  universalIdentifier: TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
  name: TIMELINE_ACTIVITY_TYPE_NAME,
  label: TIMELINE_ACTIVITY_TYPE_LABEL,
  icon: 'IconPhone',
});
