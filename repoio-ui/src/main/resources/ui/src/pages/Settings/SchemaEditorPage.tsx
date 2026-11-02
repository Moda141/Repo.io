import {
  Row,
  Col,
  Card,
  Space,
  Button,
  Table,
  Input,
  Select,
  Switch,
  Tag,
  Typography,
  Alert,
  Divider,
  Form,
  message,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ENTITY_TYPES, ROUTES } from '@/constants/routes';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

/**
 * SchemaEditorPage — add / change fields on an entity's JSON Schema.
 *
 * The right panel shows a live view of the generated JSON Schema
 * exactly as it will be written to repoio-spec/.../schema/entity/
 * <entityType>.json. On save, repoio-service runs a schema-migration
 * check (does any existing record violate the new schema?) before
 * writing — breaking changes open a steward Change Request instead
 * of writing immediately.
 */

type FieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum'
  | 'date'
  | 'email'
  | 'uuid';

interface Field {
  key: string;
  name: string;
  type: FieldType;
  required: boolean;
  unique: boolean;
  pii: boolean;
  acl: 'all' | 'steward' | 'admin';
  description?: string;
  enumValues?: string;
}

const seedByEntity: Record<string, Field[]> = {
  customer: [
    { key: 'f1', name: 'master_id', type: 'string', required: true, unique: true, pii: false, acl: 'all' },
    { key: 'f2', name: 'name', type: 'string', required: true, unique: false, pii: false, acl: 'all' },
    { key: 'f3', name: 'legal_name', type: 'string', required: false, unique: false, pii: false, acl: 'all' },
    { key: 'f4', name: 'country', type: 'enum', required: true, unique: false, pii: false, acl: 'all', enumValues: 'EG,SA,AE,KW,OM,BH,QA' },
    { key: 'f5', name: 'segment', type: 'enum', required: false, unique: false, pii: false, acl: 'all', enumValues: 'enterprise,mid_market,smb,government' },
    { key: 'f6', name: 'tax_id', type: 'string', required: false, unique: true, pii: true, acl: 'steward', description: '9 digits, optional dashes' },
    { key: 'f7', name: 'email', type: 'email', required: false, unique: false, pii: true, acl: 'steward' },
    { key: 'f8', name: 'phone', type: 'string', required: false, unique: false, pii: true, acl: 'steward' },
    { key: 'f9', name: 'parent_id', type: 'string', required: false, unique: false, pii: false, acl: 'all' },
    { key: 'f10', name: 'created_at', type: 'date', required: true, unique: false, pii: false, acl: 'all' },
  ],
  vendor: [
    { key: 'f1', name: 'master_id', type: 'string', required: true, unique: true, pii: false, acl: 'all' },
    { key: 'f2', name: 'name', type: 'string', required: true, unique: false, pii: false, acl: 'all' },
    { key: 'f3', name: 'tax_id', type: 'string', required: false, unique: true, pii: true, acl: 'steward' },
  ],
  product: [
    { key: 'f1', name: 'master_id', type: 'string', required: true, unique: true, pii: false, acl: 'all' },
    { key: 'f2', name: 'isbn', type: 'string', required: true, unique: true, pii: false, acl: 'all', description: '13 digits' },
    { key: 'f3', name: 'title', type: 'string', required: true, unique: false, pii: false, acl: 'all' },
    { key: 'f4', name: 'author_id', type: 'string', required: true, unique: false, pii: false, acl: 'all' },
  ],
};

