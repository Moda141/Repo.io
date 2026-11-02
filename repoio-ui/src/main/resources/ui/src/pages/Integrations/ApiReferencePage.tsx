import {
  Row,
  Col,
  Card,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Typography,
  Divider,
  message,
  Alert,
} from 'antd';
import {
  CopyOutlined,
  PlayCircleOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';

const { Text } = Typography;

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  tag: string;
}

const endpoints: Endpoint[] = [
  { method: 'GET', path: '/v1/entity/{entityType}', summary: 'List golden records of an entity', tag: 'Entities' },
  { method: 'GET', path: '/v1/entity/{entityType}/{id}', summary: 'Get a golden record by master ID', tag: 'Entities' },
  { method: 'POST', path: '/v1/entity/{entityType}', summary: 'Create a golden record (opens CR)', tag: 'Entities' },
  { method: 'PATCH', path: '/v1/entity/{entityType}/{id}', summary: 'Patch a golden record (opens CR)', tag: 'Entities' },
  { method: 'POST', path: '/v1/change-requests', summary: 'Open a change request', tag: 'Change requests' },
  { method: 'GET', path: '/v1/change-requests/{crId}', summary: 'Get a change request', tag: 'Change requests' },
  { method: 'POST', path: '/v1/change-requests/{crId}/approve', summary: 'Approve a change request', tag: 'Change requests' },
  { method: 'POST', path: '/v1/change-requests/{crId}/reject', summary: 'Reject a change request', tag: 'Change requests' },
  { method: 'GET', path: '/v1/pipelines/{pipelineId}/runs', summary: 'List runs of a pipeline', tag: 'Pipelines' },
  { method: 'POST', path: '/v1/pipelines/{pipelineId}/run', summary: 'Trigger a pipeline run', tag: 'Pipelines' },
  { method: 'GET', path: '/v1/quality/scores', summary: 'DQ scores per entity', tag: 'Quality' },
  { method: 'GET', path: '/v1/audit', summary: 'Query the audit log', tag: 'Audit' },
];

const methodTone: Record<Endpoint['method'], string> = {
  GET: '#027A48',
  POST: '#1570EF',
  PATCH: '#F79009',
  DELETE: '#B42318',
};

export default function ApiReferencePage() {
  const [selected, setSelected] = useState<Endpoint>(endpoints[0]!);
  const [params, setParams] = useState('entityType=customer');
  const [body, setBody] = useState<string>(
    '{\n  "name": "Acme Publishing",\n  "country": "EG"\n}'
  );
  const [response, setResponse] = useState<string | null>(null);

  const curl = `curl -X ${selected.method} \\
  "https://repoio.nahdetmisr.com/api${selected.path.replace(/\{entityType\}/g, 'customer').replace(/\{id\}/g, 'CUST-000142').replace(/\{crId\}/g, 'CR-00128').replace(/\{pipelineId\}/g, 'c4c-customers')}" \\
  -H "Authorization: Bearer \\$REPOIO_TOKEN" \\
  -H "Content-Type: application/json"${
    selected.method !== 'GET'
      ? ' \\\n  -d \'' + body.replace(/\n/g, '').replace(/\s+/g, ' ') + '\''
      : ''
  }`;

  const run = () => {
    setResponse(
      JSON.stringify(
        {
          data: [
            {
              master_id: 'CUST-000142',
              name: 'Acme Publishing House',
              status: 'golden',
              country: 'EG',
            },
          ],
          paging: { total: 1 },
        },
        null,
        2
      )
    );
  };

  return (
    <>
      <PageHeader
        title="API reference"
        subtitle="OpenAPI explorer for repoio-service. Try endpoints with your current session token."
      />

      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card title={`Endpoints (${endpoints.length})`} size="small">
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {endpoints.map((e, i) => (
                <div
                  key={`${e.method}-${e.path}-${i}`}
                  onClick={() => setSelected(e)}
                  style={{
                    cursor: 'pointer',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background:
                      selected.method === e.method && selected.path === e.path
                        ? '#F0F7FF'
                        : 'transparent',
                    border:
                      selected.method === e.method && selected.path === e.path
                        ? '1px solid #B2DDFF'
                        : '1px solid transparent',
                  }}>
                  <Space>
                    <Tag
                      bordered={false}
                      style={{
                        background: `${methodTone[e.method]}1A`,
                        color: methodTone[e.method],
                        fontWeight: 600,
                        minWidth: 54,
                        textAlign: 'center',
                      }}>
                      {e.method}
                    </Tag>
                    <code style={{ fontSize: 12 }}>{e.path}</code>
                  </Space>
                  <div style={{ color: '#667085', fontSize: 12, marginTop: 2 }}>
                    {e.summary}
                  </div>
                </div>
              ))}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card>
            <Space style={{ marginBottom: 12 }}>
              <Tag
                bordered={false}
                style={{
                  background: `${methodTone[selected.method]}1A`,
                  color: methodTone[selected.method],
                  fontWeight: 600,
                  minWidth: 60,
                  textAlign: 'center',
                }}>
                {selected.method}
              </Tag>
              <code>{selected.path}</code>
              <Tag bordered={false}>{selected.tag}</Tag>
            </Space>
            <Text type="secondary">{selected.summary}</Text>

            <Divider />

            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Text strong>Query / path params</Text>
              <Input
                value={params}
                onChange={(e) => setParams(e.target.value)}
                placeholder="key=value&key2=value2"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
              {selected.method !== 'GET' && (
                <>
                  <Text strong>Request body (JSON)</Text>
                  <Input.TextArea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      background: '#F9FAFB',
                      fontSize: 13,
                    }}
                  />
                </>
              )}
              <Space>
                <Select defaultValue="live" style={{ width: 160 }}>
                  <Select.Option value="live">Live token (yours)</Select.Option>
                  <Select.Option value="demo">Demo (read-only)</Select.Option>
                </Select>
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={run}>
                  Try it
                </Button>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(curl);
                    message.success('cURL copied');
                  }}>
                  Copy cURL
                </Button>
              </Space>

              <Divider style={{ margin: '8px 0' }} />

              <Text strong>cURL</Text>
              <pre style={codeStyle}>{curl}</pre>

              {response && (
                <>
                  <Text strong>Response</Text>
                  <pre style={codeStyle}>{response}</pre>
                </>
              )}

              <Alert
                type="info"
                showIcon
                icon={<ApiOutlined />}
                message={
                  <>
                    Full OpenAPI 3.1 spec is at{' '}
                    <code>https://repoio.nahdetmisr.com/api/openapi.json</code>.
                  </>
                }
              />
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}

const codeStyle: React.CSSProperties = {
  margin: 0,
  padding: 12,
  background: '#0C111D',
  color: '#D0D5DD',
  border: '1px solid #0C111D',
  borderRadius: 8,
  fontSize: 12,
  lineHeight: 1.6,
  overflowX: 'auto',
  fontFamily: 'JetBrains Mono, monospace',
};
