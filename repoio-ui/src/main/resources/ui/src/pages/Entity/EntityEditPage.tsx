import {
  Form,
  Input,
  Select,
  Button,
  Space,
  Card,
  Tag,
  Tooltip,
  Divider,
  message,
  Row,
  Col,
} from 'antd';
import {
  SaveOutlined,
  RollbackOutlined,
  InfoCircleOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { useNavigate, useParams, generatePath } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';

/**
 * EntityEditPage — field-level edit of a golden record.
 *
 * The key MDM behaviour here: each editable field shows WHERE the current
 * surviving value came from (which source system, when, with what
 * confidence). Changing a field goes through a Change Request rather than
 * a direct write when the user is a steward (not an admin) — the UI
 * shows that outcome before Save, so there are no surprises.
 */

interface FieldProvenance {
  source: string;
  sourceId: string;
  confidence: number;
  receivedAt: string;
}

interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  value: string;
  provenance: FieldProvenance;
}

const mockFields: FieldDef[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    value: 'Acme Publishing House',
    provenance: {
      source: 'SAP C4C',
      sourceId: 'C4C-77341',
      confidence: 0.98,
      receivedAt: '2026-11-01',
    },
  },
  {
    name: 'legal_name',
    label: 'Legal name',
    type: 'text',
    value: 'Acme Publishing House LLC',
    provenance: {
      source: 'SAP ERP',
      sourceId: 'ERP-9981',
      confidence: 1.0,
      receivedAt: '2026-10-30',
    },
  },
  {
    name: 'segment',
    label: 'Segment',
    type: 'select',
    options: [
      { value: 'enterprise', label: 'Enterprise' },
      { value: 'mid_market', label: 'Mid-market' },
      { value: 'smb', label: 'SMB' },
    ],
    value: 'enterprise',
    provenance: {
      source: 'SAP C4C',
      sourceId: 'C4C-77341',
      confidence: 0.92,
      receivedAt: '2026-11-01',
    },
  },
  {
    name: 'country',
    label: 'Country',
    type: 'select',
    options: [
      { value: 'EG', label: 'Egypt' },
      { value: 'SA', label: 'Saudi Arabia' },
      { value: 'AE', label: 'UAE' },
    ],
    value: 'EG',
    provenance: {
      source: 'SAP C4C',
      sourceId: 'C4C-77341',
      confidence: 1.0,
      receivedAt: '2026-11-01',
    },
  },
  {
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    value: 'Priority account. Billing on Net 60.',
    provenance: {
      source: 'Manual (steward)',
      sourceId: 'mohamed@nahdetmisr.com',
      confidence: 1.0,
      receivedAt: '2026-10-29',
    },
  },
];

export default function EntityEditPage() {
  const { entityType = 'customer', id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [dirty, setDirty] = useState(false);

  const initial = Object.fromEntries(mockFields.map((f) => [f.name, f.value]));

  const onFinish = (values: Record<string, string>) => {
    const changed = mockFields.filter((f) => values[f.name] !== f.value);
    if (changed.length === 0) {
      message.info('No changes to save');
      return;
    }
    message.success(
      `Change request opened with ${changed.length} field update${changed.length > 1 ? 's' : ''}`
    );
    navigate(ROUTES.CHANGE_REQUESTS);
  };

  const back = () =>
    navigate(generatePath(ROUTES.ENTITY_DETAIL, { entityType, id }));

  return (
    <>
      <PageHeader
        title={`Edit ${t(`entity.${entityType}`)} · ${id}`}
        subtitle="Changes open a Change Request until approved by an admin."
        actions={
          <>
            <Button icon={<RollbackOutlined />} onClick={back}>
              {t('actions.cancel')}
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => form.submit()}
              disabled={!dirty}>
              {t('actions.save')}
            </Button>
          </>
        }
      />

      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={initial}
          onFinish={onFinish}
          onValuesChange={() => setDirty(true)}>
          <Row gutter={24}>
            {mockFields.map((f, idx) => (
              <Col key={f.name} xs={24} md={f.type === 'textarea' ? 24 : 12}>
                <FieldWithProvenance field={f} />
                {idx < mockFields.length - 1 && <Divider style={{ margin: 0 }} />}
              </Col>
            ))}
          </Row>
        </Form>
      </Card>
    </>
  );
}

function FieldWithProvenance({ field }: { field: FieldDef }) {
  const { label, name, type, options, provenance } = field;

  const label_ = (
    <Space size={6}>
      <span>{label}</span>
      <Tooltip
        title={
          <div style={{ lineHeight: 1.5 }}>
            <div>
              <strong>Source:</strong> {provenance.source}
            </div>
            <div>
              <strong>Source ID:</strong> <code>{provenance.sourceId}</code>
            </div>
            <div>
              <strong>Confidence:</strong>{' '}
              {(provenance.confidence * 100).toFixed(0)}%
            </div>
            <div>
              <strong>Received:</strong> {provenance.receivedAt}
            </div>
          </div>
        }>
        <InfoCircleOutlined style={{ color: '#98A2B3' }} />
      </Tooltip>
      <Tag
        bordered={false}
        color={provenance.confidence >= 0.95 ? 'success' : 'processing'}
        icon={<CheckCircleFilled />}>
        {provenance.source}
      </Tag>
    </Space>
  );

  return (
    <Form.Item label={label_} name={name} style={{ marginBottom: 20 }}>
      {type === 'select' ? (
        <Select options={options} />
      ) : type === 'textarea' ? (
        <Input.TextArea rows={3} />
      ) : (
        <Input />
      )}
    </Form.Item>
  );
}
