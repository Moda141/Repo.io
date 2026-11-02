import { Row, Col, Card, Table, Tag, Button, Space, Avatar, Typography } from 'antd';
import {
  PlusOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  PauseCircleOutlined,
  SwapOutlined,
  ApiOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ColumnsType } from 'antd/es/table';
import type { ReactNode } from 'react';

const { Text } = Typography;

/**
 * WorkflowsListPage — every automation the tool runs.
 *
 * Workflows cover CR approval routing (two-approver chains, segment-
 * based routing), scheduled tasks (nightly re-match, weekly digests),
 * escalations (unanswered CR > 48h → manager), and event-driven jobs
 * (new SAP C4C contact → auto-create customer skeleton).
 */

interface Workflow {
  id: string;
  name: string;
  trigger: 'event' | 'schedule' | 'manual';
  kind: 'approval' | 'automation' | 'notification';
  owner: string;
  status: 'active' | 'paused';
  runs_7d: number;
  success_rate: number;
}

const rows: Workflow[] = [
  {
    id: 'wf-cr-approval',
    name: 'CR approval · 2-eye for enterprise',
    trigger: 'event',
    kind: 'approval',
    owner: 'mohamed@nahdetmisr.com',
    status: 'active',
    runs_7d: 32,
    success_rate: 100,
  },
  {
    id: 'wf-escalation',
    name: 'Escalate unanswered CR > 48h',
    trigger: 'schedule',
    kind: 'notification',
    owner: 'mohamed@nahdetmisr.com',
    status: 'active',
    runs_7d: 7,
    success_rate: 100,
  },
  {
    id: 'wf-c4c-auto-create',
    name: 'Auto-create Customer from new C4C contact',
    trigger: 'event',
    kind: 'automation',
    owner: 'ahmed@nahdetmisr.com',
    status: 'active',
    runs_7d: 128,
    success_rate: 98.4,
  },
  {
    id: 'wf-weekly-digest',
    name: 'Weekly steward digest · Mon 08:00',
    trigger: 'schedule',
    kind: 'notification',
    owner: 'mohamed@nahdetmisr.com',
    status: 'active',
    runs_7d: 1,
    success_rate: 100,
  },
  {
    id: 'wf-nightly-rematch',
    name: 'Nightly Splink re-match (new sources)',
    trigger: 'schedule',
    kind: 'automation',
    owner: 'mohamed@nahdetmisr.com',
    status: 'paused',
    runs_7d: 0,
    success_rate: 0,
  },
];

const kindIcon: Record<Workflow['kind'], ReactNode> = {
  approval: <SwapOutlined style={{ color: '#F79009' }} />,
  automation: <ApiOutlined style={{ color: '#1570EF' }} />,
  notification: <TeamOutlined style={{ color: '#6938EF' }} />,
};

const triggerLabel: Record<Workflow['trigger'], string> = {
  event: 'On event',
  schedule: 'Scheduled',
  manual: 'Manual',
};

export default function WorkflowsListPage() {
  const columns: ColumnsType<Workflow> = [
    {
      title: 'Workflow',
      key: 'name',
      render: (_, r) => (
        <Space>
          <Avatar
            style={{ background: 'transparent' }}
            icon={kindIcon[r.kind]}
          />
          <div>
            <Link to={`/workflows/${r.id}`}>
              <strong>{r.name}</strong>
            </Link>
            <div style={{ color: '#667085', fontSize: 12 }}>
              <code>{r.id}</code>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Trigger',
      dataIndex: 'trigger',
      width: 140,
      render: (t: Workflow['trigger']) => (
        <Tag bordered={false}>{triggerLabel[t]}</Tag>
      ),
    },
    { title: 'Owner', dataIndex: 'owner', width: 240 },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (s: Workflow['status']) =>
        s === 'active' ? (
          <Tag color="success" icon={<CheckCircleOutlined />} bordered={false}>
            ACTIVE
          </Tag>
        ) : (
          <Tag color="default" icon={<PauseCircleOutlined />} bordered={false}>
            PAUSED
          </Tag>
        ),
    },
    {
      title: 'Runs (7d)',
      dataIndex: 'runs_7d',
      width: 110,
      align: 'right' as const,
    },
    {
      title: 'Success',
      dataIndex: 'success_rate',
      width: 110,
      align: 'right' as const,
      render: (n: number) =>
        n ? (
          <strong style={{ color: n >= 99 ? '#027A48' : '#F79009' }}>
            {n.toFixed(1)}%
          </strong>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  const stats = {
    active: rows.filter((r) => r.status === 'active').length,
    paused: rows.filter((r) => r.status === 'paused').length,
    runs: rows.reduce((n, r) => n + r.runs_7d, 0),
  };

  return (
    <>
      <PageHeader
        title="Workflows"
        subtitle="Approvals, escalations, scheduled jobs and event-driven automations."
        actions={
          <Link to={ROUTES.WORKFLOW_NEW}>
            <Button type="primary" icon={<PlusOutlined />}>
              New workflow
            </Button>
          </Link>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
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
              <Text type="secondary">Paused</Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{stats.paused}</span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Runs · 7d</Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{stats.runs}</span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">
                <BranchesOutlined /> Approval chains
              </Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>
                {rows.filter((r) => r.kind === 'approval').length}
              </span>
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
