import {
  Row,
  Col,
  Card,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  BellOutlined,
  SendOutlined,
  HistoryOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface Alert {
  id: string;
  name: string;
  severity: 'info' | 'warn' | 'critical';
  trigger: string;
  channels: string[];
  enabled: boolean;
  last_fired: string;
  fired_7d: number;
}

const seed: Alert[] = [
  {
    id: 'al-dq-breach',
    name: 'DQ score below threshold',
    severity: 'warn',
    trigger: 'completeness < 85% for any entity',
    channels: ['Email · stewards', 'In-app'],
    enabled: true,
    last_fired: '2 hours ago',
    fired_7d: 3,
  },
  {
    id: 'al-pipeline-fail',
    name: 'Pipeline failure',
    severity: 'critical',
    trigger: 'any pipeline run status=failed',
    channels: ['Email · data-ops', 'Slack #data-ops', 'In-app'],
    enabled: true,
    last_fired: '18 min ago',
    fired_7d: 7,
  },
  {
    id: 'al-cr-sla',
    name: 'CR SLA breach',
    severity: 'warn',
    trigger: 'cr.open AND age > 48h',
    channels: ['Email · requester', 'In-app'],
    enabled: true,
    last_fired: 'Yesterday',
    fired_7d: 2,
  },
  {
    id: 'al-sap-c4c-down',
    name: 'SAP C4C unreachable',
    severity: 'critical',
    trigger: 'source.probe=fail for 3 consecutive checks',
    channels: ['Slack #data-ops', 'Email · it'],
    enabled: true,
    last_fired: '—',
    fired_7d: 0,
  },
  {
    id: 'al-mass-change',
    name: 'Mass change detected',
    severity: 'info',
    trigger: 'approved_changes_per_hour > 50 on same entity',
    channels: ['In-app'],
    enabled: false,
    last_fired: '2 weeks ago',
    fired_7d: 0,
  },
];

const sevTag: Record<Alert['severity'], { color: string; label: string }> = {
  info: { color: 'processing', label: 'INFO' },
  warn: { color: 'warning', label: 'WARN' },
  critical: { color: 'error', label: 'CRITICAL' },
};

export default function AlertsListPage() {
  const [rows, setRows] = useState<Alert[]>(seed);

  const toggle = (id: string) =>
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );

  const columns: ColumnsType<Alert> = [
    {
      title: '',
      dataIndex: 'enabled',
      width: 70,
      render: (v: boolean, r) => (
        <Switch size="small" checked={v} onChange={() => toggle(r.id)} />
      ),
    },
    {
      title: 'Rule',
      key: 'name',
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Link to={`/alerts/${r.id}`}>
            <strong>{r.name}</strong>
          </Link>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <code>{r.trigger}</code>
          </Text>
        </Space>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 120,
      render: (s: Alert['severity']) => (
        <Tag color={sevTag[s].color} bordered={false}>
          {sevTag[s].label}
        </Tag>
      ),
    },
    {
      title: 'Channels',
      dataIndex: 'channels',
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
    { title: 'Last fired', dataIndex: 'last_fired', width: 140 },
    { title: 'Fired (7d)', dataIndex: 'fired_7d', width: 110, align: 'right' as const },
  ];

  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.enabled).length,
    critical: rows.filter((r) => r.severity === 'critical' && r.enabled).length,
    fired_7d: rows.reduce((n, r) => n + r.fired_7d, 0),
  };

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="Rules that watch the system and page the right people when they fire."
        actions={
          <>
            <Link to={ROUTES.ALERT_CHANNELS}>
              <Button icon={<SendOutlined />}>Channels</Button>
            </Link>
            <Link to={ROUTES.ALERT_HISTORY}>
              <Button icon={<HistoryOutlined />}>History</Button>
            </Link>
            <Link to={ROUTES.ALERT_NEW}>
              <Button type="primary" icon={<PlusOutlined />}>
                New alert
              </Button>
            </Link>
          </>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">
                <BellOutlined /> Total
              </Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{stats.total}</span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Active</Text>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#027A48' }}>
                {stats.active}
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">
                <WarningFilled /> Critical active
              </Text>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#B42318' }}>
                {stats.critical}
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Fired · 7d</Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{stats.fired_7d}</span>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card>
        <Table rowKey="id" columns={columns} dataSource={rows} />
      </Card>
    </>
  );
}
