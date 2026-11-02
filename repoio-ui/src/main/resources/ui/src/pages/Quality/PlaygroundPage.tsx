import {
  Row,
  Col,
  Card,
  Button,
  Space,
  Select,
  Input,
  Divider,
  Tag,
  Typography,
  Alert,
  List,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useMemo, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ENTITY_TYPES } from '@/constants/routes';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

/**
 * PlaygroundPage — try a rule set against hand-pasted or sampled rows.
 *
 * The user pastes a JSON array (or clicks "Load sample"), picks which
 * rule set to run (DQ expectations, matching, survivorship), and sees
 * the per-row verdict in the right panel. No side-effects — nothing is
 * written to Iceberg or Kafka.
 */

const SAMPLE = `[
  {
    "master_id": "CUST-000142",
    "name": "Acme Publishing House",
    "country": "EG",
    "segment": "enterprise",
    "tax_id": "100-200-300",
    "email": "info@acme.example"
  },
  {
    "master_id": "CUST-000199",
    "name": "ACME publishing",
    "country": "EG",
    "segment": "enterprise",
    "tax_id": "1002003",
    "email": "info@ACME.example"
  },
  {
    "master_id": "CUST-000248",
    "name": "",
    "country": "XX",
    "segment": "enterprise",
    "tax_id": null
  }
]`;

interface Verdict {
  idx: number;
  level: 'ok' | 'warn' | 'fail';
  label: string;
  messages: string[];
}

export default function PlaygroundPage() {
  const { t } = useTranslation();
  const [entity, setEntity] = useState('customer');
  const [ruleSet, setRuleSet] = useState<'dq' | 'match' | 'survive'>('dq');
  const [input, setInput] = useState(SAMPLE);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [ran, setRan] = useState(false);

  const parsed = useMemo(() => {
    try {
      const v = JSON.parse(input);
      return Array.isArray(v) ? v : [];
    } catch {
      return null;
    }
  }, [input]);

  const run = () => {
    if (parsed === null) {
      setVerdicts([
        { idx: 0, level: 'fail', label: 'JSON parse error', messages: ['Fix the JSON input above'] },
      ]);
      setRan(true);
      return;
    }
    const out: Verdict[] = [];
    parsed.forEach((row, idx) => {
      const msgs: string[] = [];
      let level: Verdict['level'] = 'ok';
      if (ruleSet === 'dq') {
        if (!row.master_id) {
          msgs.push('master_id is required');
          level = 'fail';
        }
        if (!row.name) {
          msgs.push('name is required');
          level = 'fail';
        }
        if (row.country && !['EG', 'SA', 'AE', 'KW', 'OM', 'BH', 'QA'].includes(row.country)) {
          msgs.push(`country "${row.country}" not in allowed set`);
          level = level === 'fail' ? 'fail' : 'warn';
        }
        if (row.tax_id && typeof row.tax_id === 'string' && !/^\d{3}-?\d{3}-?\d{3}$/.test(row.tax_id)) {
          msgs.push('tax_id does not match 9-digit pattern');
          level = level === 'fail' ? 'fail' : 'warn';
        }
        if (msgs.length === 0) msgs.push('All expectations pass');
      } else if (ruleSet === 'match') {
        const other = parsed.find(
          (r2, j) =>
            j !== idx &&
            r2.country === row.country &&
            String(r2.name ?? '').toLowerCase().slice(0, 3) ===
              String(row.name ?? '').toLowerCase().slice(0, 3)
        );
        if (other) {
          msgs.push(
            `Candidate match with #${parsed.indexOf(other) + 1} (${other.master_id}) — blocked on country+first 3 chars of name`
          );
          level = 'warn';
        } else {
          msgs.push('No candidate matches found');
        }
      } else {
        msgs.push('Survivorship rules only apply when 2+ records are being merged.');
        msgs.push(
          'Pick ≥2 rows and run on the Merge page instead for a real survivor preview.'
        );
      }
      out.push({
        idx: idx + 1,
        level,
        label: row.master_id ?? '(no id)',
        messages: msgs,
      });
    });
    setVerdicts(out);
    setRan(true);
  };

  return (
    <>
      <PageHeader
        title="Rule playground"
        subtitle="Try your DQ, matching or survivorship rules against ad-hoc rows. Nothing is persisted."
        actions={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setInput(SAMPLE);
              setRan(false);
              setVerdicts([]);
            }}>
            Reset to sample
          </Button>
        }
      />

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card
            title="Input"
            extra={
              <Space>
                <Text type="secondary">Entity</Text>
                <Select
                  size="small"
                  value={entity}
                  onChange={setEntity}
                  style={{ width: 160 }}
                  options={ENTITY_TYPES.map((e) => ({
                    value: e.key,
                    label: t(e.labelKey),
                  }))}
                />
                <Text type="secondary">Rules</Text>
                <Select
                  size="small"
                  value={ruleSet}
                  onChange={(v) => setRuleSet(v)}
                  style={{ width: 180 }}
                  options={[
                    { value: 'dq', label: 'DQ expectations' },
                    { value: 'match', label: 'Matching (Splink)' },
                    { value: 'survive', label: 'Survivorship' },
                  ]}
                />
              </Space>
            }>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={20}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13,
                lineHeight: 1.6,
                background: '#F9FAFB',
              }}
            />
            <Divider style={{ margin: '12px 0' }} />
            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={run}
                disabled={parsed === null}>
                Run
              </Button>
              {parsed === null ? (
                <Tag color="error" bordered={false}>
                  Invalid JSON
                </Tag>
              ) : (
                <Tag bordered={false}>{parsed.length} rows parsed</Tag>
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Verdicts">
            {!ran && (
              <Alert
                type="info"
                showIcon
                message="Click Run to evaluate"
                description="Each row gets a verdict — pass / warn / fail — plus a human-readable reason."
              />
            )}
            {ran && (
              <List
                itemLayout="horizontal"
                dataSource={verdicts}
                renderItem={(v) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        v.level === 'ok' ? (
                          <CheckCircleOutlined
                            style={{ color: '#12B76A', fontSize: 18 }}
                          />
                        ) : v.level === 'warn' ? (
                          <span style={{ color: '#F79009', fontSize: 18 }}>
                            ⚠
                          </span>
                        ) : (
                          <CloseCircleOutlined
                            style={{ color: '#F04438', fontSize: 18 }}
                          />
                        )
                      }
                      title={
                        <Space>
                          <strong>#{v.idx}</strong>
                          <code>{v.label}</code>
                        </Space>
                      }
                      description={v.messages.map((m, i) => (
                        <div key={i}>{m}</div>
                      ))}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}
