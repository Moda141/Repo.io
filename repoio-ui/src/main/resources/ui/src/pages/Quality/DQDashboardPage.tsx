import {
  Row,
  Col,
  Card,
  Space,
  Tag,
  Button,
  Table,
  Progress,
  Typography,
  Segmented,
  Statistic,
} from 'antd';
import {
  SafetyCertificateOutlined,
  BuildOutlined,
  ControlOutlined,
  ExperimentOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import EChart from '@/components/common/EChart';
import { ROUTES, ENTITY_TYPES } from '@/constants/routes';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

/**
 * DQDashboardPage — the "how good is my data" screen.
 *
 * Scorecards per entity, two trend charts (match rate + completeness
 * over 30 days), and a table of failing expectations with sample
 * rows. The structure follows OpenMetadata's DataQualityPage layout:
 * KPI row → trend chart row → failing-tests table. Charts use
 * echarts (the same library OpenMetadata uses) via the shared EChart
 * wrapper.
 */

const trendDays = Array.from({ length: 30 }, (_, i) => {
  const d = new Date('2026-11-02T00:00:00Z');
  d.setDate(d.getDate() - (29 - i));
  return d.toISOString().slice(5, 10);
});
const matchSeries = [
  92.1, 92.3, 92.6, 92.8, 93.0, 93.1, 93.3, 93.6, 93.5, 93.7, 93.9, 94.0,
  94.2, 94.1, 94.3, 94.4, 94.5, 94.6, 94.7, 94.6, 94.5, 94.7, 94.8, 94.8,
  94.9, 94.8, 94.9, 94.9, 94.8, 94.8,
];
const completenessSeries = [
  86.0, 86.2, 86.5, 86.9, 87.1, 87.0, 87.2, 87.3, 87.2, 87.4, 87.5, 87.7,
  87.8, 88.0, 88.1, 88.0, 88.1, 88.2, 88.1, 88.1, 88.0, 88.1, 88.1, 88.0,
  88.1, 88.1, 88.0, 88.1, 88.1, 88.1,
];

interface EntityRow {
  key: string;
  entity: string;
  completeness: number;
  validity: number;
  match_rate: number;
  freshness_hours: number;
  score: number;
}

const entityRows: EntityRow[] = [
  {
    key: 'customer',
    entity: 'Customer',
    completeness: 88.1,
    validity: 96.3,
    match_rate: 94.8,
    freshness_hours: 0.3,
    score: 94.6,
  },
  {
    key: 'vendor',
    entity: 'Vendor',
    completeness: 92.4,
    validity: 97.8,
    match_rate: 98.1,
    freshness_hours: 9.0,
    score: 96.1,
  },
  {
    key: 'product',
    entity: 'Product',
    completeness: 76.3,
    validity: 94.1,
    match_rate: 91.2,
    freshness_hours: 1.1,
    score: 87.9,
  },
  {
    key: 'author',
    entity: 'Author',
    completeness: 68.7,
    validity: 92.4,
    match_rate: 88.9,
    freshness_hours: 72.0,
    score: 83.0,
  },
];

interface FailingTest {
  key: string;
  entity: string;
  rule: string;
  rows_affected: number;
  severity: 'low' | 'medium' | 'high';
  since: string;
}

const failing: FailingTest[] = [
  {
    key: 'ft-1',
    entity: 'Product',
    rule: 'isbn is 13 digits',
    rows_affected: 142,
    severity: 'medium',
    since: '2026-10-30',
  },
  {
    key: 'ft-2',
    entity: 'Author',
    rule: 'birth_year is not null',
    rows_affected: 318,
    severity: 'low',
    since: '2026-10-28',
  },
  {
    key: 'ft-3',
    entity: 'Customer',
    rule: 'tax_id matches pattern',
    rows_affected: 11,
    severity: 'high',
    since: '2026-11-02',
  },
];

export default function DQDashboardPage() {
  const { t } = useTranslation();
  const [range, setRange] = useState<'7' | '30' | '90'>('30');

  const matchChart = {
    xAxis: {
      type: 'category' as const,
      data: trendDays,
      boundaryGap: false,
      axisLabel: { color: '#667085', fontSize: 11 },
      axisLine: { lineStyle: { color: '#EAECF0' } },
    },
    yAxis: {
      type: 'value' as const,
      min: 90,
      max: 100,
      axisLabel: { color: '#667085', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#F2F4F7' } },
    },
    series: [
      {
        type: 'line' as const,
        name: 'Match rate',
        data: matchSeries,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#1570EF' },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(21, 112, 239, 0.18)' },
              { offset: 1, color: 'rgba(21, 112, 239, 0)' },
            ],
          },
        },
      },
    ],
  };

  const completenessChart = {
    xAxis: {
      type: 'category' as const,
      data: trendDays,
      boundaryGap: false,
      axisLabel: { color: '#667085', fontSize: 11 },
      axisLine: { lineStyle: { color: '#EAECF0' } },
    },
    yAxis: {
      type: 'value' as const,
      min: 80,
      max: 100,
      axisLabel: { color: '#667085', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#F2F4F7' } },
    },
    series: [
      {
        type: 'line' as const,
        name: 'Completeness',
        data: completenessSeries,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#12B76A' },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(18, 183, 106, 0.18)' },
              { offset: 1, color: 'rgba(18, 183, 106, 0)' },
            ],
          },
        },
      },
    ],
  };

  const columns: ColumnsType<EntityRow> = [
    {
      title: 'Entity',
      dataIndex: 'entity',
      render: (v: string, r) => (
        <Link to={`/entity/${r.key}`}>
          <strong>{v}</strong>
        </Link>
      ),
    },
    {
      title: 'Completeness',
      dataIndex: 'completeness',
      render: (n: number) => <QualityBar value={n} />,
    },
    {
      title: 'Validity',
      dataIndex: 'validity',
      render: (n: number) => <QualityBar value={n} />,
    },
    {
      title: 'Match rate',
      dataIndex: 'match_rate',
      render: (n: number) => <QualityBar value={n} />,
    },
    {
      title: 'Freshness',
      dataIndex: 'freshness_hours',
      align: 'right' as const,
      render: (h: number) => (h < 1 ? '< 1h' : `${h}h`),
    },
    {
      title: 'Score',
      dataIndex: 'score',
      align: 'right' as const,
      render: (n: number) => (
        <Tag
          color={n >= 95 ? 'success' : n >= 85 ? 'processing' : 'warning'}
          bordered={false}>
          <strong>{n.toFixed(1)}</strong>
        </Tag>
      ),
    },
  ];

  const failingColumns: ColumnsType<FailingTest> = [
    { title: 'Entity', dataIndex: 'entity', width: 110 },
    { title: 'Expectation', dataIndex: 'rule', render: (v) => <code>{v}</code> },
    {
      title: 'Rows affected',
      dataIndex: 'rows_affected',
      align: 'right' as const,
      width: 140,
      render: (n: number) => n.toLocaleString(),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 110,
      render: (s: FailingTest['severity']) => (
        <Tag
          color={s === 'high' ? 'error' : s === 'medium' ? 'warning' : 'default'}
          bordered={false}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
    { title: 'First seen', dataIndex: 'since', width: 120 },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: () => (
        <Link to={ROUTES.QUALITY_RULES}>
          <Button type="link" size="small">
            Review
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Data quality"
        subtitle="Match rate, completeness, validity and freshness per entity."
        actions={
          <>
            <Link to={ROUTES.PLAYGROUND}>
              <Button icon={<ExperimentOutlined />}>Playground</Button>
            </Link>
            <Link to={ROUTES.SURVIVORSHIP}>
              <Button icon={<ControlOutlined />}>Survivorship</Button>
            </Link>
            <Link to={ROUTES.MATCHING}>
              <Button icon={<BuildOutlined />}>Matching rules</Button>
            </Link>
            <Link to={ROUTES.QUALITY_RULES}>
              <Button type="primary" icon={<SafetyCertificateOutlined />}>
                Rules
              </Button>
            </Link>
          </>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Overall score"
              value={92.4}
              suffix="%"
              valueStyle={{ color: '#027A48' }}
            />
            <Space size={4} style={{ marginTop: 4 }}>
              <RiseOutlined style={{ color: '#027A48' }} />
              <Text type="secondary">+1.2 vs 30d</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Match rate" value={94.8} suffix="%" />
            <Space size={4} style={{ marginTop: 4 }}>
              <RiseOutlined style={{ color: '#027A48' }} />
              <Text type="secondary">+2.7 vs 30d</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Completeness" value={88.1} suffix="%" />
            <Space size={4} style={{ marginTop: 4 }}>
              <RiseOutlined style={{ color: '#027A48' }} />
              <Text type="secondary">+2.1 vs 30d</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Open issues" value={failing.length} />
            <Space size={4} style={{ marginTop: 4 }}>
              <FallOutlined style={{ color: '#B42318' }} />
              <Text type="secondary">+1 vs yesterday</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} xl={12}>
          <Card
            title="Match rate · 30 days"
            extra={
              <Segmented
                size="small"
                options={[
                  { value: '7', label: '7d' },
                  { value: '30', label: '30d' },
                  { value: '90', label: '90d' },
                ]}
                value={range}
                onChange={(v) => setRange(v as typeof range)}
              />
            }>
            <EChart option={matchChart} />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card
            title="Completeness · 30 days"
            extra={<Tag bordered={false}>All entities</Tag>}>
            <EChart option={completenessChart} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Per entity"
        extra={<Tag bordered={false}>{ENTITY_TYPES.length} tracked</Tag>}
        style={{ marginBottom: 16 }}>
        <Table
          rowKey="key"
          columns={columns}
          dataSource={entityRows}
          pagination={false}
        />
      </Card>

      <Card
        title={`Failing expectations (${failing.length})`}
        extra={<Text type="secondary">{t('actions.refresh')}</Text>}>
        <Table
          rowKey="key"
          columns={failingColumns}
          dataSource={failing}
          pagination={false}
        />
      </Card>
    </>
  );
}

function QualityBar({ value }: { value: number }) {
  const color =
    value >= 95 ? '#12B76A' : value >= 85 ? '#1570EF' : value >= 70 ? '#F79009' : '#F04438';
  return (
    <Space style={{ width: 180 }}>
      <Progress
        percent={value}
        size="small"
        showInfo={false}
        strokeColor={color}
        style={{ width: 110 }}
      />
      <strong>{value.toFixed(1)}%</strong>
    </Space>
  );
}
