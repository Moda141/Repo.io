import { Input, Space, Avatar, Dropdown, Button } from 'antd';
import {
  SearchOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  GlobalOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import styles from './TopBar.module.css';

/**
 * TopBar — global search + language toggle + help + notifications + user menu.
 * The user menu is a placeholder until AuthProvider wires Entra ID.
 */
export default function TopBar() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.toLowerCase().startsWith('ar');

  const toggleLang = () => i18n.changeLanguage(isAr ? 'en-US' : 'ar-EG');

  return (
    <div className={styles.topBar}>
      <div className={styles.searchWrap}>
        <Input
          size="middle"
          allowClear
          prefix={<SearchOutlined className={styles.searchIcon} />}
          placeholder={t('search.placeholder')}
          className={styles.search}
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

        <Button
          type="text"
          icon={<BellOutlined />}
          aria-label={t('actions.notifications')}
        />

        <Dropdown
          menu={{
            items: [
              {
                key: 'profile',
                icon: <UserOutlined />,
                label: t('user.profile'),
              },
              { type: 'divider' },
              {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: t('user.sign_out'),
                danger: true,
              },
            ],
          }}
          trigger={['click']}>
          <Avatar
            style={{ cursor: 'pointer', background: '#1570EF' }}
            size={32}>
            M
          </Avatar>
        </Dropdown>
      </Space>
    </div>
  );
}
