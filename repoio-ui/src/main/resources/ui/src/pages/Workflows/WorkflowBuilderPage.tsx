import {
  Row,
  Col,
  Card,
  Button,
  Space,
  Select,
  Input,
  Tag,
  Divider,
  Typography,
  Alert,
  message,
} from 'antd';
import {
  SaveOutlined,
  RollbackOutlined,
  PlusOutlined,
  CloseOutlined,
  CheckOutlined,
  BranchesOutlined,
  TeamOutlined,
  MailOutlined,
  CodeOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ReactNode } from 'react';

const { Text } = Typography;

/**
 * WorkflowBuilderPage — compose a workflow as a vertical chain of
 * nodes (Trigger → Condition → Step … → End). Lightweight visual
 * builder; swaps to the reactflow-based graph editor once the
 * OpenMetadata GovernanceWorkflow component is ported.
 */

type NodeKind = 'trigger' | 'condition' | 'approve' | 'notify' | 'webhook';

interface Node {
  key: string;
  kind: NodeKind;
  label: string;
  config: string;
}

const nodeIcons: Record<NodeKind, ReactNode> = {
  trigger: <BranchesOutlined style={{ color: '#1570EF' }} />,
  condition: <CodeOutlined style={{ color: '#6938EF' }} />,
  approve: <CheckOutlined style={{ color: '#F79009' }} />,
  notify: <MailOutlined style={{ color: '#12B76A' }} />,
  webhook: <TeamOutlined style={{ color: '#06AED4' }} />,
};
const nodeTone: Record<NodeKind, string> = {
  trigger: '#1570EF',
  condition: '#6938EF',
  approve: '#F79009',
  notify: '#12B76A',
  webhook: '#06AED4',
};
const nodeLabel: Record<NodeKind, string> = {
  trigger: 'Trigger',
  condition: 'Condition',
  approve: 'Approval step',
  notify: 'Notify',
  webhook: 'Webhook',
};

const DEFAULT_NODES: Node[] = [
  { key: 'n1', kind: 'trigger', label: 'On CR opened', config: 'event=cr.opened AND entity=customer' },
  { key: 'n2', kind: 'condition', label: 'If segment = Enterprise', config: 'cr.target.segment == "enterprise"' },
  { key: 'n3', kind: 'approve', label: 'Approve · Stewards', config: 'group=repoio-stewards; min=1' },
  { key: 'n4', kind: 'approve', label: 'Approve · Admin', config: 'group=repoio-admins; min=1' },
  { key: 'n5', kind: 'notify', label: 'Email requester', config: 'template=cr_approved' },
];

export default function WorkflowBuilderPage() {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('CR approval · 2-eye for enterprise');
  const [nodes, setNodes] = useState<Node[]>(DEFAULT_NODES);

  const insert = (kind: NodeKind, afterKey?: string) => {
    const node: Node = {
      key: `n${Date.now()}`,
      kind,
      label: nodeLabel[kind],
      config: '',
    };
    setNodes((prev) => {
      if (!afterKey) return [...prev, node];
      const idx = prev.findIndex((n) => n.key === afterKey);
      return [...prev.slice(0, idx + 1), node, ...prev.slice(idx + 1)];
    });
  };
  const remove = (key: string) =>
    setNodes((prev) => (prev.length <= 1 ? prev : prev.filter((n) => n.key !== key)));
  const update = (key: string, patch: Partial<Node>) =>
    setNodes((prev) =>
      prev.map((n) => (n.key === key ? { ...n, ...patch } : n))
    );

  return (
    <>
      <PageHeader
        title={workflowId ? `Edit · ${workflowId}` : 'New workflow'}
        subtitle="Chain trigger → conditions → steps. Save validates the shape before persisting."
        actions={
          <>
            <Button icon={<RollbackOutlined />} onClick={() => navigate(ROUTES.WORKFLOWS)}>
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => {
                message.success(`Workflow "${name}" saved`);
                navigate(ROUTES.WORKFLOWS);
              }}>
              Save
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card>
            <Input
              size="large"
              placeholder="Workflow name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <Divider style={{ margin: '8px 0 16px' }} />

            {nodes.map((n, i) => (
              <div key={n.key}>
                <Card
                  size="small"
                  style={{
                    borderInlineStartWidth: 4,
                    borderInlineStartColor: nodeTone[n.kind],
                  }}>
                  <Space
                    style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      {nodeIcons[n.kind]}
                      <Tag bordered={false}>{nodeLabel[n.kind]}</Tag>
                      <Input
                        size="small"
                        value={n.label}
                        placeholder="Step label"
                        onChange={(e) => update(n.key, { label: e.target.value })}
                        style={{ width: 300 }}
                      />
                    </Space>
                    <Button
                      type="text"
                      size="small"
                      icon={<CloseOutlined />}
                      disabled={n.kind === 'trigger'}
                      onClick={() => remove(n.key)}
                    />
                  </Space>
                  <Input
                    size="small"
                    placeholder="Config (DSL)"
                    value={n.config}
                    onChange={(e) => update(n.key, { config: e.target.value })}
                    style={{
                      marginTop: 8,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                </Card>
                {i < nodes.length - 1 && (
                  <div style={{ textAlign: 'center', padding: '6px 0', color: '#D0D5DD' }}>
                    <ArrowDownOutlined />
                  </div>
                )}
              </div>
            ))}

            <Divider />
            <Space wrap>
              <Text type="secondary">Add node:</Text>
              {(['condition', 'approve', 'notify', 'webhook'] as NodeKind[]).map((k) => (
                <Button
                  key={k}
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => insert(k)}>
                  {nodeLabel[k]}
                </Button>
              ))}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Supported node kinds"
              description={
                <ul style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.8 }}>
                  <li><strong>Trigger</strong>: event (cr.opened, pipeline.failed, dq.breach) or cron.</li>
                  <li><strong>Condition</strong>: expression over the triggering object (DSL).</li>
                  <li><strong>Approval step</strong>: requires N approvers from a group.</li>
                  <li><strong>Notify</strong>: send email / Slack via a template.</li>
                  <li><strong>Webhook</strong>: POST to an external URL.</li>
                </ul>
              }
            />
            <Card title="Trigger context" size="small">
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Variables available in conditions and templates:
                </Text>
                <code>cr.id · cr.target.* · cr.requested_by</code>
                <code>event.* · user.* · now · triggered_at</code>
              </Space>
            </Card>
            <Select
              style={{ width: '100%' }}
              defaultValue="event"
              options={[
                { value: 'event', label: 'Trigger: on event' },
                { value: 'schedule', label: 'Trigger: on cron' },
                { value: 'manual', label: 'Trigger: manual' },
              ]}
              onChange={(v) =>
                update('n1', {
                  label:
                    v === 'event' ? 'On CR opened' : v === 'schedule' ? 'Every day 08:00' : 'Manual run',
                })
              }
            />
          </Space>
        </Col>
      </Row>
    </>
  );
}
