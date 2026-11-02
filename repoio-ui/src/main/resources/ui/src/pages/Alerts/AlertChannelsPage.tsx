import {
  Row,
  Col,
  Card,
  Table,
  Button,
  Space,
  Tag,
  Avatar,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  message,
} from 'antd';
import {
  PlusOutlined,
  MailOutlined,
  SlackOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';
import type { ReactNode } from 'react';

const { Text } = Typography;

interface Channel {
  id: string;
  name: string;
  kind: 'email' | 'slack' | 'webhook' | 'in_app';
  target: string;
  alerts_bound: number;
  tested: string;
  ok: boolean;
}

const seed: Channel[] = [
  {
    id: 'ch-01',
    name: 'Email · stewards',
    kind: 'email',
    target: 'repoio-stewards@nahdetmisr.com',
    alerts_bound: 4,
    tested: '2 hours ago',
    ok: true,
  },
  {
    id: 'ch-02',
    name: 'Email · data-ops',
    kind: 'email',
    target: 'data-ops@nahdetmisr.com',
    alerts_bound: 3,
    tested: '2 hours ago',
    ok: true,
  },
  {
    id: 'ch-03',
    name: 'Slack · #data-ops',
    kind: 'slack',
    target: 'T001AAA/B002BBB/xoxb-...',
    alerts_bound: 2,
    tested: 'Yesterday',
    ok: true,
  },
  {
    id: 'ch-04',
    name: 'Webhook · PagerDuty',
    kind: 'webhook',
    target: 'https://events.pagerduty.com/v2/enqueue',
    alerts_bound: 1,
    tested: '3 days ago',
    ok: true,
  },
  {
    id: 'ch-05',
    name: 'In-app notifications',
    kind: 'in_app',
    target: '(system)',
    alerts_bound: 5,
    tested: '—',
    ok: true,
  },
];

const kindIcon: Record<Channel['kind'], ReactNode> = {
  email: <MailOutlined style={{ color: '#1570EF' }} />,
  slack: <SlackOutlined style={{ color: '#6938EF' }} />,
  webhook: <ApiOutlined style={{ color: '#F79009' }} />,
  in_app: <BellOutlined style={{ color: '#12B76A' }} />,
};

export default function AlertChannelsPage() {
  const [rows, setRows] = useState<Channel[]>(seed);
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();

  const columns: ColumnsType<Channel> = [
    {
      title: 'Channel',
      key: 'name',
      render: (_, r) => (
        <Space>
          <Avatar style={{ background: 'transparent' }} icon={kindIcon[r.kind]} />
          <div>
            <strong>{r.name}</strong>
            <div style={{ color: '#667085', fontSize: 12 }}>
              <code>{r.target}</code>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Kind',
      dataIndex: 'kind',
      width: 110,
      render: (k: Channel['kind']) => (
        <Tag bordered={false}>{k.toUpperCase()}</Tag>
      ),
    },
    { title: 'Bound alerts', dataIndex: 'alerts_bound', width: 130, align: 'right' as const },
    { title: 'Last probe', dataIndex: 'tested', width: 150 },
    {
      title: 'Status',
      key: 'ok',
      width: 110,
      render: (_, r) =>
        r.ok ? (
          <Tag color="success" icon={<CheckCircleOutlined />} bordered={false}>
            OK
          </Tag>
        ) : (
          <Tag color="error" bordered={false}>
            FAIL
          </Tag>
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: () => (
        <Space>
          <Button size="small" type="link">
            Test
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Alert channels"
        subtitle="Where alerts actually go — email aliases, Slack webhooks, PagerDuty, in-app."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
            Add channel
          </Button>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {(['email', 'slack', 'webhook', 'in_app'] as Channel['kind'][]).map((k) => (
          <Col key={k} xs={12} md={6}>
            <Card>
              <Space>
                <Avatar style={{ background: 'transparent' }} icon={kindIcon[k]} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {k.toUpperCase()}
                  </Text>
                  <div style={{ fontWeight: 600 }}>
                    {rows.filter((r) => r.kind === k).length}
                  </div>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Table rowKey="id" columns={columns} dataSource={rows} />
      </Card>

      <Modal
        title="Add channel"
        open={adding}
        onCancel={() => setAdding(false)}
        onOk={() => {
          form.validateFields().then((v) => {
            setRows((prev) => [
              {
                id: `ch-${Date.now()}`,
                name: v.name,
                kind: v.kind,
                target: v.target,
                alerts_bound: 0,
                tested: 'never',
                ok: true,
              },
              ...prev,
            ]);
            setAdding(false);
            form.resetFields();
            message.success('Channel added');
          });
        }}>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Kind" name="kind" initialValue="email">
            <Select
              options={[
                { value: 'email', label: 'Email' },
                { value: 'slack', label: 'Slack webhook' },
                { value: 'webhook', label: 'Generic webhook' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Target" name="target" rules={[{ required: true }]}>
            <Input placeholder="email, Slack token, or URL" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
