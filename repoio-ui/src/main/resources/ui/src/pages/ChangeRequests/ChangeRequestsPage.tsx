import { Table, Tag, Space, Button, Row, Col, Card } from 'antd';
import {
  PlusOutlined,
  UserOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ColumnsType } from 'antd/es/table';

interface Row {
  id: string;
  entity: string;
  master_id: string;
  summary: string;
  requested_by: string;
  status: 'open' | 'approved' | 'rejected';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
}

const rows: Row[] = [
  {
    id: 'CR-00128',
    entity: 'Customer',
    master_id: 'CUST-000204',
    summary: 'Update billing address',
    requested_by: 'mohamed@nahdetmisr.com',
    status: 'open',
    priority: 'normal',
    created_at: '2026-10-29',
  },
  {
    id: 'CR-00127',
    entity: 'Customer',
    master_id: 'CUST-000142',
    summary: 'Merge duplicate with CUST-000198',
    requested_by: 'ahmed@nahdetmisr.com',
    status: 'open',
    priority: 'high',
    created_at: '2026-10-28',
  },
  {
    id: 'CR-00126',
    entity: 'Customer',
    master_id: 'CUST-000142',
    summary: 'Add parent — Acme Holdings',
    requested_by: 'mohamed@nahdetmisr.com',
    status: 'open',
    priority: 'low',
    created_at: '2026-10-28',
  },
];

/**
 * ChangeRequestsPage — reviewer inbox.
 * Three KPI cards up top, then the full queue. Each row links to the
 * detail page where approve/reject lives.
 */
export default function ChangeRequestsPage() {
  const { t } = useTranslation();

  const priorityColor: Record<Row['priority'], string> = {
    low: 'default',
    normal: 'blue',
    high: 'orange',
    urgent: 'red',
  };

  const columns: ColumnsType<Row> = [
    {
      title: 'CR',
      dataIndex: 'id',
      width: 110,
      render: (id: string) => (
        <Link to={`/change-requests/${id}`}>
          <code>{id}</code>
        </Link>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      width: 100,
      render: (p: Row['priority']) => (
        <Tag color={priorityColor[p]} bordered={false}>
          {p.toUpperCase()}
        </Tag>
      ),
    },
    { title: 'Entity', dataIndex: 'entity', width: 110 },
    {
      title: t('entity.master_id'),
      dataIndex: 'master_id',
      width: 140,
      render: (id: string) => <code>{id}</code>,
    },
    { title: 'Summary', dataIndex: 'summary' },
    { title: 'Requested by', dataIndex: 'requested_by', width: 220 },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (s: Row['status']) => (
        <Tag
          color={s === 'open' ? 'warning' : s === 'approved' ? 'success' : 'error'}
          bordered={false}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
    { title: 'Created', dataIndex: 'created_at', width: 110 },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, r) => (
        <Space>
          <Link to={`/change-requests/${r.id}`}>
            <Button type="link" size="small">
              Review
            </Button>
          </Link>
        </Space>
      ),
    },
  ];

  const openCount = rows.filter((r) => r.status === 'open').length;

  return (
    <>
      <PageHeader
        title={t('page.change_requests.title')}
        subtitle={t('page.change_requests.subtitle')}
        actions={
          <>
            <Link to={ROUTES.CHANGE_REQUEST_MINE}>
              <Button icon={<UserOutlined />}>My requests</Button>
            </Link>
            <Link to={ROUTES.CHANGE_REQUEST_NEW}>
              <Button type="primary" icon={<PlusOutlined />}>
                {t('actions.new')}
              </Button>
            </Link>
          </>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <span style={{ color: '#667085' }}>Open</span>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{openCount}</span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <span style={{ color: '#667085' }}>Due today</span>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#F79009' }}>
                2
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <span style={{ color: '#667085' }}>
                <CheckOutlined /> Approved · 7d
              </span>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#027A48' }}>
                18
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <span style={{ color: '#667085' }}>
                <CloseOutlined /> Rejected · 7d
              </span>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#B42318' }}>
                2
              </span>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card>
        <Table rowKey="id" columns={columns} dataSource={rows} />
      </Card>
    </>
  );
}
