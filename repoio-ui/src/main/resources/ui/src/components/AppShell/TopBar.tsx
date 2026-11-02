import { Input, Space, Avatar, Dropdown, Button, Badge } from 'antd';
import {
  SearchOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  GlobalOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ROUTES } from '@/constants/routes';
import { useApplicationStore } from '@/hooks/useApplicationStore';
import styles from './TopBar.module.css';

/**
 * TopBar — global search + language toggle + help + notifications + user menu.
 * The user menu is a placeholder until AuthProvider wires Entra ID.
 */
export default function TopBar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useApplicationStore();
  const [q, setQ] = useState('');
  const isAr = i18n.language.toLowerCase().startsWith('ar');
  const unread = 3;

  const toggleLang = () => i18n.changeLanguage(isAr ? 'en-US' : 'ar-EG');
  const submitSearch = () => {
    const t = q.trim();
    navigate(t ? `${ROUTES.SEARCH}?q=${encodeURIComponent(t)}` : ROUTES.SEARCH);
  };

  const avatarLetter =
    (user?.name || user?.email || 'M')[0]?.toUpperCase() ?? 'M';
  const signOutAction = () => {
    signOut();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className={styles.topBar}>
      <div className={styles.searchWrap}>
        <Input
          size="middle"
          allowClear
          prefix={<SearchOutlined className={styles.searchIcon} />}
          placeholder={t('search.placeholder')}
          className={styles.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onPressEnter={submitSearch}
        />
      </div>

      <Space size="small" className={styles.right}>
        <Button
          type="text"
          icon={<GlobalOutlined />}
          onClick={toggleLang}
          aria-label={t('actions.toggle_language')}>
          {isAr ? 'EN' : 'ع'}
        </Button>

        <Button
          type="text"
          icon={<QuestionCircleOutlined />}
          aria-label={t('actions.help')}
        />

        <Badge count={unread} size="small" offset={[-2, 2]}>
          <Button
            type="text"
            icon={<BellOutlined />}
            aria-label={t('actions.notifications')}
            onClick={() => navigate(ROUTES.NOTIFICATIONS)}
          />
        </Badge>

        <Dropdown
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
          <Avatar
            style={{ cursor: 'pointer', background: '#1570EF' }}
            size={32}>
            {avatarLetter}
          </Avatar>
        </Dropdown>
      </Space>
    </div>
  );
}
