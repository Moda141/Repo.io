import { Input, Avatar, Dropdown, Badge, Button } from 'antd';
import {
  SearchOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  LogoutOutlined,
  AppstoreOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { ROUTES } from '@/constants/routes';
import { useApplicationStore } from '@/hooks/useApplicationStore';
import styles from './TopBar.module.css';

/**
 * TopBar — OpenMetadata-style navbar:
 * breadcrumb on the left, centered search, action icons on the right,
 * user avatar at the far end. Pure CSS, 40 px icon buttons, 32 px avatar.
 */
export default function TopBar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useApplicationStore();
  const [q, setQ] = useState('');
  const isAr = i18n.language.toLowerCase().startsWith('ar');
  const unread = 3;

  const toggleLang = () => i18n.changeLanguage(isAr ? 'en-US' : 'ar-EG');
  const submitSearch = () => {
    const value = q.trim();
    navigate(value ? `${ROUTES.SEARCH}?q=${encodeURIComponent(value)}` : ROUTES.SEARCH);
  };

  const avatarLetter =
    (user?.name || user?.email || 'M')[0]?.toUpperCase() ?? 'M';
  const signOutAction = () => {
    signOut();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className={styles.topBar}>
      <div className={styles.breadcrumb}>
        <Crumbs path={location.pathname} />
      </div>

      <div className={styles.searchWrap}>
        <Input
          size="middle"
          allowClear
          prefix={<SearchOutlined style={{ color: 'var(--repoio-grey-400)' }} />}
          placeholder={t('search.placeholder')}
          className={styles.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onPressEnter={submitSearch}
        />
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={styles.langPill}
          onClick={toggleLang}
          aria-label={t('actions.toggle_language')}>
          {isAr ? 'EN' : 'ع'}
        </button>

        <Link to={ROUTES.INTEGRATIONS_API}>
          <Button
            type="text"
            className={styles.iconBtn}
            icon={<BookOutlined />}
            aria-label="API reference"
          />
        </Link>

        <Button
          type="text"
          className={styles.iconBtn}
          icon={<AppstoreOutlined />}
          aria-label="Apps"
        />

        <Button
          type="text"
          className={styles.iconBtn}
          icon={<QuestionCircleOutlined />}
          aria-label={t('actions.help')}
        />

        <Badge count={unread} size="small" offset={[-6, 6]}>
          <Button
            type="text"
            className={styles.iconBtn}
            icon={<BellOutlined />}
            aria-label={t('actions.notifications')}
            onClick={() => navigate(ROUTES.NOTIFICATIONS)}
          />
        </Badge>

        <Dropdown
          placement="bottomRight"
          menu={{
            items: [
              {
                key: 'profile',
                icon: <UserOutlined />,
                label: t('user.profile'),
                onClick: () => navigate(ROUTES.PROFILE),
              },
              {
                key: 'notifications',
                icon: <BellOutlined />,
                label: t('actions.notifications'),
                onClick: () => navigate(ROUTES.NOTIFICATIONS),
              },
              { type: 'divider' },
              {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: t('user.sign_out'),
                danger: true,
                onClick: signOutAction,
              },
            ],
          }}
          trigger={['click']}>
          <span className={styles.avatarWrap}>
            <Avatar
              size={36}
              style={{
                background:
                  'linear-gradient(135deg, #1570EF 0%, #6938EF 100%)',
                color: '#ffffff',
                fontWeight: 600,
              }}>
              {avatarLetter}
            </Avatar>
          </span>
        </Dropdown>
      </div>
    </div>
  );
}

const SEGMENT_LABEL: Record<string, string> = {
  home: 'Home',
  explore: 'Explore',
  entity: 'Entity',
  'change-requests': 'Change requests',
  pipelines: 'Pipelines',
  sources: 'Sources',
  quality: 'Quality',
  workflows: 'Workflows',
  alerts: 'Alerts',
  integrations: 'Integrations',
  settings: 'Settings',
  profile: 'Profile',
  notifications: 'Notifications',
  search: 'Search',
  query: 'Query',
  views: 'Views',
  export: 'Export',
};

function Crumbs({ path }: { path: string }): ReactNode {
  const segments = path.split('/').filter(Boolean).slice(0, 3);
  if (segments.length === 0) return <span>Home</span>;
  const nodes: ReactNode[] = [];
  segments.forEach((seg, i) => {
    const label = SEGMENT_LABEL[seg] ?? seg;
    nodes.push(
      <span key={`s-${i}`} style={{ color: i === segments.length - 1 ? 'var(--repoio-grey-900)' : undefined }}>
        {label}
      </span>
    );
    if (i < segments.length - 1) nodes.push(<span key={`sep-${i}`}>/</span>);
  });
  return <>{nodes}</>;
}
