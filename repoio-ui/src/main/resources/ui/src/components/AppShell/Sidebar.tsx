import {
  HomeOutlined,
  CompassOutlined,
  DatabaseOutlined,
  SwapOutlined,
  ApiOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';
import styles from './Sidebar.module.css';
import clsx from 'classnames';
import type { ReactNode } from 'react';

/**
 * Sidebar — 84 px icon rail with Repo.io brand mark, 6 primary nav
 * items, blue active pill on the inside edge (OpenMetadata signature).
 * Pure CSS; no Antd Menu — so hover + active states match exactly.
 */

interface NavItem {
  key: string;
  to: string;
  icon: ReactNode;
  label: string;
  match: string; // prefix used to decide active
}

export default function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();

  const items: NavItem[] = [
    { key: 'home', to: ROUTES.HOME, icon: <HomeOutlined />, label: t('nav.home'), match: ROUTES.HOME },
    { key: 'explore', to: ROUTES.EXPLORE, icon: <CompassOutlined />, label: t('nav.explore'), match: ROUTES.EXPLORE },
    { key: 'entities', to: '/entity/customer', icon: <DatabaseOutlined />, label: t('nav.entities'), match: '/entity' },
    { key: 'cr', to: ROUTES.CHANGE_REQUESTS, icon: <SwapOutlined />, label: t('nav.change_requests'), match: '/change-requests' },
    { key: 'pipe', to: ROUTES.PIPELINES, icon: <ApiOutlined />, label: t('nav.pipelines'), match: '/pipelines' },
    { key: 'quality', to: ROUTES.QUALITY, icon: <SafetyCertificateOutlined />, label: t('nav.quality'), match: '/quality' },
    { key: 'settings', to: ROUTES.SETTINGS, icon: <SettingOutlined />, label: t('nav.settings'), match: '/settings' },
  ];

  const isActive = (item: NavItem) =>
    location.pathname === item.match || location.pathname.startsWith(item.match + '/');

  return (
    <div className={styles.sidebar}>
      <Link to={ROUTES.HOME} className={styles.brand} aria-label="Repo.io home">
        <RepoioMark />
      </Link>

      <nav className={styles.nav}>
        {items.map((it) => (
          <Link
            key={it.key}
            to={it.to}
            className={clsx(styles.item, { [styles.active]: isActive(it) })}
            aria-label={it.label}>
            {it.icon}
            <span className={styles.label}>{it.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function RepoioMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="10" fill="url(#rm)" />
      <path
        d="M12 10h8a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5h-3l5 6h-4l-5-6v6h-3V10zm3 3v6h5a2.5 2.5 0 0 0 0-5h-5z"
        fill="white"
      />
      <defs>
        <linearGradient id="rm" x1="0" y1="0" x2="36" y2="36">
          <stop stopColor="#1570EF" />
          <stop offset="1" stopColor="#6938EF" />
        </linearGradient>
      </defs>
    </svg>
  );
}
