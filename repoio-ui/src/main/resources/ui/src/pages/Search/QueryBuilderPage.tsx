import {
  Card,
  Button,
  Select,
  Input,
  Space,
  Tag,
  Divider,
  Table,
  Radio,
  Typography,
  message,
} from 'antd';
import {
  PlusOutlined,
  CloseOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES, ENTITY_TYPES } from '@/constants/routes';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

/**
 * QueryBuilderPage — build complex filters without SQL.
 *
 * The query is a list of (field, op, value) clauses combined by AND or
 * OR. Supported ops include eq, neq, in, contains, starts_with, gt, lt,
 * is_null and is_not_null — the exact set repoio-service's /entity
 * endpoint accepts. "Run" previews the match count and a sample table;
 * "Save as view" turns the query into a Saved View; "Export" opens the
 * Export Wizard with this query pre-filled.
 */

interface Clause {
  key: number;
  field: string;
  op: string;
  value: string;
}

const fields = [
  { value: 'name', label: 'Name' },
  { value: 'legal_name', label: 'Legal name' },
  { value: 'country', label: 'Country' },
  { value: 'segment', label: 'Segment' },
  { value: 'source', label: 'Source system' },
  { value: 'status', label: 'Status' },
  { value: 'match_score', label: 'Match score' },
  { value: 'created_at', label: 'Created at' },
];

const ops = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'in', label: 'in (comma-sep)' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'is_null', label: 'is empty' },
  { value: 'is_not_null', label: 'is not empty' },
];

const sampleRows = [
  {
    master_id: 'CUST-000142',
    name: 'Acme Publishing House',
    segment: 'Enterprise',
    country: 'EG',
  },
  {
    master_id: 'CUST-000189',
    name: 'Nile River Bookstore',
    segment: 'Enterprise',
    country: 'EG',
  },
];

export default function QueryBuilderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [entity, setEntity] = useState<string>('customer');
  const [join, setJoin] = useState<'AND' | 'OR'>('AND');
  const [clauses, setClauses] = useState<Clause[]>([
    { key: 1, field: 'country', op: 'eq', value: 'EG' },
    { key: 2, field: 'segment', op: 'eq', value: 'Enterprise' },
  ]);
  const [ran, setRan] = useState(false);

  const addClause = () =>
    setClauses((prev) => [
      ...prev,
      {
        key: prev.length ? Math.max(...prev.map((c) => c.key)) + 1 : 1,
        field: 'name',
        op: 'contains',
        value: '',
      },
    ]);
  const removeClause = (key: number) =>
    setClauses((prev) => prev.filter((c) => c.key !== key));
  const updateClause = (key: number, patch: Partial<Clause>) =>
    setClauses((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c))
    );

  const run = () => {
    setRan(true);
    message.success(`Query ran — ${sampleRows.length} matches`);
  };

  const columns: ColumnsType<(typeof sampleRows)[number]> = [
    { title: 'Master ID', dataIndex: 'master_id', render: (v) => <code>{v}</code> },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Segment', dataIndex: 'segment' },
    { title: 'Country', dataIndex: 'country' },
  ];

  const needsValue = (op: string) => op !== 'is_null' && op !== 'is_not_null';

  const dslPreview = `${entity} WHERE ${clauses
    .map((c) => `${c.field} ${c.op}${needsValue(c.op) ? ' ' + (c.value || '?') : ''}`)
    .join(` ${join} `)}`;

  return (
    <>
      <PageHeader
        title="Query builder"
        subtitle="Build complex filters without writing SQL. Save as a view or export the result."
        actions={
          <>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => navigate(`${ROUTES.EXPORT}?entityType=${entity}`)}>
              Export
            </Button>
            <Button
              icon={<SaveOutlined />}
              onClick={() => {
                message.success('View saved');
                navigate(ROUTES.VIEWS);
              }}>
              Save as view
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={run}>
              Run
            </Button>
          </>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Text type="secondary">From</Text>
          <Select
            value={entity}
            style={{ width: 180 }}
            options={ENTITY_TYPES.map((e) => ({
              value: e.key,
              label: t(e.labelKey),
            }))}
            onChange={(v) => setEntity(v)}
          />
          <Divider type="vertical" />
          <Text type="secondary">Combine with</Text>
          <Radio.Group
            size="small"
            value={join}
            onChange={(e) => setJoin(e.target.value as 'AND' | 'OR')}>
            <Radio.Button value="AND">AND</Radio.Button>
            <Radio.Button value="OR">OR</Radio.Button>
          </Radio.Group>
        </Space>

        {clauses.map((c, i) => (
          <div key={c.key}>
            {i > 0 && (
              <div style={{ padding: '6px 0' }}>
                <Tag bordered={false}>{join}</Tag>
              </div>
            )}
            <Space.Compact style={{ width: '100%' }}>
              <Select
                value={c.field}
                options={fields}
                style={{ width: 180 }}
                onChange={(v) => updateClause(c.key, { field: v })}
              />
              <Select
                value={c.op}
                options={ops}
                style={{ width: 180 }}
                onChange={(v) => updateClause(c.key, { op: v })}
              />
              <Input
                placeholder={needsValue(c.op) ? 'value' : '(no value)'}
                value={c.value}
                disabled={!needsValue(c.op)}
                onChange={(e) => updateClause(c.key, { value: e.target.value })}
                style={{ flex: 1 }}
              />
              <Button
                icon={<CloseOutlined />}
                onClick={() => removeClause(c.key)}
                disabled={clauses.length <= 1}
              />
            </Space.Compact>
          </div>
        ))}
        <Divider />
        <Button type="dashed" icon={<PlusOutlined />} onClick={addClause}>
          Add clause
        </Button>

        <Divider />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Preview
        </Text>
        <pre
          style={{
            marginTop: 4,
            padding: 12,
            background: '#F9FAFB',
            border: '1px solid #EAECF0',
            borderRadius: 8,
            overflowX: 'auto',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
          }}>
          {dslPreview}
        </pre>
      </Card>

      {ran && (
        <Card title={`Results — ${sampleRows.length} rows`}>
          <Table
            rowKey="master_id"
            columns={columns}
            dataSource={sampleRows}
            pagination={false}
          />
        </Card>
      )}
    </>
  );
}
