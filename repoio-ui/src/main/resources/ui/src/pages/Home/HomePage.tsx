import { Row, Col, Avatar, Space } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  CommentOutlined,
  LikeOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  WarningFilled,
  FileAddOutlined,
  EyeOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import EChart from '@/components/common/EChart';
import type { EChartsOption } from 'echarts';
import type { ReactNode } from 'react';

/**
 * HomePage (Launchpad) — rebuilt to match hub-v34 mockup's `lp` view.
 *
 * Layout:
 *   <h2>Good afternoon, Mohamed</h2>
 *   <p>Your master data at a glance ...</p>
 *   Grid (1fr | 310px):
 *     Left column (hmc):
 *       Activity Feed widget (with tab chips All/@Mentions/Tasks)
 *       My Data widget (2x2 tiles)
 *       KPIs widget (3 columns: coverage bars with target)
 *       Total data assets widget (echarts line + legend)
 *     Right column:
 *       Recent announcements
 *       Following
 *       Recent views
 *
 * Visual language is OpenMetadata-based: .wd widget cards, 14 px titles,
 * blue accent, grey borders, OM spacing.
 */
export default function HomePage() {
  const hour = new Date().getHours();
  const greet =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <Helmet>
        <title>Launchpad — Repo.io</title>
      </Helmet>

      {/* OM-style page header (omh) */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#101828' }}>
          {greet}, Mohamed
        </h2>
        <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13.5 }}>
          Your master data at a glance — what you own, what needs you, and how healthy it is.
        </p>
      </div>

      {/* Main grid 1fr | 310px */}
      <Row gutter={16}>
        <Col xs={24} xl={17}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <ActivityFeedCard />
            <MyDataCard />
            <KpisCard />
            <TotalAssetsCard />
          </Space>
        </Col>
        <Col xs={24} xl={7}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <AnnouncementsCard />
            <FollowingCard />
            <RecentViewsCard />
          </Space>
        </Col>
      </Row>
    </>
  );
}

/* -------------------- Activity Feed -------------------- */

function ActivityFeedCard() {
  const items = [
    {
      who: 'Mona Samir',
      initials: 'MS',
      color: '#1570EF',
      action: 'opened change request',
      target: 'CR-10452 · Update phone and governorate',
      href: '/change-requests/CR-10452',
      meta: '2 min ago · El Ezaby Pharmacy · GR-0048213',
      quote: 'Phone changed from +20 2 2345 1234 to +20 2 2345 1999 after site visit.',
    },
    {
      who: 'Ahmed Hassan',
      initials: 'AH',
      color: '#6938EF',
      action: 'approved',
      target: 'CR-10448 · Merge CUST-000198 into CUST-000142',
      href: '/change-requests/CR-10448',
      meta: '14 min ago · Customers repository',
    },
    {
      who: 'System',
      initials: 'SY',
      color: '#F79009',
      action: 'ran',
      target: 'Nightly Splink re-match',
      meta: '48 min ago · 7 new candidate matches',
    },
    {
      who: 'Nour Ibrahim',
      initials: 'NI',
      color: '#12B76A',
      action: 'commented on',
      target: 'CUST-000204',
      href: '/entity/customer/CUST-000204',
      meta: '1 h ago',
      quote: 'Billing address changed from El Thawra to El Nasr — attached photo of signed slip.',
    },
  ];

  return (
    <div className="wd" style={cardStyle}>
      <div style={cardHeadStyle}>
        <span>Activity Feed</span>
        <Space size={4}>
          <Chip on>All</Chip>
          <Chip>@Mentions</Chip>
          <Chip>Tasks <strong style={{ marginLeft: 4 }}>7</strong></Chip>
        </Space>
      </div>
      <div>
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 12,
              padding: '14px 16px',
              borderBottom: i < items.length - 1 ? '1px solid #F2F4F7' : 'none',
            }}>
            <Avatar
              size={28}
              style={{
                background: `${it.color}1A`,
                color: it.color,
                fontWeight: 700,
                fontSize: 11,
                flex: 'none',
              }}>
              {it.initials}
            </Avatar>
            <div style={{ flex: 1, fontSize: 12.5, color: '#344054' }}>
              <div>
                <strong style={{ fontWeight: 600 }}>{it.who}</strong>{' '}
                {it.action}{' '}
                {it.href ? (
                  <Link to={it.href} style={{ color: '#1570EF', fontWeight: 600 }}>
                    {it.target}
                  </Link>
                ) : (
                  <strong style={{ color: '#1570EF', fontWeight: 600 }}>{it.target}</strong>
                )}
              </div>
              {it.quote && (
                <div
                  style={{
                    marginTop: 6,
                    borderInlineStart: '3px solid #D0D5DD',
                    paddingInlineStart: 9,
                    color: '#667085',
                  }}>
                  {it.quote}
                </div>
              )}
              <div
                style={{
                  marginTop: 3,
                  display: 'flex',
                  gap: 14,
                  color: '#98A2B3',
                  fontSize: 11.5,
                }}>
                <span>{it.meta}</span>
                <span style={{ cursor: 'pointer' }}><LikeOutlined /> Like</span>
                <span style={{ cursor: 'pointer' }}><CommentOutlined /> Reply</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------- My Data -------------------- */

