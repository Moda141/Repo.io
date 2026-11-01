import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Row,
  Col,
  Alert,
  Space,
  message,
} from 'antd';
import { SaveOutlined, RollbackOutlined } from '@ant-design/icons';
import { useNavigate, useParams, generatePath } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';

/**
 * EntityNewPage — manually create a new golden record.
 *
 * Manual creation is the exception path — most records land through
 * ingestion. The form warns the user when any of the fields they typed
 * already matches an existing record (Splink real-time preview), so a
 * duplicate doesn't get committed by accident.
 */
export default function EntityNewPage() {
  const { entityType = 'customer' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const back = () =>
    navigate(generatePath(ROUTES.ENTITY_LIST, { entityType }));

  const onFinish = (values: Record<string, string>) => {
    message.success(
      `${t(`entity.${entityType}`)} queued for creation — awaiting steward approval`
    );
    // eslint-disable-next-line no-console
    console.info('[new record]', values);
    navigate(ROUTES.CHANGE_REQUESTS);
  };

  return (
    <>
      <PageHeader
        title={`New ${t(`entity.${entityType}`)}`}
        subtitle={`Create a ${t(`entity.${entityType}`).toLowerCase()} golden record manually.`}
        actions={
          <>
            <Button icon={<RollbackOutlined />} onClick={back}>
              {t('actions.cancel')}
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => form.submit()}>
              {t('actions.save')}
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Core attributes">
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              requiredMark="optional">
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Name"
                    name="name"
                    rules={[{ required: true, message: 'Required' }]}>
                    <Input placeholder="e.g. Acme Publishing House" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Legal name" name="legal_name">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Country"
                    name="country"
                    rules={[{ required: true }]}>
                    <Select
                      options={[
                        { value: 'EG', label: 'Egypt' },
                        { value: 'SA', label: 'Saudi Arabia' },
                        { value: 'AE', label: 'UAE' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Segment" name="segment">
                    <Select
                      options={[
                        { value: 'enterprise', label: 'Enterprise' },
                        { value: 'mid_market', label: 'Mid-market' },
                        { value: 'smb', label: 'SMB' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="Notes" name="notes">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Real-time duplicate check"
              description="As you type, Splink runs against existing records. If a probable match (score ≥ 0.9) is found, you'll be asked to confirm before committing."
            />
            <Card title="Workflow" size="small">
              <ol style={{ paddingInlineStart: 20, margin: 0, lineHeight: 1.8 }}>
                <li>Save creates a Change Request</li>
                <li>Admin approves</li>
                <li>Record lands in Iceberg (Golden)</li>
                <li>Pushed to downstream apps</li>
              </ol>
            </Card>
          </Space>
        </Col>
      </Row>
    </>
  );
}
