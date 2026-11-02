import {
  Row,
  Col,
  Card,
  Table,
  Button,
  Tag,
  Space,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  MailOutlined,
  SettingOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface Template {
  id: string;
  name: string;
  purpose: string;
  bound_to: string[];
  last_sent: string;
  sent_7d: number;
  locale: 'en-US' | 'ar-EG' | 'both';
}

const seed: Template[] = [
  {
    id: 'cr_opened',
    name: 'CR opened',
    purpose: 'Notify reviewers of a new change request',
    bound_to: ['Workflow · CR approval', 'Alert · CR SLA'],
    last_sent: '2 min ago',
    sent_7d: 32,
    locale: 'both',
  },
  {
    id: 'cr_approved',
    name: 'CR approved',
    purpose: 'Notify requester that their CR was approved',
    bound_to: ['Workflow · CR approval'],
    last_sent: '18 min ago',
    sent_7d: 18,
    locale: 'both',
  },
  {
    id: 'cr_rejected',
    name: 'CR rejected',
    purpose: 'Notify requester that their CR was rejected',
    bound_to: ['Workflow · CR approval'],
    last_sent: '2 days ago',
    sent_7d: 2,
    locale: 'both',
  },
  {
    id: 'user_invited',
    name: 'User invited',
    purpose: 'Sign-in link for a newly invited user',
    bound_to: ['Users admin'],
    last_sent: 'Yesterday',
    sent_7d: 1,
    locale: 'both',
  },
  {
    id: 'weekly_digest',
    name: 'Weekly steward digest',
    purpose: 'Mon 08:00 — summary of CRs, pipelines, DQ for the past week',
    bound_to: ['Workflow · weekly digest'],
    last_sent: 'Yesterday',
    sent_7d: 7,
    locale: 'both',
  },
  {
    id: 'alert_dq_breach',
    name: 'Alert · DQ breach',
    purpose: 'DQ score dropped below threshold',
    bound_to: ['Alert · DQ score below threshold'],
    last_sent: '2 hours ago',
    sent_7d: 3,
    locale: 'en-US',
  },
  {
    id: 'alert_pipeline_failed',
    name: 'Alert · Pipeline failed',
    purpose: 'Any pipeline run status=failed',
    bound_to: ['Alert · Pipeline failure'],
    last_sent: '18 min ago',
    sent_7d: 7,
    locale: 'en-US',
  },
];

export default function EmailTemplatesPage() {
  const columns: ColumnsType<Template> = [
    {
      title: 'Template',
      key: 'name',
      render: (_, r) => (
        <Space>
          <MailOutlined style={{ color: '#1570EF' }} />
          <div>
            <Link to={`/settings/email/templates/${r.id}`}>
              <strong>{r.name}</strong>
            </Link>
            <div style={{ color: '#667085', fontSize: 12 }}>
              <code>{r.id}</code>
            </div>
          </div>
        </Space>
      ),
    },
    { title: 'Purpose', dataIndex: 'purpose' },
    {
      title: 'Locales',
      dataIndex: 'locale',
      width: 110,
      render: (l: Template['locale']) => (
        <Tag bordered={false}>
          {l === 'both' ? 'EN + ع' : l === 'ar-EG' ? 'ع' : 'EN'}
        </Tag>
      ),
    },
    {
      title: 'Bound to',
      dataIndex: 'bound_to',
      render: (b: string[]) => (
        <Space size={4} wrap>
          {b.map((x) => (
            <Tag key={x} bordered={false}>
              {x}
            </Tag>
          ))}
        </Space>
      ),
    },
    { title: 'Last sent', dataIndex: 'last_sent', width: 140 },
    { title: 'Sent (7d)', dataIndex: 'sent_7d', width: 100, align: 'right' as const },
  ];

  const sent7d = seed.reduce((n, t) => n + t.sent_7d, 0);

  return (
    <>
      <PageHeader
        title="Email templates"
        subtitle="Every email the tool sends — alerts, workflow notifications, digests, invites."
        actions={
          <>
            <Link to="/settings/email">
              <Button icon={<SettingOutlined />}>SMTP settings</Button>
            </Link>
            <Link to="/settings/email/log">
              <Button icon={<AuditOutlined />}>Send log</Button>
            </Link>
            <Link to="/settings/email/templates/new">
              <Button type="primary" icon={<PlusOutlined />}>
                New template
              </Button>
            </Link>
          </>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Templates</Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{seed.length}</span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Sent · 7d</Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{sent7d}</span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Localized (EN+ع)</Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>
                {seed.filter((t) => t.locale === 'both').length}
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Delivery rate · 7d</Text>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#027A48' }}>
                99.4%
              </span>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card>
        <Table rowKey="id" columns={columns} dataSource={seed} />
      </Card>
    </>
  );
}