function MyDataCard() {
  const tiles = [
    { label: 'Owned by me', value: '947,241', to: '/entity/customer' },
    { label: 'Followed', value: '18', to: '/entity/customer' },
    { label: 'Pending approvals', value: '4', to: '/change-requests' },
    { label: 'My drafts', value: '2', to: '/change-requests/mine' },
  ];
  return (
    <div className="wd" style={cardStyle}>
      <div style={cardHeadStyle}>My Data</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          padding: '12px 16px',
        }}>
        {tiles.map((t) => (
          <Link
            key={t.label}
            to={t.to}
            style={{
              border: '1px solid #EAECF0',
              borderRadius: 6,
              padding: '10px 12px',
              textDecoration: 'none',
              display: 'block',
              transition: 'border-color 120ms',
            }}>
            <small style={{ color: '#667085', fontSize: 11, display: 'block' }}>
              {t.label}
            </small>
            <strong style={{ fontSize: 20, color: '#1570EF', fontWeight: 700 }}>
              {t.value}
            </strong>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* -------------------- KPIs -------------------- */

function KpisCard() {
  const kpis = [
    { label: 'Match rate', value: 94, target: 95 },
    { label: 'Completeness', value: 88, target: 90 },
    { label: 'Validity', value: 96, target: 95 },
  ];
  return (
    <div className="wd" style={cardStyle}>
      <div style={cardHeadStyle}>Key performance indicators</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          padding: '14px 16px',
        }}>
        {kpis.map((k) => (
          <div key={k.label}>
            <small style={{ color: '#667085', fontSize: 11.5 }}>{k.label}</small>
            <div style={{ fontSize: 20, fontWeight: 700, margin: '2px 0 6px' }}>
              {k.value}%
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: '#EEF0F3',
                overflow: 'hidden',
              }}>
              <div
                style={{
                  width: `${k.value}%`,
                  height: '100%',
                  background: '#1570EF',
                }}
              />
            </div>
            <small style={{ color: '#98A2B3', fontSize: 11 }}>
              Target {k.target}%
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------- Total data assets chart -------------------- */

function TotalAssetsCard() {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(5, 10);
  });
  const golden = [920, 921, 922, 924, 925, 927, 929, 931, 934, 937, 941, 944, 946, 948];
  const source = [2640, 2651, 2662, 2671, 2680, 2688, 2694, 2701, 2709, 2718, 2723, 2729, 2734, 2742];

  const option: EChartsOption = {
    legend: { show: false },
    xAxis: {
      type: 'category',
      data: days,
      boundaryGap: false,
      axisLabel: { color: '#667085', fontSize: 11 },
      axisLine: { lineStyle: { color: '#EAECF0' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#667085', fontSize: 11 },
      splitLine: { lineStyle: { color: '#F2F4F7' } },
    },
    series: [
      {
        type: 'line' as const,
        name: 'Golden',
        data: golden,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#1570EF' },
      },
      {
        type: 'line' as const,
        name: 'Source',
        data: source,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#6938EF' },
      },
    ],
  };

  return (
    <div className="wd" style={cardStyle}>
      <div style={cardHeadStyle}>
        <span>Total data assets</span>
        <small style={{ color: '#98A2B3', fontWeight: 400 }}>last 14 days</small>
      </div>
      <div style={{ padding: '10px 16px' }}>
        <EChart option={option} height={190} />
        <div
          style={{ display: 'flex', gap: 16, fontSize: 12, color: '#475467', padding: '4px 0' }}>
          <LegendSwatch color="#1570EF" label="Golden · 948K (+28)" />
          <LegendSwatch color="#6938EF" label="Source · 2.74M (+102)" />
        </div>
      </div>
    </div>
  );
}

/* -------------------- Right column -------------------- */

function AnnouncementsCard() {
  const items = [
    {
      icon: <BellOutlined />,
      title: 'Nightly re-match moved to 02:00 Africa/Cairo',
      meta: 'Mohamed · 2 days ago',
      tag: 'Scheduled',
      color: '#1570EF',
    },
    {
      icon: <WarningFilled />,
      title: 'Pharma ERP source credential rotates on Fri',
      meta: 'IT · yesterday',
      tag: 'Action needed',
      color: '#F79009',
    },
    {
      icon: <CheckCircleFilled />,
      title: 'DQ score hit 94% — all-time high',
      meta: 'System · 3 h ago',
      tag: 'Milestone',
      color: '#12B76A',
    },
  ];
  return (
    <div className="wd" style={cardStyle}>
      <div style={cardHeadStyle}>Recent announcements</div>
      <div>
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 9,
              padding: '10px 16px',
              borderBottom: i < items.length - 1 ? '1px solid #F5F6F8' : 'none',
              fontSize: 12.5,
            }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: `${it.color}1A`,
                color: it.color,
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
                fontSize: 12,
              }}>
              {it.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, color: '#101828' }}>{it.title}</div>
              <small style={{ color: '#98A2B3', fontSize: 11 }}>{it.meta}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FollowingCard() {
  const items = [
    { icon: <UserOutlined />, name: 'Acme Publishing House', meta: 'Customer · CUST-000142', href: '/entity/customer/CUST-000142' },
    { icon: <TeamOutlined />, name: 'Nile River Bookstore', meta: 'Customer · CUST-000189', href: '/entity/customer/CUST-000189' },
    { icon: <FileAddOutlined />, name: 'CR-10452', meta: 'Change request · in approval', href: '/change-requests/CR-10452' },
  ];
  return (
    <div className="wd" style={cardStyle}>
      <div style={cardHeadStyle}>Following</div>
      <div>
        {items.map((it, i) => (
          <Link
            key={i}
            to={it.href}
            style={{
              display: 'flex',
              gap: 9,
              padding: '10px 16px',
              borderBottom: i < items.length - 1 ? '1px solid #F5F6F8' : 'none',
              fontSize: 12.5,
              textDecoration: 'none',
              color: 'inherit',
            }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: '#E8F1FF',
                color: '#1570EF',
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
                fontSize: 11,
              }}>
              {it.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: '#101828' }}>{it.name}</div>
              <small style={{ color: '#98A2B3', fontSize: 11 }}>{it.meta}</small>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RecentViewsCard() {
  const items = [
    { name: 'CUST-000142', when: '10 min ago', href: '/entity/customer/CUST-000142' },
    { name: 'DQ Dashboard', when: '35 min ago', href: '/quality' },
    { name: 'c4c-customers runs', when: '1 h ago', href: '/pipelines/c4c-customers' },
    { name: 'Enterprise customers in Egypt', when: 'Yesterday', href: '/views/V-01' },
  ];
  return (
    <div className="wd" style={cardStyle}>
      <div style={cardHeadStyle}>
        <span>Recent views</span>
        <small style={{ color: '#98A2B3', fontWeight: 400 }}>
          <EyeOutlined style={{ marginRight: 4 }} />
          You
        </small>
      </div>
      <div>
        {items.map((it, i) => (
          <Link
            key={i}
            to={it.href}
            style={{
              display: 'flex',
              padding: '10px 16px',
              borderBottom: i < items.length - 1 ? '1px solid #F5F6F8' : 'none',
              fontSize: 12.5,
              textDecoration: 'none',
              color: 'inherit',
              justifyContent: 'space-between',
            }}>
            <span style={{ color: '#1570EF', fontWeight: 500 }}>{it.name}</span>
            <small style={{ color: '#98A2B3', fontSize: 11 }}>
              <ClockCircleFilled style={{ marginRight: 4 }} />
              {it.when}
            </small>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* -------------------- Shared -------------------- */

const cardStyle: React.CSSProperties = {
  border: '1px solid #EAECF0',
  borderRadius: 10,
  background: '#ffffff',
  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
  overflow: 'hidden',
};

const cardHeadStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid #F2F4F7',
  fontWeight: 600,
  fontSize: 13.5,
  color: '#101828',
};

function Chip({
  children,
  on,
}: {
  children: ReactNode;
  on?: boolean;
}) {
  return (
    <span
      style={{
        padding: '3px 11px',
        borderRadius: 14,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        background: on ? '#E8F1FF' : 'transparent',
        color: on ? '#1570EF' : '#475467',
      }}>
      {children}
    </span>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <Space size={6}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: color,
          display: 'inline-block',
        }}
      />
      {label}
    </Space>
  );
}
