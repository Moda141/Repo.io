import {
  Row,
  Col,
  Card,
  Button,
  Space,
  Select,
  Input,
  Switch,
  Divider,
  Tag,
  Typography,
  message,
} from 'antd';
import { CopyOutlined, EyeOutlined } from '@ant-design/icons';
import { useState } from 'react';
import PageHeader from '@/components/common/PageHeader';

const { Text } = Typography;

export default function EmbedsPage() {
  const [target, setTarget] = useState('/entity/customer/CUST-000142');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [hideChrome, setHideChrome] = useState(true);
  const [width, setWidth] = useState('100%');
  const [height, setHeight] = useState('640');

  const url = `https://repoio.nahdetmisr.com${target}?embed=1&theme=${theme}${hideChrome ? '&chrome=0' : ''}`;
  const iframe = `<iframe
  src="${url}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allow="clipboard-write"
  style="border: 1px solid #EAECF0; border-radius: 8px;"
></iframe>`;

  const scriptTag = `<script
  src="https://repoio.nahdetmisr.com/embed.js"
  data-target="${target}"
  data-theme="${theme}"
></script>`;

  return (
    <>
      <PageHeader
        title="Embed codes"
        subtitle="Drop a Repo.io view, record, or dashboard into Power BI, SharePoint or any intranet page."
      />

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <Card title="Options">
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <div>
                <Text type="secondary">Target (route)</Text>
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  style={{ marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}
                />
              </div>
              <div>
                <Text type="secondary">Theme</Text>
                <Select
                  value={theme}
                  onChange={(v) => setTheme(v)}
                  style={{ width: '100%', marginTop: 6 }}
                  options={[
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                />
              </div>
              <Space>
                <Switch checked={hideChrome} onChange={setHideChrome} />
                <Text>Hide sidebar + top bar</Text>
              </Space>
              <Divider style={{ margin: '4px 0' }} />
              <Space>
                <div style={{ flex: 1 }}>
                  <Text type="secondary">Width</Text>
                  <Input
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    style={{ marginTop: 6 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Text type="secondary">Height (px)</Text>
                  <Input
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    style={{ marginTop: 6 }}
                  />
                </div>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card
              title={
                <Space>
                  <Tag bordered={false}>iframe</Tag>
                  Direct embed
                </Space>
              }
              extra={
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(iframe);
                    message.success('iframe copied');
                  }}>
                  Copy
                </Button>
              }>
              <pre style={codeStyle}>{iframe}</pre>
            </Card>

            <Card
              title={
                <Space>
                  <Tag bordered={false}>script</Tag>
                  JS widget
                </Space>
              }
              extra={
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(scriptTag);
                    message.success('Script copied');
                  }}>
                  Copy
                </Button>
              }>
              <pre style={codeStyle}>{scriptTag}</pre>
            </Card>

            <Card
              title={
                <Space>
                  <EyeOutlined />
                  Live preview
                </Space>
              }>
              <div
                style={{
                  height,
                  width,
                  maxWidth: '100%',
                  border: '1px solid #EAECF0',
                  borderRadius: 8,
                  background: theme === 'dark' ? '#0C111D' : '#F8F9FC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme === 'dark' ? '#D0D5DD' : '#667085',
                }}>
                {target} · theme={theme}{hideChrome ? ' · no chrome' : ''}
              </div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                Live iframe is disabled in the admin preview; copy and paste into the target site.
              </Text>
            </Card>
          </Space>
        </Col>
      </Row>
    </>
  );
}

const codeStyle: React.CSSProperties = {
  margin: 0,
  padding: 12,
  background: '#F9FAFB',
  border: '1px solid #EAECF0',
  borderRadius: 8,
  fontSize: 12,
  lineHeight: 1.6,
  overflowX: 'auto',
  fontFamily: 'JetBrains Mono, monospace',
};
