import {
  Row,
  Col,
  Card,
  Steps,
  Select,
  Button,
  Space,
  Radio,
  Checkbox,
  Switch,
  Alert,
  Typography,
  message,
  Progress,
  Tag,
} from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ENTITY_TYPES, ROUTES } from '@/constants/routes';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

/**
 * ExportWizardPage — multi-step export of a view or ad-hoc query.
 *
 * Four steps: Scope · Columns · Format · Review. The last step
 * fires the export job on repoio-service, which streams the result
 * from Iceberg (through Trino for ad-hoc queries) and uploads a
 * signed, time-limited URL that lands in the user's Notifications.
 */

type Format = 'csv' | 'xlsx' | 'parquet' | 'json';

const availableColumns = [
  { key: 'master_id', label: 'Master ID', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'legal_name', label: 'Legal name' },
  { key: 'country', label: 'Country' },
  { key: 'segment', label: 'Segment' },
  { key: 'tax_id', label: 'Tax ID' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'sources', label: 'Sources' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Created at' },
  { key: 'updated_at', label: 'Updated at' },
];

export default function ExportWizardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const defaultEntity = params.get('entityType') || 'customer';

  const [step, setStep] = useState(0);
  const [entity, setEntity] = useState(defaultEntity);
  const [scope, setScope] = useState<'all' | 'query' | 'view'>('all');
  const [columns, setColumns] = useState<string[]>(
    availableColumns.filter((c) => c.required).map((c) => c.key)
  );
  const [format, setFormat] = useState<Format>('csv');
  const [includeAudit, setIncludeAudit] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const start = () => {
    setStep(3);
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          setDone(true);
          return 100;
        }
        return p + 20;
      });
    }, 240);
  };

  const steps = [
    { title: 'Scope', description: 'What to export' },
    { title: 'Columns', description: 'Which fields' },
    { title: 'Format', description: 'How to pack' },
    { title: 'Review', description: 'Run the export' },
  ];

  return (
    <>
      <PageHeader
        title="Export"
        subtitle="Download golden records, by query, by view, or in bulk."
        actions={
          <Button
            icon={<RollbackOutlined />}
            onClick={() => navigate(ROUTES.EXPLORE)}>
            {t('actions.cancel')}
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
                <Text strong>Entity</Text>
                <Select
                  value={entity}
                  onChange={setEntity}
                  options={ENTITY_TYPES.map((e) => ({
                    value: e.key,
                    label: t(e.labelKey),
                  }))}
                  style={{ maxWidth: 320 }}
                />
                <Text strong>Rows to include</Text>
                <Radio.Group
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}>
                  <Space direction="vertical">
                    <Radio value="all">All golden records</Radio>
                    <Radio value="query">From query builder</Radio>
                    <Radio value="view">From a saved view</Radio>
                  </Space>
                </Radio.Group>
                {scope === 'view' && (
                  <Select
                    placeholder="Pick a view"
                    style={{ maxWidth: 320 }}
                    options={[
                      {
                        value: 'V-01',
                        label: 'Enterprise customers in Egypt',
                      },
                      { value: 'V-03', label: 'Products missing ISBN' },
                    ]}
                  />
                )}
                <Button type="primary" onClick={() => setStep(1)}>
                  Next
                </Button>
              </Space>
            )}

            {step === 1 && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Text strong>Columns</Text>
                <Checkbox.Group
                  value={columns}
                  onChange={(v) => setColumns(v as string[])}
                  style={{ width: '100%' }}>
                  <Row>
                    {availableColumns.map((c) => (
                      <Col key={c.key} xs={12} md={8}>
                        <Checkbox value={c.key} disabled={c.required}>
                          {c.label}
                          {c.required && (
                            <Tag
                              bordered={false}
                              style={{ marginInlineStart: 6, fontSize: 11 }}>
                              required
                            </Tag>
                          )}
                        </Checkbox>
                      </Col>
                    ))}
                  </Row>
                </Checkbox.Group>
                <Switch
                  checked={includeAudit}
                  onChange={setIncludeAudit}
                  checkedChildren="With audit metadata"
                  unCheckedChildren="Without audit metadata"
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
                <Text strong>Format</Text>
                <Radio.Group
                  value={format}
                  onChange={(e) => setFormat(e.target.value as Format)}>
                  <Space direction="vertical">
                    <Radio value="csv">
                      <Space>
                        <FileTextOutlined /> CSV — universal, Excel-friendly
                      </Space>
                    </Radio>
                    <Radio value="xlsx">
                      <Space>
                        <FileExcelOutlined /> XLSX — Excel native with types
                      </Space>
                    </Radio>
                    <Radio value="parquet">
                      <Space>
                        <DatabaseOutlined /> Parquet — compressed, keeps schema
                      </Space>
                    </Radio>
                    <Radio value="json">
                      <Space>
                        <FileTextOutlined /> JSON Lines — for pipelines
                      </Space>
                    </Radio>
                  </Space>
                </Radio.Group>
                <Space>
                  <Button onClick={() => setStep(1)}>Back</Button>
                  <Button type="primary" onClick={() => setStep(3)}>
                    Next
                  </Button>
                </Space>
              </Space>
            )}

            {step === 3 && !done && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  message="Ready to export"
                  description={
                    <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                      <li>
                        Entity: <strong>{entity}</strong>
                      </li>
                      <li>
                        Scope: <strong>{scope}</strong>
                      </li>
                      <li>
                        Columns: <strong>{columns.length}</strong>
                      </li>
                      <li>
                        Format: <strong>{format.toUpperCase()}</strong>
                      </li>
                      <li>
                        Audit metadata:{' '}
                        <strong>{includeAudit ? 'Yes' : 'No'}</strong>
                      </li>
                    </ul>
                  }
                />
                <Space>
                  <Button onClick={() => setStep(2)}>Back</Button>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={start}>
                    Run export
                  </Button>
                </Space>
              </Space>
            )}

            {step === 3 && progress > 0 && !done && (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Text strong>Running…</Text>
                <Progress percent={progress} status="active" />
              </Space>
            )}

            {done && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  type="success"
                  icon={<CheckCircleOutlined />}
                  showIcon
                  message="Export ready"
                  description={`Your ${format.toUpperCase()} file is ready. The signed download link is valid for 24 hours; a copy was sent to your Notifications.`}
                />
                <Space>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={() =>
                      message.success('Download started (demo)')
                    }>
                    Download file
                  </Button>
                  <Button onClick={() => navigate(ROUTES.EXPLORE)}>
                    Done
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
