import { Menu, Tooltip } from 'antd';
import {
  HomeOutlined,
  CompassOutlined,
  DatabaseOutlined,
  SwapOutlined,
  ApiOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';
import styles from './Sidebar.module.css';

/**
 * Sidebar — 84px dark icon rail with Repo.io logo at top and the
 * primary nav as tooltip-labelled icons. Mirrors OpenMetadata's
 * left rail; sub-nav opens inside the page, not here.
 */
export default function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();

  const navItems = [
    { key: ROUTES.HOME, icon: <HomeOutlined />, label: t('nav.home') },
    { key: ROUTES.EXPLORE, icon: <CompassOutlined />, label: t('nav.explore') },
    {
      key: '/entity/customer',
      icon: <DatabaseOutlined />,
      label: t('nav.entities'),
    },
    {
      key: ROUTES.CHANGE_REQUESTS,
      icon: <SwapOutlined />,
      label: t('nav.change_requests'),
    },
    { key: ROUTES.PIPELINES, icon: <ApiOutlined />, label: t('nav.pipelines') },
    {
      key: ROUTES.SETTINGS,
      icon: <SettingOutlined />,
      label: t('nav.settings'),
    },
  ];

  const activeKey =
    navItems.find((it) => location.pathname.startsWith(it.key.split(':')[0] || it.key))
      ?.key || ROUTES.HOME;

  return (
    <div className={styles.sidebar}>
      <Link to={ROUTES.HOME} className={styles.brand} aria-label="Repo.io home">
        <RepoioMark />
      </Link>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[activeKey]}
        className={styles.menu}
        items={navItems.map((it) => ({
          key: it.key,
          icon: (
            <Tooltip title={it.label} placement="right">
              <span className={styles.iconWrap}>{it.icon}</span>
            </Tooltip>
          ),
          label: <Link to={it.key}>{it.label}</Link>,
        }))}
      />
    </div>
  );
}

function RepoioMark() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true">
      <rect width="36" height="36" rx="8" fill="url(#repoio-grad)" />
      <path
        d="M12 10h8a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5h-3l5 6h-4l-5-6v6h-3V10zm3 3v6h5a2.5 2.5 0 0 0 0-5h-5z"
        fill="white"
      />
      <defs>
        <linearGradient id="repoio-grad" x1="0" y1="0" x2="36" y2="36">
          <stop stopColor="#1570EF" />
          <stop offset="1" stopColor="#6938EF" />
        </linearGradient>
      </defs>
    </svg>
  );
}
