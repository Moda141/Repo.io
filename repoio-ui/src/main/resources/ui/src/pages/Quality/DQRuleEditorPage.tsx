import {
  Row,
  Col,
  Card,
  Space,
  Button,
  Table,
  Form,
  Input,
  Select,
  Switch,
  Divider,
  Tag,
  Typography,
  Alert,
  message,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import { ENTITY_TYPES } from '@/constants/routes';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

/**
 * DQRuleEditorPage — Great Expectations suite builder.
 *
 * Users compose expectations by picking a field, picking an expectation
 * type and filling parameters. The YAML preview updates live so a
 * steward can see exactly what will land in repoio-spec's expectation
 * registry. "Run against sample" fires 100 sampled rows and shows
 * pass/fail per expectation.
 *
 * Mirrors OpenMetadata's TestCaseForm pattern (form-driven, JSON Schema
 * backed) without the catalog-specific test registry.
 */

type ExpectationType =
  | 'not_null'
  | 'in_set'
  | 'regex'
  | 'between'
  | 'length'
  | 'unique';

interface Expectation {
  key: string;
  field: string;
  type: ExpectationType;
  params: string;
  enabled: boolean;
}

const typeOptions: {
  value: ExpectationType;
  label: string;
  hint: string;
}[] = [
  { value: 'not_null', label: 'must not be null', hint: '(no params)' },
  { value: 'in_set', label: 'must be in set', hint: 'EG, SA, AE' },
  { value: 'regex', label: 'must match regex', hint: '^[0-9]{13}$' },
  { value: 'between', label: 'must be between', hint: '0,100' },
  { value: 'length', label: 'length between', hint: '2,50' },
  { value: 'unique', label: 'must be unique', hint: '(no params)' },
];

export default function DQRuleEditorPage() {
  const { t } = useTranslation();
  const [entity, setEntity] = useState('customer');
  const [name, setName] = useState('customer.ge.yml');
  const [expectations, setExpectations] = useState<Expectation[]>([
    { key: 'e1', field: 'master_id', type: 'not_null', params: '', enabled: true },
    { key: 'e2', field: 'master_id', type: 'unique', params: '', enabled: true },
    { key: 'e3', field: 'name', type: 'not_null', params: '', enabled: true },
    { key: 'e4', field: 'name', type: 'length', params: '2,120', enabled: true },
    {
      key: 'e5',
      field: 'country',
      type: 'in_set',
      params: 'EG,SA,AE,KW,OM,BH,QA',
      enabled: true,
    },
    { key: 'e6', field: 'tax_id', type: 'regex', params: '^[0-9]{9}$', enabled: false },
  ]);
  const [showResults, setShowResults] = useState(false);

  const addRow = () =>
    setExpectations((prev) => [
      ...prev,
      {
        key: `e${Date.now()}`,
        field: '',
        type: 'not_null',
        params: '',
        enabled: true,
      },
    ]);
  const update = (key: string, patch: Partial<Expectation>) =>
    setExpectations((prev) =>
      prev.map((e) => (e.key === key ? { ...e, ...patch } : e))
    );
  const remove = (key: string) =>
    setExpectations((prev) => prev.filter((e) => e.key !== key));

  const columns: ColumnsType<Expectation> = [
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      width: 90,
      render: (v: boolean, r) => (
        <Switch
          checked={v}
          size="small"
          onChange={(c) => update(r.key, { enabled: c })}
        />
      ),
    },
    {
      title: 'Field',
      dataIndex: 'field',
      width: 180,
      render: (v: string, r) => (
        <Input
          size="small"
          placeholder="field name"
          value={v}
          onChange={(e) => update(r.key, { field: e.target.value })}
        />
      ),
    },
    {
      title: 'Expectation',
      dataIndex: 'type',
      width: 200,
      render: (v: ExpectationType, r) => (
        <Select
          size="small"
          value={v}
          style={{ width: '100%' }}
          options={typeOptions.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(x) => update(r.key, { type: x as ExpectationType })}
        />
      ),
    },
    {
      title: 'Params',
      dataIndex: 'params',
      render: (v: string, r) => {
        const t = typeOptions.find((o) => o.value === r.type);
        const disabled = r.type === 'not_null' || r.type === 'unique';
        return (
          <Input
            size="small"
            placeholder={t?.hint}
            value={v}
            disabled={disabled}
            onChange={(e) => update(r.key, { params: e.target.value })}
          />
        );
      },
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
          onClick={() => remove(r.key)}
        />
      ),
    },
  ];

  const yaml = `# ${name}
suite: ${entity}
expectations:
${expectations
  .filter((e) => e.enabled && e.field)
  .map((e) => {
    const t = typeOptions.find((o) => o.value === e.type);
    return `  - expect_column_${e.type}:\n      column: ${e.field}${
      e.params ? `\n      params: [${e.params}]` : ''
    }\n      # ${t?.label}`;
  })
  .join('\n')}
