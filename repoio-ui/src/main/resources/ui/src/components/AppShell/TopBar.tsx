import { Input, Avatar, Dropdown, Button, Badge, Tooltip, Space } from 'antd';
import {
  SearchOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  GlobalOutlined,
  UserOutlined,
  LogoutOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import classNames from 'classnames';
import { ROUTES } from '@/constants/routes';
import { useApplicationStore } from '@/hooks/useApplicationStore';
import styles from './TopBar.module.css';

/**
 * TopBar — direct port of OpenMetadata's NavBar structure, same classes:
 *
 *   <div class="navbar-container">
 *     <div class="search-container">    (35vw wide)
 *       <GlobalSearchBar />
 *     </div>
 *     <div>
 *       <help /> <bell /> <lang /> <user profile icon />
 *     </div>
 *   </div>
 *
 * Rows are 40 px tall (per nav-bar.less `> div { height: 40px }`).
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
    const text = q.trim();
    navigate(text ? `${ROUTES.SEARCH}?q=${encodeURIComponent(text)}` : ROUTES.SEARCH);
  };

  const name = user?.name || 'Mohamed Mahmoud';
  const email = user?.email || 'mohamed@nahdetmisr.com';
  const avatarLetter = (name || email)[0]?.toUpperCase() ?? 'M';

  const signOutAction = () => {
    signOut();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className={classNames('navbar-container', styles.navbar)}>
      {/* Search — 35vw per OM's .search-container */}
      <div className={classNames('search-container', styles.search)}>
        <Input
          size="middle"
          allowClear
          prefix={<SearchOutlined style={{ color: '#98a2b3' }} />}
          placeholder={t('search.placeholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onPressEnter={submitSearch}
          className={styles.searchInput}
        />
      </div>

      {/* Right cluster — 40 px icon buttons + user chip */}
      <Space size={4} className={styles.right}>
        <Tooltip title={t('actions.toggle_language')}>
          <Button
            type="text"
            icon={<GlobalOutlined />}
            onClick={toggleLang}
            className={styles.iconBtn}>
            <span className={styles.langLabel}>{isAr ? 'EN' : 'ع'}</span>
          </Button>
        </Tooltip>

        <Tooltip title={t('actions.help')}>
          <Button
            type="text"
            icon={<QuestionCircleOutlined />}
            className={styles.iconBtn}
          />
        </Tooltip>

        <Tooltip title={t('actions.notifications')}>
          <Badge count={unread} size="small" offset={[-4, 4]}>
            <Button
              type="text"
              icon={<BellOutlined />}
              onClick={() => navigate(ROUTES.NOTIFICATIONS)}
              className={styles.iconBtn}
            />
          </Badge>
        </Tooltip>

        <Dropdown
          menu={{
            items: [
              {
                key: 'profile-header',
                type: 'group',
                label: (
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownName}>{name}</div>
                    <div className={styles.dropdownEmail}>{email}</div>
                  </div>
                ),
              },
              { type: 'divider' },
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
          <div
            className={classNames('app-user-icon', styles.userChip)}
            role="button"
            tabIndex={0}>
            <Avatar
              size={32}
              style={{
                background:
                  'linear-gradient(135deg, #1570EF 0%, #6938EF 100%)',
                fontWeight: 600,
              }}>
              {avatarLetter}
            </Avatar>
            <div className={styles.userMeta}>
              <span className="username">{name.split(' ')[0]}</span>
            </div>
            <DownOutlined
              style={{ fontSize: 10, color: '#667085' }}
            />
          </div>
        </Dropdown>
      </Space>
    </div>
  );
}
