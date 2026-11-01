import { Table, Tag, Space, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';

interface Row {
  id: string;
  entity: string;
  master_id: string;
  summary: string;
  requested_by: string;
  status: 'open' | 'approved' | 'rejected';
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
    created_at: '2026-10-29',
  },
  {
    id: 'CR-00127',
    entity: 'Customer',
    master_id: 'CUST-000142',
    summary: 'Merge duplicate with CUST-000198',
    requested_by: 'ahmed@nahdetmisr.com',
    status: 'open',
    created_at: '2026-10-28',
  },
];

export default function ChangeRequestsPage() {
  const { t } = useTranslation();

  const columns: ColumnsType<Row> = [
    { title: 'CR', dataIndex: 'id', render: (id) => <code>{id}</code> },
    { title: 'Entity', dataIndex: 'entity' },
    {
      title: t('entity.master_id'),
      dataIndex: 'master_id',
      render: (id) => <code>{id}</code>,
    },
    { title: 'Summary', dataIndex: 'summary' },
    { title: 'Requested by', dataIndex: 'requested_by' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: Row['status']) => (
        <Tag
          color={s === 'open' ? 'warning' : s === 'approved' ? 'success' : 'error'}
          bordered={false}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
    { title: 'Created', dataIndex: 'created_at' },
    {
      title: '',
      key: 'actions',
      render: () => (
        <Space>
          <Button type="link" size="small">
            Review
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('page.change_requests.title')}
        subtitle={t('page.change_requests.subtitle')}
      />
      <Table rowKey="id" columns={columns} dataSource={rows} />
    </>
  );
}
