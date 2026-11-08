import { generatePath } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';

/**
 * Navigation Menu content, laid out like SAP's Compact Navigation Menu
 * (design-reference/sap-s4hana/components/navigation-menu.svg):
 *
 *   Main menu: Home · collapsible sections · groups (expand to child links or
 *   "›" to a page) · space rows ("| ›" opens the space in All Spaces) ·
 *   footer: All Spaces, Settings.
 *   All Spaces: search · pinned spaces (pin / Unpin All) · every space,
 *   expandable to its pages.
 *
 * Labels are i18n keys under `nav.menu.*`.
 */

const entity = (entityType: string) => generatePath(ROUTES.ENTITY_LIST, { entityType });

export interface NavLinkItem {
  key: string;
  to: string;
}

export type MainItem =
  | { kind: 'group'; key: string; children: NavLinkItem[] }
  | { kind: 'page'; key: string; to: string }
  | { kind: 'space'; key: string; spaceId: string }
  | { kind: 'link'; key: string; to: string };

export interface MainSection {
  key: string;
  items: MainItem[];
}

export interface Space {
  id: string;
  key: string;
  pages: NavLinkItem[];
}

export const MAIN_SECTIONS: MainSection[] = [
  {
    key: 'favorites',
    items: [
      {
        kind: 'group',
        key: 'entities',
        children: [
          { key: 'customers', to: entity('customer') },
          { key: 'products', to: entity('product') },
          { key: 'vendors', to: entity('vendor') },
          { key: 'books', to: entity('book') },
          { key: 'authors', to: entity('author') },
        ],
      },
      { kind: 'page', key: 'change_requests', to: ROUTES.CHANGE_REQUESTS },
      { kind: 'page', key: 'matching', to: ROUTES.MATCHING },
    ],
  },
  {
    key: 'my_spaces',
    items: [
      { kind: 'space', key: 'space_mdm', spaceId: 'mdm' },
      { kind: 'space', key: 'space_gov', spaceId: 'gov' },
      { kind: 'link', key: 'self_service', to: ROUTES.PROFILE },
    ],
  },
];

export const SPACES: Space[] = [
  {
    id: 'mdm',
    key: 'space_mdm',
    pages: [
      { key: 'overview', to: ROUTES.HOME },
      { key: 'customers', to: entity('customer') },
      { key: 'products', to: entity('product') },
      { key: 'vendors', to: entity('vendor') },
      { key: 'duplicates', to: generatePath(ROUTES.DUPLICATE_LIST, { entityType: 'customer' }) },
    ],
  },
  {
    id: 'gov',
    key: 'space_gov',
    pages: [
      { key: 'quality', to: ROUTES.QUALITY },
      { key: 'rules', to: ROUTES.QUALITY_RULES },
      { key: 'glossary', to: '/glossary' },
      { key: 'change_requests', to: ROUTES.CHANGE_REQUESTS },
    ],
  },
  {
    id: 'int',
    key: 'space_int',
    pages: [
      { key: 'sources', to: ROUTES.SOURCES },
      { key: 'pipelines', to: ROUTES.PIPELINES },
    ],
  },
  {
    id: 'wf',
    key: 'space_wf',
    pages: [
      { key: 'workflows', to: ROUTES.WORKFLOWS },
      { key: 'alerts', to: ROUTES.ALERTS },
    ],
  },
  {
    id: 'adm',
    key: 'space_adm',
    pages: [
      { key: 'users', to: ROUTES.SETTINGS_USERS },
      { key: 'roles', to: ROUTES.SETTINGS_ROLES },
      { key: 'audit', to: ROUTES.SETTINGS_AUDIT },
    ],
  },
];

export const DEFAULT_PINNED = ['mdm', 'gov'];
