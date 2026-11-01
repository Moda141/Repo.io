import { Card, Table, Tag, Space, Button, Progress } from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';

interface Run {
  key: string;
  pipeline: string;
  source: string;
  entity: string;
  status: 'running' | 'success' | 'queued';
  progress: number;
  last_run: string;
}

const runs: Run[] = [
  {
    key: '1',
    pipeline: 'c4c-customers',
    source: 'SAP C4C',
    entity: 'Customer',
    status: 'running',
    progress: 62,
    last_run: '2026-11-01 15:32',
  },
  {
    key: '2',
    pipeline: 'erp-vendors',
    source: 'SAP ERP',
    entity: 'Vendor',
    status: 'success',
    progress: 100,
    last_run: '2026-11-01 06:00',
  },
  {
    key: '3',
    pipeline: 'sqlserver-products',
    source: 'SQL Server',
    entity: 'Product',
    status: 'queued',
    progress: 0,
    last_run: '—',
  },
];

export default function PipelinesPage() {
  const { t } = useTranslation();

  const columns: ColumnsType<Run> = [
    {
      title: 'Pipeline',
      dataIndex: 'pipeline',
      render: (p) => <code>{p}</code>,
    },
    { title: 'Source', dataIndex: 'source' },
    { title: 'Entity', dataIndex: 'entity' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: Run['status']) => {
        if (s === 'running')
          return (
            <Tag icon={<PlayCircleOutlined />} color="processing" bordered={false}>
              RUNNING
            </Tag>
          );
        if (s === 'success')
          return (
            <Tag icon={<CheckCircleOutlined />} color="success" bordered={false}>
              SUCCESS
            </Tag>
          );
        return (
          <Tag icon={<ClockCircleOutlined />} bordered={false}>
            QUEUED
          </Tag>
        );
      },
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      render: (p: number) => <Progress percent={p} size="small" />,
    },
    { title: 'Last run', dataIndex: 'last_run' },
  ];

  return (
    <>
      <PageHeader
        title={t('page.pipelines.title')}
        subtitle={t('page.pipelines.subtitle')}
        actions={<Button type="primary">{t('actions.new')}</Button>}
      />
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Table rowKey="key" columns={columns} dataSource={runs} pagination={false} />
        </Card>
      </Space>
    </>
  );
}
