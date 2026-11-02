import {
  Row,
  Col,
  Card,
  Button,
  Space,
  Tag,
  Statistic,
  Tabs,
  Table,
  Typography,
  Divider,
  Alert,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  EditOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { Link, useParams, generatePath } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

/**
 * PipelineDetailPage — one pipeline's run history, config and logs.
 *
 * The Overview tab gathers the KPIs a steward checks when a pipeline
 * misfires: last run, next scheduled, rows/sec, success rate 7d, latest
 * errors. Runs tab shows the history table — pick a run to drill into
 * its log in the Logs tab. Config tab previews the pipeline YAML with
 * an Edit button that routes to the YAML editor.
 */

interface Run {
  run_id: string;
  started_at: string;
  duration: string;
  rows: number;
  status: 'success' | 'warn' | 'failed' | 'running';
}

const runs: Run[] = [
  { run_id: 'r-11021502', started_at: '2026-11-02 15:02', duration: '00:04:12', rows: 1_204, status: 'running' },
  { run_id: 'r-11020600', started_at: '2026-11-02 06:00', duration: '00:03:48', rows: 1_201, status: 'success' },
  { run_id: 'r-11010600', started_at: '2026-11-01 06:00', duration: '00:03:51', rows: 1_193, status: 'success' },
  { run_id: 'r-10310600', started_at: '2026-10-31 06:00', duration: '00:04:02', rows: 1_188, status: 'warn' },
  { run_id: 'r-10300600', started_at: '2026-10-30 06:00', duration: '00:03:47', rows: 1_172, status: 'failed' },
];

const runColumns: ColumnsType<Run> = [
  { title: 'Run', dataIndex: 'run_id', width: 160, render: (v) => <code>{v}</code> },
  { title: 'Started', dataIndex: 'started_at', width: 180 },
  { title: 'Duration', dataIndex: 'duration', width: 120 },
  {
    title: 'Rows',
    dataIndex: 'rows',
    width: 110,
    align: 'right',
    render: (n: number) => n.toLocaleString(),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    width: 140,
    render: (s: Run['status']) => {
      const map = {
        success: { color: 'success', icon: <CheckCircleOutlined />, label: 'SUCCESS' },
        warn: { color: 'warning', icon: <WarningOutlined />, label: 'WARN' },
        failed: { color: 'error', icon: <CloseCircleOutlined />, label: 'FAILED' },
        running: { color: 'processing', icon: <PlayCircleOutlined />, label: 'RUNNING' },
      } as const;
      const cfg = map[s];
      return (
        <Tag color={cfg.color} icon={cfg.icon} bordered={false}>
          {cfg.label}
        </Tag>
      );
    },
  },
];

const sampleYaml = `name: c4c-customers
source: sap_c4c
entity: customer
schedule: "0 */6 * * *"   # every 6 hours
mapping:
  BusinessPartnerID: master_id
  Name: name
  LegalName: legal_name
  Country: country
  Segment: segment
quality:
  great_expectations_suite: customer.ge.yml
matching:
  splink_config: splink/customer.yml
sink:
  iceberg_table: raw.customer
  kafka_topic: raw.customer
`;

const sampleLog = `[15:02:11] INFO  dispatcher     Starting run r-11021502
[15:02:12] INFO  c4c.client     Authenticated with SAP C4C (tenant: nahdetmisr)
[15:02:14] INFO  c4c.extract    Pulling business partners since 2026-11-02T09:00Z
[15:02:38] INFO  c4c.extract    Received 1,204 records
[15:02:39] INFO  kafka.sink     Writing to raw.customer (partitions=6)
[15:03:04] INFO  kafka.sink     Flushed 1,204 records in 25s (48 rec/s)
[15:03:05] INFO  dq.engine      Running Great Expectations: customer.ge.yml
[15:03:21] INFO  dq.engine      18/18 expectations passed (score 96.3%)
[15:03:22] INFO  splink.match   Candidates: 7 · best score 0.94
[15:03:48] INFO  splink.match   Decision: 4 merges, 3 open for review
[15:03:49] INFO  iceberg.sink   Writing to raw.customer snapshot s-1102-15-03
[15:04:12] INFO  dispatcher     Run r-11021502 ongoing · stage 5/6 (survivorship)
`;

export default function PipelineDetailPage() {
  const { pipelineId = '' } = useParams();
  const [paused, setPaused] = useState(false);

  return (
    <>
      <PageHeader
        title={`Pipeline · ${pipelineId}`}
        subtitle="SAP C4C → Kafka raw.customer → Spark → Iceberg golden.customer"
        actions={
          <>
            <Button
              icon={paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              onClick={() => setPaused((p) => !p)}>
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button icon={<ReloadOutlined />}>Run now</Button>
            <Link
              to={generatePath(ROUTES.PIPELINE_EDIT, { pipelineId })}>
              <Button type="primary" icon={<EditOutlined />}>
                Edit YAML
              </Button>
            </Link>
          </>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Last run" value="4m 12s" />
            <Text type="secondary" style={{ fontSize: 12 }}>
              2026-11-02 15:02
            </Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Success rate (7d)" value={92.6} suffix="%" />
            <Text type="secondary" style={{ fontSize: 12 }}>
              26 of 28 runs
            </Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Rows / run (avg)" value={1_191} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Last 30 days
            </Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Next run" value="in 1h 58m" />
            <Text type="secondary" style={{ fontSize: 12 }}>
              2026-11-02 18:00
            </Text>
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
                <Table
                  rowKey="run_id"
                  columns={runColumns}
                  dataSource={runs}
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: 'logs',
            label: 'Logs',
            children: (
              <Card
                title="r-11021502 · ongoing"
                extra={<Tag color="processing">RUNNING</Tag>}>
                <pre
                  style={{
                    margin: 0,
                    padding: 16,
                    background: '#0C111D',
                    color: '#D0D5DD',
                    borderRadius: 8,
                    fontSize: 12,
                    lineHeight: 1.6,
                    overflowX: 'auto',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                  {sampleLog}
                </pre>
              </Card>
            ),
          },
          {
            key: 'config',
            label: (
              <Space size={6}>
                <CodeOutlined /> Config
              </Space>
            ),
            children: (
              <Card>
                <Alert
                  type="info"
                  showIcon
                  message="Read-only preview — click Edit YAML in the header to change this."
                  style={{ marginBottom: 12 }}
                />
                <pre
                  style={{
                    margin: 0,
                    padding: 16,
                    background: '#F9FAFB',
                    border: '1px solid #EAECF0',
                    borderRadius: 8,
                    fontSize: 13,
                    lineHeight: 1.6,
                    overflowX: 'auto',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                  {sampleYaml}
                </pre>
              </Card>
            ),
          },
          {
            key: 'alerts',
            label: 'Alerts',
            children: (
              <Card>
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Alert
                    type="warning"
                    showIcon
                    message="DQ score below threshold"
                    description="Fired on run r-10310600 — completeness dropped to 83%. Threshold is 85%."
                  />
                  <Divider style={{ margin: '4px 0' }} />
                  <Text type="secondary">
                    Alert rules are set on the Source and DQ pages. This panel
                    will show every alert raised by this pipeline.
                  </Text>
                </Space>
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}
