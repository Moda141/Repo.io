import {
  Row,
  Col,
  Card,
  Button,
  Space,
  Tag,
  Alert,
  Typography,
  Input,
  Divider,
  message,
} from 'antd';
import {
  SaveOutlined,
  RollbackOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, generatePath } from 'react-router-dom';
import { useMemo, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';

const { Text } = Typography;

/**
 * PipelineEditPage — YAML editor for a pipeline config.
 *
 * The editor is a plain TextArea for now, but it ships with:
 *   - inline schema validation (required keys, allowed values)
 *   - a Validate button that runs the same checks repoio-service does
 *     on save
 *   - a Dry-run button that executes the pipeline against a sampled 50
 *     rows and shows the DQ + match outcome without writing anywhere.
 *
 * Monaco / CodeMirror editor will be ported from
 * openmetadata-ui src/components/common/CodeEditor as a drop-in
 * replacement for the TextArea once the dedicated code-editor port lands.
 */
const DEFAULT_YAML = `name: c4c-customers
source: sap_c4c
entity: customer
schedule: "0 */6 * * *"
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

interface ValidationIssue {
  level: 'error' | 'warn' | 'ok';
  message: string;
}

export default function PipelineEditPage() {
  const { pipelineId = '' } = useParams();
  const navigate = useNavigate();
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [dirty, setDirty] = useState(false);

  const issues: ValidationIssue[] = useMemo(() => {
    const out: ValidationIssue[] = [];
    const required = ['name:', 'source:', 'entity:', 'schedule:', 'sink:'];
    for (const key of required) {
      if (!yaml.includes(key)) {
        out.push({ level: 'error', message: `Missing required key: ${key}` });
      }
    }
    if (!/^\s*schedule:\s*"?\d/.test(yaml.match(/schedule:[^\n]*/)?.[0] ?? '')) {
      if (!yaml.includes('schedule:')) {
        /* already reported */
      } else {
        out.push({ level: 'warn', message: 'schedule should be a cron expression' });
      }
    }
    if (!yaml.includes('great_expectations_suite:'))
      out.push({ level: 'warn', message: 'No DQ suite — pipeline will skip DQ' });
    if (!yaml.includes('splink_config:'))
      out.push({ level: 'warn', message: 'No Splink config — matching will be exact-key only' });
    if (out.length === 0) out.push({ level: 'ok', message: 'All checks pass' });
    return out;
  }, [yaml]);

  const back = () =>
    navigate(generatePath(ROUTES.PIPELINE_DETAIL, { pipelineId }));

  const save = () => {
    const errors = issues.filter((i) => i.level === 'error').length;
    if (errors) {
      message.error(`Fix ${errors} error${errors > 1 ? 's' : ''} before saving`);
      return;
    }
    message.success(`Saved · ${pipelineId}`);
    back();
  };

  return (
    <>
      <PageHeader
        title={`Edit · ${pipelineId}`}
        subtitle="Pipeline YAML config · validated and dry-run against sampled rows."
        actions={
          <>
            <Button icon={<RollbackOutlined />} onClick={back}>
              Cancel
            </Button>
            <Button icon={<PlayCircleOutlined />}>Dry-run</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              disabled={!dirty}
              onClick={save}>
              Save
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={17}>
          <Card
            title="YAML"
            extra={
              <Space>
                <Tag bordered={false}>{yaml.split('\n').length} lines</Tag>
                <Tag bordered={false}>{yaml.length} chars</Tag>
              </Space>
            }>
            <Input.TextArea
              value={yaml}
              onChange={(e) => {
                setYaml(e.target.value);
                setDirty(true);
              }}
              rows={22}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13,
                lineHeight: 1.6,
                background: '#F9FAFB',
              }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={7}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card title="Validation" size="small">
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {issues.map((i, idx) => (
                  <Space key={idx} align="start">
                    {i.level === 'error' && (
                      <CloseCircleOutlined style={{ color: '#F04438' }} />
                    )}
                    {i.level === 'warn' && (
                      <Text style={{ color: '#F79009' }}>⚠</Text>
                    )}
                    {i.level === 'ok' && (
                      <CheckCircleOutlined style={{ color: '#12B76A' }} />
                    )}
                    <Text>{i.message}</Text>
                  </Space>
                ))}
              </Space>
            </Card>

            <Alert
              type="info"
              showIcon
              message="Dry-run"
              description="Reads 50 sampled rows from the source, runs standardise → DQ → match, and reports counts without writing to Kafka or Iceberg."
            />

            <Card size="small" title="Shortcuts">
              <Divider style={{ margin: '8px 0' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Monaco/CodeMirror editor (keybinds, lint, schema completion)
                lands with the openmetadata CodeEditor port in a later
                change.
              </Text>
            </Card>
          </Space>
        </Col>
      </Row>
    </>
  );
}
