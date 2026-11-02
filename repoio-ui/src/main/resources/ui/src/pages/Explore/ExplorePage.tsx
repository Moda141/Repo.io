import { Row, Col, Card, Space, Typography, Button } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import { ENTITY_TYPES, ROUTES } from '@/constants/routes';
import {
  UserOutlined,
  ShopOutlined,
  BookOutlined,
  EditOutlined,
  TeamOutlined,
  HomeOutlined,
  BuildOutlined,
  StarOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

const { Text } = Typography;

const iconMap: Record<string, ReactNode> = {
  user: <UserOutlined style={{ fontSize: 28, color: '#1570EF' }} />,
  shop: <ShopOutlined style={{ fontSize: 28, color: '#6938EF' }} />,
  book: <BookOutlined style={{ fontSize: 28, color: '#12B76A' }} />,
  edit: <EditOutlined style={{ fontSize: 28, color: '#F79009' }} />,
  team: <TeamOutlined style={{ fontSize: 28, color: '#F04438' }} />,
  home: <HomeOutlined style={{ fontSize: 28, color: '#06AED4' }} />,
};

export default function ExplorePage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader
        title={t('page.explore.title')}
        subtitle={t('page.explore.subtitle')}
        actions={
          <>
            <Link to={ROUTES.VIEWS}>
              <Button icon={<StarOutlined />}>Saved views</Button>
            </Link>
            <Link to={ROUTES.QUERY}>
              <Button icon={<BuildOutlined />}>Query builder</Button>
            </Link>
            <Link to={ROUTES.EXPORT}>
              <Button type="primary" icon={<DownloadOutlined />}>
                Export
              </Button>
            </Link>
          </>
        }
      />
      <Row gutter={[16, 16]}>
        {ENTITY_TYPES.map((et) => (
          <Col key={et.key} xs={24} sm={12} lg={8}>
            <Link to={`/entity/${et.key}`}>
              <Card hoverable style={{ height: '100%' }}>
                <Space size={16}>
                  {iconMap[et.icon]}
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                      {t(et.labelKey)}
                    </div>
                    <Text type="secondary">
                      Browse all {t(et.labelKey).toLowerCase()}
                    </Text>
                  </div>
                </Space>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </>
  );
}
