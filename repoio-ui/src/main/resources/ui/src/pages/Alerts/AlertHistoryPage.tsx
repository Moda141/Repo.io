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
  Timeline,
} from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { useState, useMemo } from 'react';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface Fire {
  id: string;
  at: string;
  rule: string;
  severity: 'info' | 'warn' | 'critical';
  message: string;
  channels: string[];
  acked_by?: string;
  resolved_at?: string;
}

const seed: Fire[] = [
  {
    id: 'af-11021450',
    at: '2026-11-02 14:50:04',
    rule: 'Pipeline failure',
    severity: 'critical',
    message: 'sqlserver-products run r-11020600 failed · JDBC timeout',
    channels: ['Slack #data-ops', 'Email · data-ops'],
    acked_by: 'mohamed@nahdetmisr.com',
    resolved_at: '2026-11-02 15:02:11',
  },
  {
    id: 'af-11021300',
    at: '2026-11-02 13:00:12',
    rule: 'DQ score below threshold',
    severity: 'warn',
    message: 'completeness for author dropped to 68.7% (threshold 75%)',
    channels: ['Email · stewards', 'In-app'],
  },
  {
    id: 'af-11020900',
    at: '2026-11-02 09:00:00',
    rule: 'CR SLA breach',
    severity: 'warn',
    message: 'CR-00124 open 48h — escalated to Admin',
    channels: ['Email · requester'],
  },
  {
    id: 'af-11010900',
    at: '2026-11-01 09:00:00',
    rule: 'CR SLA breach',
    severity: 'warn',
    message: 'CR-00118 open 48h',
    channels: ['Email · requester'],
    acked_by: 'ahmed@nahdetmisr.com',
    resolved_at: '2026-11-01 09:20:11',
  },
];

const sevTag: Record<Fire['severity'], { color: string; label: string }> = {
  info: { color: 'processing', label: 'INFO' },
  warn: { color: 'warning', label: 'WARN' },
  critical: { color: 'error', label: 'CRITICAL' },
};

export default function AlertHistoryPage() {
  const [query, setQuery] = useState('');
  const [sev, setSev] = useState<string | undefined>();
  const [selected, setSelected] = useState<Fire | null>(null);

  const rows = useMemo(
    () =>
      seed.filter((f) => {
        if (sev && f.severity !== sev) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          return (
            f.id.toLowerCase().includes(q) ||
            f.rule.toLowerCase().includes(q) ||
            f.message.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [query, sev]
  );

  const columns: ColumnsType<Fire> = [
    { title: 'When', dataIndex: 'at', width: 180 },
    { title: 'Rule', dataIndex: 'rule', width: 220 },
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 110,
      render: (s: Fire['severity']) => (
        <Tag color={sevTag[s].color} bordered={false}>
          {sevTag[s].label}
        </Tag>
      ),
    },
    { title: 'Message', dataIndex: 'message' },
    {
      title: 'Channels',
      dataIndex: 'channels',
      width: 240,
      render: (ch: string[]) => (
        <Space size={4} wrap>
          {ch.map((c) => (
            <Tag key={c} bordered={false}>
              {c}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      render: (_, r) =>
        r.resolved_at ? (
          <Tag color="success" bordered={false}>
            RESOLVED
          </Tag>
        ) : r.acked_by ? (
          <Tag color="processing" bordered={false}>
            ACKED
          </Tag>
        ) : (
          <Tag color="default" bordered={false}>
            FIRING
          </Tag>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Alert history"
        subtitle="Every fire — who was paged, when they acked, when it resolved."
        actions={<Button icon={<DownloadOutlined />}>Export CSV</Button>}
      />
      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search rule, message, fire id…"
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 340 }}
          />
          <Select
            placeholder="Severity"
            allowClear
            style={{ width: 180 }}
            value={sev}
            onChange={(v) => setSev(v)}
            options={[
              { value: 'info', label: 'Info' },
              { value: 'warn', label: 'Warn' },
              { value: 'critical', label: 'Critical' },
            ]}
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
        title="Alert fire"
        placement="right"
        width={480}
        open={!!selected}
        onClose={() => setSelected(null)}>
        {selected && (
          <>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Fire ID">
                <code>{selected.id}</code>
              </Descriptions.Item>
              <Descriptions.Item label="Rule">{selected.rule}</Descriptions.Item>
              <Descriptions.Item label="Severity">
                <Tag color={sevTag[selected.severity].color} bordered={false}>
                  {sevTag[selected.severity].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Message">{selected.message}</Descriptions.Item>
            </Descriptions>
            <Timeline
              style={{ marginTop: 16 }}
              items={[
                { color: 'red', children: `${selected.at} · Fired` },
                ...(selected.acked_by
                  ? [{ children: `${selected.acked_by} acknowledged` }]
                  : []),
                ...(selected.resolved_at
                  ? [{ color: 'green', children: `${selected.resolved_at} · Resolved` }]
                  : []),
              ]}
            />
          </>
        )}
      </Drawer>
    </>
  );
}
