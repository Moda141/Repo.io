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
  Switch,
  Typography,
  Alert,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import EChart from '@/components/common/EChart';
import { ENTITY_TYPES } from '@/constants/routes';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

/**
 * MatchingRulesPage — Splink config editor.
 *
 * Splink has two primary concepts to configure:
 *   - BLOCKING RULES: cheap SQL predicates that produce candidate
 *     pairs. We expose them as "block on field X" rows.
 *   - COMPARISON LEVELS: per-field similarity logic (exact, jaro-
 *     winkler, levenshtein, numeric diff), each with a weight.
 *
 * The right-hand chart shows the match-weight histogram against last
 * run's sample so a user can see how changes shift the decision
 * boundary (threshold line at 0.9).
 */

interface BlockingRule {
  key: string;
  field: string;
  mode: 'exact' | 'first_3_chars' | 'metaphone';
  enabled: boolean;
}

interface Comparison {
  key: string;
  field: string;
  level: 'exact' | 'jaro_winkler' | 'levenshtein' | 'numeric_diff';
  threshold: number;
  weight: number;
}

const defaultBlocks: BlockingRule[] = [
  { key: 'b1', field: 'country', mode: 'exact', enabled: true },
  { key: 'b2', field: 'name', mode: 'first_3_chars', enabled: true },
  { key: 'b3', field: 'phone', mode: 'exact', enabled: false },
];

const defaultComparisons: Comparison[] = [
  { key: 'c1', field: 'name', level: 'jaro_winkler', threshold: 0.85, weight: 3.2 },
  { key: 'c2', field: 'tax_id', level: 'exact', threshold: 1.0, weight: 4.0 },
  { key: 'c3', field: 'country', level: 'exact', threshold: 1.0, weight: 1.0 },
  { key: 'c4', field: 'phone', level: 'levenshtein', threshold: 0.9, weight: 2.1 },
];

