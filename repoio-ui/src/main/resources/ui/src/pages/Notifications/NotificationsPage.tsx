import {
  Row,
  Col,
  Card,
  List,
  Tag,
  Space,
  Button,
  Avatar,
  Typography,
  Tabs,
  Dropdown,
  Empty,
} from 'antd';
import {
  SwapOutlined,
  ApiOutlined,
  WarningOutlined,
  BellOutlined,
  CheckOutlined,
  SettingOutlined,
  MoreOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ReactNode } from 'react';

const { Text } = Typography;

/**
 * NotificationsPage — in-app inbox grouped by category.
 *
 * Every notification lands in Postgres via repoio-service. The user's
 * routing (see Profile → Notifications) decides which notifications
 * also go out as email or Slack. The badge in the TopBar reads from
 * the "unread" subset of this list.
 */

type Kind =
  | 'cr_assigned'
  | 'cr_approved'
  | 'cr_rejected'
  | 'pipeline_failed'
  | 'dq_breach'
  | 'schema_change'
  | 'user_invited';

interface Item {
  id: string;
  kind: Kind;
  title: string;
  summary: string;
  at: string;
  unread: boolean;
  target?: string;
}

const seed: Item[] = [
  {
    id: 'n-1',
    kind: 'cr_assigned',
    title: 'CR-00128 needs your review',
    summary: 'mohamed@nahdetmisr.com opened a change on CUST-000204',
    at: '2 min ago',
    unread: true,
    target: '/change-requests/CR-00128',
  },
  {
    id: 'n-2',
    kind: 'pipeline_failed',
    title: 'sqlserver-products failed',
    summary: 'Run r-11020600 — JDBC timeout after 2 retries',
    at: '18 min ago',
    unread: true,
    target: '/pipelines/sqlserver-products',
  },
  {
    id: 'n-3',
    kind: 'cr_approved',
    title: 'CR-00126 approved',
    summary: 'ahmed@nahdetmisr.com approved your "Add parent" request',
    at: '1 hour ago',
    unread: true,
    target: '/change-requests/CR-00126',
  },
  {
    id: 'n-4',
    kind: 'dq_breach',
    title: 'Author completeness dropped to 68.7%',
    summary: 'Threshold is 75%. First seen at 06:00 on today\'s pull.',
    at: '2 hours ago',
    unread: false,
    target: '/quality',
  },
  {
    id: 'n-5',
    kind: 'schema_change',
    title: 'Customer schema v2 proposed',
    summary: 'Added field loyalty_tier (enum). No breaking changes.',
    at: 'Yesterday',
    unread: false,
    target: '/settings/schema/customer',
  },
  {
    id: 'n-6',
    kind: 'user_invited',
    title: 'yara@nahdetmisr.com invited',
    summary: 'Role: Reader · Team: Marketing',
    at: 'Yesterday',
    unread: false,
    target: '/settings/users',
  },
  {
    id: 'n-7',
    kind: 'cr_rejected',
    title: 'CR-00109 rejected',
    summary: 'khaled@nahdetmisr.com rejected — "needs supporting source"',
    at: '2 days ago',
    unread: false,
    target: '/change-requests/CR-00109',
  },
];

