import { Row, Col, Space, Button, Alert, Tag } from 'antd';
import { PlusOutlined, UserOutlined, ShopOutlined, BookOutlined, EditOutlined, TeamOutlined, HomeOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import { ENTITY_TYPES, ROUTES } from '@/constants/routes';
import type { ReactNode } from 'react';

/**
 * ExplorePage (Repositories) — rebuilt to match hub-v34 mockup's `repos` view.
 *
 * Layout:
 *   Title + "+ New repository" button
 *   g3 grid of repository cards: Customers / Vendors / Products
 *     Each card: name + status pill + "model vN · N sources" subtitle
 *     Three metric columns: Golden · Source · To review
 *   Recent activity table (card)
 */

interface RepoCardData {
  key: string;
  name: string;
  icon: ReactNode;
  color: string;
  status: 'deployed' | 'draft';
  modelLabel: string;
  stats: { golden: string; source: string; review: string };
}

const iconMap: Record<string, ReactNode> = {
  user: <UserOutlined />,
  shop: <ShopOutlined />,
  book: <BookOutlined />,
  edit: <EditOutlined />,
  team: <TeamOutlined />,
  home: <HomeOutlined />,
};
const colorMap: Record<string, string> = {
  customer: '#1570EF',
  vendor: '#6938EF',
  product: '#12B76A',
  author: '#F79009',
  employee: '#F04438',
  store: '#06AED4',
};

const repos: Record<string, RepoCardData> = {
  customer: {
    key: 'customer',
    name: 'Customers',
    icon: iconMap.user,
    color: colorMap.customer,
    status: 'deployed',
    modelLabel: 'Customer model v4 · 3 sources',
    stats: { golden: '948K', source: '2.7M', review: '1,930' },
  },
  vendor: {
    key: 'vendor',
    name: 'Vendors',
    icon: iconMap.shop,
    color: colorMap.vendor,
    status: 'deployed',
    modelLabel: 'Vendor model v2 · 2 sources',
    stats: { golden: '4.1K', source: '9.8K', review: '12' },
  },
  product: {
    key: 'product',
    name: 'Products',
    icon: iconMap.book,
    color: colorMap.product,
    status: 'draft',
    modelLabel: 'Product model v1 · no sources',
    stats: { golden: '—', source: '—', review: '—' },
  },
  author: {
    key: 'author',
    name: 'Authors',
    icon: iconMap.edit,
    color: colorMap.author,
    status: 'deployed',
    modelLabel: 'Author model v1 · 1 source',
    stats: { golden: '2.4K', source: '2.8K', review: '38' },
  },
  employee: {
    key: 'employee',
    name: 'Employees',
    icon: iconMap.team,
    color: colorMap.employee,
    status: 'deployed',
    modelLabel: 'Employee model v3 · 1 source',
    stats: { golden: '1.2K', source: '1.2K', review: '0' },
  },
  store: {
    key: 'store',
    name: 'Stores',
    icon: iconMap.home,
    color: colorMap.store,
    status: 'deployed',
    modelLabel: 'Store model v1 · 1 source',
    stats: { golden: '186', source: '202', review: '4' },
  },
};

interface Activity {
  event: string;
  repo: string;
  source: string;
  result: { label: string; tone: 'ok' | 'warn' | 'error' };
  when: string;
}
const activity: Activity[] = [
  {
    event: 'Incremental load #2041',
    repo: 'Customers',
    source: 'Retail POS',
    result: { label: '409 upserted · 3 quarantined', tone: 'ok' },
    when: 'Yesterday',
  },
  {
    event: 'Full load #2033',
    repo: 'Customers',
    source: 'Pharma ERP',
    result: { label: '1.2M processed', tone: 'ok' },
    when: '2 days ago',
  },
  {
    event: 'Load #2029',
    repo: 'Customers',
    source: 'Legacy CRM',
    result: { label: 'Connection failed', tone: 'error' },
    when: '2 days ago',
  },
];

export default function ExplorePage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader
        title="Repositories"
        subtitle="Each repository holds golden records for one entity type."
        actions={
          <>
            <Link to={ROUTES.QUERY}>
              <Button>Query builder</Button>
            </Link>
            <Link to={ROUTES.VIEWS}>
              <Button>Saved views</Button>
            </Link>
            <Button type="primary" icon={<PlusOutlined />}>
              New repository
            </Button>
          </>
        }
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message={
          <>
            <strong>Retail POS:</strong> 2 schema changes affect the mapping.{' '}
            <Link to="/pipelines/retail-pos">Review</Link>
          </>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {ENTITY_TYPES.map((et) => {
          const r = repos[et.key];
          if (!r) return null;
          return (
            <Col key={r.key} xs={24} md={12} lg={8}>
              <Link to={`/entity/${r.key}`}>
                <div style={repoCardStyle}>
                  <Space
                    style={{ justifyContent: 'space-between', width: '100%' }}
                    align="start">
                    <Space size={12}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: `${r.color}1A`,
                          color: r.color,
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 18,
                        }}>
                        {r.icon}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 15, color: '#101828' }}>
                          {r.name}
                        </h3>
                        <small style={{ color: '#667085' }}>{r.modelLabel}</small>
                      </div>
                    </Space>
                    <Tag
                      bordered={false}
                      color={r.status === 'deployed' ? 'success' : 'warning'}>
                      {r.status === 'deployed' ? 'Deployed' : 'Draft'}
                    </Tag>
                  </Space>

                  <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
                    <Metric label="Golden" value={r.stats.golden} />
                    <Metric label="Source" value={r.stats.source} />
                    <Metric label="To review" value={r.stats.review} />
                  </div>
                </div>
              </Link>
            </Col>
          );
        })}
      </Row>

      {/* Recent activity */}
      <div style={cardStyle}>
        <div style={cardHeadStyle}>Recent activity</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Th>Event</Th>
              <Th>Repository</Th>
              <Th>Source</Th>
              <Th>Result</Th>
              <Th>When</Th>
            </tr>
          </thead>
          <tbody>
            {activity.map((a, i) => (
              <tr key={i}>
                <Td>
                  <a style={{ color: '#1570EF', fontWeight: 600 }}>{a.event}</a>
                </Td>
                <Td>{a.repo}</Td>
                <Td>{a.source}</Td>
                <Td>
                  <Tag
                    bordered={false}
                    color={
                      a.result.tone === 'ok'
                        ? 'success'
                        : a.result.tone === 'warn'
                          ? 'warning'
                          : 'error'
                    }>
                    {a.result.label}
                  </Tag>
                </Td>
                <Td style={{ color: '#667085' }}>{a.when}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hidden to satisfy ts-noUnusedLocals — translation hook ready for the next pass */}
      <span style={{ display: 'none' }}>{t('nav.explore')}</span>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong style={{ display: 'block', fontSize: 19, fontWeight: 600, color: '#101828' }}>
        {value}
      </strong>
      <small style={{ color: '#667085', fontSize: 11 }}>{label}</small>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #EAECF0',
  borderRadius: 10,
  background: '#ffffff',
  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
  overflow: 'hidden',
};

const cardHeadStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: '1px solid #F2F4F7',
  fontWeight: 600,
  fontSize: 14,
  color: '#101828',
};

const repoCardStyle: React.CSSProperties = {
  ...cardStyle,
  padding: 14,
  cursor: 'pointer',
  transition: 'border-color 120ms, box-shadow 120ms',
  display: 'block',
};

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        background: '#F9FAFB',
        color: '#475467',
        fontSize: 12,
        fontWeight: 600,
        padding: '11px 18px',
        textAlign: 'start',
        borderBottom: '1px solid #EAECF0',
      }}>
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: '14px 18px',
        borderBottom: '1px solid #F2F4F7',
        color: '#101828',
        ...style,
      }}>
      {children}
    </td>
  );
}
