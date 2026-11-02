import classNames from 'classnames';
import { Link, useLocation, matchPath } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tooltip } from 'antd';
import {
  HomeOutlined,
  CompassOutlined,
  DatabaseOutlined,
  SwapOutlined,
  ApiOutlined,
  SafetyCertificateOutlined,
  BranchesOutlined,
  BellOutlined,
  LinkOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { ROUTES } from '@/constants/routes';
import { useApplicationStore } from '@/hooks/useApplicationStore';
import type { ReactNode } from 'react';
import styles from './Sidebar.module.css';

/**
 * Sidebar — direct port of OpenMetadata's
 * MyData/LeftSidebar/LeftSidebar.component.tsx, same HTML shape:
 *
 *   <aside class="app-sidebar sidebar-collapsed | sidebar-open">
 *     <div class="logo-container">
 *       <Link>{brand monogram or full}</Link>
 *     </div>
 *     <div class="left-sidebar-layout">
 *       <div class="menu-container">
 *         <nav class="top-menu">
 *           <ul class="left-sidebar-menu">
 *             <li>NavItem…</li>
 *           </ul>
 *         </nav>
 *         <nav class="bottom-menu">
 *           <ul>
 *             <li>Settings</li>
 *             <li>Logout</li>
 *           </ul>
 *         </nav>
 *       </div>
 *     </div>
 *   </aside>
 *
 * Collapsed width 72 px, expanded 228 px. Logo 40 px tall at the top.
 * Settings + Logout always pinned to the bottom. All visual styling
 * comes from the ported OpenMetadata token system + the local
 * Sidebar.module.css that replicates app-sidebar + left-sidebar-layout +
 * NavItemBase from OpenMetadata's custom components library.
 */

interface NavEntry {
  key: string;
  title: string;
  icon: ReactNode;
  to: string;
  matchPrefixes?: string[];
}

const TOP_ITEMS: NavEntry[] = [
  { key: 'home', title: 'nav.home', icon: <HomeOutlined />, to: ROUTES.HOME },
  {
    key: 'explore',
    title: 'nav.explore',
    icon: <CompassOutlined />,
    to: ROUTES.EXPLORE,
    matchPrefixes: ['/search', '/query', '/views'],
  },
  {
    key: 'entities',
    title: 'nav.entities',
    icon: <DatabaseOutlined />,
    to: '/entity/customer',
    matchPrefixes: ['/entity'],
  },
  {
    key: 'change-requests',
    title: 'nav.change_requests',
    icon: <SwapOutlined />,
    to: ROUTES.CHANGE_REQUESTS,
  },
  {
    key: 'pipelines',
    title: 'nav.pipelines',
    icon: <ApiOutlined />,
    to: ROUTES.PIPELINES,
    matchPrefixes: ['/pipelines', '/sources'],
  },
  {
    key: 'quality',
    title: 'nav.quality',
    icon: <SafetyCertificateOutlined />,
    to: ROUTES.QUALITY,
  },
  {
    key: 'workflows',
    title: 'nav.workflows',
    icon: <BranchesOutlined />,
    to: ROUTES.WORKFLOWS,
  },
  {
    key: 'alerts',
    title: 'nav.alerts',
    icon: <BellOutlined />,
    to: ROUTES.ALERTS,
  },
  {
    key: 'integrations',
    title: 'nav.integrations',
    icon: <LinkOutlined />,
    to: ROUTES.INTEGRATIONS,
  },
];

const BOTTOM_ITEMS: NavEntry[] = [
  {
    key: 'settings',
    title: 'nav.settings',
    icon: <SettingOutlined />,
    to: ROUTES.SETTINGS,
    matchPrefixes: ['/settings'],
  },
];

export default function Sidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { signOut } = useApplicationStore();

  const isCurrent = (item: NavEntry) => {
    if (
      matchPath({ path: item.to, end: false, caseSensitive: false }, location.pathname)
    )
      return true;
    return (
      item.matchPrefixes?.some((p) => location.pathname.startsWith(p)) ?? false
    );
  };

  return (
    <aside
      dir={i18n.dir()}
      data-testid="left-sidebar"
      className={classNames('app-sidebar', styles.aside, {
        'sidebar-collapsed': collapsed,
        'sidebar-open': !collapsed,
        [styles.collapsed]: collapsed,
        [styles.expanded]: !collapsed,
      })}>
      {/* Logo container — monogram when collapsed, wordmark when expanded */}
      <div className={classNames('logo-container', styles.logoContainer)}>
        <Link to={ROUTES.HOME} className={styles.logoLink} aria-label="Repo.io">
          <RepoioMark />
          {!collapsed && (
            <span className={styles.wordmark}>Repo.io</span>
          )}
        </Link>
      </div>

      <div className={classNames('left-sidebar-layout', styles.layout)}>
        <div className={classNames('menu-container', styles.menu)}>
          <nav aria-label={t('nav.home')} className={classNames('top-menu', styles.topMenu)}>
            <ul className={classNames('left-sidebar-menu', styles.list)}>
              {TOP_ITEMS.map((item) => (
                <li key={item.key} data-testid={`side-bar-${item.key}`}>
                  <NavItem
                    item={item}
                    current={isCurrent(item)}
                    collapsed={collapsed}
                    label={t(item.title)}
                  />
                </li>
              ))}
            </ul>
          </nav>

          <nav
            aria-label={t('nav.settings')}
            className={classNames('bottom-menu', styles.bottomMenu)}>
            <div className={styles.divider} />
            <ul className={styles.list}>
              {BOTTOM_ITEMS.map((item) => (
                <li key={item.key} data-testid={`side-bar-${item.key}`}>
                  <NavItem
                    item={item}
                    current={isCurrent(item)}
                    collapsed={collapsed}
                    label={t(item.title)}
                  />
                </li>
              ))}
              <li data-testid="side-bar-logout">
                <button
                  type="button"
                  onClick={signOut}
                  className={classNames(styles.navItem, styles.logoutBtn)}>
                  <span className={styles.navIcon}>
                    <LogoutOutlined />
                  </span>
                  {!collapsed && (
                    <span className={styles.navLabel}>
                      {t('user.sign_out')}
                    </span>
                  )}
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Collapse toggle (bottom-right corner, OM-style) */}
      <button
        type="button"
        aria-label="Toggle sidebar"
        onClick={onToggleCollapse}
        className={styles.collapseToggle}>
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </button>
    </aside>
  );
}

function NavItem({
  item,
  current,
  collapsed,
  label,
}: {
  item: NavEntry;
  current: boolean;
  collapsed: boolean;
  label: string;
}) {
  const inner = (
    <Link
      to={item.to}
      className={classNames(styles.navItem, { [styles.navItemCurrent]: current })}>
      <span className={styles.navIcon}>{item.icon}</span>
      {!collapsed && <span className={styles.navLabel}>{label}</span>}
    </Link>
  );
  return collapsed ? (
    <Tooltip title={label} placement="right">
      {inner}
    </Tooltip>
  ) : (
    inner
  );
}

function RepoioMark() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true">
      <rect width="36" height="36" rx="8" fill="url(#rmark-g)" />
      <path
        d="M12 10h8a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5h-3l5 6h-4l-5-6v6h-3V10zm3 3v6h5a2.5 2.5 0 0 0 0-5h-5z"
        fill="white"
      />
      <defs>
        <linearGradient id="rmark-g" x1="0" y1="0" x2="36" y2="36">
          <stop stopColor="#1570EF" />
          <stop offset="1" stopColor="#6938EF" />
        </linearGradient>
      </defs>
    </svg>
  );
}
