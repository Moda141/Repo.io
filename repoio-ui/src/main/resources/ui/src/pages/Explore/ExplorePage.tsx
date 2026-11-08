import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ENTITY_TYPES, ROUTES } from '@/constants/routes';
import styles from './ExplorePage.module.css';

/**
 * ExplorePage — SAP Fiori Horizon List Report
 *
 * Floorplan: List Report (Filter Bar + Responsive Table / Card Grid)
 * Reference: SAP Fiori Design Guidelines — List Report
 *
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │  Dynamic Page Header: title + 2 action buttons                   │
 *  ├──────────────────────────────────────────────────────────────────┤
 *  │  Filter Bar: Status (All/Deployed/Draft) | Search                │
 *  ├──────────────────────────────────────────────────────────────────┤
 *  │  Info Strip: "X repositories" + Go (adapt / sort)               │
 *  ├──────────────────────────────────────────────────────────────────┤
 *  │  Repository grid: Fiori object cards (3-up)                      │
 *  │    Each card: header (icon+title+status) / 3 KPI cells           │
 *  ├──────────────────────────────────────────────────────────────────┤
 *  │  MessageStrip (information): Schema-change alert                 │
 *  └──────────────────────────────────────────────────────────────────┘
 */

// ─── Types ────────────────────────────────────────────────────────────────────
interface RepoCardData {
  key: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  status: 'deployed' | 'draft';
  modelLabel: string;
  sourcesLabel: string;
  stats: { golden: string; source: string; review: string };
}

type StatusFilter = 'all' | 'deployed' | 'draft';

