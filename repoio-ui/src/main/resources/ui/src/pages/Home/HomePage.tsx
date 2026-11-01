import { Row, Col, Card, Statistic, Typography, Space, Tag } from 'antd';
import {
  UserOutlined,
  ShopOutlined,
  BookOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';

const { Title, Text } = Typography;

/**
 * HomePage — admin-configurable dashboard. For now, static KPIs so the
 * shell can be reviewed; the "configurable" surface (admin can add / remove
 * widgets) lands in M4 alongside the Golden Record workflow.
 */
export default function HomePage() {
  const { t } = useTranslation();

  const kpis = [
    {
      key: 'customers',
      icon: <UserOutlined style={{ color: '#1570EF' }} />,
      title: t('entity.customer_plural'),
      value: 952_431,
      delta: '+1.2%',
      positive: true,
    },
    {
      key: 'vendors',
      icon: <ShopOutlined style={{ color: '#6938EF' }} />,
      title: t('entity.vendor_plural'),
      value: 3_204,
      delta: '+0.3%',
      positive: true,
    },
    {
      key: 'products',
      icon: <BookOutlined style={{ color: '#12B76A' }} />,
      title: t('entity.product_plural'),
      value: 48_117,
      delta: '+2.4%',
      positive: true,
    },
    {
      key: 'change_requests',
      icon: <SwapOutlined style={{ color: '#F79009' }} />,
      title: t('nav.change_requests'),
      value: 27,
      delta: 'open',
      positive: false,
    },
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Helmet>
        <title>{t('page.home.title')} — Repo.io</title>
      </Helmet>

      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          {t('page.home.title')}
        </Title>
        <Text type="secondary">{t('page.home.subtitle')}</Text>
      </div>

      <Row gutter={[16, 16]}>
        {kpis.map((k) => (
          <Col key={k.key} xs={24} sm={12} lg={6}>
            <Card>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space>
                  <span style={{ fontSize: 20 }}>{k.icon}</span>
                  <Text type="secondary">{k.title}</Text>
                </Space>
                <Statistic value={k.value} valueStyle={{ fontSize: 28 }} />
                <Tag color={k.positive ? 'green' : 'orange'} bordered={false}>
                  {k.delta}
                </Tag>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Golden record quality" extra={<Tag color="blue">Last 30 days</Tag>}>
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <QualityRow label="Match rate" value={94.8} />
              <QualityRow label="Completeness" value={88.1} />
              <QualityRow label="Validity" value={96.3} />
              <QualityRow label="Freshness" value={91.0} />
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Recent runs">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <RunRow name="SAP C4C — Customers" status="ok" />
              <RunRow name="SAP ERP — Vendors" status="ok" />
              <RunRow name="SQL Server — Products" status="warn" />
              <RunRow name="Excel — Authors" status="ok" />
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function QualityRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Text>{label}</Text>
        <Text strong>{value.toFixed(1)}%</Text>
      </Space>
      <div
        style={{
          marginTop: 6,
          height: 8,
          background: '#EAECF0',
          borderRadius: 6,
          overflow: 'hidden',
        }}>
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background:
              value >= 95
                ? '#12B76A'
                : value >= 85
                  ? '#1570EF'
                  : '#F79009',
          }}
        />
      </div>
    </div>
  );
}

function RunRow({ name, status }: { name: string; status: 'ok' | 'warn' }) {
  return (
    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
      <Text>{name}</Text>
      {status === 'ok' ? (
        <Tag icon={<CheckCircleOutlined />} color="success" bordered={false}>
          OK
        </Tag>
      ) : (
        <Tag icon={<WarningOutlined />} color="warning" bordered={false}>
          Warn
        </Tag>
      )}
    </Space>
  );
}
