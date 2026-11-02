import {
  Row,
  Col,
  Card,
  Input,
  List,
  Tag,
  Space,
  Checkbox,
  Divider,
  Typography,
  Empty,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { Link, useSearchParams, generatePath } from 'react-router-dom';
import { useMemo, useState } from 'react';
import PageHeader from '@/components/common/PageHeader';
import { ROUTES, ENTITY_TYPES } from '@/constants/routes';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

/**
 * SearchResultsPage — unified search across every entity type.
 *
 * The user types a query; results come back grouped by entity (Customer,
 * Vendor, Product, Author, Employee, Store). Facets on the left narrow
 * by entity type, source, country and status. Each result row carries
 * the matched master ID, the primary name, the sources that fed it,
 * and a snippet of the field that matched.
 */

interface Hit {
  master_id: string;
  entity_type: string;
  name: string;
  snippet: string;
  sources: string[];
  country: string;
  status: 'golden' | 'review';
}

const hits: Hit[] = [
  {
    master_id: 'CUST-000142',
    entity_type: 'customer',
    name: 'Acme Publishing House',
    snippet: 'Priority account. Billing on <mark>Net 60</mark>.',
    sources: ['SAP C4C', 'SAP ERP', 'SQL Server'],
    country: 'Egypt',
    status: 'golden',
  },
  {
    master_id: 'CUST-000189',
    entity_type: 'customer',
    name: 'Nile River Bookstore',
    snippet: 'Downtown Cairo — <mark>Net 30</mark> payment terms.',
    sources: ['SAP C4C', 'SQL Server'],
    country: 'Egypt',
    status: 'golden',
  },
  {
    master_id: 'VEND-000041',
    entity_type: 'vendor',
    name: 'Papyrus Paper Mill',
    snippet: 'Supplies cover stock. <mark>Net 60</mark>, EGP currency.',
    sources: ['SAP ERP'],
    country: 'Egypt',
    status: 'golden',
  },
  {
    master_id: 'PROD-098441',
    entity_type: 'product',
    name: 'الوحدة 7 — الطبعة الذهبية',
    snippet: 'ISBN 978-977-00-9872-1 · <mark>Hardcover</mark> · 328 pp.',
    sources: ['SAP ERP', 'SQL Server'],
    country: 'Egypt',
    status: 'golden',
  },
];

export default function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const { t } = useTranslation();
  const q = params.get('q') || '';
  const [query, setQuery] = useState(q);
  const [entityFacet, setEntityFacet] = useState<string[]>([]);
  const [sourceFacet, setSourceFacet] = useState<string[]>([]);

  const results = useMemo(() => {
    let r = hits;
    if (entityFacet.length) r = r.filter((h) => entityFacet.includes(h.entity_type));
    if (sourceFacet.length)
      r = r.filter((h) => h.sources.some((s) => sourceFacet.includes(s)));
    if (query.trim())
      r = r.filter(
        (h) =>
          h.name.toLowerCase().includes(query.toLowerCase()) ||
          h.snippet.toLowerCase().includes(query.toLowerCase())
      );
    return r;
  }, [query, entityFacet, sourceFacet]);

  const grouped = useMemo(() => {
    const map = new Map<string, Hit[]>();
    for (const h of results) {
      const list = map.get(h.entity_type) ?? [];
      list.push(h);
      map.set(h.entity_type, list);
    }
    return map;
  }, [results]);

  const entityCounts = useMemo(() => {
    const map = new Map<string, number>();
    hits.forEach((h) => map.set(h.entity_type, (map.get(h.entity_type) ?? 0) + 1));
    return map;
  }, []);
  const sourceCounts = useMemo(() => {
    const map = new Map<string, number>();
    hits.forEach((h) =>
      h.sources.forEach((s) => map.set(s, (map.get(s) ?? 0) + 1))
    );
    return map;
  }, []);

  const runSearch = (text: string) => {
    setQuery(text);
    setParams(text ? { q: text } : {});
  };

  return (
    <>
      <PageHeader
        title={query ? `Results for "${query}"` : 'Search'}
        subtitle={`${results.length} ${t('entity.records')} across ${grouped.size} entity type${grouped.size === 1 ? '' : 's'}`}
      />

      <Card style={{ marginBottom: 16 }}>
        <Input
          size="large"
          prefix={<SearchOutlined />}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPressEnter={() => runSearch(query)}
          allowClear
        />
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={6}>
          <Card title="Entity">
            <Checkbox.Group
              value={entityFacet}
              onChange={(v) => setEntityFacet(v as string[])}
              style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {ENTITY_TYPES.map((et) => (
                  <Checkbox
                    key={et.key}
                    value={et.key}
                    style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space style={{ justifyContent: 'space-between', width: 180 }}>
                      <span>{t(et.labelKey)}</span>
                      <Text type="secondary">
                        {entityCounts.get(et.key) ?? 0}
                      </Text>
                    </Space>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Card>
          <Card title="Source" style={{ marginTop: 12 }}>
            <Checkbox.Group
              value={sourceFacet}
              onChange={(v) => setSourceFacet(v as string[])}
              style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {Array.from(sourceCounts.entries()).map(([s, n]) => (
                  <Checkbox key={s} value={s}>
                    <Space style={{ justifyContent: 'space-between', width: 180 }}>
                      <span>{s}</span>
                      <Text type="secondary">{n}</Text>
                    </Space>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Card>
        </Col>

        <Col xs={24} lg={18}>
          {grouped.size === 0 ? (
            <Card>
              <Empty description="No matches" />
            </Card>
          ) : (
            Array.from(grouped.entries()).map(([et, items]) => (
              <Card
                key={et}
                size="small"
                style={{ marginBottom: 12 }}
                title={
                  <Space>
                    <strong>{t(`entity.${et}_plural`)}</strong>
                    <Tag bordered={false}>{items.length}</Tag>
                  </Space>
                }>
                <List
                  itemLayout="horizontal"
                  dataSource={items}
                  renderItem={(h) => (
                    <List.Item
                      actions={[
                        <Link
                          key="open"
                          to={generatePath(ROUTES.ENTITY_DETAIL, {
                            entityType: h.entity_type,
                            id: h.master_id,
                          })}>
                          Open
                        </Link>,
                      ]}>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Link
                              to={generatePath(ROUTES.ENTITY_DETAIL, {
                                entityType: h.entity_type,
                                id: h.master_id,
                              })}>
                              {h.name}
                            </Link>
                            <code
                              style={{ fontSize: 12, color: '#667085' }}>
                              {h.master_id}
                            </code>
                            <Tag
                              color={h.status === 'golden' ? 'success' : 'warning'}
                              bordered={false}>
                              {h.status.toUpperCase()}
                            </Tag>
                          </Space>
                        }
                        description={
                          <>
                            <div
                              dangerouslySetInnerHTML={{ __html: h.snippet }}
                            />
                            <Space size={4} style={{ marginTop: 4 }}>
                              {h.sources.map((s) => (
                                <Tag key={s} bordered={false}>
                                  {s}
                                </Tag>
                              ))}
                              <Divider type="vertical" />
                              <Text type="secondary">{h.country}</Text>
                            </Space>
                          </>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            ))
          )}
        </Col>
      </Row>
    </>
  );
}
