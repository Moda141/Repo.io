import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Typography,
  message,
} from 'antd';
import {
  PlusOutlined,
  LinkOutlined,
  CopyOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface ShareLink {
  id: string;
  short: string;
  target: string;
  kind: 'view' | 'record' | 'dashboard' | 'export';
  created_by: string;
  created_at: string;
  expires: string;
  password: boolean;
  hits: number;
}

const seed: ShareLink[] = [
  {
    id: 'sl-01',
    short: 'repoio.sh/9f2A',
    target: '/views/V-01',
    kind: 'view',
    created_by: 'mohamed@nahdetmisr.com',
    created_at: '2026-10-28',
    expires: '2026-11-28',
    password: false,
    hits: 42,
  },
  {
    id: 'sl-02',
    short: 'repoio.sh/K8m2',
    target: '/entity/customer/CUST-000142',
    kind: 'record',
    created_by: 'mohamed@nahdetmisr.com',
    created_at: '2026-10-25',
    expires: '2026-11-25',
    password: true,
    hits: 11,
  },
  {
    id: 'sl-03',
    short: 'repoio.sh/Q7xP',
    target: '/quality',
    kind: 'dashboard',
    created_by: 'ahmed@nahdetmisr.com',
    created_at: '2026-10-30',
    expires: 'never',
    password: false,
    hits: 108,
  },
];

export default function ShareLinksPage() {
  const [rows, setRows] = useState<ShareLink[]>(seed);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [form] = Form.useForm();

  const columns: ColumnsType<ShareLink> = [
    {
      title: 'Short URL',
      dataIndex: 'short',
      render: (s: string) => (
        <Space>
          <LinkOutlined style={{ color: '#1570EF' }} />
          <code>{s}</code>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(`https://${s}`);
              message.success('Copied');
            }}
          />
        </Space>
      ),
    },
    {
      title: 'Target',
      dataIndex: 'target',
      render: (v: string) => <code>{v}</code>,
    },
    {
      title: 'Kind',
      dataIndex: 'kind',
      width: 120,
      render: (k: ShareLink['kind']) => <Tag bordered={false}>{k.toUpperCase()}</Tag>,
    },
    { title: 'Created by', dataIndex: 'created_by', width: 220 },
    { title: 'Expires', dataIndex: 'expires', width: 120 },
    {
      title: 'Password',
      dataIndex: 'password',
      width: 100,
      render: (v: boolean) =>
        v ? (
          <Tag bordered={false} color="processing">
            Yes
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Hits',
      dataIndex: 'hits',
      width: 80,
      align: 'right' as const,
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_, r) => (
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => setRows((prev) => prev.filter((l) => l.id !== r.id))}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Share links"
        subtitle="Short, signed, time-limited URLs. Each link enforces the creator's permissions."
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreating(true)}>
            New link
          </Button>
        }
      />
      <Card>
        <Table rowKey="id" columns={columns} dataSource={rows} />
      </Card>

      <Modal
        title="New share link"
        open={creating}
        onCancel={() => setCreating(false)}
        onOk={() =>
          form.validateFields().then((v) => {
            const code = Math.random().toString(36).slice(2, 6);
            const url = `repoio.sh/${code}`;
            setRows((prev) => [
              {
                id: `sl-${Date.now()}`,
                short: url,
                target: v.target,
                kind: v.kind,
                created_by: 'mohamed@nahdetmisr.com',
                created_at: new Date().toISOString().slice(0, 10),
                expires: v.expires,
                password: !!v.password,
                hits: 0,
              },
              ...prev,
            ]);
            setCreating(false);
            setCreated(`https://${url}`);
            form.resetFields();
          })
        }>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="Target (route or absolute URL)" name="target" rules={[{ required: true }]}>
            <Input placeholder="/entity/customer/CUST-000142" />
          </Form.Item>
          <Form.Item label="Kind" name="kind" initialValue="record">
            <Select
              options={[
                { value: 'view', label: 'View' },
                { value: 'record', label: 'Record' },
                { value: 'dashboard', label: 'Dashboard' },
                { value: 'export', label: 'Export file' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Expires" name="expires" initialValue="30d">
            <Select
              options={[
                { value: '1d', label: '1 day' },
                { value: '7d', label: '7 days' },
                { value: '30d', label: '30 days' },
                { value: 'never', label: 'Never' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Password-protect" name="password" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Share link created"
        open={!!created}
        onCancel={() => setCreated(null)}
        onOk={() => setCreated(null)}
        okText="Done"
        cancelButtonProps={{ style: { display: 'none' } }}>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Space>
            <CheckCircleOutlined style={{ color: '#027A48', fontSize: 20 }} />
            <Text>Share it anywhere; access respects your permissions.</Text>
          </Space>
          <Space.Compact style={{ width: '100%' }}>
            <Input value={created ?? ''} readOnly />
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                if (created) {
                  navigator.clipboard.writeText(created);
                  message.success('Copied');
                }
              }}>
              Copy
            </Button>
          </Space.Compact>
        </Space>
      </Modal>
    </>
  );
}
