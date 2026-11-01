import { Space, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';

const { Title, Text } = Typography;

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  documentTitle?: string;
}

export default function PageHeader({
  title,
  subtitle,
  actions,
  documentTitle,
}: Props) {
  return (
    <Space
      direction="horizontal"
      align="start"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 24,
      }}>
      <Helmet>
        <title>{documentTitle || title} — Repo.io</title>
      </Helmet>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          {title}
        </Title>
        {subtitle && <Text type="secondary">{subtitle}</Text>}
      </div>
      {actions && <Space>{actions}</Space>}
    </Space>
  );
}
