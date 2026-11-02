import {
  Row,
  Col,
  Card,
  Button,
  Space,
  Table,
  Select,
  Input,
  InputNumber,
  Divider,
  Tag,
  Typography,
  Alert,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ENTITY_TYPES } from '@/constants/routes';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

/**
 * SurvivorshipPage — per-field survivor rules.
 *
 * When two or more records are merged, each field needs a rule for
 * which incoming value wins. Repo.io supports the five standard MDM
 * strategies:
 *   SOURCE_PRIORITY — pick by a per-source ranking (table on the right)
 *   LONGEST          — pick the longest non-empty value
 *   MOST_RECENT      — pick by last-updated timestamp
 *   HIGHEST_CONF     — pick by Splink confidence
 *   MANUAL           — always queue for steward review
 */

type Strategy =
  | 'SOURCE_PRIORITY'
  | 'LONGEST'
  | 'MOST_RECENT'
  | 'HIGHEST_CONF'
  | 'MANUAL';

interface FieldRule {
  key: string;
  field: string;
  strategy: Strategy;
  tiebreaker?: Strategy;
}

interface SourcePriority {
  key: string;
  source: string;
  priority: number;
}

const defaultFieldRules: FieldRule[] = [
  { key: 'f1', field: 'master_id', strategy: 'SOURCE_PRIORITY', tiebreaker: 'MOST_RECENT' },
  { key: 'f2', field: 'name', strategy: 'LONGEST', tiebreaker: 'SOURCE_PRIORITY' },
  { key: 'f3', field: 'legal_name', strategy: 'SOURCE_PRIORITY', tiebreaker: 'MOST_RECENT' },
  { key: 'f4', field: 'country', strategy: 'MOST_RECENT' },
  { key: 'f5', field: 'tax_id', strategy: 'SOURCE_PRIORITY' },
  { key: 'f6', field: 'email', strategy: 'MOST_RECENT' },
  { key: 'f7', field: 'phone', strategy: 'HIGHEST_CONF', tiebreaker: 'MOST_RECENT' },
  { key: 'f8', field: 'segment', strategy: 'MANUAL' },
];

const defaultSources: SourcePriority[] = [
  { key: 's1', source: 'SAP ERP', priority: 1 },
  { key: 's2', source: 'SAP C4C', priority: 2 },
  { key: 's3', source: 'SQL Server', priority: 3 },
  { key: 's4', source: 'Excel upload', priority: 4 },
];

const strategyLabels: Record<Strategy, string> = {
  SOURCE_PRIORITY: 'Source priority',
  LONGEST: 'Longest non-empty',
  MOST_RECENT: 'Most recent',
  HIGHEST_CONF: 'Highest confidence',
  MANUAL: 'Manual (steward)',
};
const strategyTone: Record<Strategy, string> = {
  SOURCE_PRIORITY: 'processing',
  LONGEST: 'default',
  MOST_RECENT: 'default',
  HIGHEST_CONF: 'default',
  MANUAL: 'warning',
};

