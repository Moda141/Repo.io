import { Routes, Route, Link } from 'react-router-dom';
import { Row, Col, Card, Space, Typography } from 'antd';
import {
  TeamOutlined,
  SafetyOutlined,
  ApiOutlined,
  ControlOutlined,
  CloudSyncOutlined,
  KeyOutlined,
  AuditOutlined,
  BookOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import UsersPage from './UsersPage';
import RolesPage from './RolesPage';
import SsoConfigPage from './SsoConfigPage';
import ApiKeysPage from './ApiKeysPage';
import AuditLogPage from './AuditLogPage';
import SchemaListPage from './SchemaListPage';
import SchemaEditorPage from './SchemaEditorPage';

const { Text } = Typography;

/**
 * SettingsPage — hub + router for every admin surface.
 * The index route renders a grid of entry-point cards; nested paths
 * mount the individual admin pages.
 */
export default function SettingsPage() {
  return (
    <Routes>
      <Route index element={<SettingsHub />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="users/:userId" element={<UsersPage />} />
      <Route path="roles" element={<RolesPage />} />
      <Route path="sso" element={<SsoConfigPage />} />
      <Route path="api-keys" element={<ApiKeysPage />} />
      <Route path="audit" element={<AuditLogPage />} />
      <Route path="schema" element={<SchemaListPage />} />
      <Route path="schema/:entityType" element={<SchemaEditorPage />} />
    </Routes>
  );
}

function SettingsHub() {
  const cards = [
    { to: '/settings/users', icon: <TeamOutlined />, title: 'Users', desc: 'Invite, enable, change roles.' },
    { to: '/settings/roles', icon: <SafetyOutlined />, title: 'Roles & permissions', desc: 'Who can do what.' },
    { to: '/settings/sso', icon: <CloudSyncOutlined />, title: 'Single sign-on', desc: 'Entra ID (Azure AD) connection.' },
    { to: '/settings/api-keys', icon: <KeyOutlined />, title: 'API keys', desc: 'Service accounts for ingest and scripts.' },
    { to: '/settings/audit', icon: <AuditOutlined />, title: 'Audit log', desc: 'Signed trail of every write.' },
    { to: '/settings/schema', icon: <BookOutlined />, title: 'Entity schemas', desc: 'Edit JSON Schemas per entity.' },
    { to: '/sources', icon: <ApiOutlined />, title: 'Sources & connectors', desc: 'SAP, SQL Server, drives.' },
    { to: '/quality/rules', icon: <ControlOutlined />, title: 'Matching & survivorship', desc: 'DQ, Splink, survivorship rules.' },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Admin surfaces: users, roles, SSO, API keys, audit, schemas, and governance."
      />
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col key={c.title} xs={24} sm={12} lg={6}>
            <Link to={c.to}>
              <Card hoverable style={{ height: '100%' }}>
                <div style={{ fontSize: 28, color: '#1570EF', marginBottom: 8 }}>
                  {c.icon}
                </div>
                <Space direction="vertical" size={2}>
                  <strong>{c.title}</strong>
                  <Text type="secondary">{c.desc}</Text>
                </Space>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </>
  );
}
