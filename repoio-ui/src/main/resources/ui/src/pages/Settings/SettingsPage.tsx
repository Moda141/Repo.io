import { Row, Col, Card } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import {
  TeamOutlined,
  SafetyOutlined,
  ApiOutlined,
  ControlOutlined,
} from '@ant-design/icons';
import { ROUTES } from '@/constants/routes';

export default function SettingsPage() {
  const { t } = useTranslation();

  const cards = [
    {
      key: 'users',
      icon: <TeamOutlined />,
      title: 'Users',
      to: ROUTES.SETTINGS_USERS,
    },
    {
      key: 'roles',
      icon: <SafetyOutlined />,
      title: 'Roles & permissions',
      to: ROUTES.SETTINGS_ROLES,
    },
    {
      key: 'sources',
      icon: <ApiOutlined />,
      title: 'Sources & connectors',
      to: ROUTES.SETTINGS_SOURCES,
    },
    {
      key: 'rules',
      icon: <ControlOutlined />,
      title: 'Matching & survivorship rules',
      to: ROUTES.SETTINGS_RULES,
    },
  ];

  return (
    <>
      <PageHeader title={t('page.settings.title')} />
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col key={c.key} xs={24} sm={12} lg={6}>
            <Link to={c.to}>
              <Card hoverable>
                <div style={{ fontSize: 28, color: '#1570EF' }}>{c.icon}</div>
                <div style={{ marginTop: 12, fontWeight: 600 }}>{c.title}</div>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </>
  );
}
