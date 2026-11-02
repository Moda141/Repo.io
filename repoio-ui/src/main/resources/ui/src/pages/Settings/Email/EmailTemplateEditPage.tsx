import {
  Row,
  Col,
  Card,
  Form,
  Input,
  Button,
  Space,
  Tabs,
  Typography,
  Alert,
  Tag,
  message,
} from 'antd';
import {
  SaveOutlined,
  SendOutlined,
  RollbackOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';

const { Text } = Typography;

/**
 * EmailTemplateEditPage — tabs for EN and AR editing, plus a Preview
 * tab that renders the compiled HTML with sample variables.
 */

const DEFAULT_EN = `# Change request {{cr.id}} needs your review

{{cr.requested_by}} opened a change on **{{cr.target.entity}} · {{cr.target.id}}**.

**Summary**: {{cr.summary}}
**Priority**: {{cr.priority}}

[Open the change request]({{cr.url}})

---
Repo.io · Nahdet Misr Publishing Group
`;

const DEFAULT_AR = `# طلب التعديل {{cr.id}} بانتظار مراجعتك

قدّم {{cr.requested_by}} طلب تعديل على **{{cr.target.entity}} · {{cr.target.id}}**.

**الملخص**: {{cr.summary}}
**الأولوية**: {{cr.priority}}

[فتح طلب التعديل]({{cr.url}})

---
Repo.io · نهضة مصر للنشر
`;

export default function EmailTemplateEditPage() {
  const { templateId = 'cr_opened' } = useParams();
  const navigate = useNavigate();
  const isNew = templateId === 'new';
  const [subjectEn, setSubjectEn] = useState('Change request {{cr.id}} needs your review');
  const [subjectAr, setSubjectAr] = useState('طلب التعديل {{cr.id}} بانتظار مراجعتك');
  const [bodyEn, setBodyEn] = useState(DEFAULT_EN);
  const [bodyAr, setBodyAr] = useState(DEFAULT_AR);
  const [form] = Form.useForm();

  const sample = {
    cr: {
      id: 'CR-00128',
      requested_by: 'mohamed@nahdetmisr.com',
      target: { entity: 'Customer', id: 'CUST-000204' },
      summary: 'Update billing address',
      priority: 'normal',
      url: 'https://repoio.nahdetmisr.com/change-requests/CR-00128',
    },
  };

  const substitute = (tpl: string) =>
    tpl.replace(/\{\{\s*cr\.id\s*\}\}/g, sample.cr.id)
       .replace(/\{\{\s*cr\.requested_by\s*\}\}/g, sample.cr.requested_by)
       .replace(/\{\{\s*cr\.target\.entity\s*\}\}/g, sample.cr.target.entity)
       .replace(/\{\{\s*cr\.target\.id\s*\}\}/g, sample.cr.target.id)
       .replace(/\{\{\s*cr\.summary\s*\}\}/g, sample.cr.summary)
       .replace(/\{\{\s*cr\.priority\s*\}\}/g, sample.cr.priority)
       .replace(/\{\{\s*cr\.url\s*\}\}/g, sample.cr.url);

  return (
    <>
      <PageHeader
        title={isNew ? 'New email template' : `Template · ${templateId}`}
        subtitle="Markdown body with Handlebars variables. One editor per locale."
        actions={
          <>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => navigate(ROUTES.EMAIL_TEMPLATES)}>
              Back
            </Button>
            <Button icon={<SendOutlined />}>Send test to me</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => message.success('Template saved')}>
              Save
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={17}>
          <Card>
            <Form form={form} layout="vertical">
              <Form.Item label="Template ID (code name)" initialValue={templateId}>
                <Input
                  disabled={!isNew}
                  defaultValue={isNew ? '' : templateId}
                  placeholder="e.g. cr_approved"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
              </Form.Item>
            </Form>

            <Tabs
              defaultActiveKey="en"
              items={[
                {
                  key: 'en',
                  label: 'English',
                  children: (
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <Form.Item label="Subject">
                        <Input
                          value={subjectEn}
                          onChange={(e) => setSubjectEn(e.target.value)}
                        />
                      </Form.Item>
                      <Form.Item label="Body (Markdown + Handlebars)">
                        <Input.TextArea
                          value={bodyEn}
                          onChange={(e) => setBodyEn(e.target.value)}
                          rows={18}
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 13,
                            background: '#F9FAFB',
                          }}
                        />
                      </Form.Item>
                    </Space>
                  ),
                },
                {
                  key: 'ar',
                  label: 'العربية',
                  children: (
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <Form.Item label="العنوان">
                        <Input
                          value={subjectAr}
                          onChange={(e) => setSubjectAr(e.target.value)}
                          dir="rtl"
                        />
                      </Form.Item>
                      <Form.Item label="المحتوى (Markdown)">
                        <Input.TextArea
                          value={bodyAr}
                          onChange={(e) => setBodyAr(e.target.value)}
                          rows={18}
                          dir="rtl"
                          style={{
                            fontFamily: '"IBM Plex Sans Arabic", monospace',
                            fontSize: 13,
                            background: '#F9FAFB',
                          }}
                        />
                      </Form.Item>
                    </Space>
                  ),
                },
                {
                  key: 'preview',
                  label: (
                    <Space size={6}>
                      <EyeOutlined />
                      Preview
                    </Space>
                  ),
                  children: (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      <Card title="EN · with sample variables" size="small">
                        <strong>{substitute(subjectEn)}</strong>
                        <pre style={previewStyle}>{substitute(bodyEn)}</pre>
                      </Card>
                      <Card title="ع · with sample variables" size="small">
                        <strong style={{ display: 'block', textAlign: 'right' }} dir="rtl">
                          {substitute(subjectAr)}
                        </strong>
                        <pre style={{ ...previewStyle, direction: 'rtl', textAlign: 'right', fontFamily: '"IBM Plex Sans Arabic", monospace' }}>
                          {substitute(bodyAr)}
                        </pre>
                      </Card>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={7}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Variables"
              description={
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Handlebars; depends on template purpose:
                  </Text>
                  <code>cr.*</code>
                  <code>user.*</code>
                  <code>pipeline.*</code>
                  <code>alert.*</code>
                  <code>now · brand.name · brand.url</code>
                </Space>
              }
            />
            <Card size="small" title="Delivery">
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Space><Tag bordered={false}>From</Tag><Text>repoio@nahdetmisr.com</Text></Space>
                <Space><Tag bordered={false}>Reply-to</Tag><Text>no-reply@…</Text></Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Change these on Settings → Email.
                </Text>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </>
  );
}

const previewStyle: React.CSSProperties = {
  margin: 0,
  padding: 12,
  background: '#F9FAFB',
  border: '1px solid #EAECF0',
  borderRadius: 8,
  fontSize: 13,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  fontFamily: 'inherit',
};
