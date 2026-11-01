import { Card, Tree, Space, Button, Tag, Typography, Row, Col } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useParams, useNavigate, generatePath } from 'react-router-dom';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import {
  BranchesOutlined,
  PlusOutlined,
  LinkOutlined,
  CloseOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * HierarchyPage — parent/child view of a golden record.
 *
 * Parent is at the RECORD level (per Mohamed's clarification): a
 * customer can have a parent customer. The tree is editable here —
 * drag to re-parent, add child, unlink — and every edit opens a
 * Change Request before the hierarchy actually moves.
 */

const treeData: DataNode[] = [
  {
    key: 'CUST-000001',
    title: nodeTitle('CUST-000001', 'Acme Holdings', 'ultimate parent'),
    children: [
      {
        key: 'CUST-000142',
        title: nodeTitle('CUST-000142', 'Acme Publishing House', 'self'),
        children: [
          {
            key: 'CUST-000221',
            title: nodeTitle('CUST-000221', 'Acme Publishing · Cairo branch'),
          },
          {
            key: 'CUST-000222',
            title: nodeTitle('CUST-000222', 'Acme Publishing · Alexandria branch'),
          },
          {
            key: 'CUST-000223',
            title: nodeTitle('CUST-000223', 'Acme Publishing · Mansoura branch'),
          },
        ],
      },
      {
        key: 'CUST-000143',
        title: nodeTitle('CUST-000143', 'Acme Distribution'),
      },
    ],
  },
];

function nodeTitle(id: string, name: string, badge?: string) {
  return (
    <Space size={6}>
      <code>{id}</code>
      <span>{name}</span>
      {badge && (
        <Tag bordered={false} color={badge === 'self' ? 'processing' : undefined}>
          {badge}
        </Tag>
      )}
    </Space>
  );
}

export default function HierarchyPage() {
  const { entityType = 'customer', id = '' } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>(id);

  return (
    <>
      <PageHeader
        title={`Hierarchy · ${id}`}
        subtitle="Parent and child relationships for this record."
        actions={
          <>
            <Button icon={<LinkOutlined />}>Change parent</Button>
            <Button type="primary" icon={<PlusOutlined />}>
              Add child
            </Button>
          </>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card>
            <Tree
              defaultExpandAll
              showLine={{ showLeafIcon: false }}
              icon={<BranchesOutlined />}
              treeData={treeData}
              defaultSelectedKeys={[id]}
              onSelect={(keys) =>
                keys[0] && setSelected(String(keys[0]))
              }
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="Selected node"
            size="small"
            extra={
              <Button
                size="small"
                type="link"
                onClick={() =>
                  navigate(
                    generatePath(ROUTES.ENTITY_DETAIL, {
                      entityType,
                      id: selected,
                    })
                  )
                }>
                Open
              </Button>
            }>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Master ID
                </Text>
                <div>
                  <code>{selected}</code>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Depth
                </Text>
                <div>Level 3 under CUST-000001</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Children
                </Text>
                <div>3 branches</div>
              </div>
              <Button
                size="small"
                danger
                type="text"
                icon={<CloseOutlined />}
                style={{ marginTop: 8 }}>
                Unlink from parent
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}