export default function MatchingRulesPage() {
  const { t } = useTranslation();
  const [entity, setEntity] = useState('customer');
  const [threshold, setThreshold] = useState(0.9);
  const [blocks, setBlocks] = useState<BlockingRule[]>(defaultBlocks);
  const [comps, setComps] = useState<Comparison[]>(defaultComparisons);

  const blockColumns: ColumnsType<BlockingRule> = [
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      width: 90,
      render: (v: boolean, r) => (
        <Switch
          size="small"
          checked={v}
          onChange={(c) =>
            setBlocks((prev) =>
              prev.map((b) => (b.key === r.key ? { ...b, enabled: c } : b))
            )
          }
        />
      ),
    },
    {
      title: 'Field',
      dataIndex: 'field',
      render: (v: string, r) => (
        <Input
          size="small"
          value={v}
          onChange={(e) =>
            setBlocks((prev) =>
              prev.map((b) => (b.key === r.key ? { ...b, field: e.target.value } : b))
            )
          }
        />
      ),
    },
    {
      title: 'Blocking mode',
      dataIndex: 'mode',
      width: 180,
      render: (v: BlockingRule['mode'], r) => (
        <Select
          size="small"
          value={v}
          style={{ width: '100%' }}
          options={[
            { value: 'exact', label: 'exact' },
            { value: 'first_3_chars', label: 'first 3 chars' },
            { value: 'metaphone', label: 'metaphone' },
          ]}
          onChange={(x) =>
            setBlocks((prev) =>
              prev.map((b) => (b.key === r.key ? { ...b, mode: x } : b))
            )
          }
        />
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
            setBlocks((prev) => prev.filter((b) => b.key !== r.key))
          }
        />
      ),
    },
  ];

  const compColumns: ColumnsType<Comparison> = [
    {
      title: 'Field',
      dataIndex: 'field',
      render: (v: string, r) => (
        <Input
          size="small"
          value={v}
          onChange={(e) =>
            setComps((prev) =>
              prev.map((c) => (c.key === r.key ? { ...c, field: e.target.value } : c))
            )
          }
        />
      ),
    },
    {
      title: 'Comparison',
      dataIndex: 'level',
      width: 200,
      render: (v: Comparison['level'], r) => (
        <Select
          size="small"
          value={v}
          style={{ width: '100%' }}
          options={[
            { value: 'exact', label: 'exact' },
            { value: 'jaro_winkler', label: 'jaro-winkler' },
            { value: 'levenshtein', label: 'levenshtein' },
            { value: 'numeric_diff', label: 'numeric diff' },
          ]}
          onChange={(x) =>
            setComps((prev) =>
              prev.map((c) => (c.key === r.key ? { ...c, level: x } : c))
            )
          }
        />
      ),
    },
    {
      title: 'Threshold',
      dataIndex: 'threshold',
      width: 130,
      render: (v: number, r) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          max={1}
          step={0.05}
          onChange={(x) =>
            setComps((prev) =>
              prev.map((c) =>
                c.key === r.key ? { ...c, threshold: x ?? 0 } : c
              )
            )
          }
        />
      ),
    },
    {
      title: 'Weight',
      dataIndex: 'weight',
      width: 130,
      render: (v: number, r) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          max={10}
          step={0.1}
          onChange={(x) =>
            setComps((prev) =>
              prev.map((c) =>
                c.key === r.key ? { ...c, weight: x ?? 0 } : c
              )
            )
          }
        />
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
            setComps((prev) => prev.filter((c) => c.key !== r.key))
          }
        />
      ),
    },
  ];

  // Histogram: fake buckets of match_weight from a sampled run
  const histogram = [
    [0.3, 240],
    [0.4, 180],
    [0.5, 130],
    [0.6, 80],
    [0.7, 42],
    [0.8, 61],
    [0.85, 87],
    [0.9, 124],
    [0.95, 210],
    [1.0, 180],
  ] as [number, number][];

  const chart = {
    xAxis: {
      type: 'category' as const,
      data: histogram.map(([x]) => x.toFixed(2)),
      axisLabel: { color: '#667085', fontSize: 11 },
      axisLine: { lineStyle: { color: '#EAECF0' } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: '#667085', fontSize: 11 },
      splitLine: { lineStyle: { color: '#F2F4F7' } },
    },
    series: [
      {
        type: 'bar' as const,
        name: 'Pairs',
        data: histogram.map(([x, y]) => ({
          value: y,
          itemStyle: { color: x >= threshold ? '#12B76A' : '#D0D5DD' },
        })),
        barWidth: '70%',
      },
    ],
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#101828',
      textStyle: { color: '#FFFFFF', fontSize: 12 },
      borderColor: '#101828',
    },
  };

  return (
    <>
      <PageHeader
        title="Matching rules"
        subtitle="Splink blocking rules + per-field comparisons. The histogram previews the decision boundary."
        actions={
          <>
            <Button icon={<PlayCircleOutlined />}>Dry run on sample</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => message.success('Splink config saved')}>
              Save
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} xl={14}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card>
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
                <Divider type="vertical" />
                <Text type="secondary">Merge threshold</Text>
                <InputNumber
                  value={threshold}
                  min={0.5}
                  max={1}
                  step={0.05}
                  onChange={(v) => setThreshold(v ?? 0.9)}
                />
                <Text type="secondary">
                  Pairs ≥ this merge; below go to the duplicate review queue.
                </Text>
              </Space>
            </Card>

            <Card
              title="Blocking rules"
              extra={
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    setBlocks((prev) => [
                      ...prev,
                      {
                        key: `b${Date.now()}`,
                        field: '',
                        mode: 'exact',
                        enabled: true,
                      },
                    ])
                  }>
                  Add rule
                </Button>
              }>
              <Table
                rowKey="key"
                columns={blockColumns}
                dataSource={blocks}
                pagination={false}
                size="small"
              />
            </Card>

            <Card
              title="Field comparisons"
              extra={
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    setComps((prev) => [
                      ...prev,
                      {
                        key: `c${Date.now()}`,
                        field: '',
                        level: 'exact',
                        threshold: 1,
                        weight: 1,
                      },
                    ])
                  }>
                  Add comparison
                </Button>
              }>
              <Table
                rowKey="key"
                columns={compColumns}
                dataSource={comps}
                pagination={false}
                size="small"
              />
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={10}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card
              title="Match-weight histogram"
              extra={<Tag bordered={false}>Last run · 1,332 pairs</Tag>}>
              <EChart option={chart} height={300} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Bars at or above the threshold ({threshold.toFixed(2)}) are
                green and will auto-merge. Bars below land in the duplicate
                review queue.
              </Text>
            </Card>

            <Alert
              type="info"
              showIcon
              message="Splink is the model, not the policy"
              description="These rules shape which pairs Splink surfaces. The merge policy (auto vs steward) is set by the threshold above and the Survivorship page controls which field value wins."
            />
          </Space>
        </Col>
      </Row>
    </>
  );
}
