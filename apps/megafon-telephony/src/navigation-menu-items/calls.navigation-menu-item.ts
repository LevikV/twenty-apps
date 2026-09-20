import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { CALLS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER, CALLS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

/**
 * Пункт меню «Звонки» → страница приложения (STANDALONE_PAGE).
 *
 * Заголовок standalone-страницы Twenty берёт именно из пункта навигации
 * (`StandalonePageHeader`: `navigationMenuItem?.name` и иконка), поэтому
 * подпись для пользователя живёт здесь.
 */
export default defineNavigationMenuItem({
  universalIdentifier: CALLS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Звонки',
  icon: 'IconPhone',
  position: 21,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: CALLS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
