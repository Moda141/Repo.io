import { Card, Tag, Space, Typography, Tooltip } from 'antd';
import { useParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import {
  CloudDownloadOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  MergeCellsOutlined,
  SafetyOutlined,
  CrownFilled,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

const { Text } = Typography;

/**
 * LineagePage — "where did this record come from?"
 *
 * Horizontal chain of stages the record flowed through, from raw source
 * event to golden survivor. Each stage shows which upstream rows fed it
 * and when it ran. The visualisation is intentionally simple SVG for M1;
 * once the dedicated OpenMetadata Lineage component is ported in a later
 * phase, this page swaps its body without changing the route.
 */

interface Stage {
  key: string;
  label: string;
  sublabel: string;
  icon: ReactNode;
  tone: 'raw' | 'process' | 'golden';
  details: { label: string; value: string }[];
}

const stages: Stage[] = [
  {
    key: 'c4c',
    label: 'SAP C4C',
    sublabel: 'raw.customer',
    icon: <CloudDownloadOutlined />,
    tone: 'raw',
    details: [
      { label: 'Event ID', value: 'c4c-evt-77341-a' },
      { label: 'Received', value: '2026-11-01 15:02:11' },
    ],
  },
  {
    key: 'fastapi',
    label: 'FastAPI ingest',
    sublabel: 'ingestion/fastapi',
    icon: <ApiOutlined />,
    tone: 'process',
    details: [
      { label: 'Pod', value: 'ingest-5b8f' },
      { label: 'Latency', value: '12 ms' },
    ],
  },
  {
    key: 'standardise',
    label: 'Standardise',
    sublabel: 'spark · job: standardise',
    icon: <SafetyOutlined />,
    tone: 'process',
    details: [
      { label: 'Rows in', value: '1' },
      { label: 'Rows out', value: '1' },
      { label: 'Rules applied', value: '12' },
    ],
  },
  {
    key: 'dq',
    label: 'Data quality',
    sublabel: 'great expectations · customer.ge.yml',
    icon: <CheckCircleOutlined />,
    tone: 'process',
    details: [
      { label: 'Expectations', value: '18' },
      { label: 'Pass', value: '18' },
      { label: 'Score', value: '96.3%' },
    ],
  },
  {
    key: 'match',
    label: 'Splink match',
    sublabel: 'spark · job: match',
    icon: <MergeCellsOutlined />,
    tone: 'process',
    details: [
      { label: 'Candidates', value: '3' },
      { label: 'Best score', value: '0.96' },
      { label: 'Decision', value: 'merge with CUST-000198' },
    ],
  },
  {
    key: 'golden',
    label: 'Golden',
    sublabel: 'iceberg · golden_customer',
    icon: <CrownFilled />,
    tone: 'golden',
    details: [
      { label: 'Master ID', value: 'CUST-000142' },
      { label: 'Index', value: 'master_id → leaf-00017' },
      { label: 'Snapshot', value: 's-1101-15-02' },
    ],
  },
];

export default function LineagePage() {
  const { id = '' } = useParams();

  return (
    <>
      <PageHeader
        title={`Lineage · ${id}`}
        subtitle="How this golden record flowed from the source system to Iceberg."
      />

      <Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 16,
            overflowX: 'auto',
            paddingBottom: 8,
          }}>
          {stages.map((s, i) => (
            <>
              <StageCard key={s.key} stage={s} />
              {i < stages.length - 1 && <Arrow key={`arrow-${i}`} />}
            </>
          ))}
        </div>
      </Card>
    </>
  );
}

function StageCard({ stage }: { stage: Stage }) {
  const toneColor =
    stage.tone === 'raw'
      ? '#1570EF'
      : stage.tone === 'golden'
        ? '#12B76A'
        : '#6938EF';

  return (
    <Tooltip
      placement="bottom"
      title={
        <div>
          {stage.details.map((d) => (
            <div key={d.label}>
              <strong>{d.label}:</strong> {d.value}
            </div>
          ))}
        </div>
      }>
      <div
        style={{
          minWidth: 180,
          padding: 16,
          borderRadius: 12,
          background: '#FFFFFF',
          border: `1px solid ${toneColor}33`,
          boxShadow: `0 1px 2px ${toneColor}11`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
        <Space>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${toneColor}1A`,
              color: toneColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}>
            {stage.icon}
          </div>
          <Tag bordered={false}>{stage.tone}</Tag>
        </Space>
        <div>
          <div style={{ fontWeight: 600 }}>{stage.label}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {stage.sublabel}
          </Text>
        </div>
      </div>
    </Tooltip>
  );
}

function Arrow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        color: '#D0D5DD',
        fontSize: 20,
      }}>
      →
    </div>
  );
}
