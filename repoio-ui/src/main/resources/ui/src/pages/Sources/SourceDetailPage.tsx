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
  Descriptions,
  Alert,
  Typography,
  Divider,
} from 'antd';
import {
  CheckCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  LinkOutlined,
  CloudOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

/**
 * SourceDetailPage — one source system, in depth.
 *
 * Overview carries the connection string, auth mode, counts and health.
 * Pipelines lists the pipelines that pull from this source. Schemas
 * shows the tables/entities Repo.io has discovered. Syncs shows the last
 * N connection attempts (useful when debugging an outage).
 */

interface Pipeline {
  id: string;
  name: string;
  entity: string;
  schedule: string;
  last_run: string;
  status: 'ok' | 'warn';
}

const pipelines: Pipeline[] = [
  {
    id: 'c4c-customers',
    name: 'c4c-customers',
    entity: 'Customer',
    schedule: 'every 6h',
    last_run: '2026-11-02 15:02',
    status: 'ok',
  },
  {
    id: 'c4c-contacts',
    name: 'c4c-contacts',
    entity: 'Customer',
    schedule: 'daily @ 02:00',
    last_run: '2026-11-02 02:03',
    status: 'ok',
  },
  {
    id: 'c4c-opportunities',
    name: 'c4c-opportunities',
    entity: 'Customer',
    schedule: 'every 12h',
    last_run: '2026-11-02 06:00',
    status: 'warn',
  },
];

interface SchemaRow {
  key: string;
  object: string;
  mapped_entity: string;
  fields: number;
}

const schemas: SchemaRow[] = [
  { key: 'BusinessPartner', object: 'BusinessPartner', mapped_entity: 'Customer', fields: 72 },
  { key: 'Contact', object: 'Contact', mapped_entity: 'Customer', fields: 48 },
  { key: 'Opportunity', object: 'Opportunity', mapped_entity: '(domain)', fields: 36 },
];

interface Sync {
  started_at: string;
  pipeline: string;
  duration: string;
  rows: number;
  status: 'ok' | 'warn' | 'failed';
}

const syncs: Sync[] = [
  { started_at: '2026-11-02 15:02', pipeline: 'c4c-customers', duration: '00:04:12', rows: 1_204, status: 'ok' },
  { started_at: '2026-11-02 06:00', pipeline: 'c4c-customers', duration: '00:03:48', rows: 1_201, status: 'ok' },
  { started_at: '2026-11-02 02:03', pipeline: 'c4c-contacts', duration: '00:02:27', rows: 823, status: 'ok' },
  { started_at: '2026-11-01 23:30', pipeline: 'c4c-opportunities', duration: '00:05:08', rows: 42, status: 'warn' },
];

export default function SourceDetailPage() {
  const { sourceId = '' } = useParams();

  const pipelineColumns: ColumnsType<Pipeline> = [
    {
      title: 'Pipeline',
      dataIndex: 'name',
      render: (name: string) => (
        <Link to={`/pipelines/${name}`}>
          <code>{name}</code>
        </Link>
      ),
    },
    { title: 'Entity', dataIndex: 'entity' },
    { title: 'Schedule', dataIndex: 'schedule' },
    { title: 'Last run', dataIndex: 'last_run' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s) => (
        <Tag color={s === 'ok' ? 'success' : 'warning'} bordered={false}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
  ];

  const schemaColumns: ColumnsType<SchemaRow> = [
    {
      title: 'Object',
      dataIndex: 'object',
      render: (v: string) => <code>{v}</code>,
    },
    { title: 'Mapped entity', dataIndex: 'mapped_entity' },
    { title: 'Fields', dataIndex: 'fields', align: 'right' as const },
  ];

  const syncColumns: ColumnsType<Sync> = [
    { title: 'Started', dataIndex: 'started_at', width: 180 },
    {
      title: 'Pipeline',
      dataIndex: 'pipeline',
      render: (p) => <code>{p}</code>,
    },
    { title: 'Duration', dataIndex: 'duration', width: 120 },
    {
      title: 'Rows',
      dataIndex: 'rows',
      width: 110,
      align: 'right' as const,
      render: (n: number) => n.toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (s: Sync['status']) => (
        <Tag
          color={s === 'ok' ? 'success' : s === 'warn' ? 'warning' : 'error'}
          bordered={false}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="SAP C4C — production"
        subtitle={`Source ID: ${sourceId}`}
        actions={
          <>
            <Button icon={<DisconnectOutlined />} danger>
              Disconnect
            </Button>
            <Button icon={<ReloadOutlined />}>Test connection</Button>
            <Button type="primary" icon={<SettingOutlined />}>
              Configure
            </Button>
          </>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Pipelines" value={pipelines.length} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Records (approx.)" value={952_431} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Last sync" value="2 min ago" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Health"
              value="Healthy"
              valueStyle={{ color: '#027A48' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <Row gutter={16}>
                <Col xs={24} lg={14}>
                  <Card title="Connection">
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="Endpoint">
                        <Space>
                          <LinkOutlined />
                          <code>
                            https://my{numericalPart(sourceId)}.crm.ondemand.com/sap/c4c/odata/v1
                          </code>
                        </Space>
                      </Descriptions.Item>
                      <Descriptions.Item label="Tenant">
                        nahdetmisr-prod
                      </Descriptions.Item>
                      <Descriptions.Item label="Auth">
                        <Tag color="processing" bordered={false}>
                          OAuth 2.0
                        </Tag>{' '}
                        · service principal (Entra ID)
                      </Descriptions.Item>
                      <Descriptions.Item label="Rate limit">
                        240 req / min
                      </Descriptions.Item>
                      <Descriptions.Item label="Timezone">
                        Africa/Cairo
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col xs={24} lg={10}>
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Alert
                      type="success"
                      icon={<CheckCircleOutlined />}
                      showIcon
                      message="Connection healthy"
                      description="Last probe succeeded in 128 ms. Next probe in 4 minutes."
                    />
                    <Card size="small">
                      <Space>
                        <CloudOutlined style={{ color: '#1570EF' }} />
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            Pushed by FastAPI webhook
                          </div>
                          <Text type="secondary">
                            Business-partner change events land in Kafka
                            within 50 ms of C4C emitting them.
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  </Space>
                </Col>
              </Row>
            ),
          },
          {
            key: 'pipelines',
            label: `Pipelines (${pipelines.length})`,
            children: (
              <Card>
                <Table
                  rowKey="id"
                  columns={pipelineColumns}
                  dataSource={pipelines}
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: 'schemas',
            label: `Schemas (${schemas.length})`,
            children: (
              <Card>
                <Table
                  rowKey="key"
                  columns={schemaColumns}
                  dataSource={schemas}
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: 'syncs',
            label: 'Recent syncs',
            children: (
              <Card>
                <Table
                  rowKey="started_at"
                  columns={syncColumns}
                  dataSource={syncs}
                  pagination={false}
                />
                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Showing last {syncs.length}. The full history is on the{' '}
                  <Link to={ROUTES.PIPELINES}>Pipelines</Link> page.
                </Text>
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}

function numericalPart(id: string): string {
  const match = id.match(/\d+/);
  return match ? match[0] : '12345';
}