const iconFor: Record<Kind, ReactNode> = {
  cr_assigned: <SwapOutlined style={{ color: '#F79009' }} />,
  cr_approved: <CheckOutlined style={{ color: '#027A48' }} />,
  cr_rejected: <SwapOutlined style={{ color: '#B42318' }} />,
  pipeline_failed: <ApiOutlined style={{ color: '#B42318' }} />,
  dq_breach: <SafetyCertificateOutlined style={{ color: '#F79009' }} />,
  schema_change: <BookOutlined style={{ color: '#6938EF' }} />,
  user_invited: <BellOutlined style={{ color: '#1570EF' }} />,
};
const toneFor: Record<Kind, string> = {
  cr_assigned: '#F79009',
  cr_approved: '#027A48',
  cr_rejected: '#B42318',
  pipeline_failed: '#B42318',
  dq_breach: '#F79009',
  schema_change: '#6938EF',
  user_invited: '#1570EF',
};
const categoryFor: Record<Kind, 'cr' | 'pipeline' | 'quality' | 'admin'> = {
  cr_assigned: 'cr',
  cr_approved: 'cr',
  cr_rejected: 'cr',
  pipeline_failed: 'pipeline',
  dq_breach: 'quality',
  schema_change: 'admin',
  user_invited: 'admin',
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>(seed);
  const [tab, setTab] = useState<'all' | 'unread' | 'cr' | 'pipeline' | 'quality' | 'admin'>(
    'all'
  );

  const markAll = () => setItems((prev) => prev.map((i) => ({ ...i, unread: false })));
  const markOne = (id: string) =>
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, unread: false } : i))
    );
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const filtered = useMemo(() => {
    if (tab === 'all') return items;
    if (tab === 'unread') return items.filter((i) => i.unread);
    return items.filter((i) => categoryFor[i.kind] === tab);
  }, [items, tab]);

  const counts = {
    all: items.length,
    unread: items.filter((i) => i.unread).length,
    cr: items.filter((i) => categoryFor[i.kind] === 'cr').length,
    pipeline: items.filter((i) => categoryFor[i.kind] === 'pipeline').length,
    quality: items.filter((i) => categoryFor[i.kind] === 'quality').length,
    admin: items.filter((i) => categoryFor[i.kind] === 'admin').length,
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={`${counts.unread} unread of ${counts.all} total`}
        actions={
          <>
            <Button icon={<CheckOutlined />} onClick={markAll} disabled={counts.unread === 0}>
              Mark all read
            </Button>
            <Link to={ROUTES.PROFILE}>
              <Button icon={<SettingOutlined />}>Routing</Button>
            </Link>
          </>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Unread</Text>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#1570EF' }}>
                {counts.unread}
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">
                <SwapOutlined /> Change requests
              </Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{counts.cr}</span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">
                <ApiOutlined /> Pipelines
              </Text>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#B42318' }}>
                {counts.pipeline}
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">
                <WarningOutlined /> Quality
              </Text>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#F79009' }}>
                {counts.quality}
              </span>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as typeof tab)}
          items={[
            { key: 'all', label: `All (${counts.all})` },
            { key: 'unread', label: `Unread (${counts.unread})` },
            { key: 'cr', label: `Change requests (${counts.cr})` },
            { key: 'pipeline', label: `Pipelines (${counts.pipeline})` },
            { key: 'quality', label: `Quality (${counts.quality})` },
            { key: 'admin', label: `Admin (${counts.admin})` },
          ]}
        />

        {filtered.length === 0 ? (
          <Empty description="Nothing here" />
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={filtered}
            renderItem={(it) => (
              <List.Item
                style={{
                  cursor: it.target ? 'pointer' : 'default',
                  background: it.unread ? '#F0F7FF' : 'transparent',
                  paddingInlineStart: 12,
                  paddingInlineEnd: 12,
                  borderRadius: 8,
                }}
                onClick={() => {
                  markOne(it.id);
                  if (it.target) navigate(it.target);
                }}
                actions={[
                  <Dropdown
                    key="more"
                    trigger={['click']}
                    menu={{
                      items: [
                        {
                          key: 'read',
                          icon: <CheckOutlined />,
                          label: it.unread ? 'Mark read' : 'Mark unread',
                          onClick: () =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id ? { ...x, unread: !x.unread } : x
                              )
                            ),
                        },
                        { type: 'divider' },
                        {
                          key: 'delete',
                          danger: true,
                          label: 'Dismiss',
                          onClick: () => remove(it.id),
                        },
                      ],
                    }}>
                    <Button
                      type="text"
                      icon={<MoreOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Dropdown>,
                ]}>
                <List.Item.Meta
                  avatar={
                    <Avatar
                      style={{
                        background: `${toneFor[it.kind]}1A`,
                        color: toneFor[it.kind],
                      }}
                      icon={iconFor[it.kind]}
                    />
                  }
                  title={
                    <Space>
                      <strong>{it.title}</strong>
                      {it.unread && (
                        <Tag color="processing" bordered={false}>
                          NEW
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Text>{it.summary}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {it.at}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </>
  );
}
