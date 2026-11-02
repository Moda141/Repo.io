import {
  Row,
  Col,
  Card,
  Form,
  Input,
  Button,
  Space,
  Switch,
  Select,
  Alert,
  Tag,
  Divider,
  Typography,
  message,
} from 'antd';
import {
  SaveOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';

const { Text } = Typography;

export default function EmailSettingsPage() {
  const [form] = Form.useForm();
  const [tested, setTested] = useState(false);

  return (
    <>
      <PageHeader
        title="Email settings"
        subtitle="SMTP server, sender identity, DKIM, and delivery guards."
        actions={
          <>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => {
                setTested(true);
                message.success('SMTP OK · 212 ms');
              }}>
              Test
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => message.success('Email settings saved')}>
              Save
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card>
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                provider: 'smtp',
                host: 'smtp.office365.com',
                port: 587,
                encryption: 'tls',
                username: 'repoio@nahdetmisr.com',
                password: '•••••••••••••',
                from_email: 'repoio@nahdetmisr.com',
                from_name: 'Repo.io · Nahdet Misr',
                reply_to: 'no-reply@nahdetmisr.com',
                dkim: true,
                suppress_outside: true,
                rate_limit: 60,
              }}>
              <Form.Item label="Provider" name="provider">
                <Select
                  options={[
                    { value: 'smtp', label: 'SMTP' },
                    { value: 'ses', label: 'Amazon SES' },
                    { value: 'sendgrid', label: 'SendGrid' },
                    { value: 'graph', label: 'Microsoft Graph (Office 365)' },
                  ]}
                />
              </Form.Item>

              <Divider>SMTP</Divider>
              <Row gutter={16}>
                <Col xs={24} md={16}>
                  <Form.Item label="Host" name="host">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="Port" name="port">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="Encryption" name="encryption">
                    <Select
                      options={[
                        { value: 'none', label: 'None' },
                        { value: 'ssl', label: 'SSL' },
                        { value: 'tls', label: 'TLS' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Username" name="username">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Password" name="password">
                    <Input.Password />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>Sender identity</Divider>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="From email" name="from_email">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="From name" name="from_name">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Reply-to" name="reply_to">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item label="DKIM" name="dkim" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={12} md={6}>
                  <Form.Item
                    label="Rate limit (/min)"
                    name="rate_limit"
                    tooltip="Max emails per minute, applied per channel">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>Delivery guards</Divider>
              <Form.Item
                label="Suppress sends outside @nahdetmisr.com"
                name="suppress_outside"
                valuePropName="checked"
                tooltip="Prevents sending to external addresses; useful in dev/staging">
                <Switch />
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {tested && (
              <Alert
                type="success"
                icon={<CheckCircleOutlined />}
                showIcon
                message="SMTP probe OK"
                description="Connected and authenticated in 212 ms. No test email was sent."
              />
            )}
            <Card size="small" title="Last 24h">
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text>Sent</Text>
                  <Text strong>62</Text>
                </Space>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text>Delivered</Text>
                  <Tag bordered={false} color="success">61 (98%)</Tag>
                </Space>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text>Bounced</Text>
                  <Tag bordered={false}>1</Tag>
                </Space>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text>Suppressed</Text>
                  <Tag bordered={false}>0</Tag>
                </Space>
              </Space>
            </Card>
            <Card size="small">
              <Button block icon={<SendOutlined />}>
                Send test to me
              </Button>
            </Card>
          </Space>
        </Col>
      </Row>
    </>
  );
}
