import {
  Row,
  Col,
  Card,
  Space,
  Button,
  Avatar,
  Typography,
  Tag,
  Form,
  Select,
  Switch,
  Divider,
  Descriptions,
  message,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  BellOutlined,
  GlobalOutlined,
  SaveOutlined,
  LogoutOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import { useApplicationStore } from '@/hooks/useApplicationStore';

const { Text } = Typography;

/**
 * ProfilePage — user's own profile and preferences.
 *
 * Profile data (name, email, team) comes from Entra ID and is
 * read-only here — the user updates it in Entra. Preferences
 * (language, timezone, notification routing, UI density) are
 * local to Repo.io and saved via repoio-service's /me endpoint.
 */
export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useApplicationStore();
  const [form] = Form.useForm();

  const u = user ?? {
    name: 'Mohamed Mahmoud',
    email: 'mohamed@nahdetmisr.com',
    roles: ['Admin', 'Steward'],
  };
  const initial = (u.name || u.email || 'M')[0]?.toUpperCase();

  const logout = () => {
    signOut();
    message.info(t('user.sign_out'));
    navigate(ROUTES.LOGIN);
  };

  return (
    <>
      <PageHeader
        title={t('user.profile')}
        subtitle="Your account, preferences and notifications."
        actions={
          <Button danger icon={<LogoutOutlined />} onClick={logout}>
            {t('user.sign_out')}
          </Button>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card>
            <Space direction="vertical" align="center" style={{ width: '100%', textAlign: 'center' }} size={10}>
              <Avatar
                size={96}
                style={{
                  background:
                    'linear-gradient(135deg, #1570EF 0%, #6938EF 100%)',
                  fontSize: 36,
                  fontWeight: 600,
                }}>
                {initial}
              </Avatar>
              <div>
                <div style={{ fontWeight: 600, fontSize: 18 }}>{u.name}</div>
                <Text type="secondary">{u.email}</Text>
              </div>
              <Space size={4} wrap style={{ justifyContent: 'center' }}>
                {u.roles.map((r) => (
                  <Tag key={r} bordered={false} color="processing">
                    {r}
                  </Tag>
                ))}
              </Space>
            </Space>
            <Divider />
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Team">Data Management</Descriptions.Item>
              <Descriptions.Item label="Joined">2026-09-10</Descriptions.Item>
              <Descriptions.Item label="MFA">
                <Tag color="success" bordered={false}>
                  Enabled (TOTP)
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="SSO">
                <Space size={4}>
                  <KeyOutlined style={{ color: '#1570EF' }} />
                  Entra ID
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card
              title={
                <Space>
                  <UserOutlined />
                  <span>Profile (from Entra)</span>
                  <Tag bordered={false}>Read-only</Tag>
                </Space>
              }>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Full name">{u.name}</Descriptions.Item>
                <Descriptions.Item label="Email">{u.email}</Descriptions.Item>
                <Descriptions.Item label="Team">Data Management</Descriptions.Item>
                <Descriptions.Item label="Manager">it@nahdetmisr.com</Descriptions.Item>
                <Descriptions.Item label="Location">Cairo, Egypt</Descriptions.Item>
                <Descriptions.Item label="Phone">+20 2 2345 1234</Descriptions.Item>
              </Descriptions>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                Edit these in Entra ID; changes sync on next sign-in.
              </Text>
            </Card>

            <Card
              title={
                <Space>
                  <GlobalOutlined />
                  <span>Preferences</span>
                </Space>
              }
              extra={
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={() => message.success('Preferences saved')}>
                  Save
                </Button>
              }>
              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  language: i18n.language.toLowerCase().startsWith('ar') ? 'ar-EG' : 'en-US',
                  timezone: 'Africa/Cairo',
                  theme: 'light',
                  density: 'comfortable',
                  dateFormat: 'YYYY-MM-DD',
                  numberFormat: 'en-US',
                }}>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label={t('actions.toggle_language')} name="language">
                      <Select
                        onChange={(v) => i18n.changeLanguage(v)}
                        options={[
                          { value: 'en-US', label: 'English (US)' },
                          { value: 'ar-EG', label: 'العربية (مصر)' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Timezone" name="timezone">
                      <Select
                        options={[
                          { value: 'Africa/Cairo', label: 'Africa/Cairo (UTC+2)' },
                          { value: 'Asia/Riyadh', label: 'Asia/Riyadh (UTC+3)' },
                          { value: 'Europe/London', label: 'Europe/London (UTC)' },
                          { value: 'UTC', label: 'UTC' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Date format" name="dateFormat">
                      <Select
                        options={[
                          { value: 'YYYY-MM-DD', label: '2026-11-02' },
                          { value: 'DD/MM/YYYY', label: '02/11/2026' },
                          { value: 'MMM D, YYYY', label: 'Nov 2, 2026' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Number format" name="numberFormat">
                      <Select
                        options={[
                          { value: 'en-US', label: '1,234.56' },
                          { value: 'de-DE', label: '1.234,56' },
                          { value: 'ar-EG', label: '١٬٢٣٤٫٥٦' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="UI density" name="density">
                      <Select
                        options={[
                          { value: 'comfortable', label: 'Comfortable' },
                          { value: 'compact', label: 'Compact' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Theme" name="theme">
                      <Select
                        options={[
                          { value: 'light', label: 'Light' },
                          { value: 'dark', label: 'Dark (preview)' },
                          { value: 'system', label: 'Match system' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>

            <Card
              title={
                <Space>
                  <BellOutlined />
                  <span>Notifications</span>
                </Space>
              }>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <NotifRow
                  title="Change requests assigned to me"
                  desc="Email + in-app on every assignment"
                  defaultChecked
                />
                <NotifRow
                  title="My CR approved or rejected"
                  desc="In-app only"
                  defaultChecked
                />
                <NotifRow
                  title="Pipeline failure on a source I own"
                  desc="Email + in-app"
                  defaultChecked
                />
                <NotifRow
                  title="DQ score drops below threshold"
                  desc="In-app only"
                  defaultChecked
                />
                <NotifRow
                  title="New schema change proposed"
                  desc="Email digest (daily)"
                />
                <NotifRow
                  title="New user invited"
                  desc="(admins only)"
                />
              </Space>
            </Card>

            <Card
              title={
                <Space>
                  <LockOutlined />
                  <span>Security</span>
                </Space>
              }>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <div>
                    <strong>Multi-factor authentication</strong>
                    <div style={{ color: '#667085', fontSize: 12 }}>
                      Managed by Entra ID — change there.
                    </div>
                  </div>
                  <Tag color="success" bordered={false}>
                    Enabled
                  </Tag>
                </Space>
                <Divider style={{ margin: '4px 0' }} />
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <div>
                    <strong>Active sessions</strong>
                    <div style={{ color: '#667085', fontSize: 12 }}>
                      This device (Cairo · Chrome · 09:12 today)
                      <br />
                      Mobile (Cairo · Safari · 2 hours ago)
                    </div>
                  </div>
                  <Button danger>Revoke others</Button>
                </Space>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </>
  );
}

function NotifRow({
  title,
  desc,
  defaultChecked,
}: {
  title: string;
  desc: string;
  defaultChecked?: boolean;
}) {
  return (
    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
      <div>
        <strong style={{ fontSize: 14 }}>{title}</strong>
        <div style={{ color: '#667085', fontSize: 12 }}>{desc}</div>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </Space>
  );
}