export default function SurvivorshipPage() {
  const { t } = useTranslation();
  const [entity, setEntity] = useState('customer');
  const [fieldRules, setFieldRules] = useState<FieldRule[]>(defaultFieldRules);
  const [sources, setSources] = useState<SourcePriority[]>(defaultSources);

  const strategyOptions = (Object.keys(strategyLabels) as Strategy[]).map((k) => ({
    value: k,
    label: strategyLabels[k],
  }));

  const fieldColumns: ColumnsType<FieldRule> = [
    {
      title: 'Field',
      dataIndex: 'field',
      render: (v: string, r) => (
        <Input
          size="small"
          value={v}
          onChange={(e) =>
            setFieldRules((prev) =>
              prev.map((f) =>
                f.key === r.key ? { ...f, field: e.target.value } : f
              )
            )
          }
        />
      ),
    },
    {
      title: 'Primary strategy',
      dataIndex: 'strategy',
      render: (v: Strategy, r) => (
        <Select
          size="small"
          value={v}
          style={{ width: '100%' }}
          options={strategyOptions}
          onChange={(x) =>
            setFieldRules((prev) =>
              prev.map((f) => (f.key === r.key ? { ...f, strategy: x } : f))
            )
          }
        />
      ),
    },
    {
      title: 'Tiebreaker',
      dataIndex: 'tiebreaker',
      render: (v: Strategy | undefined, r) => (
        <Select
          size="small"
          value={v}
          allowClear
          placeholder="(none)"
          style={{ width: '100%' }}
          options={strategyOptions}
          onChange={(x) =>
            setFieldRules((prev) =>
              prev.map((f) => (f.key === r.key ? { ...f, tiebreaker: x } : f))
            )
          }
        />
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'strategy',
      width: 150,
      render: (v: Strategy) => (
        <Tag color={strategyTone[v]} bordered={false}>
          {strategyLabels[v]}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_, r) => (
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          onClick={() =>
            setFieldRules((prev) => prev.filter((f) => f.key !== r.key))
          }
        />
      ),
    },
  ];

  const move = (key: string, dir: -1 | 1) => {
    setSources((prev) => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority);
      const idx = sorted.findIndex((s) => s.key === key);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= sorted.length) return prev;
      [sorted[idx], sorted[to]] = [sorted[to], sorted[idx]];
      return sorted.map((s, i) => ({ ...s, priority: i + 1 }));
    });
  };

  const sourceColumns: ColumnsType<SourcePriority> = [
    {
      title: '',
      key: 'order',
      width: 100,
      render: (_, r) => (
        <Space size={2}>
          <Button
            type="text"
            size="small"
            icon={<ArrowUpOutlined />}
            onClick={() => move(r.key, -1)}
          />
          <Button
            type="text"
            size="small"
            icon={<ArrowDownOutlined />}
            onClick={() => move(r.key, 1)}
          />
        </Space>
      ),
    },
    {
      title: '#',
      dataIndex: 'priority',
      width: 60,
      render: (p: number) => <Tag bordered={false}>{p}</Tag>,
    },
    { title: 'Source', dataIndex: 'source' },
  ];

  return (
    <>
      <PageHeader
        title="Survivorship rules"
        subtitle="For each field, how do we pick which value survives when records merge?"
        actions={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => message.success('Survivorship rules saved')}>
            Save
          </Button>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Text type="secondary">Entity</Text>
          <Select
            value={entity}
            onChange={setEntity}
            style={{ width: 220 }}
            options={ENTITY_TYPES.map((e) => ({
              value: e.key,
              label: t(e.labelKey),
            }))}
          />
        </Space>
      </Card>

      <Row gutter={16}>
        <Col xs={24} xl={16}>
          <Card
            title="Field rules"
            extra={
              <Button
                size="small"
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() =>
                  setFieldRules((prev) => [
                    ...prev,
                    {
                      key: `f${Date.now()}`,
                      field: '',
                      strategy: 'MOST_RECENT',
                    },
                  ])
                }>
                Add field
              </Button>
            }>
            <Table
              rowKey="key"
              columns={fieldColumns}
              dataSource={fieldRules}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card title="Source priority (for SOURCE_PRIORITY rules)">
              <Table
                rowKey="key"
                columns={sourceColumns}
                dataSource={[...sources].sort((a, b) => a.priority - b.priority)}
                pagination={false}
                size="small"
              />
              <Divider style={{ margin: '12px 0' }} />
              <Space.Compact style={{ width: '100%' }}>
                <Input placeholder="Add source name…" />
                <InputNumber
                  placeholder="#"
                  min={1}
                  max={100}
                  style={{ width: 70 }}
                />
                <Button icon={<PlusOutlined />} />
              </Space.Compact>
            </Card>

            <Alert
              type="info"
              showIcon
              message="How this gets applied"
              description="On merge, repoio-stream reads these rules per field. If the primary strategy returns a tie, the tiebreaker is applied; if both tie, MANUAL review is triggered and the merge opens a Change Request."
            />
          </Space>
        </Col>
      </Row>
    </>
  );
}
