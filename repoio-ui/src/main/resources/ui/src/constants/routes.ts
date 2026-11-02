/**
 * Named routes.
 * Build URLs with `generatePath(ROUTES.X, params)` from react-router-dom
 * instead of hand-concatenating strings.
 */
export const ROUTES = {
  HOME: '/home',
  EXPLORE: '/explore',

  // Entity read
  ENTITY_LIST: '/entity/:entityType',
  ENTITY_DETAIL: '/entity/:entityType/:id',

  // Entity write
  ENTITY_NEW: '/entity/:entityType/new',
  ENTITY_EDIT: '/entity/:entityType/:id/edit',

  // Golden-record workflows
  ENTITY_HIERARCHY: '/entity/:entityType/:id/hierarchy',
  ENTITY_LINEAGE: '/entity/:entityType/:id/lineage',
  DUPLICATE_LIST: '/entity/:entityType/duplicates',
  DUPLICATE_REVIEW: '/entity/:entityType/duplicates/:pairId',
  ENTITY_MERGE: '/entity/:entityType/merge',

  // Governance
  CHANGE_REQUESTS: '/change-requests',
  CHANGE_REQUEST_NEW: '/change-requests/new',
  CHANGE_REQUEST_MINE: '/change-requests/mine',
  CHANGE_REQUEST_DETAIL: '/change-requests/:crId',
  PIPELINES: '/pipelines',

  // Admin
  SETTINGS: '/settings',
  SETTINGS_USERS: '/settings/users',
  SETTINGS_ROLES: '/settings/roles',
  SETTINGS_SOURCES: '/settings/sources',
  SETTINGS_RULES: '/settings/rules',
} as const;

export const ENTITY_TYPES = [
  { key: 'customer', labelKey: 'entity.customer_plural', icon: 'user' },
  { key: 'vendor', labelKey: 'entity.vendor_plural', icon: 'shop' },
  { key: 'product', labelKey: 'entity.product_plural', icon: 'book' },
  { key: 'author', labelKey: 'entity.author_plural', icon: 'edit' },
  { key: 'employee', labelKey: 'entity.employee_plural', icon: 'team' },
  { key: 'store', labelKey: 'entity.store_plural', icon: 'home' },
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number]['key'];
