import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';
import styles from './HomePage.module.css';

/**
 * HomePage — SAP Fiori Horizon Launchpad + Overview Page
 *
 * Layout follows Fiori Launchpad (node 53:7535) + Overview Page (node 53:7538):
 *
 *  ┌──────────────────────────────────────────────────────┐
 *  │  Dynamic Page Header                                  │
 *  │    Greeting   |   4 KPI metrics                       │
 *  ├──────────────────────────────────────────────────────┤
 *  │  Tile Group: Repositories (6 tiles)                   │
 *  ├──────────────────────────────────────────────────────┤
 *  │  Tile Group: Tools (4 tiles)                          │
 *  ├──────────────────────────────────────────────────────┤
 *  │  Recent Activity table                                │
 *  └──────────────────────────────────────────────────────┘
 */

// ─── Icons ────────────────────────────────────────────────────────────────────
function UserIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="10" r="5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 24c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function ShopIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M4 7h20l-2 8H6L4 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M4 7L6 4h16l2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="8" y="18" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
function BookIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M6 4h16v20H6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 9h8M10 13h8M10 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function PenIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M19 4l5 5-13 13H6v-5L19 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}
function TeamIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="20" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 23c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M22 23c0-2.761-2.239-5-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function HomeIcon2() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M4 12L14 4l10 8v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V12Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M11 25v-8h6v8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}
function PipelineIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="5" cy="14" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="14" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="14" cy="21" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="23" cy="14" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 14h3M17 7l3 5M17 21l3-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M14 3l3.09 6.26L24 10.27l-5 4.87 1.18 6.88L14 18.77l-6.18 3.25L9 15.14 4 10.27l6.91-1.01L14 3Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M17.5 17.5L24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M10 8h14M10 14h14M10 20h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="5" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="5" cy="14" r="1.5" fill="currentColor"/>
      <circle cx="5" cy="20" r="1.5" fill="currentColor"/>
    </svg>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const kpis = [
  { label: 'Golden Records', value: '953K', delta: '+2.1%', positive: true, color: '#0070F2' },
  { label: 'Source Records', value: '2.71M', delta: '+0.8%', positive: true, color: '#188918' },
  { label: 'Pending Review', value: '1,984', delta: '-12%', positive: true, color: '#E76500' },
  { label: 'Active Repos', value: '5 / 6', delta: '', positive: true, color: '#354A5E' },
];

const repoTiles = [
  { key: 'customer', label: 'Customers', subtitle: '948K golden records', icon: <UserIcon />, color: '#0070F2', to: '/entity/customer' },
  { key: 'vendor', label: 'Vendors', subtitle: '4.1K golden records', icon: <ShopIcon />, color: '#6938EF', to: '/entity/vendor' },
  { key: 'product', label: 'Products', subtitle: 'Draft — no records', icon: <BookIcon />, color: '#12B76A', to: '/entity/product' },
  { key: 'author', label: 'Authors', subtitle: '2.4K golden records', icon: <PenIcon />, color: '#F79009', to: '/entity/author' },
  { key: 'employee', label: 'Employees', subtitle: '1.2K golden records', icon: <TeamIcon />, color: '#F04438', to: '/entity/employee' },
  { key: 'store', label: 'Stores', subtitle: '186 golden records', icon: <HomeIcon2 />, color: '#06AED4', to: '/entity/store' },
];

const toolTiles = [
  { key: 'pipelines', label: 'Pipelines', subtitle: 'Manage data loads', icon: <PipelineIcon />, color: '#354A5E', to: '/pipelines' },
  { key: 'quality', label: 'Data Quality', subtitle: 'Monitor rules', icon: <StarIcon />, color: '#188918', to: '/quality' },
  { key: 'query', label: 'Query Builder', subtitle: 'Ad-hoc analysis', icon: <SearchIcon />, color: '#0070F2', to: ROUTES.QUERY },
  { key: 'views', label: 'Saved Views', subtitle: 'Shared queries', icon: <ListIcon />, color: '#6938EF', to: ROUTES.VIEWS },
];

