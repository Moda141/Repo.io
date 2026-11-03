import { useState } from 'react';
import { useParams, Link, generatePath, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';
import styles from './EntityDetailPage.module.css';

/**
 * EntityDetailPage — SAP Fiori Horizon Object Page
 *
 * Floorplan: Object Page
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │  Dynamic Page Header                                              │
 *  │    [Avatar] Title (entity id)  [breadcrumb]                       │
 *  │    Header facets: Type · Owner · Tier · Status                    │
 *  ├──────────────────────────────────────────────────────────────────┤
 *  │  Tab Bar: Attributes │ Activity │ Sources │ Change Requests │ … │
 *  ├──────────────────────────────────────────────────────────────────┤
 *  │  Section: Attributes                                              │
 *  │    Filter + search toolbar                                        │
 *  │    Responsive table (Name / Type / Description / Tags / DQ)      │
 *  │    ─── Aside ────────────────────────────────────────────────── │
 *  │    Tags · Glossary Terms · Custom Properties                      │
 *  └──────────────────────────────────────────────────────────────────┘
 */

// ─── Types ────────────────────────────────────────────────────────────────────
interface AttributeRow {
  key: string;
  name: string;
  type: string;
  description: string;
  tags: string[];
  glossary: string[];
  authored_by?: string;
  authored_at?: string;
  dq?: 'ok' | 'warn' | null;
}

type TabKey = 'attributes' | 'activity' | 'sources' | 'change_requests' | 'observability' | 'lineage';

// ─── Static data ──────────────────────────────────────────────────────────────
const ATTRIBUTE_ROWS: AttributeRow[] = [
  {
    key: 'master_id',
    name: 'master_id',
    type: 'varchar',
    description: 'Unique master identifier assigned when the record was promoted to golden.',
    tags: ['Primary key', 'Non-null'],
    glossary: ['Customer'],
    authored_by: 'mohamed.m',
    authored_at: '2 days ago',
    dq: 'ok',
  },
  {
    key: 'name',
    name: 'name',
    type: 'varchar',
    description: 'Business name as it appears to steward and downstream apps.',
    tags: ['Searchable'],
    glossary: ['Customer', 'Name'],
    authored_by: 'ahmed.h',
    authored_at: '7 days ago',
    dq: 'ok',
  },
  {
    key: 'legal_name',
    name: 'legal_name',
    type: 'varchar',
    description: 'Full legal entity name used on contracts and invoicing.',
    tags: ['Contract-ready'],
    glossary: ['Customer'],
    authored_by: 'ahmed.h',
    authored_at: '14 days ago',
    dq: null,
  },
  {
    key: 'country',
    name: 'country',
    type: 'enum',
    description: 'ISO country code — in {EG, SA, AE, KW, OM, BH, QA}.',
    tags: ['Location'],
    glossary: ['Country'],
    dq: 'ok',
  },
  {
    key: 'tax_id',
    name: 'tax_id',
    type: 'varchar',
    description: '9-digit government tax identifier (dashes optional).',
    tags: ['PII', 'Highly Confidential'],
    glossary: ['Tax number'],
    authored_by: 'mohamed.m',
    authored_at: '30 days ago',
    dq: 'warn',
  },
  {
    key: 'email',
    name: 'email',
    type: 'email',
    description: 'Primary business email address — RFC 5322.',
    tags: ['PII', 'Contact'],
    glossary: ['Email'],
    dq: 'ok',
  },
  {
    key: 'phone',
    name: 'phone',
    type: 'varchar',
    description: 'International phone number (E.164).',
    tags: ['PII'],
    glossary: ['Phone number'],
    dq: null,
  },
  {
    key: 'segment',
    name: 'segment',
    type: 'enum',
    description: 'Business segment (enterprise, mid_market, smb, government).',
    tags: ['Segmentation'],
    glossary: [],
    dq: 'ok',
  },
  {
    key: 'parent_id',
    name: 'parent_id',
    type: 'varchar',
    description: 'master_id of this record\'s parent in the hierarchy.',
    tags: ['Hierarchy'],
    glossary: ['Parent'],
    dq: null,
  },
  {
    key: 'created_at',
    name: 'created_at',
    type: 'timestamp',
    description: 'When the golden record was first materialised.',
    tags: [],
    glossary: [],
    dq: 'ok',
  },
];

// ─── Small inline icons ───────────────────────────────────────────────────────
function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M9 1.5l1.5 1.5-7 7H2V8.5l7-7Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="4" r="1" fill="currentColor"/>
      <circle cx="8" cy="8" r="1" fill="currentColor"/>
      <circle cx="8" cy="12" r="1" fill="currentColor"/>
    </svg>
  );
}
function BookIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1" y="1" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M3 4h6M3 6h6M3 8h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EntityDetailPage() {
  const { entityType = 'customer', id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('attributes');
  const [search, setSearch] = useState('');

  const path = (route: string) => generatePath(route, { entityType, id });

  const filteredRows = ATTRIBUTE_ROWS.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  );

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'attributes', label: t('entity.tab_attributes', 'Attributes'), badge: ATTRIBUTE_ROWS.length },
    { key: 'activity', label: t('entity.tab_activity', 'Activity'), badge: 80 },
    { key: 'sources', label: t('entity.tab_sources', 'Sources') },
    { key: 'change_requests', label: t('entity.tab_change_requests', 'Change Requests'), badge: 2 },
    { key: 'observability', label: t('entity.tab_observability', 'Data Observability') },
    { key: 'lineage', label: t('entity.tab_lineage', 'Lineage') },
  ];

  return (
    <div className={styles.page}>

      {/* ── Dynamic Page Header ──────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        {/* Breadcrumb */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to={ROUTES.HOME} className={styles.breadcrumbLink}>Repo.io</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link to={ROUTES.EXPLORE} className={styles.breadcrumbLink}>Repositories</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link
            to={generatePath(ROUTES.ENTITY_LIST, { entityType })}
            className={styles.breadcrumbLink}>
            {t(`entity.${entityType}_plural`, entityType)}
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{id}</span>
        </nav>

        {/* Header content */}
        <div className={styles.headerContent}>
          <div className={styles.headerMain}>
            {/* Avatar */}
            <div className={styles.avatar} aria-hidden="true">
              {(id?.[0] ?? 'E').toUpperCase()}
            </div>

            {/* Title group */}
            <div className={styles.titleGroup}>
              <h1 className={styles.objectTitle}>{id}</h1>
              <p className={styles.objectSubtitle}>
                {t(`entity.${entityType}`, entityType)} ·{' '}
                <span className={styles.badgeGolden}>Golden</span>
              </p>
            </div>
          </div>

          {/* Header actions */}
          <div className={styles.headerActions}>
            <button
              className={styles.btnSecondary}
              onClick={() => navigate(path(ROUTES.ENTITY_EDIT))}>
              <EditIcon />
              {t('entity.action_edit', 'Edit')}
            </button>
            <div className={styles.menuWrapper}>
              <button className={styles.btnIcon} aria-label="More actions">
                <MoreIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Header facets */}
        <div className={styles.facetsRow}>
          <Facet label={t('entity.facet_type', 'Type')} value="Regular" />
          <Facet label={t('entity.facet_tier', 'Tier')} value="Tier 1" highlight />
          <Facet label={t('entity.facet_cert', 'Certification')} value="Gold" positive />
          <Facet label={t('entity.facet_retention', 'Retention')} value="7 years" />
          <Facet label={t('entity.facet_owners', 'Owners')} value="M · A · N" />
          <Facet label={t('entity.facet_usage', 'Usage')} value="95th pctile" />
        </div>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
      <div className={styles.tabBar} role="tablist" aria-label="Object page sections">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}>
            {tab.label}
            {tab.badge != null && (
              <span className={styles.tabBadge}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Section content ───────────────────────────────────────────────── */}
      <div className={styles.sectionContent}>

        {activeTab === 'attributes' && (
          <div className={styles.attributesLayout}>
            {/* Main area */}
            <div className={styles.mainArea}>

              {/* Description */}
              <div className={styles.descriptionCard}>
                <div className={styles.descriptionHeader}>
                  <strong className={styles.descriptionLabel}>
                    {t('entity.description', 'Description')}
                  </strong>
                  <button className={styles.btnTextSm}>
                    <EditIcon /> {t('common.edit', 'Edit')}
                  </button>
                </div>
                <p className={styles.descriptionText}>
                  Golden {t(`entity.${entityType}`, entityType)} records are produced by Splink
                  matching + survivorship rules from SAP C4C, SAP ERP, SQL Server and Excel sources.
                  This table holds one row per surviving entity with full provenance in{' '}
                  <a className={styles.inlineLink}>change_log</a> and{' '}
                  <a className={styles.inlineLink}>audit</a>.
                </p>
                <p className={styles.descriptionMeta}>
                  {t('entity.authored_by', 'Authored by')}{' '}
                  <a className={styles.inlineLink}>mohamed.m</a> · 7 days ago
                </p>
              </div>

              {/* Table toolbar */}
              <div className={styles.tableCard}>
                <div className={styles.tableToolbar}>
                  <div className={styles.searchBox}>
                    <span className={styles.searchIcon} aria-hidden="true">
                      <SearchIcon />
                    </span>
                    <input
                      type="search"
                      className={styles.searchInput}
                      placeholder={t('entity.find_attribute', 'Find attribute…')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <span className={styles.toolbarCount}>
                    {filteredRows.length} {t('entity.attributes', 'attributes')}
                  </span>
                </div>

                {/* Responsive table */}
                <div className={styles.tableWrapper}>
                  <table className={styles.attrTable}>
                    <thead>
                      <tr>
                        <th>{t('entity.col_name', 'Name')}</th>
                        <th>{t('entity.col_type', 'Type')}</th>
                        <th>{t('entity.col_description', 'Description')}</th>
                        <th>{t('entity.col_tags', 'Tags')}</th>
                        <th>{t('entity.col_glossary', 'Glossary')}</th>
                        <th>{t('entity.col_dq', 'DQ')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <tr key={row.key}>
                          <td>
                            <a className={styles.attrNameLink}>{row.name}</a>
                          </td>
                          <td>
                            <span className={styles.typeChip}>{row.type}</span>
                          </td>
                          <td>
                            <p className={styles.descCell}>{row.description}</p>
                            {row.authored_by && (
                              <p className={styles.authorMeta}>
                                {t('entity.authored_by', 'Authored by')}{' '}
                                <a className={styles.inlineLink}>{row.authored_by}</a>
                                {' · '}{row.authored_at}
                              </p>
                            )}
                          </td>
                          <td>
                            {row.tags.length > 0 ? (
                              <div className={styles.tagList}>
                                {row.tags.map((tag) => (
                                  <span key={tag} className={styles.tag}>{tag}</span>
                                ))}
                              </div>
                            ) : (
                              <span className={styles.emptyCell}>—</span>
                            )}
                          </td>
                          <td>
                            {row.glossary.length > 0 ? (
                              <div className={styles.tagList}>
                                {row.glossary.map((g) => (
                                  <span key={g} className={`${styles.tag} ${styles.tagGlossary}`}>
                                    <BookIcon /> {g}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={styles.emptyCell}>—</span>
                            )}
                          </td>
                          <td>
                            {row.dq === 'ok' ? (
                              <span className={styles.dqPass}>Pass</span>
                            ) : row.dq === 'warn' ? (
                              <span className={styles.dqWarn}>Warn</span>
                            ) : (
                              <span className={styles.emptyCell}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Aside / right panel */}
            <aside className={styles.aside}>
              <AsideCard title={t('entity.aside_tags', 'Tags')}>
                <div className={styles.tagList}>
                  {['Engineering', 'Finance', 'HR', 'Marketing', 'Confidential'].map((tag) => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                  <button className={styles.btnTextSm}>+ 4 More</button>
                </div>
              </AsideCard>

              <AsideCard title={t('entity.aside_glossary', 'Glossary Terms')}>
                <div className={styles.tagList}>
                  {['Bank', 'Customer', 'Order', 'Mobile number'].map((g) => (
                    <span key={g} className={`${styles.tag} ${styles.tagGlossary}`}>
                      <BookIcon /> {g}
                    </span>
                  ))}
                  <button className={styles.btnTextSm}>+ 11 More</button>
                </div>
              </AsideCard>

              <AsideCard title={t('entity.aside_custom', 'Custom Properties')}>
                <dl className={styles.customProps}>
                  <div className={styles.customPropRow}>
                    <dt className={styles.customPropLabel}>clsno</dt>
                    <dd><span className={`${styles.tag} ${styles.tagError}`}>Invalid</span></dd>
                  </div>
                  <div className={styles.customPropRow}>
                    <dt className={styles.customPropLabel}>demo</dt>
                    <dd className={styles.emptyCell}>—</dd>
                  </div>
                </dl>
              </AsideCard>
            </aside>
          </div>
        )}

        {activeTab === 'activity' && (
          <PlaceholderSection>
            {t('entity.activity_placeholder', 'Activity feed — CR activity, DQ breaches and pipeline runs for this record.')}
          </PlaceholderSection>
        )}

        {activeTab === 'sources' && (
          <PlaceholderSection>
            {t('entity.sources_placeholder', 'Source trail with per-source value and confidence.')}
          </PlaceholderSection>
        )}

        {activeTab === 'change_requests' && (
          <PlaceholderSection>
            {t('entity.cr_placeholder', 'Change requests opened against this record.')}{' '}
            <Link
              className={styles.inlineLink}
              to={`${ROUTES.CHANGE_REQUEST_NEW}?entityType=${entityType}&id=${id}`}>
              {t('entity.cr_new', 'New request →')}
            </Link>
          </PlaceholderSection>
        )}

        {activeTab === 'observability' && (
          <PlaceholderSection>
            {t('entity.observability_placeholder', 'Freshness, completeness and validity scorecards over time.')}
          </PlaceholderSection>
        )}

        {activeTab === 'lineage' && (
          <PlaceholderSection>
            <Link className={styles.inlineLink} to={path(ROUTES.ENTITY_LINEAGE)}>
              {t('entity.lineage_open', 'Open full lineage →')}
            </Link>
          </PlaceholderSection>
        )}

      </div>

      {/* Hidden — satisfies ts-noUnusedLocals */}
      <span style={{ display: 'none' }}>{t('nav.home')}</span>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Facet({
  label,
  value,
  highlight,
  positive,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
}) {
  return (
    <div className={styles.facet}>
      <span className={styles.facetLabel}>{label}</span>
      <span
        className={`${styles.facetValue} ${highlight ? styles.facetHighlight : ''} ${positive ? styles.facetPositive : ''}`}>
        {value}
      </span>
    </div>
  );
}

function AsideCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.asideCard}>
      <div className={styles.asideCardHeader}>
        <strong className={styles.asideCardTitle}>{title}</strong>
        <button className={styles.btnIcon} aria-label="Edit">
          <EditIcon />
        </button>
      </div>
      <div className={styles.asideCardBody}>{children}</div>
    </div>
  );
}

function PlaceholderSection({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.placeholder}>
      <p className={styles.placeholderText}>{children}</p>
    </div>
  );
}
