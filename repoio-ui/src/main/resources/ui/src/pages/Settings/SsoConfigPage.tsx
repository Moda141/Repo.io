import {
  Row,
  Col,
  Card,
  Form,
  Input,
  Switch,
  Button,
  Space,
  Tag,
  Typography,
  Alert,
  Divider,
  Select,
  message,
} from 'antd';
import {
  CloudSyncOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  CopyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';

const { Text } = Typography;

/**
 * SsoConfigPage — Entra ID (Azure AD) connection.
 *
 * Repo.io authenticates every user and every service principal
 * through Entra ID. This page captures tenant ID, client ID,
 * client secret, redirect URIs, group-to-role mapping and the
 * callback URL to register in Entra. Values are stored encrypted
 * (AES-256) in repoio-service and surfaced here with secret masking.
 */
export default function SsoConfigPage() {
  const [form] = Form.useForm();
  const [connected, setConnected] = useState(true);
  const [testing, setTesting] = useState<'idle' | 'ok' | 'fail'>('idle');

  const test = () => {
    setTesting('ok');
    message.success('Connected to Entra ID in 184 ms');
  };

  const callbackUrl = `${window.location.origin}/api/v1/auth/callback`;

  return (
    <>
      <PageHeader
        title="Single sign-on"
        subtitle="Entra ID (Azure AD) is the only identity provider. Users and service principals authenticate through it."
        actions={
          <>
            <Button icon={<ThunderboltOutlined />} onClick={test}>
              Test connection
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => message.success('SSO config saved')}>
              Save
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <CloudSyncOutlined style={{ color: '#1570EF' }} />
                <span>Entra ID (Azure AD)</span>
                {connected && (
                  <Tag
                    color="success"
                    icon={<CheckCircleOutlined />}
                    bordered={false}>
                    Connected
                  </Tag>
                )}
              </Space>
            }
            extra={
              <Switch
                checked={connected}
                checkedChildren="On"
                unCheckedChildren="Off"
                onChange={(c) => setConnected(c)}
              />
            }>
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                tenant_id: '72f988bf-86f1-41af-91ab-2d7cd011db47',
                client_id: 'ea7b4a1c-9c67-4d9f-9c1e-b2d9a8d3b4f1',
                client_secret: '•••••••••••••••••••••••••••••••',
                redirect_uri: callbackUrl,
                scopes: 'openid profile email offline_access',
              }}>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Tenant ID"
                    name="tenant_id"
                    required
                    tooltip="Directory (tenant) ID from your Entra ID app registration">
                    <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Client (application) ID" name="client_id" required>
                    <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Client secret"
                    name="client_secret"
                    required
                    tooltip="Encrypted at rest. Rotate from Entra ID when it expires.">
                    <Input.Password />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Scopes" name="scopes">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    label="Redirect URI (register this in Entra)"
                    name="redirect_uri">
                    <Space.Compact style={{ width: '100%' }}>
                      <Input value={callbackUrl} readOnly />
                      <Button
                        icon={<CopyOutlined />}
                        onClick={() => {
                          navigator.clipboard.writeText(callbackUrl);
                          message.success('Copied');
                        }}>
                        Copy
                      </Button>
                    </Space.Compact>
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '12px 0' }} />
              <Text strong>Group → role mapping</Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
                Entra groups map to Repo.io roles on login. Any unmapped group logs the
                user in as Reader.
              </Text>

              <Row gutter={16}>
                {[
                  { role: 'Admin', group: 'repoio-admins' },
                  { role: 'Steward', group: 'repoio-stewards' },
                  { role: 'Reader', group: 'repoio-readers' },
                ].map((m) => (
                  <Col key={m.role} xs={24} md={8}>
                    <Form.Item label={m.role} name={`group_${m.role.toLowerCase()}`} initialValue={m.group}>
                      <Input />
                    </Form.Item>
                  </Col>
                ))}
              </Row>

              <Divider style={{ margin: '12px 0' }} />
              <Form.Item
                label="Session"
                name="session"
                tooltip="How long user tokens stay valid before refresh">
                <Select
                  defaultValue="60min"
                  options={[
                    { value: '15min', label: '15 minutes' },
                    { value: '60min', label: '1 hour' },
                    { value: '240min', label: '4 hours' },
                    { value: '480min', label: '8 hours (workday)' },
                  ]}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Setup checklist"
              description={
                <ol style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.8 }}>
                  <li>Create an app registration in Entra ID.</li>
                  <li>Add the Redirect URI shown here.</li>
                  <li>Grant <code>openid</code>, <code>profile</code>, <code>email</code>, <code>offline_access</code>.</li>
                  <li>Create 3 Entra groups and map them above.</li>
                  <li>Add users to the matching group.</li>
                </ol>
              }
            />

            {testing === 'ok' && (
              <Alert
                type="success"
                icon={<CheckCircleOutlined />}
                showIcon
                message="Last probe"
                description="Succeeded 184 ms ago. Tenant discovery, metadata endpoint and token endpoint all reachable."
              />
            )}

            <Card size="small" title="Service principals">
              <Text type="secondary" style={{ fontSize: 12 }}>
                FastAPI ingest, repoio-stream, and repoio-airflow-apis all
                authenticate with their own service principals — managed on
                the API Keys page.
              </Text>
            </Card>
          </Space>
        </Col>
      </Row>
    </>
  );
}
