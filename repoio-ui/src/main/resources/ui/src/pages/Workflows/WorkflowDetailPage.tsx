import {
  Row,
  Col,
  Card,
  Button,
  Tag,
  Statistic,
  Tabs,
  Table,
  Timeline,
  Descriptions,
} from 'antd';
import {
  EditOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import { Link, useParams, generatePath } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ColumnsType } from 'antd/es/table';

interface Run {
  id: string;
  started: string;
  trigger: string;
  duration: string;
  status: 'success' | 'failed' | 'running';
}

const runs: Run[] = [
  { id: 'wr-11021502', started: '2026-11-02 15:02', trigger: 'cr.opened CR-00128', duration: '00:00:42', status: 'running' },
  { id: 'wr-11021420', started: '2026-11-02 14:20', trigger: 'cr.opened CR-00127', duration: '00:03:11', status: 'success' },
  { id: 'wr-11021000', started: '2026-11-02 10:00', trigger: 'cr.opened CR-00126', duration: '00:02:48', status: 'success' },
  { id: 'wr-11020812', started: '2026-11-02 08:12', trigger: 'cr.opened CR-00124', duration: '00:08:04', status: 'failed' },
];

export default function WorkflowDetailPage() {
  const { workflowId = '' } = useParams();
  const [paused, setPaused] = useState(false);

  const columns: ColumnsType<Run> = [
    { title: 'Run', dataIndex: 'id', width: 160, render: (v) => <code>{v}</code> },
    { title: 'Started', dataIndex: 'started', width: 180 },
    { title: 'Trigger', dataIndex: 'trigger' },
    { title: 'Duration', dataIndex: 'duration', width: 120 },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (s: Run['status']) =>
        s === 'success' ? (
          <Tag color="success" icon={<CheckCircleOutlined />} bordered={false}>
            SUCCESS
          </Tag>
        ) : s === 'failed' ? (
          <Tag color="error" icon={<CloseCircleOutlined />} bordered={false}>
            FAILED
          </Tag>
        ) : (
          <Tag color="processing" icon={<PlayCircleOutlined />} bordered={false}>
            RUNNING
          </Tag>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={`Workflow · ${workflowId}`}
        subtitle="CR approval · 2-eye for enterprise"
        actions={
          <>
            <Button
              icon={paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              onClick={() => setPaused((p) => !p)}>
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button icon={<ReloadOutlined />}>Run now</Button>
            <Link to={generatePath(ROUTES.WORKFLOW_EDIT, { workflowId })}>
              <Button type="primary" icon={<EditOutlined />}>
                Edit
              </Button>
            </Link>
          </>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Runs (7d)" value={32} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Success rate"
              value={96.9}
              suffix="%"
              valueStyle={{ color: '#027A48' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Avg duration" value="2m 48s" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Status"
              value={paused ? 'Paused' : 'Active'}
              valueStyle={{ color: paused ? '#667085' : '#027A48' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="runs"
        items={[
          {
            key: 'runs',
            label: `Runs (${runs.length})`,
            children: (
              <Card>
                <Table rowKey="id" columns={columns} dataSource={runs} pagination={false} />
              </Card>
            ),
          },
          {
            key: 'graph',
            label: 'Graph',
            children: (
              <Card>
                <Timeline
                  items={[
                    {
                      color: '#1570EF',
                      dot: <BranchesOutlined />,
                      children: <strong>Trigger · cr.opened entity=customer</strong>,
                    },
                    {
                      color: '#6938EF',
                      children: 'Condition · cr.target.segment == "enterprise"',
                    },
                    { color: '#F79009', children: 'Approve · Stewards (min 1)' },
                    { color: '#F79009', children: 'Approve · Admins (min 1)' },
                    { color: '#12B76A', children: 'Notify · template=cr_approved' },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'triggers',
            label: 'Triggers',
            children: (
              <Card>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Kind">Event</Descriptions.Item>
                  <Descriptions.Item label="Event">cr.opened</Descriptions.Item>
                  <Descriptions.Item label="Entity filter">customer</Descriptions.Item>
                  <Descriptions.Item label="Rate limit">10/min per user</Descriptions.Item>
                  <Descriptions.Item label="On error">Retry 3× with 60s backoff</Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}