const recentActivity = [
  { id: 'a1', event: 'Incremental load #2041', repo: 'Customers', source: 'Retail POS', result: '409 upserted · 3 quarantined', status: 'success' as const, when: 'Today, 09:14' },
  { id: 'a2', event: 'Full load #2033', repo: 'Customers', source: 'Pharma ERP', result: '1.2M processed', status: 'success' as const, when: 'Yesterday' },
  { id: 'a3', event: 'Load #2029', repo: 'Customers', source: 'Legacy CRM', result: 'Connection failed', status: 'error' as const, when: '2 days ago' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { t } = useTranslation();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('home.good_morning', 'Good morning');
    if (h < 17) return t('home.good_afternoon', 'Good afternoon');
    return t('home.good_evening', 'Good evening');
  })();

  return (
    <div className={styles.page}>

      {/* ── Dynamic Page Header ─────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <div className={styles.greetingGroup}>
            <h1 className={styles.greeting}>{greeting}, Mohamed</h1>
            <p className={styles.greetingSubtitle}>
              {t('home.subtitle', "Here's your master data overview")}
            </p>
          </div>
          <div className={styles.kpiRow}>
            {kpis.map((kpi) => (
              <div key={kpi.label} className={styles.kpiItem}>
                <div className={styles.kpiValue} style={{ color: kpi.color }}>
                  {kpi.value}
                </div>
                <div className={styles.kpiLabel}>{kpi.label}</div>
                {kpi.delta && (
                  <div className={`${styles.kpiDelta} ${kpi.positive ? styles.kpiDeltaPos : styles.kpiDeltaNeg}`}>
                    {kpi.delta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className={styles.content}>

        {/* Tile Group: Repositories */}
        <section className={styles.tileGroup}>
          <div className={styles.tileGroupHeader}>
            <h2 className={styles.tileGroupTitle}>
              {t('home.group_repositories', 'Repositories')}
            </h2>
            <Link to={ROUTES.EXPLORE} className={styles.tileGroupLink}>
              {t('home.view_all', 'View all')}
            </Link>
          </div>
          <div className={styles.tileGrid}>
            {repoTiles.map((tile) => (
              <Link key={tile.key} to={tile.to} className={styles.tile}>
                <div className={styles.tileIcon} style={{ background: `${tile.color}1A`, color: tile.color }}>
                  {tile.icon}
                </div>
                <div className={styles.tileBody}>
                  <div className={styles.tileTitle}>{tile.label}</div>
                  <div className={styles.tileSubtitle}>{tile.subtitle}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Tile Group: Tools */}
        <section className={styles.tileGroup}>
          <div className={styles.tileGroupHeader}>
            <h2 className={styles.tileGroupTitle}>
              {t('home.group_tools', 'Tools')}
            </h2>
          </div>
          <div className={styles.tileGrid}>
            {toolTiles.map((tile) => (
              <Link key={tile.key} to={tile.to} className={styles.tile}>
                <div className={styles.tileIcon} style={{ background: `${tile.color}1A`, color: tile.color }}>
                  {tile.icon}
                </div>
                <div className={styles.tileBody}>
                  <div className={styles.tileTitle}>{tile.label}</div>
                  <div className={styles.tileSubtitle}>{tile.subtitle}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {t('home.recent_activity', 'Recent Activity')}
            </h2>
          </div>
          <div className={styles.activityCard}>
            <table className={styles.activityTable}>
              <thead>
                <tr>
                  <th>{t('activity.event', 'Event')}</th>
                  <th>{t('activity.repo', 'Repository')}</th>
                  <th>{t('activity.source', 'Source')}</th>
                  <th>{t('activity.result', 'Result')}</th>
                  <th>{t('activity.when', 'When')}</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <a href="#" className={styles.activityLink}>{a.event}</a>
                    </td>
                    <td>{a.repo}</td>
                    <td>{a.source}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`badge_${a.status}`]}`}>
                        {a.result}
                      </span>
                    </td>
                    <td className={styles.activityWhen}>{a.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {/* Hidden — satisfies ts-noUnusedLocals */}
      <span style={{ display: 'none' }}>{t('nav.home')}</span>
    </div>
  );
}
