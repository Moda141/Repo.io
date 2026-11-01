import {
  Row,
  Col,
  Card,
  Button,
  Space,
  Tag,
  Alert,
  Divider,
  Typography,
  Select,
  message,
} from 'antd';
import { MergeCellsOutlined, RollbackOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';

const { Text } = Typography;

/**
 * EntityMergePage — merge TWO OR MORE records (not just a Splink pair).
 *
 * Invoked via /entity/:entityType/merge?ids=A,B,C — the user picked
 * multiple rows from the entity list and chose "Merge selected".
 * For each attribute the steward picks which record's value survives;
 * the chosen master ID becomes the surviving record and the rest become
 * aliases of it.
 */

interface Column {
  id: string;
  label: string;
  values: Record<string, string>;
}

const fieldDefs = [
  { key: 'name', label: 'Name' },
  { key: 'legal_name', label: 'Legal name' },
  { key: 'country', label: 'Country' },
  { key: 'segment', label: 'Segment' },
  { key: 'phone', label: 'Phone' },
];

function mockColumn(id: string, suffix: string): Column {
  return {
    id,
    label: id,
    values: {
      name: `Acme Publishing ${suffix}`,
      legal_name: `Acme Publishing House LLC`,
      country: 'Egypt',
      segment: suffix === 'A' ? 'Enterprise' : 'Mid-market',
      phone: `+20 2 2345 123${suffix === 'A' ? '4' : suffix === 'B' ? '5' : '6'}`,
    },
  };
}

export default function EntityMergePage() {
  const { entityType = 'customer' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const ids = useMemo(
    () => (params.get('ids') || 'CUST-000142,CUST-000198,CUST-000211').split(','),
    [params]
  );

  const columns = useMemo<Column[]>(
    () =>
      ids.map((id, i) =>
        mockColumn(id, String.fromCharCode(65 + i).toString())
      ),
    [ids]
  );

  const [survivorId, setSurvivorId] = useState<string>(ids[0] ?? '');
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(fieldDefs.map((f) => [f.key, ids[0] ?? '']))
  );

  const confirm = () => {
    message.success(
      `Merge Change Request opened: ${ids.length} records → survivor ${survivorId}`
    );
    navigate(`/entity/${entityType}`);
  };

  return (
    <>
      <PageHeader
        title={`Merge ${ids.length} records`}
        subtitle="Pick the surviving master ID and the value that wins per field."
        actions={
          <>
            <Button icon={<RollbackOutlined />} onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<MergeCellsOutlined />}
              onClick={confirm}>
              Open merge CR
            </Button>
          </>
        }
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message={
          <Space>
            <span>Surviving master ID:</span>
            <Select
              style={{ minWidth: 220 }}
              value={survivorId}
              onChange={(v) => setSurvivorId(v)}
              options={ids.map((i) => ({ value: i, label: i }))}
            />
            <span>
              — the other {ids.length - 1} IDs become aliases of this one.
            </span>
          </Space>
        }
      />

      <Card>
        <Row gutter={16} style={{ fontWeight: 600, marginBottom: 8 }}>
          <Col span={5}>Field</Col>
          {columns.map((c) => (
            <Col
              key={c.id}
              flex="auto"
              style={{
                padding: 8,
                background: c.id === survivorId ? '#F0F7FF' : undefined,
                borderRadius: 6,
              }}>
              <code>{c.id}</code>
              {c.id === survivorId && (
                <Tag bordered={false} color="processing" style={{ marginInlineStart: 6 }}>
                  survivor
                </Tag>
              )}
            </Col>
          ))}
        </Row>
        <Divider style={{ margin: '8px 0 16px' }} />

        {fieldDefs.map((f) => (
          <Row key={f.key} gutter={16} align="middle" style={{ padding: '10px 0' }}>
            <Col span={5}>
              <Text strong>{f.label}</Text>
            </Col>
            {columns.map((c) => {
              const chosen = picks[f.key] === c.id;
              return (
                <Col
                  key={c.id}
                  flex="auto"
                  style={{
                    padding: 10,
                    background: chosen ? '#ECFDF3' : '#FFFFFF',
                    border: chosen ? '1px solid #12B76A' : '1px solid #EAECF0',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    setPicks((prev) => ({ ...prev, [f.key]: c.id }))
                  }>
                  {c.values[f.key]}
                </Col>
              );
            })}
          </Row>
        ))}
      </Card>
    </>
  );
}