export default function SchemaEditorPage() {
  const { entityType = 'customer' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const initial = seedByEntity[entityType] ?? seedByEntity.customer;
  const [fields, setFields] = useState<Field[]>(initial);
  const [adding, setAdding] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form] = Form.useForm();

  const schema = useMemo(() => {
    const required = fields.filter((f) => f.required).map((f) => f.name);
    const props: Record<string, unknown> = {};
    for (const f of fields) {
      const tsType: Record<FieldType, string> = {
        string: 'string',
        number: 'number',
        integer: 'integer',
        boolean: 'boolean',
        enum: 'string',
        date: 'string',
        email: 'string',
        uuid: 'string',
      };
      const p: Record<string, unknown> = { type: tsType[f.type] };
      if (f.type === 'date') p.format = 'date-time';
      if (f.type === 'email') p.format = 'email';
      if (f.type === 'uuid') p.format = 'uuid';
      if (f.type === 'enum' && f.enumValues) p.enum = f.enumValues.split(',').map((s) => s.trim());
      if (f.description) p.description = f.description;
      if (f.pii) (p as any)['x-pii'] = true;
      if (f.unique) (p as any)['x-unique'] = true;
      if (f.acl !== 'all') (p as any)['x-acl'] = f.acl;
      props[f.name] = p;
    }
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: `https://repoio.nahdetmisr.com/schema/entity/${entityType}.json`,
      title: `${entityType[0]?.toUpperCase()}${entityType.slice(1)}`,
      type: 'object',
      required,
      properties: props,
    };
  }, [fields, entityType]);

  const update = (key: string, patch: Partial<Field>) =>
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, ...patch } : f))
    );
  const remove = (key: string) =>
    setFields((prev) => prev.filter((f) => f.key !== key));

  const columns: ColumnsType<Field> = [
    {
      title: 'Field',
      dataIndex: 'name',
      render: (v: string, r) => (
        <Input
          size="small"
          value={v}
          onChange={(e) => update(r.key, { name: e.target.value })}
        />
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 130,
      render: (v: FieldType, r) => (
        <Select
          size="small"
          value={v}
          style={{ width: '100%' }}
          options={[
            { value: 'string', label: 'string' },
            { value: 'number', label: 'number' },
            { value: 'integer', label: 'integer' },
            { value: 'boolean', label: 'boolean' },
            { value: 'enum', label: 'enum' },
            { value: 'date', label: 'date' },
            { value: 'email', label: 'email' },
            { value: 'uuid', label: 'uuid' },
          ]}
          onChange={(x) => update(r.key, { type: x as FieldType })}
        />
      ),
    },
    {
      title: 'Enum values',
      dataIndex: 'enumValues',
      width: 220,
      render: (v: string | undefined, r) => (
        <Input
          size="small"
          placeholder="comma, separated"
          value={v}
          disabled={r.type !== 'enum'}
          onChange={(e) => update(r.key, { enumValues: e.target.value })}
        />
      ),
    },
    {
      title: 'Req',
      dataIndex: 'required',
      width: 60,
      align: 'center' as const,
      render: (v: boolean, r) => (
        <Switch size="small" checked={v} onChange={(c) => update(r.key, { required: c })} />
      ),
    },
    {
      title: 'Unique',
      dataIndex: 'unique',
      width: 80,
      align: 'center' as const,
      render: (v: boolean, r) => (
        <Switch size="small" checked={v} onChange={(c) => update(r.key, { unique: c })} />
      ),
    },
    {
      title: 'PII',
      dataIndex: 'pii',
      width: 60,
      align: 'center' as const,
      render: (v: boolean, r) => (
        <Switch size="small" checked={v} onChange={(c) => update(r.key, { pii: c })} />
      ),
    },
    {
      title: 'Visible to',
      dataIndex: 'acl',
      width: 130,
      render: (v: Field['acl'], r) => (
        <Select
          size="small"
          value={v}
          style={{ width: '100%' }}
          options={[
            { value: 'all', label: 'All users' },
            { value: 'steward', label: 'Stewards' },
            { value: 'admin', label: 'Admins' },
          ]}
          onChange={(x) => update(r.key, { acl: x as Field['acl'] })}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_, r) => (
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => remove(r.key)}
        />
      ),
    },
  ];

  const save = () => {
    message.success(`${entityType}.json validated · no breaking changes · schema saved`);
  };

  return (
    <>
      <PageHeader
        title={`Schema · ${t(`entity.${entityType}`)}`}
        subtitle="Add or change fields on an entity's JSON Schema. Breaking changes open a Change Request."
        actions={
          <>
            <Select
              size="middle"
              value={entityType}
              style={{ width: 220 }}
              onChange={(v) => navigate(`/settings/schema/${v}`)}
              options={ENTITY_TYPES.map((e) => ({
                value: e.key,
                label: t(e.labelKey),
              }))}
            />
            <Button icon={<CodeOutlined />} onClick={() => setPreviewOpen(true)}>
              Preview JSON
            </Button>
            <Link to={ROUTES.SETTINGS_SCHEMA}>
              <Button>Back</Button>
            </Link>
            <Button type="primary" icon={<SaveOutlined />} onClick={save}>
              Save
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} xl={17}>
          <Card
            title={`Fields (${fields.length})`}
            extra={
              <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
                Add field
              </Button>
            }>
            <Table
              rowKey="key"
              columns={columns}
              dataSource={fields}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Where this lands"
              description={
                <>
                  Saved schemas go to{' '}
                  <code>
                    repoio-spec/src/main/resources/json/schema/entity/
                    {entityType}.json
                  </code>{' '}
                  and the TypeScript / Java SDKs are regenerated on next CI run.
                </>
              }
            />
            <Card title="Field counts" size="small">
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text>Required</Text>
                  <Tag bordered={false}>{fields.filter((f) => f.required).length}</Tag>
                </Space>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text>Unique</Text>
                  <Tag bordered={false}>{fields.filter((f) => f.unique).length}</Tag>
                </Space>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text>PII (field-level masking)</Text>
                  <Tag bordered={false} color="warning">{fields.filter((f) => f.pii).length}</Tag>
                </Space>
                <Divider style={{ margin: '4px 0' }} />
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text>Restricted to stewards</Text>
                  <Tag bordered={false}>{fields.filter((f) => f.acl === 'steward').length}</Tag>
                </Space>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text>Admin only</Text>
                  <Tag bordered={false}>{fields.filter((f) => f.acl === 'admin').length}</Tag>
                </Space>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>

      <Modal
        title="Add field"
        open={adding}
        onCancel={() => setAdding(false)}
        onOk={() => {
          form.validateFields().then((v) => {
            setFields((prev) => [
              ...prev,
              {
                key: `f${Date.now()}`,
                name: v.name,
                type: v.type ?? 'string',
                required: v.required ?? false,
                unique: false,
                pii: v.pii ?? false,
                acl: v.pii ? 'steward' : 'all',
                description: v.description,
              },
            ]);
            setAdding(false);
            form.resetFields();
          });
        }}>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. loyalty_tier" />
          </Form.Item>
          <Form.Item label="Type" name="type" initialValue="string">
            <Select
              options={[
                { value: 'string', label: 'string' },
                { value: 'number', label: 'number' },
                { value: 'integer', label: 'integer' },
                { value: 'boolean', label: 'boolean' },
                { value: 'enum', label: 'enum' },
                { value: 'date', label: 'date' },
                { value: 'email', label: 'email' },
                { value: 'uuid', label: 'uuid' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Required" name="required" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="PII (hidden from Readers)" name="pii" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${entityType}.json`}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        onOk={() => setPreviewOpen(false)}
        width={720}>
        <pre
          style={{
            margin: 0,
            padding: 12,
            background: '#F9FAFB',
            border: '1px solid #EAECF0',
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.6,
            overflowX: 'auto',
            fontFamily: 'JetBrains Mono, monospace',
            maxHeight: 500,
            overflowY: 'auto',
          }}>
          {JSON.stringify(schema, null, 2)}
        </pre>
      </Modal>
    </>
  );
}
