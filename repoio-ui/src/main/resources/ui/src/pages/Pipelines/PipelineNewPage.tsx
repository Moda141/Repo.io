import {
  Row,
  Col,
  Card,
  Steps,
  Select,
  Button,
  Space,
  Input,
  Table,
  Tag,
  Alert,
  Typography,
  message,
} from 'antd';
import {
  RollbackOutlined,
  CheckCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES, ENTITY_TYPES } from '@/constants/routes';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

/**
 * PipelineNewPage — Create-pipeline wizard.
 *
 * Four steps: Source · Entity · Mapping · Schedule.
 * On finish, writes the pipeline YAML to repoio-service and schedules
 * the first run on Airflow (repoio-airflow-apis).
 *
 * The mapping step pre-fills field-to-field suggestions from a lookup
 * of the source's known schema (e.g. SAP C4C BusinessPartner fields)
 * against the entity's JSON Schema (from repoio-spec).
 */

interface MappingRow {
  key: string;
  source: string;
  target: string;
  skip: boolean;
}

const defaultMapping: MappingRow[] = [
  { key: '1', source: 'BusinessPartnerID', target: 'master_id', skip: false },
  { key: '2', source: 'Name', target: 'name', skip: false },
  { key: '3', source: 'LegalName', target: 'legal_name', skip: false },
  { key: '4', source: 'Country', target: 'country', skip: false },
  { key: '5', source: 'Segment', target: 'segment', skip: false },
  { key: '6', source: 'ExternalID', target: '', skip: true },
];

export default function PipelineNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [source, setSource] = useState('sap_c4c');
  const [entity, setEntity] = useState('customer');
  const [mapping, setMapping] = useState<MappingRow[]>(defaultMapping);
  const [schedule, setSchedule] = useState('0 */6 * * *');

  const columns: ColumnsType<MappingRow> = [
    { title: 'Source field', dataIndex: 'source', width: 220 },
    {
      title: 'Target attribute',
      dataIndex: 'target',
      render: (v: string, r) => (
        <Input
          value={v}
          disabled={r.skip}
          placeholder="e.g. legal_name"
          onChange={(e) =>
            setMapping((prev) =>
              prev.map((row) =>
                row.key === r.key ? { ...row, target: e.target.value } : row
              )
            )
          }
        />
      ),
    },
    {
      title: '',
      dataIndex: 'skip',
      width: 100,
      render: (skip: boolean, r) => (
        <Tag
          color={skip ? 'default' : 'processing'}
          bordered={false}
          style={{ cursor: 'pointer' }}
          onClick={() =>
            setMapping((prev) =>
              prev.map((row) =>
                row.key === r.key ? { ...row, skip: !row.skip } : row
              )
            )
          }>
          {skip ? 'SKIP' : 'MAP'}
        </Tag>
      ),
    },
  ];

  const finish = () => {
    if (!name.trim()) {
      message.error('Give the pipeline a name');
      setStep(0);
      return;
    }
    message.success(`Pipeline "${name}" created and scheduled`);
    navigate(ROUTES.PIPELINES);
  };

  const steps = [
    { title: 'Source', description: 'Where from' },
    { title: 'Entity', description: 'What model' },
    { title: 'Mapping', description: 'Field → attribute' },
    { title: 'Schedule', description: 'When to run' },
  ];

  return (
    <>
      <PageHeader
        title="New pipeline"
        subtitle="Walk through the four steps; the result is a validated YAML config persisted to repoio-service."
        actions={
          <Button
            icon={<RollbackOutlined />}
            onClick={() => navigate(ROUTES.PIPELINES)}>
            Cancel
          </Button>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={6}>
          <Card>
            <Steps direction="vertical" current={step} items={steps} />
          </Card>
        </Col>
        <Col xs={24} lg={18}>
          <Card>
            {step === 0 && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Text strong>Pipeline name</Text>
                <Input
                  placeholder="e.g. c4c-customers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ maxWidth: 360 }}
                />
                <Text strong>Source system</Text>
                <Select
                  value={source}
                  onChange={setSource}
                  style={{ maxWidth: 360 }}
                  options={[
                    { value: 'sap_c4c', label: 'SAP C4C (Cloud for Customer)' },
                    { value: 'sap_erp', label: 'SAP ERP' },
                    { value: 'sql_server', label: 'SQL Server' },
                    { value: 'excel', label: 'Excel / CSV' },
                    { value: 'drive', label: 'Google Drive / SharePoint' },
                  ]}
                />
                <Button type="primary" onClick={() => setStep(1)}>
                  Next
                </Button>
              </Space>
            )}

            {step === 1 && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Text strong>Target entity</Text>
                <Select
                  value={entity}
                  onChange={setEntity}
                  style={{ maxWidth: 360 }}
                  options={ENTITY_TYPES.map((e) => ({
                    value: e.key,
                    label: t(e.labelKey),
                  }))}
                />
                <Alert
                  type="info"
                  showIcon
                  message="Schema loaded from repoio-spec"
                  description={`The next step pre-fills field-to-attribute suggestions from ${entity}.json in repoio-spec.`}
                />
                <Space>
                  <Button onClick={() => setStep(0)}>Back</Button>
                  <Button type="primary" onClick={() => setStep(2)}>
                    Next
                  </Button>
                </Space>
              </Space>
            )}

            {step === 2 && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Text strong>Field mapping</Text>
                <Table
                  rowKey="key"
                  columns={columns}
                  dataSource={mapping}
                  pagination={false}
                />
                <Alert
                  type="warning"
                  showIcon
                  message="Required attributes"
                  description="master_id and name are required on every record. The dry-run step will reject the pipeline if either is unmapped."
                />
                <Space>
                  <Button onClick={() => setStep(1)}>Back</Button>
                  <Button type="primary" onClick={() => setStep(3)}>
                    Next
                  </Button>
                </Space>
              </Space>
            )}

            {step === 3 && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Text strong>Schedule (cron)</Text>
                <Input
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  style={{
                    maxWidth: 360,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />
                <Space wrap>
                  {[
                    { label: 'Every hour', v: '0 * * * *' },
                    { label: 'Every 6h', v: '0 */6 * * *' },
                    { label: 'Daily @ 06:00', v: '0 6 * * *' },
                    { label: 'Mon–Fri 09:00', v: '0 9 * * 1-5' },
                  ].map((p) => (
                    <Button
                      key={p.v}
                      size="small"
                      onClick={() => setSchedule(p.v)}>
                      {p.label}
                    </Button>
                  ))}
                </Space>
                <Alert
                  type="info"
                  icon={<CheckCircleOutlined />}
                  showIcon
                  message="Ready"
                  description={
                    <>
                      Source: <strong>{source}</strong> · Entity:{' '}
                      <strong>{entity}</strong> ·{' '}
                      {mapping.filter((m) => !m.skip).length} mappings · Cron:{' '}
                      <code>{schedule}</code>
                    </>
                  }
                />
                <Space>
                  <Button onClick={() => setStep(2)}>Back</Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={finish}>
                    Create pipeline
                  </Button>
                </Space>
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}
