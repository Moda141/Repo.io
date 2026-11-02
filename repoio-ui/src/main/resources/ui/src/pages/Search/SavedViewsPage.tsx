import {
  Table,
  Button,
  Space,
  Tag,
  Avatar,
  Typography,
  Dropdown,
  message,
  Row,
  Col,
  Card,
} from 'antd';
import {
  PlusOutlined,
  MoreOutlined,
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  StarFilled,
  StarOutlined,
  ShareAltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

/**
 * SavedViewsPage — saved queries you (and your team) use often.
 *
 * A view bundles entity + query + sort + columns. Pinned views
 * appear at the top of the user's left rail and in the entity list
 * toolbar as quick filters. Private views are visible only to the
 * owner; shared views are visible to everyone in the owner's team.
 */

interface View {
  id: string;
  name: string;
  entity: string;
  owner: string;
  shared: boolean;
  pinned: boolean;
  rows: number;
  updated_at: string;
}

const initial: View[] = [
  {
    id: 'V-01',
    name: 'Enterprise customers in Egypt',
    entity: 'Customer',
    owner: 'mohamed@nahdetmisr.com',
    shared: true,
    pinned: true,
    rows: 342,
    updated_at: '2026-11-01',
  },
  {
    id: 'V-02',
    name: 'Vendors with no tax ID',
    entity: 'Vendor',
    owner: 'ahmed@nahdetmisr.com',
    shared: true,
    pinned: false,
    rows: 11,
    updated_at: '2026-10-30',
  },
  {
    id: 'V-03',
    name: 'Products missing ISBN',
    entity: 'Product',
    owner: 'mohamed@nahdetmisr.com',
    shared: false,
    pinned: true,
    rows: 7,
    updated_at: '2026-10-28',
  },
  {
    id: 'V-04',
    name: 'Review queue (score 0.8–0.9)',
    entity: 'Customer',
    owner: 'mohamed@nahdetmisr.com',
    shared: true,
    pinned: false,
    rows: 48,
    updated_at: '2026-10-25',
  },
];

export default function SavedViewsPage() {
  const navigate = useNavigate();
  const [views, setViews] = useState<View[]>(initial);

  const togglePin = (id: string) => {
    setViews((prev) =>
      prev.map((v) => (v.id === id ? { ...v, pinned: !v.pinned } : v))
    );
  };

  const columns: ColumnsType<View> = [
    {
      title: '',
      dataIndex: 'pinned',
      width: 48,
      render: (p: boolean, r) => (
        <Button
          type="text"
          size="small"
          icon={p ? <StarFilled style={{ color: '#F79009' }} /> : <StarOutlined />}
          onClick={() => togglePin(r.id)}
        />
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      render: (name: string, r) => (
        <Link to={`/views/${r.id}`}>
          <strong>{name}</strong>
        </Link>
      ),
    },
    { title: 'Entity', dataIndex: 'entity', width: 120 },
    {
      title: 'Owner',
      dataIndex: 'owner',
      width: 240,
      render: (o: string) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <Text>{o}</Text>
        </Space>
      ),
    },
    {
      title: 'Visibility',
      dataIndex: 'shared',
      width: 120,
      render: (s: boolean) =>
        s ? (
          <Tag icon={<ShareAltOutlined />} color="processing" bordered={false}>
            Shared
          </Tag>
        ) : (
          <Tag bordered={false}>Private</Tag>
        ),
    },
    {
      title: 'Rows',
      dataIndex: 'rows',
      width: 100,
      align: 'right',
      render: (n: number) => n.toLocaleString(),
    },
    { title: 'Updated', dataIndex: 'updated_at', width: 120 },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_, r) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'edit',
                icon: <EditOutlined />,
                label: 'Edit query',
                onClick: () => navigate(ROUTES.QUERY),
              },
              {
                key: 'duplicate',
                icon: <CopyOutlined />,
                label: 'Duplicate',
                onClick: () => message.success(`Duplicated "${r.name}"`),
              },
              { type: 'divider' },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: 'Delete',
                danger: true,
                onClick: () =>
                  setViews((prev) => prev.filter((v) => v.id !== r.id)),
              },
            ],
          }}
          trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const pinned = views.filter((v) => v.pinned);
  const others = views.filter((v) => !v.pinned);

  return (
    <>
      <PageHeader
        title="Saved views"
        subtitle="Reusable queries pinned to your rail and shared with your team."
        actions={
          <Link to={ROUTES.QUERY}>
            <Button type="primary" icon={<PlusOutlined />}>
              New view
            </Button>
          </Link>
        }
      />

      {pinned.length > 0 && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {pinned.map((v) => (
              <Col key={v.id} xs={24} sm={12} lg={6}>
                <Link to={`/views/${v.id}`}>
                  <Card hoverable>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space
                        style={{ width: '100%', justifyContent: 'space-between' }}>
                        <StarFilled style={{ color: '#F79009' }} />
                        <Tag bordered={false}>{v.entity}</Tag>
                      </Space>
                      <strong>{v.name}</strong>
                      <Text type="secondary">
                        {v.rows.toLocaleString()} rows
                      </Text>
                    </Space>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        </>
      )}

      <Card title="All views">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={[...pinned, ...others]}
          pagination={false}
        />
      </Card>
    </>
  );
}
