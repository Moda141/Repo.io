import { Card, Table, Tag, Typography, Timeline, Space, Button } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface Run {
  id: string;
  started: string;
  trigger: string;
  duration: string;
  status: 'success' | 'failed' | 'running';
  steps: {
    label: string;
    at: string;
    status: 'ok' | 'fail' | 'running';
    detail?: string;
  }[];
}

const runs: Run[] = [
  {
    id: 'wr-11021502',
    started: '2026-11-02 15:02',
    trigger: 'cr.opened CR-00128',
    duration: '00:00:42',
    status: 'running',
    steps: [
      { label: 'Trigger · cr.opened', at: '15:02:11', status: 'ok' },
      { label: 'Condition · segment=enterprise', at: '15:02:12', status: 'ok', detail: 'matched' },
      { label: 'Approve · Stewards', at: '15:02:13', status: 'running' },
    ],
  },
  {
    id: 'wr-11020812',
    started: '2026-11-02 08:12',
    trigger: 'cr.opened CR-00124',
    duration: '00:08:04',
    status: 'failed',
    steps: [
      { label: 'Trigger · cr.opened', at: '08:12:04', status: 'ok' },
      { label: 'Condition · segment=enterprise', at: '08:12:05', status: 'ok' },
      { label: 'Approve · Stewards', at: '08:14:11', status: 'ok' },
      { label: 'Approve · Admins', at: '08:20:08', status: 'fail', detail: 'SLA exceeded (6h cap)' },
    ],
  },
];

export default function WorkflowRunsPage() {
  const { workflowId = '' } = useParams();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string>(runs[0]!.id);
  const selected = runs.find((r) => r.id === selectedId) ?? runs[0]!;

  const columns: ColumnsType<Run> = [
    {
      title: 'Run',
      dataIndex: 'id',
      render: (v: string, r: Run) => (
        <Text strong={r.id === selectedId}>
          <code>{v}</code>
        </Text>
      ),
    },
    { title: 'Started', dataIndex: 'started', width: 170 },
    { title: 'Duration', dataIndex: 'duration', width: 110 },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (s: Run['status']) =>
        s === 'success' ? (
          <Tag color="success" icon={<CheckCircleOutlined />} bordered={false}>SUCCESS</Tag>
        ) : s === 'failed' ? (
          <Tag color="error" icon={<CloseCircleOutlined />} bordered={false}>FAILED</Tag>
        ) : (
          <Tag color="processing" icon={<PlayCircleOutlined />} bordered={false}>RUNNING</Tag>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={`Runs · ${workflowId}`}
        subtitle="Click a run to see its per-step timeline."
        actions={
          <Button icon={<RollbackOutlined />} onClick={() => navigate(-1)}>
            Back
          </Button>
        }
      />
      <Card style={{ marginBottom: 16 }}>
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={runs}
          pagination={false}
          onRow={(r) => ({
            onClick: () => setSelectedId(r.id),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      <Card
        title={
          <Space>
            <code>{selected.id}</code>
            <Text type="secondary">· {selected.started}</Text>
          </Space>
        }>
        <Timeline
          items={selected.steps.map((s) => ({
            color: s.status === 'ok' ? '#12B76A' : s.status === 'fail' ? '#F04438' : '#1570EF',
            dot:
              s.status === 'ok' ? <CheckCircleOutlined /> :
              s.status === 'fail' ? <CloseCircleOutlined /> :
              <PlayCircleOutlined />,
            children: (
              <Space direction="vertical" size={0}>
                <strong>{s.label}</strong>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {s.at} {s.detail && `· ${s.detail}`}
                </Text>
              </Space>
            ),
          }))}
        />
      </Card>
    </>
  );
}
