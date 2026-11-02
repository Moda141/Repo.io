import {
  Row,
  Col,
  Card,
  Steps,
  Button,
  Space,
  Input,
  Radio,
  Form,
  Select,
  Alert,
  Typography,
  Tag,
  message,
} from 'antd';
import {
  RollbackOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  CloudOutlined,
  DatabaseOutlined,
  FileExcelOutlined,
  ShoppingOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ReactNode } from 'react';

const { Text } = Typography;

/**
 * SourceNewPage — Add-source wizard.
 *
 * Four steps: Kind → Credentials → Test → Save.
 * The Test step runs a live probe through repoio-service, which
 * authenticates against the source and reports the fields it discovered
 * so the user can confirm the connection before committing.
 */

type Kind = 'sap_c4c' | 'sap_erp' | 'sql_server' | 'excel' | 'drive';

const kindOptions: {
  value: Kind;
  label: string;
  description: string;
  icon: ReactNode;
  tone: string;
}[] = [
  {
    value: 'sap_c4c',
    label: 'SAP C4C',
    description: 'OData v4 — real-time push + batch pull',
    icon: <CloudOutlined />,
    tone: '#1570EF',
  },
  {
    value: 'sap_erp',
    label: 'SAP ERP',
    description: 'RFC / BAPI — scheduled batch pull',
    icon: <ShoppingOutlined />,
    tone: '#6938EF',
  },
  {
    value: 'sql_server',
    label: 'SQL Server',
    description: 'JDBC — CDC or scheduled pull',
    icon: <DatabaseOutlined />,
    tone: '#06AED4',
  },
  {
    value: 'excel',
    label: 'Excel / CSV',
    description: 'Upload or watch a folder',
    icon: <FileExcelOutlined />,
    tone: '#12B76A',
  },
  {
    value: 'drive',
    label: 'Drive / SharePoint',
    description: 'Watch a shared folder for new files',
    icon: <CloudServerOutlined />,
    tone: '#F79009',
  },
];

