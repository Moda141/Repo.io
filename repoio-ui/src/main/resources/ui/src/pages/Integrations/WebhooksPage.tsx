import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  Select,
  message,
} from 'antd';
import {
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';

interface Hook {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  last_fire: string;
  success_rate: number;
}

const seed: Hook[] = [
  {
    id: 'wh-01',
    name: 'PagerDuty · critical alerts',
    url: 'https://events.pagerduty.com/v2/enqueue',
    events: ['alert.critical'],
    enabled: true,
    last_fire: '2 hours ago',
    success_rate: 100,
  },
  {
    id: 'wh-02',
    name: 'Teams · stewards channel',
    url: 'https://outlook.office.com/webhook/xxxx',
    events: ['cr.opened', 'cr.approved'],
    enabled: true,
    last_fire: '18 min ago',
    success_rate: 99.2,
  },
  {
    id: 'wh-03',
    name: 'ERP outbox · customer changes',
    url: 'https://erp.nahdetmisr.com/api/mdm/customer-changes',
    events: ['changes.customer'],
    enabled: true,
    last_fire: '2 min ago',
    success_rate: 99.9,
  },
];

export default function WebhooksPage() {
  const [rows, setRows] = useState<Hook[]>(seed);
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();

  const columns: ColumnsType<Hook> = [
    {
      title: '',
      dataIndex: 'enabled',
      width: 70,
      render: (v: boolean, r) => (
        <Switch
          size="small"
          checked={v}
          onChange={(c) =>
            setRows((prev) =>
              prev.map((h) => (h.id === r.id ? { ...h, enabled: c } : h))
            )
          }
        />
      ),
    },
    {
      title: 'Name',
      key: 'name',
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <strong>{r.name}</strong>
          <code style={{ color: '#667085', fontSize: 12 }}>{r.url}</code>
        </Space>
      ),
    },
    {
      title: 'Events',
      dataIndex: 'events',
      render: (ev: string[]) => (
        <Space size={4} wrap>
          {ev.map((e) => (
            <Tag key={e} bordered={false}>
              {e}
            </Tag>
          ))}
        </Space>
      ),
    },
    { title: 'Last fire', dataIndex: 'last_fire', width: 140 },
    {
      title: 'Success',
      dataIndex: 'success_rate',
      width: 110,
      align: 'right' as const,
      render: (n: number) => (
        <strong style={{ color: n >= 99 ? '#027A48' : '#F79009' }}>
          {n.toFixed(1)}%
        </strong>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: () => (
        <Button type="link" size="small" icon={<ThunderboltOutlined />}>
          Test
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Outgoing webhooks"
        subtitle="Fire HTTP POSTs on events — alerts, CR lifecycle, change events for the outbox pattern."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
            Add webhook
          </Button>
        }
      />

      <Card>
        <Table rowKey="id" columns={columns} dataSource={rows} />
      </Card>

      <Modal
        title="Add webhook"
        open={adding}
        onCancel={() => setAdding(false)}
        onOk={() =>
          form.validateFields().then((v) => {
            setRows((prev) => [
              {
                id: `wh-${Date.now()}`,
                name: v.name,
                url: v.url,
                events: v.events ?? [],
                enabled: true,
                last_fire: 'never',
                success_rate: 100,
              },
              ...prev,
            ]);
            setAdding(false);
            form.resetFields();
            message.success('Webhook added');
          })
        }>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="URL" name="url" rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://…" />
          </Form.Item>
          <Form.Item label="Events" name="events" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              options={[
                { value: 'cr.opened', label: 'cr.opened' },
                { value: 'cr.approved', label: 'cr.approved' },
                { value: 'cr.rejected', label: 'cr.rejected' },
                { value: 'alert.critical', label: 'alert.critical' },
                { value: 'alert.warn', label: 'alert.warn' },
                { value: 'pipeline.failed', label: 'pipeline.failed' },
                { value: 'changes.customer', label: 'changes.customer' },
                { value: 'changes.vendor', label: 'changes.vendor' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Signing secret (optional)" name="secret">
            <Input.Password placeholder="HMAC-SHA256 secret for X-Repoio-Signature" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
