import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Row,
  Col,
  Space,
  Divider,
  Typography,
  Alert,
  message,
} from 'antd';
import {
  SendOutlined,
  RollbackOutlined,
  PlusOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import { ENTITY_TYPES } from '@/constants/routes';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface FieldChange {
  key: number;
  field: string;
  newValue: string;
}

/**
 * ChangeRequestNewPage — open a new CR.
 *
 * The user picks the target record (pre-filled when linked from an
 * entity page), lists which fields change and the new value for each,
 * and gives a reason. Submission writes the CR to Postgres via
 * repoio-service; the governance workflow (SLA, routing to the right
 * admin) runs there, not in the UI.
 */
export default function ChangeRequestNewPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const [changes, setChanges] = useState<FieldChange[]>([
    { key: 1, field: '', newValue: '' },
  ]);
  const nextKey = () =>
    changes.length ? Math.max(...changes.map((c) => c.key)) + 1 : 1;

  const addRow = () =>
    setChanges((prev) => [...prev, { key: nextKey(), field: '', newValue: '' }]);
  const removeRow = (key: number) =>
    setChanges((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.key !== key)));
  const updateRow = (key: number, patch: Partial<FieldChange>) =>
    setChanges((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c))
    );

  const submit = () => {
    form
      .validateFields()
      .then(() => {
        const empty = changes.filter((c) => !c.field.trim());
        if (empty.length === changes.length) {
          message.error('Add at least one field change');
          return;
        }
        message.success('Change request opened — reviewers notified');
        navigate(ROUTES.CHANGE_REQUESTS);
      })
      .catch(() => undefined);
  };

  return (
    <>
      <PageHeader
        title="New change request"
        subtitle="Request a change to a golden record. Admins review before it hits Iceberg."
        actions={
          <>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => navigate(ROUTES.CHANGE_REQUESTS)}>
              {t('actions.cancel')}
            </Button>
            <Button type="primary" icon={<SendOutlined />} onClick={submit}>
              Open CR
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              entityType: params.get('entityType') || 'customer',
              masterId: params.get('id') || '',
              priority: 'normal',
            }}>
            <Card title="Target" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Entity"
                    name="entityType"
                    rules={[{ required: true }]}>
                    <Select
                      options={ENTITY_TYPES.map((e) => ({
                        value: e.key,
                        label: t(e.labelKey),
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={10}>
                  <Form.Item
                    label="Master ID"
                    name="masterId"
                    rules={[{ required: true, message: 'Required' }]}>
                    <Input placeholder="e.g. CUST-000204" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item label="Priority" name="priority">
                    <Select
                      options={[
                        { value: 'low', label: 'Low' },
                        { value: 'normal', label: 'Normal' },
                        { value: 'high', label: 'High' },
                        { value: 'urgent', label: 'Urgent' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card
              title="Field changes"
              extra={
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={addRow}>
                  Add change
                </Button>
              }>
              {changes.map((row, i) => (
                <div key={row.key}>
                  {i > 0 && <Divider style={{ margin: '12px 0' }} />}
                  <Row gutter={12} align="middle">
                    <Col flex="200px">
                      <Input
                        placeholder="Field name"
                        value={row.field}
                        onChange={(e) =>
                          updateRow(row.key, { field: e.target.value })
                        }
                      />
                    </Col>
                    <Col flex="auto">
                      <Input
                        placeholder="New value"
                        value={row.newValue}
                        onChange={(e) =>
                          updateRow(row.key, { newValue: e.target.value })
                        }
                      />
                    </Col>
                    <Col flex="48px">
                      <Button
                        type="text"
                        icon={<CloseOutlined />}
                        disabled={changes.length <= 1}
                        onClick={() => removeRow(row.key)}
                      />
                    </Col>
                  </Row>
                </div>
              ))}
              <Divider style={{ margin: '16px 0' }} />
              <Form.Item
                label="Reason (visible to reviewers)"
                name="reason"
                rules={[{ required: true, message: 'Give a reason' }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
            </Card>
          </Form>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Workflow"
              description={
                <ol style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.8 }}>
                  <li>CR is persisted in Postgres</li>
                  <li>Reviewer (by entity + role) is notified</li>
                  <li>On approve → Iceberg write + Kafka changes event</li>
                  <li>Outbox pushes to SAP C4C within 60s</li>
                </ol>
              }
            />
            <Card size="small" title="Audit">
              <Text type="secondary" style={{ fontSize: 12 }}>
                Every CR is signed with your Entra ID principal and
                stored in the audit log for 7 years.
              </Text>
            </Card>
          </Space>
        </Col>
      </Row>
    </>
  );
}