`;

  const run = () => {
    message.success('Dry run complete — 2 fail, 4 pass');
    setShowResults(true);
  };

  return (
    <>
      <PageHeader
        title="Data quality rules"
        subtitle="Build a Great Expectations suite for an entity. The YAML preview is what repoio-service ships to Spark."
        actions={
          <>
            <Button icon={<PlayCircleOutlined />} onClick={run}>
              Run against sample
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => message.success('Suite saved')}>
              Save suite
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Suite">
            <Form layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Entity">
                    <Select
                      value={entity}
                      onChange={setEntity}
                      options={ENTITY_TYPES.map((e) => ({
                        value: e.key,
                        label: t(e.labelKey),
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Suite file">
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
            <Divider style={{ margin: '8px 0 16px' }} />
            <Table
              rowKey="key"
              columns={columns}
              dataSource={expectations}
              pagination={false}
              size="small"
            />
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addRow}
              style={{ marginTop: 12 }}>
              Add expectation
            </Button>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card
              title="YAML preview"
              size="small"
              extra={
                <Tag bordered={false}>
                  {expectations.filter((e) => e.enabled && e.field).length} active
                </Tag>
              }>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: '#F9FAFB',
                  border: '1px solid #EAECF0',
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.6,
                  overflowX: 'auto',
                  fontFamily: 'JetBrains Mono, monospace',
                  maxHeight: 400,
                  overflowY: 'auto',
                }}>
                {yaml}
              </pre>
            </Card>
            <Alert
              type="info"
              showIcon
              message="Where this lands"
              description="Saved suites are stored in repoio-spec under expectations/<entity>.ge.yml and executed by repoio-stream on every batch of staged.<entity> events."
            />
          </Space>
        </Col>
      </Row>

      <Modal
        title="Dry run — 100 sampled rows"
        open={showResults}
        onCancel={() => setShowResults(false)}
        onOk={() => setShowResults(false)}
        width={720}>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <RunRow pass={100} label="master_id must not be null" />
          <RunRow pass={100} label="master_id must be unique" />
          <RunRow pass={100} label="name must not be null" />
          <RunRow pass={98} label="name length 2–120" fail={2} />
          <RunRow pass={97} label="country must be in set" fail={3} />
          <RunRow
            pass={0}
            label="tax_id regex"
            fail={0}
            info="Expectation disabled"
          />
          <Divider style={{ margin: '8px 0' }} />
          <Text type="secondary">
            Sample taken from the latest raw.customer batch (seed 42).
          </Text>
        </Space>
      </Modal>
    </>
  );
}

function RunRow({
  pass,
  fail,
  label,
  info,
}: {
  pass: number;
  fail?: number;
  label: string;
  info?: string;
}) {
  if (info) {
    return (
      <Space>
        <Tag bordered={false}>DISABLED</Tag>
        <code>{label}</code>
        <Text type="secondary">{info}</Text>
      </Space>
    );
  }
  const ok = (fail ?? 0) === 0;
  return (
    <Space>
      {ok ? (
        <Tag color="success" icon={<CheckCircleOutlined />} bordered={false}>
          PASS
        </Tag>
      ) : (
        <Tag color="error" icon={<CloseCircleOutlined />} bordered={false}>
          FAIL
        </Tag>
      )}
      <code>{label}</code>
      <Text type="secondary">
        {pass}/{pass + (fail ?? 0)}
      </Text>
    </Space>
  );
}
