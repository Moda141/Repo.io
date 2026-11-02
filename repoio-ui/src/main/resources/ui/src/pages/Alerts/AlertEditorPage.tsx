import {
  Row,
  Col,
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Divider,
  Switch,
  Typography,
  Alert,
  message,
} from 'antd';
import { SaveOutlined, PlayCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';

const { Text } = Typography;

/**
 * AlertEditorPage — create or edit a single alert rule.
 *
 * The trigger is a predicate over system events (pipeline.run, dq.score,
 * cr.age, source.health). Channels are the fan-out — one alert can go
 * to multiple channels. Severity drives routing and whether the UI
 * banner is red/yellow/blue.
 */
export default function AlertEditorPage() {
  const { alertId } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  return (
    <>
      <PageHeader
        title={alertId ? `Alert · ${alertId}` : 'New alert'}
        subtitle="Watch a signal and page the right people when it fires."
        actions={
          <>
            <Button icon={<RollbackOutlined />} onClick={() => navigate(ROUTES.ALERTS)}>
              Cancel
            </Button>
            <Button icon={<PlayCircleOutlined />}>Test fire</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => {
                message.success('Alert saved');
                navigate(ROUTES.ALERTS);
              }}>
              Save
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card>
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                name: 'DQ score below threshold',
                severity: 'warn',
                enabled: true,
                event_source: 'dq',
                predicate: 'score.completeness < 85 FOR ANY entity',
                suppress: '10m',
                channels: ['email_stewards', 'in_app'],
                template: 'alert_dq_breach',
              }}>
              <Row gutter={16}>
                <Col xs={24} md={16}>
                  <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                    <Input placeholder="Human-readable rule name" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Severity" name="severity">
                    <Select
                      options={[
                        { value: 'info', label: 'Info' },
                        { value: 'warn', label: 'Warn' },
                        { value: 'critical', label: 'Critical' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Enabled" name="enabled" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={16}>
                  <Form.Item
                    label="Suppress repeats for"
                    name="suppress"
                    tooltip="Won't re-page while the same key has fired within this window.">
                    <Select
                      options={[
                        { value: 'none', label: 'No suppression' },
                        { value: '5m', label: '5 minutes' },
                        { value: '10m', label: '10 minutes' },
                        { value: '1h', label: '1 hour' },
                        { value: '24h', label: '24 hours' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>Trigger</Divider>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item label="Event source" name="event_source">
                    <Select
                      options={[
                        { value: 'dq', label: 'Data quality signals' },
                        { value: 'pipeline', label: 'Pipeline runs' },
                        { value: 'cr', label: 'Change requests' },
                        { value: 'source', label: 'Source health' },
                        { value: 'auth', label: 'Auth events' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={16}>
                  <Form.Item
                    label="Predicate"
                    name="predicate"
                    tooltip="Expression over the event. Must return a boolean.">
                    <Input.TextArea
                      rows={3}
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>Fan-out</Divider>

              <Form.Item label="Channels" name="channels">
                <Select
                  mode="multiple"
                  options={[
                    { value: 'email_stewards', label: 'Email · stewards' },
                    { value: 'email_data_ops', label: 'Email · data-ops' },
                    { value: 'email_requester', label: 'Email · requester' },
                    { value: 'slack_data_ops', label: 'Slack · #data-ops' },
                    { value: 'in_app', label: 'In-app notification' },
                    { value: 'webhook_pagerduty', label: 'Webhook · PagerDuty' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="Message template"
                name="template"
                tooltip="Templates are managed on Settings → Email templates.">
                <Select
                  options={[
                    { value: 'alert_dq_breach', label: 'alert_dq_breach' },
                    { value: 'alert_pipeline_failed', label: 'alert_pipeline_failed' },
                    { value: 'alert_cr_sla', label: 'alert_cr_sla' },
                    { value: 'alert_source_down', label: 'alert_source_down' },
                  ]}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Dedup key"
              description="Repeated fires with the same (rule_id, entity) key within the suppress window are collapsed into one notification."
            />
            <Card title="Predicate variables" size="small">
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Available in <code>predicate</code> and <code>template</code>:
                </Text>
                <code>score.*  entity  source  pipeline.*</code>
                <code>cr.*  user.*  event.at  now</code>
              </Space>
            </Card>
            <Card title="Routing by severity" size="small">
              <Space direction="vertical" size={6}>
                <Space><Tag color="processing" bordered={false}>INFO</Tag><Text>In-app only</Text></Space>
                <Space><Tag color="warning" bordered={false}>WARN</Tag><Text>+ Email digest</Text></Space>
                <Space><Tag color="error" bordered={false}>CRITICAL</Tag><Text>+ Slack + PagerDuty</Text></Space>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </>
  );
}
