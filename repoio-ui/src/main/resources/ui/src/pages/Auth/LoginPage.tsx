import {
  Card,
  Button,
  Space,
  Input,
  Form,
  Divider,
  Typography,
  Alert,
  Row,
  Col,
  message,
  Checkbox,
} from 'antd';
import { WindowsFilled, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { ROUTES } from '@/constants/routes';
import { useApplicationStore } from '@/hooks/useApplicationStore';

const { Title, Text, Link: AntLink } = Typography;

/**
 * LoginPage — SSO-first login screen (full-bleed, no AppShell).
 *
 * Primary action is "Continue with Microsoft" — Entra ID redirects
 * to /api/v1/auth/callback which repoio-service handles.
 * Email + password fallback is kept behind "Use a password" for
 * break-glass / local dev, but is disabled by default in production
 * (toggled by the admin on the SSO page).
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setUser } = useApplicationStore();
  const isAr = i18n.language.toLowerCase().startsWith('ar');

  const demoSignIn = (name: string, email: string, roles: string[]) => {
    setLoading(true);
    setTimeout(() => {
      setUser({
        id: 'u-demo',
        name,
        email,
        roles,
      });
      // In production this is the token from Entra; demo stores a placeholder.
      localStorage.setItem('repoio-token', 'demo.jwt.token');
      message.success(`Welcome, ${name.split(' ')[0]}`);
      navigate(ROUTES.HOME);
    }, 600);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background:
          'linear-gradient(135deg, #F8F9FC 0%, #EEF4FF 50%, #F4F0FF 100%)',
      }}>
      <Helmet>
        <title>Sign in — Repo.io</title>
      </Helmet>

      <Row style={{ width: '100%' }}>
        {/* Left: brand/narrative */}
        <Col
          xs={0}
          lg={12}
          style={{
            padding: '64px 72px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background:
              'linear-gradient(135deg, #0C111D 0%, #1D2939 50%, #0C111D 100%)',
            color: '#FFFFFF',
          }}>
          <Space direction="horizontal">
            <RepoioMark />
            <strong style={{ fontSize: 20 }}>Repo.io</strong>
          </Space>

          <div>
            <Title level={2} style={{ color: '#FFFFFF', marginBottom: 12 }}>
              {isAr
                ? 'إدارة البيانات الرئيسية — موحدة، موثوقة، جاهزة.'
                : 'Master data — unified, trusted, ready.'}
            </Title>
            <Text style={{ color: '#D0D5DD', fontSize: 15 }}>
              {isAr
                ? 'كيان ذهبي واحد لكل عميل ومورد ومنتج، من SAP C4C و SAP ERP و SQL Server و Excel، مع تدقيق كامل وموافقة الـ steward.'
                : 'One golden record per customer, vendor, product — from SAP C4C, SAP ERP, SQL Server and Excel, with full audit and steward approval.'}
            </Text>
          </div>

          <Space direction="vertical" size={4}>
            <Text style={{ color: '#98A2B3', fontSize: 12 }}>
              {isAr
                ? 'نهضة مصر للنشر · شغل الحوكمة الداخلية'
                : 'Nahdet Misr Publishing Group · internal governance tooling'}
            </Text>
            <Text style={{ color: '#667085', fontSize: 11 }}>
              v1.0.0-SNAPSHOT
            </Text>
          </Space>
        </Col>

        {/* Right: sign-in form */}
        <Col
          xs={24}
          lg={12}
          style={{
            padding: '48px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Card
            style={{ width: '100%', maxWidth: 420 }}
            styles={{ body: { padding: 32 } }}>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <div>
                <Title level={3} style={{ marginBottom: 4 }}>
                  {t('auth.sign_in')}
                </Title>
                <Text type="secondary">{t('auth.sso_subtitle')}</Text>
              </div>

              <Button
                size="large"
                type="primary"
                block
                icon={<WindowsFilled />}
                loading={loading}
                onClick={() =>
                  demoSignIn(
                    'Mohamed Mahmoud',
                    'mohamed@nahdetmisr.com',
                    ['Admin', 'Steward']
                  )
                }>
                {t('auth.continue_microsoft')}
              </Button>

              {!showPassword && (
                <div style={{ textAlign: 'center' }}>
                  <AntLink onClick={() => setShowPassword(true)}>
                    {t('auth.use_password')}
                  </AntLink>
                </div>
              )}

              {showPassword && (
                <>
                  <Divider style={{ margin: '8px 0' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('auth.or')}
                    </Text>
                  </Divider>

                  <Alert
                    type="warning"
                    showIcon
                    message={t('auth.password_disabled_prod')}
                  />

                  <Form
                    layout="vertical"
                    onFinish={(v) =>
                      demoSignIn(
                        'Mohamed Mahmoud',
                        v.email,
                        ['Admin', 'Steward']
                      )
                    }>
                    <Form.Item name="email" rules={[{ required: true }]}>
                      <Input
                        size="large"
                        prefix={<MailOutlined />}
                        placeholder="you@nahdetmisr.com"
                      />
                    </Form.Item>
                    <Form.Item name="password" rules={[{ required: true }]}>
                      <Input.Password
                        size="large"
                        prefix={<LockOutlined />}
                        placeholder="••••••••"
                      />
                    </Form.Item>
                    <Form.Item>
                      <Space
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}>
                        <Checkbox>{t('auth.remember')}</Checkbox>
                        <AntLink>{t('auth.forgot')}</AntLink>
                      </Space>
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button
                        size="large"
                        block
                        htmlType="submit"
                        loading={loading}>
                        {t('auth.sign_in')}
                      </Button>
                    </Form.Item>
                  </Form>
                </>
              )}

              <Divider style={{ margin: '8px 0' }} />
              <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>
                {t('auth.need_help')}{' '}
                <AntLink href="mailto:it@nahdetmisr.com">it@nahdetmisr.com</AntLink>
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function RepoioMark() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="8" fill="url(#login-grad)" />
      <path
        d="M12 10h8a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5h-3l5 6h-4l-5-6v6h-3V10zm3 3v6h5a2.5 2.5 0 0 0 0-5h-5z"
        fill="white"
      />
      <defs>
        <linearGradient id="login-grad" x1="0" y1="0" x2="36" y2="36">
          <stop stopColor="#1570EF" />
          <stop offset="1" stopColor="#6938EF" />
        </linearGradient>
      </defs>
    </svg>
  );
}