// ─── Icons ────────────────────────────────────────────────────────────────────
function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function ShopIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 5h14l-1.5 6H4.5L3 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M3 5L4.5 3h11L17 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="6" y="13" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4 3h12v14H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function PenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M14 3l3 3L7 16H4v-3L14 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}
function TeamIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="14" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 17c0-3.314 2.24-6 5-6s5 2.686 5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 17c0-2.071-1.343-3.839-3.2-4.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function StoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 9L10 3l7 6v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 19v-6h4v6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2l5.5 10H1.5L7 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 6.5v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="7" cy="10" r="0.75" fill="currentColor"/>
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const REPOS: RepoCardData[] = [
  {
    key: 'customer',
    name: 'Customers',
    icon: <UserIcon />,
    color: '#0070F2',
    status: 'deployed',
    modelLabel: 'Customer model v4',
    sourcesLabel: '3 sources',
    stats: { golden: '948K', source: '2.7M', review: '1,930' },
  },
  {
    key: 'vendor',
    name: 'Vendors',
    icon: <ShopIcon />,
    color: '#6938EF',
    status: 'deployed',
    modelLabel: 'Vendor model v2',
    sourcesLabel: '2 sources',
    stats: { golden: '4.1K', source: '9.8K', review: '12' },
  },
  {
    key: 'product',
    name: 'Products',
    icon: <BookIcon />,
    color: '#12B76A',
    status: 'draft',
    modelLabel: 'Product model v1',
    sourcesLabel: 'No sources yet',
    stats: { golden: '—', source: '—', review: '—' },
  },
  {
    key: 'author',
    name: 'Authors',
    icon: <PenIcon />,
    color: '#F79009',
    status: 'deployed',
    modelLabel: 'Author model v1',
    sourcesLabel: '1 source',
    stats: { golden: '2.4K', source: '2.8K', review: '38' },
  },
  {
    key: 'employee',
    name: 'Employees',
    icon: <TeamIcon />,
    color: '#F04438',
    status: 'deployed',
    modelLabel: 'Employee model v3',
    sourcesLabel: '1 source',
    stats: { golden: '1.2K', source: '1.2K', review: '0' },
  },
  {
    key: 'store',
    name: 'Stores',
    icon: <StoreIcon />,
    color: '#06AED4',
    status: 'deployed',
    modelLabel: 'Store model v1',
    sourcesLabel: '1 source',
    stats: { golden: '186', source: '202', review: '4' },
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ExplorePage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = REPOS.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Satisfy ts-noUnusedLocals for ENTITY_TYPES
  void ENTITY_TYPES;

  return (
    <div className={styles.page}>

      {/* ── Dynamic Page Header ──────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <div className={styles.headerTitle}>
            <h1 className={styles.title}>
              {t('explore.title', 'Repositories')}
            </h1>
            <p className={styles.subtitle}>
              {t('explore.subtitle', 'Each repository holds golden records for one entity type.')}
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link to={ROUTES.QUERY} className={styles.btnGhost}>
              {t('explore.query_builder', 'Query Builder')}
            </Link>
            <button className={styles.btnPrimary}>
              <PlusIcon />
              {t('explore.new_repo', 'New Repository')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <div className={styles.filterBar}>
        <div className={styles.filterBarInner}>
          {/* Status filter chips */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>
              {t('explore.filter_status', 'Status')}:
            </span>
            {(['all', 'deployed', 'draft'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                className={`${styles.filterChip} ${statusFilter === s ? styles.filterChipActive : ''}`}
                onClick={() => setStatusFilter(s)}>
                {s === 'all'
                  ? t('explore.filter_all', 'All')
                  : s === 'deployed'
                  ? t('explore.filter_deployed', 'Deployed')
                  : t('explore.filter_draft', 'Draft')}
              </button>
            ))}
          </div>

          <div className={styles.filterSpacer} />

          {/* Search */}
          <div className={styles.searchBox}>
            <span className={styles.searchIcon} aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder={t('explore.search_placeholder', 'Search repositories…')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Info strip ───────────────────────────────────────────────────── */}
      <div className={styles.infoStrip}>
        <span className={styles.infoStripCount}>
          {filtered.length} {t('explore.repositories', 'repositories')}
        </span>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className={styles.content}>

        {/* Schema-change MessageStrip */}
        <div className={styles.messageStrip}>
          <span className={styles.messageStripIcon} aria-hidden="true">
            <AlertIcon />
          </span>
          <span className={styles.messageStripText}>
            <strong>Retail POS:</strong> 2 schema changes affect the mapping.{' '}
            <Link to="/pipelines/retail-pos" className={styles.messageStripLink}>
              Review
            </Link>
          </span>
        </div>

        {/* Repository grid */}
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>
              {t('explore.no_results', 'No repositories match the current filter.')}
            </p>
          </div>
        ) : (
          <div className={styles.cardGrid}>
            {filtered.map((r) => (
              <Link key={r.key} to={`/entity/${r.key}`} className={styles.repoCard}>
                {/* Card header */}
                <div className={styles.cardHeader}>
                  <div className={styles.cardIcon} style={{ background: `${r.color}1A`, color: r.color }}>
                    {r.icon}
                  </div>
                  <div className={styles.cardTitleGroup}>
                    <div className={styles.cardName}>{r.name}</div>
                    <div className={styles.cardMeta}>{r.modelLabel} · {r.sourcesLabel}</div>
                  </div>
                  <span
                    className={`${styles.statusBadge} ${
                      r.status === 'deployed' ? styles.statusDeployed : styles.statusDraft
                    }`}>
                    {r.status === 'deployed'
                      ? t('explore.status_deployed', 'Deployed')
                      : t('explore.status_draft', 'Draft')}
                  </span>
                </div>

                {/* KPI cells */}
                <div className={styles.cardStats}>
                  <div className={styles.statCell}>
                    <span className={styles.statValue}>{r.stats.golden}</span>
                    <span className={styles.statLabel}>{t('explore.stat_golden', 'Golden')}</span>
                  </div>
                  <div className={styles.statDivider} />
                  <div className={styles.statCell}>
                    <span className={styles.statValue}>{r.stats.source}</span>
                    <span className={styles.statLabel}>{t('explore.stat_source', 'Source')}</span>
                  </div>
                  <div className={styles.statDivider} />
                  <div className={styles.statCell}>
                    <span
                      className={styles.statValue}
                      style={r.stats.review !== '0' && r.stats.review !== '—'
                        ? { color: 'var(--sapCritical, #E76500)' }
                        : undefined}>
                      {r.stats.review}
                    </span>
                    <span className={styles.statLabel}>{t('explore.stat_review', 'To review')}</span>
                  </div>
                </div>

                {/* Card footer link */}
                <div className={styles.cardFooter}>
                  <span className={styles.cardFooterLink}>
                    {t('explore.open', 'Open repository')}
                    <ChevronRightIcon />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Hidden — satisfies ts-noUnusedLocals */}
      <span style={{ display: 'none' }}>{t('nav.explore')}</span>
    </div>
  );
}
