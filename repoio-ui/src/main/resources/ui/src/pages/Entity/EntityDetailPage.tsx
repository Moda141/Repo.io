import {
  Tabs,
  Row,
  Col,
  Card,
  Input,
  Button,
  Space,
  Tag,
  Avatar,
  Typography,
  Table,
  Dropdown,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  ControlOutlined,
  LikeOutlined,
  DislikeOutlined,
  CommentOutlined,
  HistoryOutlined,
  MoreOutlined,
  CopyOutlined,
  LinkOutlined,
  BranchesOutlined,
  NodeIndexOutlined,
  MergeCellsOutlined,
  SwapOutlined,
  TagOutlined,
  BookOutlined,
  TrophyFilled,
} from '@ant-design/icons';
import { useParams, Link, generatePath, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import TitleBreadcrumb from '@/components/common/TitleBreadcrumb';
import { ROUTES } from '@/constants/routes';
import type { ColumnsType } from 'antd/es/table';
import type { ReactNode } from 'react';

const { Text } = Typography;

/**
 * EntityDetailPage — rebuilt to match OpenMetadata's dim_customers layout:
 *
 *   TitleBreadcrumb
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  [icon] <Title>                                 ★ 46 👎 14 💬 │
 *   │  <subtitle>                                                   │
 *   ├───────────────────────────────────────────────────────────────┤
 *   │ Domains · Owners · Tier · Certification · Retention · Type …  │ pills row
 *   ├───────────────────────────────────────────────────────────────┤
 *   │ Columns [12]  Activity 80  Sample  Queries 2  Observability … │ tabs
 *   └───────────────────────────────────────────────────────────────┘
 *
 *   Left (18/24)                              Right (6/24)
 *   ┌──────────────────────────────────────┐  ┌──────────────────┐
 *   │ Description card                      │  │ Data Products   │
 *   │ ────────────────────────────────────  │  ├──────────────────┤
 *   │ [Find in table]  [Sort] [Customize]   │  │ Tags            │
 *   │ ┌──────────────────────────────────┐  │  ├──────────────────┤
 *   │ │ Name  Type  Description  Tags …  │  │  │ Glossary Term   │
 *   │ │ ─────────────────────────────── │  │  ├──────────────────┤
 *   │ │ rows…                            │  │  │ Custom Properties│
 *   │ └──────────────────────────────────┘  │  └──────────────────┘
 *   └──────────────────────────────────────┘
 */

interface AttributeRow {
  key: string;
  name: string;
  type: string;
  description: string;
  tags: string[];
  glossary: string[];
  authored_by?: string;
  authored_at?: string;
  dq?: 'ok' | 'warn' | null;
}

const attributeRows: AttributeRow[] = [
  {
    key: 'master_id',
    name: 'master_id',
    type: 'varchar',
    description: 'Unique master identifier assigned when the record was promoted to golden.',
    tags: ['Primary key', 'Non-null'],
    glossary: ['Customer'],
    authored_by: 'mohamed.m',
    authored_at: '2 days ago',
    dq: 'ok',
  },
  {
    key: 'name',
    name: 'name',
    type: 'varchar',
    description: 'Business name as it appears to steward and downstream apps.',
    tags: ['Searchable'],
    glossary: ['Customer', 'Name'],
    authored_by: 'ahmed.h',
    authored_at: '7 days ago',
    dq: 'ok',
  },
  {
    key: 'legal_name',
    name: 'legal_name',
    type: 'varchar',
    description: 'Full legal entity name used on contracts and invoicing.',
    tags: ['Contract-ready'],
    glossary: ['Customer'],
    authored_by: 'ahmed.h',
    authored_at: '14 days ago',
    dq: null,
  },
  {
    key: 'country',
    name: 'country',
    type: 'enum',
    description: 'ISO country code — in {EG, SA, AE, KW, OM, BH, QA}.',
    tags: ['Location'],
    glossary: ['Country'],
    dq: 'ok',
  },
  {
    key: 'tax_id',
    name: 'tax_id',
    type: 'varchar',
    description: '9-digit government tax identifier (dashes optional).',
    tags: ['PII', 'Highly Confidential'],
    glossary: ['Tax number'],
    authored_by: 'mohamed.m',
    authored_at: '30 days ago',
    dq: 'warn',
  },
  {
    key: 'email',
    name: 'email',
    type: 'email',
    description: 'Primary business email address — RFC 5322.',
    tags: ['PII', 'Contact'],
    glossary: ['Email'],
    dq: 'ok',
  },
  {
    key: 'phone',
    name: 'phone',
    type: 'varchar',
    description: 'International phone number (E.164).',
    tags: ['PII'],
    glossary: ['Phone number'],
    dq: null,
  },
  {
    key: 'segment',
    name: 'segment',
    type: 'enum',
    description: 'Business segment (enterprise, mid_market, smb, government).',
    tags: ['Segmentation'],
    glossary: [],
    dq: 'ok',
  },
  {
    key: 'parent_id',
    name: 'parent_id',
    type: 'varchar',
    description: 'master_id of this record\'s parent in the hierarchy.',
    tags: ['Hierarchy'],
    glossary: ['Parent'],
    dq: null,
  },
  {
    key: 'created_at',
    name: 'created_at',
    type: 'timestamp',
    description: 'When the golden record was first materialised.',
    tags: [],
    glossary: [],
    dq: 'ok',
  },
];

export default function EntityDetailPage() {
  const { entityType = 'customer', id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const path = (route: string) => generatePath(route, { entityType, id });

  const breadcrumb = (
    <TitleBreadcrumb
      titleLinks={[
        {
          name: 'repoio_mdm',
          url: ROUTES.HOME,
        },
        {
          name: 'Golden',
          url: ROUTES.EXPLORE,
        },
        {
          name: t(`entity.${entityType}_plural`),
          url: generatePath(ROUTES.ENTITY_LIST, { entityType }),
        },
        { name: id, activeTitle: true },
      ]}
    />
  );

  const attrColumns: ColumnsType<AttributeRow> = [
    {
      title: 'Name',
      dataIndex: 'name',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string) => (
        <Space direction="vertical" size={0}>
          <a style={{ color: '#1570EF', fontWeight: 500 }}>{name}</a>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 110,
      render: (t: string) => (
        <Text type="secondary">{t}</Text>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (desc: string, r) => (
        <Space direction="vertical" size={2}>
          <Text>{desc}</Text>
          {r.authored_by && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Authored by{' '}
              <a style={{ color: '#1570EF' }}>{r.authored_by}</a>
              {' · '}
              {r.authored_at}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      width: 220,
      render: (tags: string[]) =>
        tags.length ? (
          <Space size={4} wrap>
            {tags.map((t) => (
              <Tag key={t} bordered={false}>
                {t}
              </Tag>
            ))}
          </Space>
        ) : (
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}>
            Add
          </Button>
        ),
    },
    {
      title: 'Glossary Terms',
      dataIndex: 'glossary',
      width: 180,
      render: (glossary: string[]) =>
        glossary.length ? (
          <Space size={4} wrap>
            {glossary.map((g) => (
              <Tag key={g} icon={<BookOutlined />} bordered={false} color="processing">
                {g}
              </Tag>
            ))}
          </Space>
        ) : (
          <Button type="text" size="small" style={{ color: '#98a2b3' }}>
            Go Off
          </Button>
        ),
    },
    {
      title: 'Data Quality',
      dataIndex: 'dq',
      width: 130,
      render: (dq: AttributeRow['dq']) =>
        dq === 'ok' ? (
          <Tag bordered={false} color="success">
            Pass
          </Tag>
        ) : dq === 'warn' ? (
          <Tag bordered={false} color="warning">
            Warn
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title=""
        documentTitle={`${t(`entity.${entityType}`)} · ${id}`}
      />

      {/* Breadcrumb */}
      <div style={{ marginBottom: 8 }}>{breadcrumb}</div>

      {/* Entity header card — mirrors OpenMetadata PageHeader with pills row */}
      <Card
        bordered
        style={{
          marginBottom: 16,
          background: 'linear-gradient(180deg, #fcfcfd 0%, #ffffff 100%)',
        }}
        styles={{ body: { padding: '20px 24px' } }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col flex="auto">
            <Space size={12} align="start">
              <Avatar
                size={48}
                shape="square"
                style={{
                  background:
                    'linear-gradient(135deg, #1570EF 0%, #6938EF 100%)',
                  fontSize: 20,
                  fontWeight: 700,
                }}>
                C
              </Avatar>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                    {id}
                  </h2>
                  <Button type="text" size="small" icon={<CopyOutlined />} />
                  <Button type="text" size="small" icon={<LinkOutlined />} />
                </div>
                <Text type="secondary">{t(`entity.${entityType}`)}</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space size={16}>
              <IconStat icon={<TrophyFilled />} value={46} color="#F79009" />
              <IconStat icon={<LikeOutlined />} value={46} />
              <IconStat icon={<DislikeOutlined />} value={14} />
              <IconStat icon={<CommentOutlined />} value={15} />
              <IconStat icon={<HistoryOutlined />} value={27.8} />
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'edit',
                      icon: <EditOutlined />,
                      label: 'Edit',
                      onClick: () => navigate(path(ROUTES.ENTITY_EDIT)),
                    },
                    {
                      key: 'hierarchy',
                      icon: <BranchesOutlined />,
                      label: 'Hierarchy',
                      onClick: () => navigate(path(ROUTES.ENTITY_HIERARCHY)),
                    },
                    {
                      key: 'lineage',
                      icon: <NodeIndexOutlined />,
                      label: 'Lineage',
                      onClick: () => navigate(path(ROUTES.ENTITY_LINEAGE)),
                    },
                    {
                      key: 'merge',
                      icon: <MergeCellsOutlined />,
                      label: 'Merge',
                      onClick: () =>
                        navigate(`/entity/${entityType}/merge?ids=${id},CUST-000198`),
                    },
                    {
                      key: 'request',
                      icon: <SwapOutlined />,
                      label: 'Request change',
                      onClick: () =>
                        navigate(
                          `${ROUTES.CHANGE_REQUEST_NEW}?entityType=${entityType}&id=${id}`
                        ),
                    },
                  ],
                }}
                trigger={['click']}>
                <Button type="text" icon={<MoreOutlined />} />
              </Dropdown>
            </Space>
          </Col>
        </Row>

        {/* Info pills row */}
        <Row gutter={0}>
          {[
            { label: 'Domains', value: <Tag bordered={false} color="processing">Golden</Tag> },
            { label: 'Owners', value: <OwnerPills owners={['M', 'A', 'N']} /> },
            { label: 'Tier', value: <Tag color="warning" bordered={false} icon={<TrophyFilled />}>Tier 1</Tag> },
            { label: 'Certification', value: <Tag color="success" bordered={false}>Gold</Tag> },
            { label: 'Retention Period', value: <Text>7 years</Text> },
            { label: 'Type', value: <Text>Regular</Text> },
            { label: 'Usage', value: <Text>95 pctile</Text> },
          ].map((pill, i, arr) => (
            <Col
              key={pill.label}
              flex="1 0 auto"
              style={{
                paddingInline: 16,
                borderInlineEnd: i < arr.length - 1 ? '1px dashed #eaecf0' : undefined,
              }}>
              <div style={{ color: '#667085', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                {pill.label} <EditOutlined style={{ fontSize: 11, opacity: 0.4 }} />
              </div>
              <div>{pill.value}</div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Tabs row with count badges */}
      <Tabs
        defaultActiveKey="columns"
        className="entity-detail-tabs"
        items={[
          {
            key: 'columns',
            label: (
              <Space size={6}>
                <strong>Attributes</strong>
                <Tag bordered={false} color="processing">{attributeRows.length}</Tag>
              </Space>
            ),
            children: (
              <Row gutter={16}>
                <Col xs={24} xl={18}>
                  {/* Description card */}
                  <Card
                    title="Description"
                    extra={
                      <Space>
                        <Button type="text" size="small" icon={<EditOutlined />} />
                        <Button type="text" size="small" icon={<CopyOutlined />} />
                        <Button type="text" size="small" icon={<CommentOutlined />} />
                      </Space>
                    }
                    style={{ marginBottom: 16 }}>
                    <Text>
                      Golden {t(`entity.${entityType}`)} records are produced by Splink matching +
                      survivorship rules from SAP C4C, SAP ERP, SQL Server and Excel sources.
                      This table holds one row per surviving entity with full provenance in{' '}
                      <a style={{ color: '#1570EF' }}>change_log</a> and{' '}
                      <a style={{ color: '#1570EF' }}>audit</a>.
                    </Text>
                    <div style={{ marginTop: 10, color: '#667085', fontSize: 12 }}>
                      Authored by <a style={{ color: '#1570EF' }}>mohamed.m</a> · 7 days ago
                    </div>
                  </Card>

                  {/* Attributes table toolbar */}
                  <Card style={{ marginBottom: 0 }}>
                    <Row
                      style={{ marginBottom: 12 }}
                      justify="space-between"
                      align="middle"
                      gutter={12}>
                      <Col flex="auto">
                        <Input
                          size="middle"
                          placeholder="Find in table"
                          prefix={<SearchOutlined style={{ color: '#98a2b3' }} />}
                          allowClear
                          style={{
                            maxWidth: 420,
                            background: '#f9fafb',
                            borderColor: 'transparent',
                          }}
                        />
                      </Col>
                      <Col>
                        <Space>
                          <Button icon={<SortAscendingOutlined />}>Sort</Button>
                          <Button icon={<ControlOutlined />}>Customize</Button>
                        </Space>
                      </Col>
                    </Row>

                    <Table
                      rowKey="key"
                      columns={attrColumns}
                      dataSource={attributeRows}
                      pagination={false}
                      size="middle"
                    />
                  </Card>
                </Col>

                {/* Right side panel */}
                <Col xs={24} xl={6}>
                  <SidePanelCard
                    title="Data Products"
                    icon={<BookOutlined />}
                    body={<Button type="dashed" size="small" icon={<PlusOutlined />}>Add</Button>}
                  />
                  <SidePanelCard
                    title="Tags"
                    icon={<TagOutlined />}
                    body={
                      <Space size={4} wrap>
                        <Tag bordered={false} color="processing">Engineering</Tag>
                        <Tag bordered={false} color="processing">Finance</Tag>
                        <Tag bordered={false} color="processing">HR</Tag>
                        <Tag bordered={false} color="processing">Marketing</Tag>
                        <Tag bordered={false} color="warning">Confidential</Tag>
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, fontSize: 12 }}>
                          + 4 More
                        </Button>
                      </Space>
                    }
                  />
                  <SidePanelCard
                    title="Glossary Terms"
                    icon={<BookOutlined />}
                    body={
                      <Space size={4} wrap>
                        <Tag bordered={false} icon={<BookOutlined />}>Bank</Tag>
                        <Tag bordered={false} icon={<BookOutlined />}>testUmaTerm</Tag>
                        <Tag bordered={false} icon={<BookOutlined />}>Customer</Tag>
                        <Tag bordered={false} icon={<BookOutlined />}>Order</Tag>
                        <Tag bordered={false} icon={<BookOutlined />}>Mobile number</Tag>
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, fontSize: 12 }}>
                          + 11 More
                        </Button>
                      </Space>
                    }
                  />
                  <SidePanelCard
                    title="Custom Properties"
                    icon={<ControlOutlined />}
                    extra={<a style={{ fontSize: 12, color: '#1570EF' }}>View All</a>}
                    body={
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            clsno
                          </Text>
                          <div>
                            <Tag bordered color="error">Invalid</Tag>
                          </div>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            demo
                          </Text>
                          <div>
                            <Text>—</Text>
                          </div>
                        </div>
                      </Space>
                    }
                  />
                </Col>
              </Row>
            ),
          },
          {
            key: 'activity',
            label: (
              <Space size={6}>
                Activity Feeds &amp; Tasks
                <Tag bordered={false}>80</Tag>
              </Space>
            ),
            children: <Card>Activity feed will show CR activity, DQ breaches, pipeline runs for this record.</Card>,
          },
          {
            key: 'sources',
            label: 'Sources',
            children: <Card>Source trail with per-source value + confidence.</Card>,
          },
          {
            key: 'queries',
            label: (
              <Space size={6}>
                Change Requests
                <Tag bordered={false}>2</Tag>
              </Space>
            ),
            children: <Card>Change requests opened against this record.</Card>,
          },
          {
            key: 'observability',
            label: 'Data Observability',
            children: <Card>Freshness, completeness, validity scorecards over time.</Card>,
          },
          {
            key: 'lineage',
            label: 'Lineage',
            children: (
              <Card>
                <Link to={path(ROUTES.ENTITY_LINEAGE)}>Open full lineage →</Link>
              </Card>
            ),
          },
          {
            key: 'hierarchy',
            label: 'Hierarchy',
            children: (
              <Card>
                <Link to={path(ROUTES.ENTITY_HIERARCHY)}>Open full hierarchy →</Link>
              </Card>
            ),
          },
          {
            key: 'custom',
            label: 'Custom Properties',
            children: <Card>Custom properties attached to this entity.</Card>,
          },
        ]}
      />
    </>
  );
}

function IconStat({
  icon,
  value,
  color,
}: {
  icon: ReactNode;
  value: number;
  color?: string;
}) {
  return (
    <Space size={4} style={{ color: color ?? '#667085', fontSize: 13 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <strong style={{ color: '#101828' }}>{value}</strong>
    </Space>
  );
}

function OwnerPills({ owners }: { owners: string[] }) {
  const colors = ['#1570EF', '#6938EF', '#F79009'];
  return (
    <Avatar.Group size="small">
      {owners.map((o, i) => (
        <Avatar
          key={o}
          size={22}
          style={{
            background: `${colors[i % colors.length]}1A`,
            color: colors[i % colors.length],
            fontWeight: 600,
            fontSize: 11,
          }}>
          {o}
        </Avatar>
      ))}
    </Avatar.Group>
  );
}

function SidePanelCard({
  title,
  icon,
  body,
  extra,
}: {
  title: string;
  icon?: ReactNode;
  body: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <Card
      size="small"
      title={
        <Space size={6}>
          {icon}
          <strong style={{ fontSize: 13 }}>{title}</strong>
          <Button type="text" size="small" icon={<EditOutlined style={{ fontSize: 11, color: '#98a2b3' }} />} />
          <Button type="text" size="small" icon={<CommentOutlined style={{ fontSize: 11, color: '#98a2b3' }} />} />
        </Space>
      }
      extra={extra}
      style={{ marginBottom: 12 }}
      styles={{ body: { paddingTop: 10, paddingBottom: 10 } }}>
      {body}
    </Card>
  );
}
