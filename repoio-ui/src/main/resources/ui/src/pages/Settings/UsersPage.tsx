import {
  Row,
  Col,
  Card,
  Space,
  Button,
  Table,
  Avatar,
  Tag,
  Input,
  Dropdown,
  Typography,
  Modal,
  Form,
  Select,
  message,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  UserOutlined,
  MoreOutlined,
  LockOutlined,
  DeleteOutlined,
  SwapOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import PageHeader from '@/components/common/PageHeader';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  team: string;
  status: 'active' | 'invited' | 'disabled';
  last_login: string;
  mfa: boolean;
}

const seed: User[] = [
  {
    id: 'u-01',
    name: 'Mohamed Mahmoud',
    email: 'mohamed@nahdetmisr.com',
    roles: ['Steward', 'Admin'],
    team: 'Data Management',
    status: 'active',
    last_login: '2026-11-02 09:12',
    mfa: true,
  },
  {
    id: 'u-02',
    name: 'Ahmed Hassan',
    email: 'ahmed@nahdetmisr.com',
    roles: ['Steward'],
    team: 'Sales ops',
    status: 'active',
    last_login: '2026-11-02 07:48',
    mfa: true,
  },
  {
    id: 'u-03',
    name: 'Nour Ibrahim',
    email: 'nour@nahdetmisr.com',
    roles: ['Reader'],
    team: 'Finance',
    status: 'active',
    last_login: '2026-11-01 16:04',
    mfa: false,
  },
  {
    id: 'u-04',
    name: 'Yara Fouad',
    email: 'yara@nahdetmisr.com',
    roles: ['Reader'],
    team: 'Marketing',
    status: 'invited',
    last_login: '—',
    mfa: false,
  },
  {
    id: 'u-05',
    name: 'Khaled Osman',
    email: 'khaled@nahdetmisr.com',
    roles: ['Steward'],
    team: 'Publishing',
    status: 'disabled',
    last_login: '2026-09-21 10:33',
    mfa: true,
  },
];

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [inviting, setInviting] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const rows = useMemo(
    () =>
      seed.filter(
        (u) =>
          !query.trim() ||
          u.name.toLowerCase().includes(query.toLowerCase()) ||
          u.email.toLowerCase().includes(query.toLowerCase()) ||
          u.team.toLowerCase().includes(query.toLowerCase())
      ),
    [query]
  );

  const columns: ColumnsType<User> = [
    {
      title: 'User',
      key: 'user',
      render: (_, r) => (
        <Space>
          <Avatar
            style={{ background: '#1570EF' }}
            icon={<UserOutlined />}
          />
          <div>
            <Link to={`/settings/users/${r.id}`}>
              <strong>{r.name}</strong>
            </Link>
            <div style={{ color: '#667085', fontSize: 12 }}>{r.email}</div>
          </div>
        </Space>
      ),
    },
    { title: 'Team', dataIndex: 'team', width: 160 },
    {
      title: 'Roles',
      dataIndex: 'roles',
      width: 200,
      render: (roles: string[]) => (
        <Space size={4} wrap>
          {roles.map((r) => (
            <Tag key={r} bordered={false}>
              {r}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (s: User['status']) => (
        <Tag
          color={
            s === 'active' ? 'success' : s === 'invited' ? 'processing' : 'default'
          }
          bordered={false}>
          {s.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'MFA',
      dataIndex: 'mfa',
      width: 70,
      render: (v: boolean) =>
        v ? (
          <CheckCircleOutlined style={{ color: '#12B76A' }} />
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    { title: 'Last login', dataIndex: 'last_login', width: 160 },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_, r) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'open',
                icon: <UserOutlined />,
                label: 'Open profile',
                onClick: () => navigate(`/settings/users/${r.id}`),
              },
              {
                key: 'roles',
                icon: <SwapOutlined />,
                label: 'Change roles',
              },
              {
                key: 'reset',
                icon: <LockOutlined />,
                label: 'Reset MFA',
              },
              { type: 'divider' },
              {
                key: 'disable',
                icon: <DeleteOutlined />,
                label: r.status === 'disabled' ? 'Enable' : 'Disable',
                danger: r.status !== 'disabled',
              },
            ],
          }}
          trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const stats = {
    active: seed.filter((u) => u.status === 'active').length,
    invited: seed.filter((u) => u.status === 'invited').length,
    mfaCoverage: Math.round(
      (seed.filter((u) => u.mfa && u.status === 'active').length /
        Math.max(1, seed.filter((u) => u.status === 'active').length)) *
        100
    ),
  };

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="People who can sign in to Repo.io. SSO comes from Entra ID; roles and team are managed here."
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setInviting(true)}>
            Invite user
          </Button>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Active</Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{stats.active}</span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Pending invites</Text>
              <span style={{ fontSize: 24, fontWeight: 600, color: '#1570EF' }}>
                {stats.invited}
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">MFA coverage</Text>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: stats.mfaCoverage >= 90 ? '#027A48' : '#F79009',
                }}>
                {stats.mfaCoverage}%
              </span>
            </Space>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Space direction="vertical" size={0}>
              <Text type="secondary">Total</Text>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{seed.length}</span>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search name, email, team…"
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ maxWidth: 360 }}
          />
          <Text type="secondary">
            {rows.length} of {seed.length}
          </Text>
        </Space>
        <Table rowKey="id" columns={columns} dataSource={rows} />
      </Card>

      <Modal
        title="Invite user"
        open={inviting}
        onCancel={() => setInviting(false)}
        onOk={() => {
          message.success('Invitation sent');
          setInviting(false);
          form.resetFields();
        }}>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="Email" name="email" rules={[{ required: true }]}>
            <Input placeholder="person@nahdetmisr.com" />
          </Form.Item>
          <Form.Item label="Team" name="team">
            <Select
              options={[
                { value: 'Data Management', label: 'Data Management' },
                { value: 'Sales ops', label: 'Sales ops' },
                { value: 'Finance', label: 'Finance' },
                { value: 'Marketing', label: 'Marketing' },
                { value: 'Publishing', label: 'Publishing' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Roles" name="roles">
            <Select
              mode="multiple"
              defaultValue={['Reader']}
              options={[
                { value: 'Admin', label: 'Admin' },
                { value: 'Steward', label: 'Steward' },
                { value: 'Reader', label: 'Reader' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
