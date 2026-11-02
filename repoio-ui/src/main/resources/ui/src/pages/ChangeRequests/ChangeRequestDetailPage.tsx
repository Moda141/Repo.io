import {
  Row,
  Col,
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Timeline,
  Input,
  Divider,
  Avatar,
  Alert,
  message,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  SendOutlined,
  UserOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, Link, generatePath } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';

const { Text } = Typography;

/**
 * ChangeRequestDetailPage — field-level diff with approve / reject.
 *
 * The reviewer sees exactly which fields will change if they approve,
 * who requested the change, why, and the record's current state. An
 * approval generates a signed audit entry, writes the new survivor to
 * Iceberg, and emits a `changes.<entity>` event to Kafka for the
 * outbox consumer that updates SAP C4C.
 */

interface Change {
  field: string;
  before: string;
  after: string;
  reason: string;
}

const changes: Change[] = [
  {
    field: 'Billing address',
    before: '12 El-Thawra St., Cairo',
    after: '45 El-Nasr Rd., Cairo',
    reason: 'Customer moved offices on 2026-10-27',
  },
  {
    field: 'Phone',
    before: '+20 2 2345 1234',
    after: '+20 2 2345 1999',
    reason: 'New main switchboard',
  },
  {
    field: 'Segment',
    before: 'Mid-market',
    after: 'Enterprise',
    reason: 'Annual revenue crossed EGP 50M threshold in Q3',
  },
];

const activity = [
  {
    color: 'blue',
    children: (
      <>
        <strong>mohamed@nahdetmisr.com</strong> opened this CR · 2026-10-29 11:14
      </>
    ),
  },
  {
    children: (
      <>Spark job <code>match</code> recomputed survivorship · 2026-10-29 11:16</>
    ),
  },
  {
    children: (
      <>
        <strong>ahmed@nahdetmisr.com</strong> commented · 2026-10-29 14:32
      </>
    ),
  },
];

export default function ChangeRequestDetailPage() {
  const { crId = '' } = useParams();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');

  const act = (decision: 'approve' | 'reject') => {
    message.success(
      decision === 'approve'
        ? `${crId} approved — survivor written to Iceberg · changes.customer emitted`
        : `${crId} rejected`
    );
    navigate(ROUTES.CHANGE_REQUESTS);
  };

  return (
    <>
      <PageHeader
        title={`${crId} · Update billing address`}
        subtitle="Steward-driven edit on customer CUST-000204 — awaiting approval."
        actions={
          <>
            <Button danger icon={<CloseOutlined />} onClick={() => act('reject')}>
              Reject
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => act('approve')}>
              Approve
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Field-level diff" style={{ marginBottom: 16 }}>
            {changes.map((c, i) => (
              <div key={c.field}>
                {i > 0 && <Divider style={{ margin: '12px 0' }} />}
                <ChangeRow change={c} />
              </div>
            ))}
          </Card>

          <Card title="Discussion">
            <Timeline items={activity} />
            <Divider />
            <Space.Compact style={{ width: '100%' }}>
              <Input.TextArea
                rows={2}
                placeholder="Add a comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                disabled={!comment.trim()}
                style={{ alignSelf: 'stretch', height: 'auto' }}
                onClick={() => {
                  message.success('Comment posted');
                  setComment('');
                }}>
                Send
              </Button>
            </Space.Compact>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small">
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <KeyValue label="Status" value={<Tag color="warning" bordered={false}>OPEN</Tag>} />
                <KeyValue
                  label="Target record"
                  value={
                    <Link
                      to={generatePath(ROUTES.ENTITY_DETAIL, {
                        entityType: 'customer',
                        id: 'CUST-000204',
                      })}>
                      <Space size={4}>
                        <LinkOutlined />
                        <code>CUST-000204</code>
                      </Space>
                    </Link>
                  }
                />
                <KeyValue label="Entity" value="Customer" />
                <KeyValue
                  label="Requested by"
                  value={
                    <Space>
                      <Avatar size="small" icon={<UserOutlined />} />
                      <span>mohamed@nahdetmisr.com</span>
                    </Space>
                  }
                />
                <KeyValue label="Opened" value="2026-10-29 11:14" />
                <KeyValue label="SLA" value="Due in 1d 6h" />
              </Space>
            </Card>

            <Alert
              type="info"
              showIcon
              message="On approve"
              description="Survivor is written to the Iceberg golden table, the Iceberg Index for master_id is updated, and a changes.customer event is emitted for the SAP C4C outbox consumer."
            />
          </Space>
        </Col>
      </Row>
    </>
  );
}

function ChangeRow({ change }: { change: Change }) {
  return (
    <Row gutter={16} align="middle">
      <Col span={5}>
        <Text strong>{change.field}</Text>
      </Col>
      <Col span={8}>
        <div
          style={{
            padding: 8,
            background: '#FEF3F2',
            border: '1px solid #FECDCA',
            borderRadius: 6,
            textDecoration: 'line-through',
            color: '#B42318',
          }}>
          {change.before}
        </div>
      </Col>
      <Col span={1} style={{ textAlign: 'center', color: '#98A2B3' }}>
        →
      </Col>
      <Col span={8}>
        <div
          style={{
            padding: 8,
            background: '#ECFDF3',
            border: '1px solid #ABEFC6',
            borderRadius: 6,
            color: '#027A48',
            fontWeight: 500,
          }}>
          {change.after}
        </div>
      </Col>
      <Col span={24} style={{ marginTop: 6 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Reason: {change.reason}
        </Text>
      </Col>
    </Row>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}
