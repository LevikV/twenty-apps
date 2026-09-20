import {
  PageLayoutTabLayoutMode,
  PageLayoutType,
  WidgetType,
  definePageLayout,
} from 'twenty-sdk/define';

import {
  CALLS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  CALLS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  CALLS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  CALLS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/**
 * Страница «Звонки» — раздел приложения в обычном меню Twenty.
 *
 * Тип STANDALONE_PAGE: рендерится во внутреннем лэйауте Twenty (левое меню на месте).
 * Единственный виджет — фронт-компонент приложения, который и рисует экран.
 */
export default definePageLayout({
  universalIdentifier: CALLS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Звонки',
  type: PageLayoutType.STANDALONE_PAGE,
  tabs: [
    {
      universalIdentifier: CALLS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Звонки',
      position: 0,
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: CALLS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Звонки по сотрудникам',
          type: WidgetType.FRONT_COMPONENT,
          position: {
            layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
            index: 0,
          },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              CALLS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
