import { Row, Col, Card, Space, Typography, Tag } from 'antd';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ENTITY_TYPES } from '@/constants/routes';
import { useTranslation } from 'react-i18next';
import {
  UserOutlined,
  ShopOutlined,
  BookOutlined,
  EditOutlined,
  TeamOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

const { Text } = Typography;

const iconMap: Record<string, ReactNode> = {
  user: <UserOutlined style={{ fontSize: 24, color: '#1570EF' }} />,
  shop: <ShopOutlined style={{ fontSize: 24, color: '#6938EF' }} />,
  book: <BookOutlined style={{ fontSize: 24, color: '#12B76A' }} />,
  edit: <EditOutlined style={{ fontSize: 24, color: '#F79009' }} />,
  team: <TeamOutlined style={{ fontSize: 24, color: '#F04438' }} />,
  home: <HomeOutlined style={{ fontSize: 24, color: '#06AED4' }} />,
};

const stats: Record<string, { fields: number; required: number; pii: number }> = {
  customer: { fields: 24, required: 5, pii: 4 },
  vendor: { fields: 14, required: 4, pii: 2 },
  product: { fields: 18, required: 6, pii: 0 },
  author: { fields: 10, required: 3, pii: 1 },
  employee: { fields: 22, required: 7, pii: 6 },
  store: { fields: 12, required: 4, pii: 1 },
};

export default function SchemaListPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader
        title="Entity schemas"
        subtitle="Add or edit the JSON Schema that defines each entity. Changes publish to repoio-spec on save."
      />
      <Row gutter={[16, 16]}>
        {ENTITY_TYPES.map((et) => {
          const s = stats[et.key] ?? { fields: 0, required: 0, pii: 0 };
          return (
            <Col key={et.key} xs={24} md={12} lg={8}>
              <Link to={`/settings/schema/${et.key}`}>
                <Card hoverable style={{ height: '100%' }}>
                  <Space
                    style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space size={12}>
                      {iconMap[et.icon]}
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {t(et.labelKey)}
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {et.key}.json
                        </Text>
                      </div>
                    </Space>
                    <Tag bordered={false}>v1</Tag>
                  </Space>
                  <Space wrap size={6} style={{ marginTop: 12 }}>
                    <Tag bordered={false}>{s.fields} fields</Tag>
                    <Tag bordered={false} color="processing">
                      {s.required} required
                    </Tag>
                    {s.pii > 0 && (
                      <Tag bordered={false} color="warning">
                        {s.pii} PII
                      </Tag>
                    )}
                  </Space>
                </Card>
              </Link>
            </Col>
          );
        })}
      </Row>
    </>
  );
}
