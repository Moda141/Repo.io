/**
 * Named routes.
 * Build URLs with `generatePath(ROUTES.X, params)` from react-router-dom
 * instead of hand-concatenating strings.
 */
export const ROUTES = {
  // Auth & profile
  LOGIN: '/login',
  PROFILE: '/profile',
  NOTIFICATIONS: '/notifications',

  HOME: '/home',
  EXPLORE: '/explore',

  // Search & Discovery
  SEARCH: '/search',
  QUERY: '/query',
  VIEWS: '/views',
  VIEW_DETAIL: '/views/:viewId',
  EXPORT: '/export',

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

  // Pipelines & Sources
  PIPELINES: '/pipelines',
  PIPELINE_NEW: '/pipelines/new',
  PIPELINE_DETAIL: '/pipelines/:pipelineId',
  PIPELINE_EDIT: '/pipelines/:pipelineId/edit',
  SOURCES: '/sources',
  SOURCE_NEW: '/sources/new',
  SOURCE_DETAIL: '/sources/:sourceId',

  // Admin
  SETTINGS: '/settings',
  SETTINGS_USERS: '/settings/users',
  SETTINGS_USER_DETAIL: '/settings/users/:userId',
  SETTINGS_ROLES: '/settings/roles',
  SETTINGS_SSO: '/settings/sso',
  SETTINGS_API_KEYS: '/settings/api-keys',
  SETTINGS_AUDIT: '/settings/audit',
  SETTINGS_SCHEMA: '/settings/schema',
  SETTINGS_SCHEMA_ENTITY: '/settings/schema/:entityType',
  SETTINGS_SOURCES: '/settings/sources',
  SETTINGS_RULES: '/settings/rules',

  // Data quality & rules
  QUALITY: '/quality',
  QUALITY_RULES: '/quality/rules',
  QUALITY_RULE_EDIT: '/quality/rules/:ruleId',
  MATCHING: '/quality/matching',
  SURVIVORSHIP: '/quality/survivorship',
  PLAYGROUND: '/quality/playground',
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
