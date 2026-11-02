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
  Typography,
  Alert,
  message,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  KeyOutlined,
  CopyOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

/**
 * ApiKeysPage — service accounts for FastAPI ingest, scripts and
 * agents that can't log in interactively.
 *
 * Keys are shown once at creation and never again (hashed in storage).
 * Each key is bound to a role, an expiry and an IP allowlist. Rotation
 * works by issuing a new key with the same role and revoking the old
 * one — a scheduled job removes expired keys from the DB.
 */

interface Key {
  id: string;
  label: string;
  role: string;
  prefix: string;
  created_at: string;
  expires_at: string;
  last_used: string;
  status: 'active' | 'expired' | 'revoked';
}

const seed: Key[] = [
  {
    id: 'k-01',
    label: 'FastAPI ingest · prod',
    role: 'AI agent',
    prefix: 'repoio_live_7A4K',
    created_at: '2026-09-10',
    expires_at: '2027-09-10',
    last_used: '2 minutes ago',
    status: 'active',
  },
  {
    id: 'k-02',
    label: 'Airflow DAGs',
    role: 'Steward',
    prefix: 'repoio_live_9HG2',
    created_at: '2026-09-10',
    expires_at: '2027-09-10',
    last_used: '1 hour ago',
    status: 'active',
  },
  {
    id: 'k-03',
    label: 'Reporting script (Finance)',
    role: 'Reader',
    prefix: 'repoio_live_K84L',
    created_at: '2026-07-01',
    expires_at: '2026-10-01',
    last_used: '28 days ago',
    status: 'expired',
  },
  {
    id: 'k-04',
    label: 'Legacy integration',
    role: 'Reader',
    prefix: 'repoio_live_X11A',
    created_at: '2026-05-14',
    expires_at: '2027-05-14',
    last_used: '-',
    status: 'revoked',
  },
];

export default function ApiKeysPage() {
  const [rows, setRows] = useState<Key[]>(seed);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [form] = Form.useForm();

  const create = () => {
    form.validateFields().then((v) => {
      const prefix = `repoio_live_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const full = `${prefix}_${Math.random().toString(36).slice(2, 42)}`;
      setRows((prev) => [
        {
          id: `k-${Date.now()}`,
          label: v.label,
          role: v.role,
          prefix,
          created_at: new Date().toISOString().slice(0, 10),
          expires_at: '2027-11-02',
          last_used: '—',
          status: 'active',
        },
        ...prev,
      ]);
      setNewKey(full);
      setCreating(false);
      form.resetFields();
    });
  };

  const revoke = (id: string) => {
    setRows((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: 'revoked' } : k))
    );
    message.success('Key revoked');
  };

  const columns: ColumnsType<Key> = [
    {
      title: 'Key',
      key: 'label',
      render: (_, r) => (
        <Space>
          <KeyOutlined style={{ color: '#1570EF' }} />
          <div>
            <strong>{r.label}</strong>
            <div>
              <code style={{ fontSize: 12, color: '#667085' }}>
                {r.prefix}_••••••••••••••••
              </code>
            </div>
          </div>
        </Space>
      ),
    },
    { title: 'Role', dataIndex: 'role', width: 140 },
    { title: 'Created', dataIndex: 'created_at', width: 130 },
    { title: 'Expires', dataIndex: 'expires_at', width: 130 },
    { title: 'Last used', dataIndex: 'last_used', width: 150 },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (s: Key['status']) => (
        <Tag
          color={
            s === 'active'
              ? 'success'
              : s === 'expired'
                ? 'warning'
                : 'default'
          }
          bordered={false}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_, r) =>
        r.status === 'active' ? (
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => revoke(r.id)}>
            Revoke
          </Button>
        ) : null,
    },
  ];

  const stats = {
    active: rows.filter((k) => k.status === 'active').length,
    expired: rows.filter((k) => k.status === 'expired').length,
    revoked: rows.filter((k) => k.status === 'revoked').length,
  };

  return (
    <>
      <PageHeader
        title="API keys"
        subtitle="Service accounts for ingest, scripts, agents — things that can't do interactive SSO."
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreating(true)}>
            Create key
          </Button>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Active</Text>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#027A48' }}>
                {stats.active}
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Expired</Text>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#F79009' }}>
                {stats.expired}
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Revoked</Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{stats.revoked}</span>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card>
        <Table rowKey="id" columns={columns} dataSource={rows} />
      </Card>

      <Modal
        title="Create API key"
        open={creating}
        onCancel={() => setCreating(false)}
        onOk={create}
        okText="Create">
        <Alert
          type="warning"
          showIcon
          message="The key will be shown only once"
          description="Copy it now; after this dialog closes you can't retrieve the full value."
          style={{ marginBottom: 12 }}
        />
        <Form form={form} layout="vertical">
          <Form.Item label="Label" name="label" rules={[{ required: true }]}>
            <Input placeholder="e.g. FastAPI ingest · staging" />
          </Form.Item>
          <Form.Item label="Role" name="role" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'Admin', label: 'Admin' },
                { value: 'Steward', label: 'Steward' },
                { value: 'Reader', label: 'Reader' },
                { value: 'AI agent', label: 'AI agent' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Expires in" name="expires" initialValue="365d">
            <Select
              options={[
                { value: '30d', label: '30 days' },
                { value: '90d', label: '90 days' },
                { value: '365d', label: '1 year' },
                { value: 'never', label: 'Never' },
              ]}
            />
          </Form.Item>
          <Form.Item label="IP allowlist (CIDR, one per line)" name="cidrs">
            <Input.TextArea rows={2} placeholder="10.0.0.0/8" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Your new API key"
        open={!!newKey}
        onCancel={() => setNewKey(null)}
        onOk={() => setNewKey(null)}
        okText="I've copied it"
        cancelButtonProps={{ style: { display: 'none' } }}>
        <Alert
          type="warning"
          icon={<CheckCircleOutlined />}
          showIcon
          message="Copy and store this securely — it won't be shown again."
          style={{ marginBottom: 12 }}
        />
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={newKey ?? ''}
            readOnly
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          />
          <Button
            icon={<CopyOutlined />}
            onClick={() => {
              if (newKey) {
                navigator.clipboard.writeText(newKey);
                message.success('Copied');
              }
            }}>
            Copy
          </Button>
        </Space.Compact>
      </Modal>
    </>
  );
}
