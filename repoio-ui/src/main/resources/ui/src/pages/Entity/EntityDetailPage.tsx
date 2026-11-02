import { Tabs, Descriptions, Card, Tag, Space, Button, Timeline } from 'antd';
import { useParams, Link, generatePath, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import {
  EditOutlined,
  BranchesOutlined,
  NodeIndexOutlined,
  MergeCellsOutlined,
  SwapOutlined,
} from '@ant-design/icons';

export default function EntityDetailPage() {
  const { entityType = 'customer', id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const path = (route: string) => generatePath(route, { entityType, id });

  return (
    <>
      <PageHeader
        title={`${t(`entity.${entityType}`)} · ${id}`}
        subtitle={t('entity.golden_record')}
        actions={
          <>
            <Link to={path(ROUTES.ENTITY_HIERARCHY)}>
              <Button icon={<BranchesOutlined />}>Hierarchy</Button>
            </Link>
            <Link to={path(ROUTES.ENTITY_LINEAGE)}>
              <Button icon={<NodeIndexOutlined />}>Lineage</Button>
            </Link>
            <Link
              to={`${ROUTES.CHANGE_REQUEST_NEW}?entityType=${entityType}&id=${id}`}>
              <Button icon={<SwapOutlined />}>Request change</Button>
            </Link>
            <Button
              icon={<MergeCellsOutlined />}
              onClick={() =>
                navigate(
                  `/entity/${entityType}/merge?ids=${id},CUST-000198`
                )
              }>
              Merge
            </Button>
            <Link to={path(ROUTES.ENTITY_EDIT)}>
              <Button type="primary" icon={<EditOutlined />}>
                {t('actions.edit')}
              </Button>
            </Link>
          </>
        }
      />

      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card title="Golden record">
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="Master ID">
                      <code>{id}</code>
                    </Descriptions.Item>
                    <Descriptions.Item label="Name">
                      Acme Publishing House
                    </Descriptions.Item>
                    <Descriptions.Item label="Country">Egypt</Descriptions.Item>
                    <Descriptions.Item label="Segment">
                      Enterprise
                    </Descriptions.Item>
                    <Descriptions.Item label="Parent">
                      <code>CUST-000001</code>
                    </Descriptions.Item>
                    <Descriptions.Item label="Status">
                      <Tag color="success" bordered={false}>
                        GOLDEN
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="Sources">
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <SourceRow name="SAP C4C" id="C4C-77341" updated="2026-11-01" />
                    <SourceRow name="SAP ERP" id="ERP-9981" updated="2026-10-30" />
                    <SourceRow name="SQL Server" id="SQL-442" updated="2026-10-21" />
                  </Space>
                </Card>
              </Space>
            ),
          },
          {
            key: 'children',
            label: 'Children',
            children: <Card>No child records yet.</Card>,
          },
          {
            key: 'duplicates',
            label: 'Potential duplicates',
            children: <Card>2 candidate matches awaiting review.</Card>,
          },
          {
            key: 'history',
            label: 'History',
            children: (
              <Card>
                <Timeline
                  items={[
                    {
                      color: 'green',
                      children:
                        '2026-11-01 — Golden record created from Splink match (score 0.94)',
                    },
                    {
                      children: '2026-10-30 — Source SAP ERP added',
                    },
                    {
                      children: '2026-10-21 — Source SQL Server added',
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}

function SourceRow({
  name,
  id,
  updated,
}: {
  name: string;
  id: string;
  updated: string;
}) {
  return (
    <Space
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
      }}>
      <Space>
        <Tag bordered={false}>{name}</Tag>
        <code>{id}</code>
      </Space>
      <span style={{ color: '#667085' }}>{updated}</span>
    </Space>
  );
}
