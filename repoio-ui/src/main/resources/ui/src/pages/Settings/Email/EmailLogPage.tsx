import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  DatePicker,
  Typography,
  Drawer,
  Descriptions,
} from 'antd';
import { SearchOutlined, DownloadOutlined, SendOutlined } from '@ant-design/icons';
import { useState, useMemo } from 'react';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { RangePicker } = DatePicker;

type Status = 'queued' | 'sent' | 'delivered' | 'bounced' | 'suppressed';

interface Row {
  id: string;
  at: string;
  to: string;
  template: string;
  subject: string;
  status: Status;
  provider_id?: string;
  reason?: string;
}

const seed: Row[] = [
  {
    id: 'em-11021502',
    at: '2026-11-02 15:02:11',
    to: 'ahmed@nahdetmisr.com',
    template: 'cr_opened',
    subject: 'Change request CR-00128 needs your review',
    status: 'delivered',
    provider_id: 'AAMkADG4...',
  },
  {
    id: 'em-11021450',
    at: '2026-11-02 14:50:12',
    to: 'data-ops@nahdetmisr.com',
    template: 'alert_pipeline_failed',
    subject: 'Alert · sqlserver-products failed',
    status: 'delivered',
  },
  {
    id: 'em-11021300',
    at: '2026-11-02 13:00:04',
    to: 'repoio-stewards@nahdetmisr.com',
    template: 'alert_dq_breach',
    subject: 'Alert · completeness for author dropped to 68.7%',
    status: 'delivered',
  },
  {
    id: 'em-11020800',
    at: '2026-11-02 08:00:00',
    to: 'yara@nahdetmisr.com',
    template: 'user_invited',
    subject: 'You have been invited to Repo.io',
    status: 'bounced',
    reason: '550 5.1.1 recipient does not exist',
  },
  {
    id: 'em-11020900',
    at: '2026-11-02 09:00:21',
    to: 'external@acme.example',
    template: 'cr_approved',
    subject: 'Change request CR-00126 approved',
    status: 'suppressed',
    reason: 'Outside @nahdetmisr.com (guard enabled)',
  },
];

const statusTag: Record<Status, { color: string; label: string }> = {
  queued: { color: 'default', label: 'QUEUED' },
  sent: { color: 'processing', label: 'SENT' },
  delivered: { color: 'success', label: 'DELIVERED' },
  bounced: { color: 'error', label: 'BOUNCED' },
  suppressed: { color: 'warning', label: 'SUPPRESSED' },
};

export default function EmailLogPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status | undefined>();
  const [selected, setSelected] = useState<Row | null>(null);

  const rows = useMemo(
    () =>
      seed.filter((r) => {
        if (status && r.status !== status) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          return (
            r.id.toLowerCase().includes(q) ||
            r.to.toLowerCase().includes(q) ||
            r.subject.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [query, status]
  );

  const columns: ColumnsType<Row> = [
    { title: 'When', dataIndex: 'at', width: 180 },
    { title: 'To', dataIndex: 'to', width: 260 },
    {
      title: 'Template',
      dataIndex: 'template',
      width: 180,
      render: (v) => <code>{v}</code>,
    },
    { title: 'Subject', dataIndex: 'subject' },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      render: (s: Status) => (
        <Tag color={statusTag[s].color} bordered={false}>
          {statusTag[s].label}
        </Tag>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Email send log"
        subtitle="Every email the tool tried to send, with provider status and reasons."
        actions={<Button icon={<DownloadOutlined />}>Export CSV</Button>}
      />
      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search id, recipient, subject…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            allowClear
            style={{ width: 340 }}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 180 }}
            value={status}
            onChange={(v) => setStatus(v)}
            options={(Object.keys(statusTag) as Status[]).map((s) => ({
              value: s,
              label: statusTag[s].label,
            }))}
          />
          <RangePicker />
          <Text type="secondary">
            {rows.length} of {seed.length}
          </Text>
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          onRow={(r) => ({
            onClick: () => setSelected(r),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      <Drawer
        title="Email event"
        placement="right"
        width={520}
        open={!!selected}
        onClose={() => setSelected(null)}
        extra={
          <Button icon={<SendOutlined />} size="small">
            Resend
          </Button>
        }>
        {selected && (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Event ID">
              <code>{selected.id}</code>
            </Descriptions.Item>
            <Descriptions.Item label="When">{selected.at}</Descriptions.Item>
            <Descriptions.Item label="To">{selected.to}</Descriptions.Item>
            <Descriptions.Item label="Template">
              <code>{selected.template}</code>
            </Descriptions.Item>
            <Descriptions.Item label="Subject">{selected.subject}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={statusTag[selected.status].color} bordered={false}>
                {statusTag[selected.status].label}
              </Tag>
            </Descriptions.Item>
            {selected.provider_id && (
              <Descriptions.Item label="Provider ID">
                <code>{selected.provider_id}</code>
              </Descriptions.Item>
            )}
            {selected.reason && (
              <Descriptions.Item label="Reason">
                {selected.reason}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Drawer>
    </>
  );
}
