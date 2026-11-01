import { Table, Tag, Button, Space, Progress } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link, useParams, generatePath } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ColumnsType } from 'antd/es/table';

interface Pair {
  pair_id: string;
  left_id: string;
  left_name: string;
  right_id: string;
  right_name: string;
  score: number;
  reason: string;
  status: 'open' | 'merged' | 'rejected';
}

const rows: Pair[] = [
  {
    pair_id: 'PR-00042',
    left_id: 'CUST-000142',
    left_name: 'Acme Publishing House',
    right_id: 'CUST-000198',
    right_name: 'Acme Publishing',
    score: 0.96,
    reason: 'Name + country + tax ID prefix',
    status: 'open',
  },
  {
    pair_id: 'PR-00041',
    left_id: 'CUST-000204',
    left_name: 'Horus Media Group',
    right_id: 'CUST-000211',
    right_name: 'Horus Media Grp.',
    score: 0.92,
    reason: 'Name tokens + address street',
    status: 'open',
  },
  {
    pair_id: 'PR-00040',
    left_id: 'CUST-000189',
    left_name: 'Nile River Bookstore',
    right_id: 'CUST-000187',
    right_name: 'Nile Bookstore',
    score: 0.86,
    reason: 'Name token + phone',
    status: 'open',
  },
];

export default function DuplicateListPage() {
  const { entityType = 'customer' } = useParams();
  const { t } = useTranslation();

  const columns: ColumnsType<Pair> = [
    { title: 'Pair', dataIndex: 'pair_id', render: (p) => <code>{p}</code> },
    {
      title: 'Left',
      key: 'left',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <code>{r.left_id}</code>
          <span>{r.left_name}</span>
        </Space>
      ),
    },
    {
      title: 'Right',
      key: 'right',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <code>{r.right_id}</code>
          <span>{r.right_name}</span>
        </Space>
      ),
    },
    {
      title: 'Match score',
      dataIndex: 'score',
      render: (s: number) => (
        <Space>
          <Progress
            percent={Math.round(s * 100)}
            size="small"
            steps={10}
            strokeColor={s >= 0.95 ? '#12B76A' : s >= 0.9 ? '#1570EF' : '#F79009'}
            showInfo={false}
          />
          <strong>{(s * 100).toFixed(1)}%</strong>
        </Space>
      ),
    },
    { title: 'Reason', dataIndex: 'reason' },
    {
      title: '',
      key: 'actions',
      render: (_, r) => (
        <Link
          to={generatePath(ROUTES.DUPLICATE_REVIEW, {
            entityType,
            pairId: r.pair_id,
          })}>
          <Button type="link">Review</Button>
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={`Potential duplicates — ${t(`entity.${entityType}_plural`)}`}
        subtitle="Pairs produced by Splink awaiting a steward decision."
        actions={<Tag bordered={false}>{rows.length} open</Tag>}
      />
      <Table rowKey="pair_id" columns={columns} dataSource={rows} />
    </>
  );
}
