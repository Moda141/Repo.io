import { Table, Button, Space, Tag, Input } from 'antd';
import { PlusOutlined, SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';

interface MockRow {
  master_id: string;
  name: string;
  sources: string[];
  status: 'golden' | 'review' | 'duplicate';
  updated_at: string;
}

const mockRows: MockRow[] = [
  {
    master_id: 'CUST-000142',
    name: 'Acme Publishing House',
    sources: ['SAP C4C', 'SAP ERP'],
    status: 'golden',
    updated_at: '2026-11-01',
  },
  {
    master_id: 'CUST-000189',
    name: 'Nile River Bookstore',
    sources: ['SAP C4C', 'SQL Server'],
    status: 'golden',
    updated_at: '2026-10-30',
  },
  {
    master_id: 'CUST-000204',
    name: 'Horus Media Group',
    sources: ['SAP C4C'],
    status: 'review',
    updated_at: '2026-10-29',
  },
];

export default function EntityListPage() {
  const { t } = useTranslation();
  const { entityType = 'customer' } = useParams<{ entityType: string }>();
  const typePluralKey = `entity.${entityType}_plural`;

  const columns: ColumnsType<MockRow> = [
    {
      title: t('entity.master_id'),
      dataIndex: 'master_id',
      key: 'master_id',
      render: (id: string) => (
        <Link to={`/entity/${entityType}/${id}`}>
          <code>{id}</code>
        </Link>
      ),
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Sources',
      dataIndex: 'sources',
      key: 'sources',
      render: (sources: string[]) => (
        <Space size={4}>
          {sources.map((s) => (
            <Tag key={s} bordered={false}>
              {s}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: MockRow['status']) => {
        const color =
          status === 'golden'
            ? 'success'
            : status === 'review'
              ? 'warning'
              : 'error';
        return (
          <Tag color={color} bordered={false}>
            {status.toUpperCase()}
          </Tag>
        );
      },
    },
    { title: 'Updated', dataIndex: 'updated_at', key: 'updated_at' },
  ];

  return (
    <>
      <PageHeader
        title={t(typePluralKey)}
        subtitle={`${mockRows.length} ${t('entity.records')}`}
        actions={
          <>
            <Button icon={<FilterOutlined />}>{t('actions.export')}</Button>
            <Button type="primary" icon={<PlusOutlined />}>
              {t('actions.new')}
            </Button>
          </>
        }
      />
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Input
          size="middle"
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t('search.placeholder')}
          style={{ maxWidth: 480 }}
        />
        <Table
          rowKey="master_id"
          columns={columns}
          dataSource={mockRows}
          pagination={{ pageSize: 20 }}
        />
      </Space>
    </>
  );
}
