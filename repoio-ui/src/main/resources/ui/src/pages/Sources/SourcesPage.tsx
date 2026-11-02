import { Row, Col, Card, Tag, Space, Button, Avatar, Typography } from 'antd';
import {
  PlusOutlined,
  CloudOutlined,
  DatabaseOutlined,
  FileExcelOutlined,
  ShoppingOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES } from '@/constants/routes';
import type { ReactNode } from 'react';

const { Text } = Typography;

interface Source {
  id: string;
  name: string;
  kind: 'sap_c4c' | 'sap_erp' | 'sql_server' | 'excel' | 'drive';
  pipelines: number;
  records: number;
  last_sync: string;
  health: 'ok' | 'warn' | 'down';
}

const sources: Source[] = [
  {
    id: 'src-c4c-prod',
    name: 'SAP C4C — production',
    kind: 'sap_c4c',
    pipelines: 3,
    records: 952_431,
    last_sync: '2 minutes ago',
    health: 'ok',
  },
  {
    id: 'src-erp-prod',
    name: 'SAP ERP — production',
    kind: 'sap_erp',
    pipelines: 4,
    records: 51_321,
    last_sync: '9 hours ago',
    health: 'ok',
  },
  {
    id: 'src-sqlsrv-prod',
    name: 'SQL Server — books catalog',
    kind: 'sql_server',
    pipelines: 2,
    records: 48_117,
    last_sync: '1 hour ago',
    health: 'warn',
  },
  {
    id: 'src-xlsx-regional',
    name: 'Regional distributors — Excel',
    kind: 'excel',
    pipelines: 1,
    records: 3_204,
    last_sync: '3 days ago',
    health: 'down',
  },
];

const iconFor: Record<Source['kind'], ReactNode> = {
  sap_c4c: <CloudOutlined />,
  sap_erp: <ShoppingOutlined />,
  sql_server: <DatabaseOutlined />,
  excel: <FileExcelOutlined />,
  drive: <CloudServerOutlined />,
};
const labelFor: Record<Source['kind'], string> = {
  sap_c4c: 'SAP C4C',
  sap_erp: 'SAP ERP',
  sql_server: 'SQL Server',
  excel: 'Excel / CSV',
  drive: 'Drive / SharePoint',
};
const toneFor: Record<Source['kind'], string> = {
  sap_c4c: '#1570EF',
  sap_erp: '#6938EF',
  sql_server: '#06AED4',
  excel: '#12B76A',
  drive: '#F79009',
};

/**
 * SourcesPage — every connected system that feeds Repo.io.
 *
 * Grid of source cards. Each card is a glanceable health + volume view
 * with a direct link to the detailed source page where connection
 * settings, schemas and recent syncs live.
 */
export default function SourcesPage() {
  return (
    <>
      <PageHeader
        title="Sources"
        subtitle="Every system that feeds Repo.io — SAP C4C, SAP ERP, SQL Server, spreadsheets, drives."
        actions={
          <Link to={ROUTES.SOURCE_NEW}>
            <Button type="primary" icon={<PlusOutlined />}>
              Add source
            </Button>
          </Link>
        }
      />

      <Row gutter={[16, 16]}>
        {sources.map((s) => (
          <Col key={s.id} xs={24} md={12} lg={8}>
            <Link to={`/sources/${s.id}`}>
              <Card hoverable style={{ height: '100%' }}>
                <Space
                  style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Avatar
                      size={40}
                      style={{
                        background: `${toneFor[s.kind]}1A`,
                        color: toneFor[s.kind],
                      }}
                      icon={iconFor[s.kind]}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {labelFor[s.kind]}
                      </Text>
                    </div>
                  </Space>
                  <HealthTag health={s.health} />
                </Space>

                <Row style={{ marginTop: 16 }} gutter={16}>
                  <Col span={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Pipelines
                    </Text>
                    <div style={{ fontWeight: 600 }}>{s.pipelines}</div>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Records
                    </Text>
                    <div style={{ fontWeight: 600 }}>
                      {s.records.toLocaleString()}
                    </div>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Last sync
                    </Text>
                    <div style={{ fontWeight: 600 }}>{s.last_sync}</div>
                  </Col>
                </Row>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </>
  );
}

function HealthTag({ health }: { health: Source['health'] }) {
  if (health === 'ok')
    return (
      <Tag color="success" icon={<CheckCircleOutlined />} bordered={false}>
        Healthy
      </Tag>
    );
  if (health === 'warn')
    return (
      <Tag color="warning" icon={<WarningOutlined />} bordered={false}>
        Warning
      </Tag>
    );
  return (
    <Tag color="error" icon={<CloseCircleOutlined />} bordered={false}>
      Offline
    </Tag>
  );
}
