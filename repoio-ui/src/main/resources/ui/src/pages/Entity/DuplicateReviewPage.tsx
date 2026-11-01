import {
  Row,
  Col,
  Card,
  Button,
  Space,
  Tag,
  Radio,
  Divider,
  Typography,
  Alert,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MergeCellsOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';

const { Text } = Typography;

/**
 * DuplicateReviewPage — side-by-side merge decision for one Splink pair.
 *
 * The surviving golden record is composed field by field. For each
 * attribute the steward picks LEFT, RIGHT or custom; the choice is
 * previewed on the right. On confirm, this generates a Change Request
 * that merges Right into Left (or vice versa) with full provenance.
 */

interface FieldPair {
  key: string;
  label: string;
  leftValue: string;
  leftSource: string;
  rightValue: string;
  rightSource: string;
}

const fields: FieldPair[] = [
  {
    key: 'name',
    label: 'Name',
    leftValue: 'Acme Publishing House',
    leftSource: 'SAP C4C',
    rightValue: 'Acme Publishing',
    rightSource: 'SQL Server',
  },
  {
    key: 'legal_name',
    label: 'Legal name',
    leftValue: 'Acme Publishing House LLC',
    leftSource: 'SAP ERP',
    rightValue: '—',
    rightSource: '—',
  },
  {
    key: 'country',
    label: 'Country',
    leftValue: 'Egypt',
    leftSource: 'SAP C4C',
    rightValue: 'Egypt',
    rightSource: 'SQL Server',
  },
  {
    key: 'tax_id',
    label: 'Tax ID',
    leftValue: '100-200-300',
    leftSource: 'SAP ERP',
    rightValue: '100-200-300',
    rightSource: 'SQL Server',
  },
  {
    key: 'phone',
    label: 'Phone',
    leftValue: '+20 2 2345 1234',
    leftSource: 'SAP C4C',
    rightValue: '+20 2 2345 1235',
    rightSource: 'SQL Server',
  },
];

type Side = 'left' | 'right';

export default function DuplicateReviewPage() {
  const { entityType = 'customer', pairId = '' } = useParams();
  const navigate = useNavigate();

  const [picks, setPicks] = useState<Record<string, Side>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, 'left' as Side]))
  );

  const confirm = (action: 'merge' | 'reject') => {
    if (action === 'merge') {
      message.success(
        `Merge Change Request opened for ${pairId} — awaiting approval`
      );
    } else {
      message.info(`Pair ${pairId} marked as "not a duplicate"`);
    }
    navigate(`/entity/${entityType}/duplicates`);
  };

  return (
    <>
      <PageHeader
        title={`Review duplicate · ${pairId}`}
        subtitle="Pick which value survives per field, then open the merge Change Request."
        actions={
          <>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => confirm('reject')}>
              Not a duplicate
            </Button>
            <Button
              type="primary"
              icon={<MergeCellsOutlined />}
              onClick={() => confirm('merge')}>
              Open merge CR
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} xl={18}>
          <Alert
            type="info"
            showIcon
            message="Match score 96% · Splink reason: Name tokens + Country + Tax-ID prefix"
            style={{ marginBottom: 16 }}
          />
          <Card>
            <Row gutter={16} style={{ fontWeight: 600, marginBottom: 8 }}>
              <Col span={6}>Field</Col>
              <Col span={8}>
                <Space>
                  <code>CUST-000142</code>
                  <Tag bordered={false}>LEFT</Tag>
                </Space>
              </Col>
              <Col span={2} />
              <Col span={8}>
                <Space>
                  <code>CUST-000198</code>
                  <Tag bordered={false}>RIGHT</Tag>
                </Space>
              </Col>
            </Row>
            <Divider style={{ margin: '8px 0 16px' }} />
            {fields.map((f) => (
              <FieldRow
                key={f.key}
                field={f}
                picked={picks[f.key] ?? 'left'}
                onPick={(side) =>
                  setPicks((prev) => ({ ...prev, [f.key]: side }))
                }
              />
            ))}
          </Card>
        </Col>

        <Col xs={24} xl={6}>
          <Card
            title="Survivor preview"
            size="small"
            extra={
              <Tag icon={<CheckCircleOutlined />} color="success" bordered={false}>
                golden
              </Tag>
            }>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {fields.map((f) => {
                const picked = picks[f.key] ?? 'left';
                const value = picked === 'left' ? f.leftValue : f.rightValue;
                const source =
                  picked === 'left' ? f.leftSource : f.rightSource;
                return (
                  <div key={f.key}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {f.label}
                    </Text>
                    <div style={{ fontWeight: 500 }}>{value}</div>
                    <Tag bordered={false} style={{ fontSize: 11 }}>
                      {source}
                    </Tag>
                  </div>
                );
              })}
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}

function FieldRow({
  field,
  picked,
  onPick,
}: {
  field: FieldPair;
  picked: Side;
  onPick: (s: Side) => void;
}) {
  const differs = field.leftValue !== field.rightValue;
  return (
    <Row gutter={16} align="middle" style={{ padding: '10px 0' }}>
      <Col span={6}>
        <Text strong>{field.label}</Text>
      </Col>
      <Col span={8}>
        <Space direction="vertical" size={0}>
          <span style={differs ? { color: '#F04438' } : undefined}>
            {field.leftValue}
          </span>
          <Tag bordered={false} style={{ fontSize: 11 }}>
            {field.leftSource}
          </Tag>
        </Space>
      </Col>
      <Col span={2}>
        <Radio.Group
          value={picked}
          onChange={(e) => onPick(e.target.value as Side)}
          size="small">
          <Radio.Button value="left">L</Radio.Button>
          <Radio.Button value="right">R</Radio.Button>
        </Radio.Group>
      </Col>
      <Col span={8}>
        <Space direction="vertical" size={0}>
          <span style={differs ? { color: '#F04438' } : undefined}>
            {field.rightValue}
          </span>
          <Tag bordered={false} style={{ fontSize: 11 }}>
            {field.rightSource}
          </Tag>
        </Space>
      </Col>
    </Row>
  );
}
