import { Row, Col, Card, Tabs, Table, Tag, Space, Progress, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ColumnsType } from 'antd/es/table';

/**
 * MyRequestsPage — change requests opened by the current user.
 * Tabs split by lifecycle: Open · Approved · Rejected · All, with
 * SLA / status progress visible at a glance.
 */

interface Row {
  id: string;
  summary: string;
  entity: string;
  master_id: string;
  status: 'open' | 'approved' | 'rejected';
  sla_pct: number; // 0..100 of SLA elapsed
  updated_at: string;
}

const rows: Row[] = [
  {
    id: 'CR-00128',
    summary: 'Update billing address',
    entity: 'Customer',
    master_id: 'CUST-000204',
    status: 'open',
    sla_pct: 68,
    updated_at: '2026-11-02 09:00',
  },
  {
    id: 'CR-00126',
    summary: 'Add parent — Acme Holdings',
    entity: 'Customer',
    master_id: 'CUST-000142',
    status: 'open',
    sla_pct: 24,
    updated_at: '2026-11-02 08:12',
  },
  {
    id: 'CR-00120',
    summary: 'Fix tax ID typo',
    entity: 'Vendor',
    master_id: 'VEND-000041',
    status: 'approved',
    sla_pct: 100,
    updated_at: '2026-10-31 17:40',
  },
  {
    id: 'CR-00115',
    summary: 'Merge CUST-000198 into CUST-000142',
    entity: 'Customer',
    master_id: 'CUST-000142',
    status: 'approved',
    sla_pct: 100,
    updated_at: '2026-10-30 11:22',
  },
  {
    id: 'CR-00109',
    summary: 'Change segment to Enterprise',
    entity: 'Customer',
    master_id: 'CUST-000089',
    status: 'rejected',
    sla_pct: 100,
    updated_at: '2026-10-28 14:03',
  },
];

export default function MyRequestsPage() {
  const { t } = useTranslation();

  const statusColor: Record<Row['status'], 'warning' | 'success' | 'error'> = {
    open: 'warning',
    approved: 'success',
    rejected: 'error',
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
    { title: 'Summary', dataIndex: 'summary' },
    { title: 'Entity', dataIndex: 'entity', width: 110 },
    {
      title: t('entity.master_id'),
      dataIndex: 'master_id',
      width: 140,
      render: (id: string) => <code>{id}</code>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (s: Row['status']) => (
        <Tag color={statusColor[s]} bordered={false}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'SLA',
      dataIndex: 'sla_pct',
      width: 160,
      render: (pct: number, r: Row) =>
        r.status === 'open' ? (
          <Progress
            percent={pct}
            size="small"
            strokeColor={
              pct >= 90 ? '#F04438' : pct >= 70 ? '#F79009' : '#1570EF'
            }
            showInfo={false}
          />
        ) : (
          <Tag bordered={false}>Closed</Tag>
        ),
    },
    { title: 'Updated', dataIndex: 'updated_at', width: 160 },
  ];

  const subset = (status?: Row['status']) =>
    status ? rows.filter((r) => r.status === status) : rows;

  const summary = {
    open: subset('open').length,
    approved: subset('approved').length,
    rejected: subset('rejected').length,
    all: rows.length,
  };

  return (
    <>
      <PageHeader
        title="My change requests"
        subtitle="Change requests you opened — status, SLA and reviewer activity."
        actions={
          <Link to={ROUTES.CHANGE_REQUEST_NEW}>
            <Button type="primary" icon={<PlusOutlined />}>
              {t('actions.new')}
            </Button>
          </Link>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <span style={{ color: '#667085' }}>Open</span>
              <span style={{ fontSize: 24, fontWeight: 600 }}>
                {summary.open}
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <span style={{ color: '#667085' }}>Approved</span>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#027A48' }}>
                {summary.approved}
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <span style={{ color: '#667085' }}>Rejected</span>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#B42318' }}>
                {summary.rejected}
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <span style={{ color: '#667085' }}>Total this month</span>
              <span style={{ fontSize: 24, fontWeight: 600 }}>
                {summary.all}
              </span>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          defaultActiveKey="open"
          items={[
            {
              key: 'open',
              label: `Open (${summary.open})`,
              children: (
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={subset('open')}
                  pagination={false}
                />
              ),
            },
            {
              key: 'approved',
              label: `Approved (${summary.approved})`,
              children: (
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={subset('approved')}
                  pagination={false}
                />
              ),
            },
            {
              key: 'rejected',
              label: `Rejected (${summary.rejected})`,
              children: (
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={subset('rejected')}
                  pagination={false}
                />
              ),
            },
            {
              key: 'all',
              label: `All (${summary.all})`,
              children: (
                <Table
                  rowKey="id"
                  columns={columns}
                  dataSource={subset()}
                  pagination={false}
                />
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
