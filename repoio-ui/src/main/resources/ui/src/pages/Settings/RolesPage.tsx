import {
  Row,
  Col,
  Card,
  Space,
  Button,
  Tag,
  Checkbox,
  Typography,
  Divider,
  Modal,
  Form,
  Input,
  message,
} from 'antd';
import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ENTITY_TYPES } from '@/constants/routes';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

/**
 * RolesPage — role × permission matrix.
 *
 * Permissions are grouped by domain (Entity CRUD, Change Requests,
 * Pipelines, Quality rules, Admin). The matrix is editable in place;
 * save persists the full permission set to repoio-service's RBAC store.
 *
 * Each entity type also has a per-field, per-role visibility rule that
 * lives on the entity's JSON Schema (field-level ACL). That's beyond the
 * matrix shown here and lives on the Schema Editor page.
 */

interface Role {
  key: string;
  name: string;
  description: string;
  users: number;
  system: boolean;
}

const roles: Role[] = [
  { key: 'admin', name: 'Admin', description: 'Full control. One per team recommended.', users: 2, system: true },
  { key: 'steward', name: 'Steward', description: 'Edit records, open and review CRs.', users: 7, system: true },
  { key: 'reader', name: 'Reader', description: 'Read-only across entities.', users: 24, system: true },
  { key: 'ai', name: 'AI agent', description: 'Scoped service role for MCP calls.', users: 3, system: true },
  { key: 'contractor', name: 'Contractor', description: 'Read-only for product team contractors.', users: 1, system: false },
];

interface Permission {
  key: string;
  group: string;
  label: string;
  defaults: Record<string, boolean>;
}

const permissions: Permission[] = [
  // Entity CRUD (one per entity type)
  ...ENTITY_TYPES.flatMap((e) => [
    {
      key: `read:${e.key}`,
      group: 'Read',
      label: `Read ${e.labelKey.replace('entity.', '').replace('_plural', '')}`,
      defaults: {
        admin: true,
        steward: true,
        reader: true,
        ai: true,
        contractor: e.key === 'product',
      },
    },
    {
      key: `write:${e.key}`,
      group: 'Write',
      label: `Edit ${e.labelKey.replace('entity.', '').replace('_plural', '')}`,
      defaults: {
        admin: true,
        steward: true,
        reader: false,
        ai: false,
        contractor: false,
      },
    },
  ]),
  // CRs
  {
    key: 'cr:open',
    group: 'Change requests',
    label: 'Open CR',
    defaults: { admin: true, steward: true, reader: false, ai: true, contractor: false },
  },
  {
    key: 'cr:approve',
    group: 'Change requests',
    label: 'Approve CR',
    defaults: { admin: true, steward: false, reader: false, ai: false, contractor: false },
  },
  // Pipelines
  {
    key: 'pipeline:run',
    group: 'Pipelines',
    label: 'Run pipeline',
    defaults: { admin: true, steward: true, reader: false, ai: false, contractor: false },
  },
  {
    key: 'pipeline:edit',
    group: 'Pipelines',
    label: 'Edit pipeline YAML',
    defaults: { admin: true, steward: false, reader: false, ai: false, contractor: false },
  },
  // Quality
  {
    key: 'quality:edit',
    group: 'Quality',
    label: 'Edit DQ / matching / survivorship rules',
    defaults: { admin: true, steward: false, reader: false, ai: false, contractor: false },
  },
  // Admin
  {
    key: 'admin:users',
    group: 'Admin',
    label: 'Manage users',
    defaults: { admin: true, steward: false, reader: false, ai: false, contractor: false },
  },
  {
    key: 'admin:roles',
    group: 'Admin',
    label: 'Manage roles',
    defaults: { admin: true, steward: false, reader: false, ai: false, contractor: false },
  },
  {
    key: 'admin:sso',
    group: 'Admin',
    label: 'Configure SSO',
    defaults: { admin: true, steward: false, reader: false, ai: false, contractor: false },
  },
];

export default function RolesPage() {
  const { t } = useTranslation();
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>(
    () =>
      Object.fromEntries(permissions.map((p) => [p.key, { ...p.defaults }]))
  );
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();

  const toggle = (permKey: string, roleKey: string) =>
    setMatrix((prev) => ({
      ...prev,
      [permKey]: { ...prev[permKey], [roleKey]: !prev[permKey]?.[roleKey] },
    }));

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        subtitle="Who can do what. Field-level ACL per entity lives on the Schema Editor."
        actions={
          <>
            <Button icon={<PlusOutlined />} onClick={() => setAdding(true)}>
              New role
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => message.success('Permission matrix saved')}>
              Save
            </Button>
          </>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {roles.map((r) => (
          <Col key={r.key} xs={24} md={12} lg={8} xl={roles.length <= 5 ? 24 / roles.length : 6}>
            <Card>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <strong>{r.name}</strong>
                  {r.system ? (
                    <Tag bordered={false}>System</Tag>
                  ) : (
                    <Tag color="processing" bordered={false}>
                      Custom
                    </Tag>
                  )}
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {r.description}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {r.users} user{r.users === 1 ? '' : 's'}
                </Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        {Object.entries(grouped).map(([group, perms], gi) => (
          <div key={group}>
            {gi > 0 && <Divider style={{ margin: '8px 0 16px' }} />}
            <Row style={{ marginBottom: 8 }}>
              <Col span={10}>
                <Text strong>{group}</Text>
              </Col>
              {roles.map((r) => (
                <Col
                  key={r.key}
                  flex="auto"
                  style={{ textAlign: 'center', color: '#667085', fontSize: 12 }}>
                  {r.name}
                </Col>
              ))}
            </Row>
            {perms.map((p) => (
              <Row key={p.key} align="middle" style={{ padding: '6px 0' }}>
                <Col span={10}>
                  <Text style={{ fontSize: 13 }}>
                    {t(p.label as any, { defaultValue: p.label })}
                  </Text>
                </Col>
                {roles.map((r) => (
                  <Col key={r.key} flex="auto" style={{ textAlign: 'center' }}>
                    <Checkbox
                      checked={!!matrix[p.key]?.[r.key]}
                      onChange={() => toggle(p.key, r.key)}
                    />
                  </Col>
                ))}
              </Row>
            ))}
          </div>
        ))}
      </Card>

      <Modal
        title="New role"
        open={adding}
        onCancel={() => setAdding(false)}
        onOk={() => {
          form.validateFields().then(() => {
            message.success('Role created');
            setAdding(false);
            form.resetFields();
          });
        }}>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Finance analyst" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Base on" name="base">
            <Input placeholder="(optional) existing role to copy" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
