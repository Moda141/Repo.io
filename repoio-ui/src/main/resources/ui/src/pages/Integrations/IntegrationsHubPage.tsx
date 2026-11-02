import { Row, Col, Card, Space, Typography } from 'antd';
import {
  ApiOutlined,
  LinkOutlined,
  CodeOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';

const { Text } = Typography;

export default function IntegrationsHubPage() {
  const cards = [
    {
      to: ROUTES.INTEGRATIONS_WEBHOOKS,
      icon: <CloudServerOutlined />,
      title: 'Outgoing webhooks',
      desc: 'Fire HTTP POSTs on events — PagerDuty, Teams, custom endpoints.',
    },
    {
      to: ROUTES.INTEGRATIONS_LINKS,
      icon: <LinkOutlined />,
      title: 'Share links',
      desc: 'Short, signed, time-limited URLs for views, records, dashboards.',
    },
    {
      to: ROUTES.INTEGRATIONS_EMBEDS,
      icon: <CodeOutlined />,
      title: 'Embed codes',
      desc: 'Iframe + JS snippets for Power BI, SharePoint, internal portals.',
    },
    {
      to: ROUTES.INTEGRATIONS_API,
      icon: <ApiOutlined />,
      title: 'API reference',
      desc: 'OpenAPI explorer for repoio-service — try endpoints in-browser.',
    },
  ];

  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="Share Repo.io with the outside world — webhooks, URLs, embeds, API."
      />
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col key={c.title} xs={24} sm={12} lg={6}>
            <Link to={c.to}>
              <Card hoverable style={{ height: '100%' }}>
                <div style={{ fontSize: 28, color: '#1570EF', marginBottom: 10 }}>
                  {c.icon}
                </div>
                <Space direction="vertical" size={2}>
                  <strong>{c.title}</strong>
                  <Text type="secondary">{c.desc}</Text>
                </Space>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </>
  );
}
