import {
  Row,
  Col,
  Card,
  Space,
  Button,
  Input,
  Select,
  DatePicker,
  Table,
  Tag,
  Typography,
  Drawer,
  Descriptions,
  Divider,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  FilterOutlined,
  UserOutlined,
  ApiOutlined,
  SwapOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useState, useMemo } from 'react';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';
import type { ReactNode } from 'react';

const { Text } = Typography;
const { RangePicker } = DatePicker;

/**
 * AuditLogPage — immutable record of every write (CR, user action,
 * schema change, pipeline run, auth event).
 *
 * The log itself is append-only in Iceberg (audit table) and signed per
 * batch so tampering is detectable. Filters narrow by actor, action,
 * entity and time range. Clicking a row opens the raw event with the
 * before/after diff where applicable.
 */

type ActionKind =
  | 'cr_open'
  | 'cr_approve'
  | 'cr_reject'
  | 'schema_change'
  | 'pipeline_run'
  | 'login'
  | 'key_create'
  | 'role_change';

interface Entry {
  id: string;
  at: string;
  actor: string;
  actor_kind: 'user' | 'service';
  action: ActionKind;
  entity?: string;
  master_id?: string;
  ip: string;
  signed: boolean;
  payload: Record<string, unknown>;
}

const seed: Entry[] = [
  {
    id: 'ev-11021502',
    at: '2026-11-02 15:02:11',
    actor: 'mohamed@nahdetmisr.com',
    actor_kind: 'user',
    action: 'cr_open',
    entity: 'Customer',
    master_id: 'CUST-000204',
    ip: '41.238.17.42',
    signed: true,
    payload: {
      cr: 'CR-00128',
      fields_changed: ['billing_address', 'phone', 'segment'],
    },
  },
  {
    id: 'ev-11021450',
    at: '2026-11-02 14:50:04',
    actor: 'ahmed@nahdetmisr.com',
    actor_kind: 'user',
    action: 'cr_approve',
    entity: 'Customer',
    master_id: 'CUST-000142',
    ip: '41.238.17.80',
    signed: true,
    payload: { cr: 'CR-00127', outcome: 'merge' },
  },
  {
    id: 'ev-11021425',
    at: '2026-11-02 14:25:12',
    actor: 'ingest-5b8f (service)',
    actor_kind: 'service',
    action: 'pipeline_run',
    entity: '-',
    ip: 'internal',
    signed: true,
    payload: { pipeline: 'c4c-customers', run: 'r-11021425', rows: 1_204 },
  },
  {
    id: 'ev-11021338',
    at: '2026-11-02 13:38:51',
    actor: 'mohamed@nahdetmisr.com',
    actor_kind: 'user',
    action: 'schema_change',
    entity: 'Customer',
    ip: '41.238.17.42',
    signed: true,
    payload: {
      field: 'segment',
      change: 'added enum value "government"',
    },
  },
  {
    id: 'ev-11020912',
    at: '2026-11-02 09:12:04',
    actor: 'mohamed@nahdetmisr.com',
    actor_kind: 'user',
    action: 'login',
    ip: '41.238.17.42',
    signed: true,
    payload: { mfa: true, mfa_method: 'TOTP' },
  },
  {
    id: 'ev-11020900',
    at: '2026-11-02 09:00:21',
    actor: 'nour@nahdetmisr.com',
    actor_kind: 'user',
    action: 'role_change',
    ip: '41.238.17.42',
    signed: true,
    payload: {
      target: 'yara@nahdetmisr.com',
      from: ['Reader'],
      to: ['Reader', 'Steward'],
    },
  },
];

const actionIcons: Record<ActionKind, ReactNode> = {
  cr_open: <SwapOutlined style={{ color: '#F79009' }} />,
  cr_approve: <SwapOutlined style={{ color: '#027A48' }} />,
  cr_reject: <SwapOutlined style={{ color: '#B42318' }} />,
  schema_change: <BookOutlined style={{ color: '#6938EF' }} />,
  pipeline_run: <ApiOutlined style={{ color: '#1570EF' }} />,
  login: <UserOutlined style={{ color: '#06AED4' }} />,
  key_create: <UserOutlined style={{ color: '#6938EF' }} />,
  role_change: <UserOutlined style={{ color: '#F79009' }} />,
};

const actionLabels: Record<ActionKind, string> = {
  cr_open: 'CR opened',
  cr_approve: 'CR approved',
  cr_reject: 'CR rejected',
  schema_change: 'Schema changed',
  pipeline_run: 'Pipeline ran',
  login: 'Login',
  key_create: 'API key created',
  role_change: 'Role changed',
};