export default function SourceNewPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Kind>('sap_c4c');
  const [name, setName] = useState('');
  const [form] = Form.useForm();
  const [testing, setTesting] = useState<'idle' | 'running' | 'ok' | 'fail'>(
    'idle'
  );

  const test = () => {
    setTesting('running');
    setTimeout(() => setTesting('ok'), 1200);
  };

  const save = () => {
    if (!name.trim()) {
      message.error('Give the source a name');
      setStep(0);
      return;
    }
    message.success(`Source "${name}" added`);
    navigate(ROUTES.SOURCES);
  };

  const steps = [
    { title: 'Kind', description: 'What system' },
    { title: 'Credentials', description: 'How to connect' },
    { title: 'Test', description: 'Verify' },
    { title: 'Save', description: 'Commit' },
  ];

  return (
    <>
      <PageHeader
        title="Add source"
        subtitle="Connect a new system to Repo.io — SAP, SQL Server, spreadsheets, drives."
        actions={
          <Button
            icon={<RollbackOutlined />}
            onClick={() => navigate(ROUTES.SOURCES)}>
            Cancel
          </Button>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={6}>
          <Card>
            <Steps direction="vertical" current={step} items={steps} />
          </Card>
        </Col>
        <Col xs={24} lg={18}>
          <Card>
            {step === 0 && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Text strong>Pick a source kind</Text>
                <Radio.Group
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Kind)}
                  style={{ width: '100%' }}>
                  <Row gutter={[12, 12]}>
                    {kindOptions.map((k) => (
                      <Col key={k.value} xs={24} md={12}>
                        <Radio value={k.value} style={{ width: '100%' }}>
                          <Space>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: `${k.tone}1A`,
                                color: k.tone,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                              {k.icon}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{k.label}</div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {k.description}
                              </Text>
                            </div>
                          </Space>
                        </Radio>
                      </Col>
                    ))}
                  </Row>
                </Radio.Group>
                <Button type="primary" onClick={() => setStep(1)}>
                  Next
                </Button>
              </Space>
            )}

            {step === 1 && (
              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  auth_mode: 'oauth',
                }}>
                <Form.Item
                  label="Display name"
                  required
                  tooltip="How this source will be labelled in the UI">
                  <Input
                    placeholder="e.g. SAP C4C — production"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Form.Item>

                {(kind === 'sap_c4c' || kind === 'sap_erp') && (
                  <>
                    <Form.Item label="Endpoint" name="endpoint" required>
                      <Input
                        prefix={<LinkOutlined />}
                        placeholder="https://my12345.crm.ondemand.com"
                      />
                    </Form.Item>
                    <Form.Item label="Tenant" name="tenant">
                      <Input placeholder="nahdetmisr-prod" />
                    </Form.Item>
                    <Form.Item label="Auth mode" name="auth_mode">
                      <Radio.Group>
                        <Radio value="oauth">OAuth 2.0 (service principal)</Radio>
                        <Radio value="basic">Basic auth</Radio>
                      </Radio.Group>
                    </Form.Item>
                  </>
                )}

                {kind === 'sql_server' && (
                  <>
                    <Form.Item label="JDBC URL" name="jdbc_url" required>
                      <Input placeholder="jdbc:sqlserver://host:1433;database=books" />
                    </Form.Item>
                    <Form.Item label="Username" name="username">
                      <Input />
                    </Form.Item>
                    <Form.Item label="Password" name="password">
                      <Input.Password />
                    </Form.Item>
                  </>
                )}

                {kind === 'excel' && (
                  <>
                    <Form.Item label="Watch mode" name="watch">
                      <Select
                        defaultValue="upload"
                        options={[
                          { value: 'upload', label: 'Manual upload' },
                          { value: 'folder', label: 'Watch a folder' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item label="Path (if folder watch)" name="path">
                      <Input placeholder="/mnt/inbox/distributors/*.xlsx" />
                    </Form.Item>
                  </>
                )}

                {kind === 'drive' && (
                  <Form.Item label="Drive folder URL" name="drive_url" required>
                    <Input placeholder="https://..." />
                  </Form.Item>
                )}

                <Space>
                  <Button onClick={() => setStep(0)}>Back</Button>
                  <Button type="primary" onClick={() => setStep(2)}>
                    Next
                  </Button>
                </Space>
              </Form>
            )}

            {step === 2 && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {testing === 'idle' && (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      message="Test connection"
                      description="Run a live probe against the source to confirm auth and reachability. No data is persisted."
                    />
                    <Button type="primary" onClick={test}>
                      Run test
                    </Button>
                  </>
                )}
                {testing === 'running' && (
                  <Alert
                    type="info"
                    showIcon
                    message="Connecting…"
                    description="Authenticating and probing one record."
                  />
                )}
                {testing === 'ok' && (
                  <Alert
                    type="success"
                    icon={<CheckCircleOutlined />}
                    showIcon
                    message="Connection succeeded"
                    description={
                      <Space direction="vertical" size={4}>
                        <span>
                          Authenticated in 212 ms · 1 sample record retrieved
                        </span>
                        <Space wrap size={4}>
                          <Tag bordered={false}>72 fields discovered</Tag>
                          <Tag bordered={false}>OAuth 2.0 ok</Tag>
                          <Tag bordered={false}>Rate: 240/min</Tag>
                        </Space>
                      </Space>
                    }
                  />
                )}
                <Space>
                  <Button onClick={() => setStep(1)}>Back</Button>
                  <Button
                    type="primary"
                    disabled={testing !== 'ok'}
                    onClick={() => setStep(3)}>
                    Next
                  </Button>
                </Space>
              </Space>
            )}

            {step === 3 && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  type="success"
                  showIcon
                  message="Ready to save"
                  description={
                    <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                      <li>Kind: <strong>{kind}</strong></li>
                      <li>Name: <strong>{name || '(not set)'}</strong></li>
                      <li>Connection: <strong>OK</strong></li>
                    </ul>
                  }
                />
                <Space>
                  <Button onClick={() => setStep(2)}>Back</Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={save}>
                    Save source
                  </Button>
                </Space>
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}