export default function AuditLogPage() {
  const [query, setQuery] = useState('');
  const [actorFilter, setActorFilter] = useState<string | undefined>();
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [selected, setSelected] = useState<Entry | null>(null);

  const rows = useMemo(
    () =>
      seed.filter((e) => {
        if (actorFilter && e.actor !== actorFilter) return false;
        if (actionFilter && e.action !== actionFilter) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          return (
            e.id.toLowerCase().includes(q) ||
            e.actor.toLowerCase().includes(q) ||
            (e.master_id ?? '').toLowerCase().includes(q) ||
            (e.entity ?? '').toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [query, actorFilter, actionFilter]
  );

  const columns: ColumnsType<Entry> = [
    { title: 'When', dataIndex: 'at', width: 180 },
    {
      title: 'Actor',
      key: 'actor',
      width: 240,
      render: (_, r) => (
        <Space>
          {r.actor_kind === 'service' ? (
            <ApiOutlined style={{ color: '#6938EF' }} />
          ) : (
            <UserOutlined style={{ color: '#1570EF' }} />
          )}
          <Text>{r.actor}</Text>
        </Space>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 200,
      render: (a: ActionKind) => (
        <Space>
          {actionIcons[a]}
          <strong>{actionLabels[a]}</strong>
        </Space>
      ),
    },
    {
      title: 'Entity',
      key: 'entity',
      render: (_, r) =>
        r.entity && r.entity !== '-' ? (
          <Space>
            <Tag bordered={false}>{r.entity}</Tag>
            {r.master_id && <code>{r.master_id}</code>}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    { title: 'IP', dataIndex: 'ip', width: 150 },
    {
      title: 'Signed',
      dataIndex: 'signed',
      width: 90,
      render: (v: boolean) =>
        v ? (
          <Tag bordered={false} color="success">
            ✓
          </Tag>
        ) : (
          <Tag bordered={false} color="error">
            ✗
          </Tag>
        ),
    },
  ];

  const actors = Array.from(new Set(seed.map((e) => e.actor)));
  const actions = Array.from(new Set(seed.map((e) => e.action)));

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every write and auth event, signed per batch and retained for 7 years in Iceberg."
        actions={
          <Button icon={<DownloadOutlined />}>Export CSV</Button>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Events (24h)</Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>412</span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Writes (24h)</Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>58</span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Signed</Text>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#027A48' }}>
                100%
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Retention</Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>7y</span>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search event id, actor, entity, master ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            allowClear
            style={{ width: 340 }}
          />
          <Select
            placeholder="Actor"
            allowClear
            style={{ width: 260 }}
            value={actorFilter}
            onChange={(v) => setActorFilter(v)}
            options={actors.map((a) => ({ value: a, label: a }))}
          />
          <Select
            placeholder="Action"
            allowClear
            style={{ width: 200 }}
            value={actionFilter}
            onChange={(v) => setActionFilter(v)}
            options={actions.map((a) => ({ value: a, label: actionLabels[a] }))}
          />
          <RangePicker />
          <Button icon={<FilterOutlined />}>More</Button>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          onRow={(r) => ({ onClick: () => setSelected(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      <Drawer
        title="Audit event"
        placement="right"
        width={520}
        open={!!selected}
        onClose={() => setSelected(null)}>
        {selected && (
          <>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Event ID">
                <code>{selected.id}</code>
              </Descriptions.Item>
              <Descriptions.Item label="When">{selected.at}</Descriptions.Item>
              <Descriptions.Item label="Actor">{selected.actor}</Descriptions.Item>
              <Descriptions.Item label="Action">
                {actionLabels[selected.action]}
              </Descriptions.Item>
              {selected.entity && selected.entity !== '-' && (
                <Descriptions.Item label="Entity">{selected.entity}</Descriptions.Item>
              )}
              {selected.master_id && (
                <Descriptions.Item label="Master ID">
                  <code>{selected.master_id}</code>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="IP">{selected.ip}</Descriptions.Item>
              <Descriptions.Item label="Signed">
                {selected.signed ? '✓ batch-signed' : '✗ unsigned'}
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '12px 0' }} />
            <Text strong>Payload</Text>
            <pre
              style={{
                marginTop: 6,
                padding: 12,
                background: '#F9FAFB',
                border: '1px solid #EAECF0',
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.6,
                overflowX: 'auto',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
              {JSON.stringify(selected.payload, null, 2)}
            </pre>
          </>
        )}
      </Drawer>
    </>
  );
}
