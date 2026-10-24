import { Alert, Button, Descriptions, Input, Space, Spin, Table, Tabs, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { canWrite, fail } from "../ui";
import { CANONICAL, Column, Register, RunsList, startSync, TableRow, tableLabel } from "./shared";

type Rec = { id: number; source_id: string; name: string; phone: string; email: string; city: string; tax_id: string; ingested_at: string };
type Drift = { id: string; change_type: string; column_name: string; before: string; after: string; affects_mapping: boolean; detected_at: string };

function Schema({ table }: { table: TableRow }) {
  const mapped: Record<string, string[]> = {};
  CANONICAL.forEach((k) => { const c = table.column_map[k]; if (typeof c === "string") (mapped[c] ??= []).push(k); });
  ((table.column_map.extra as string[] | undefined) ?? []).forEach((c) => (mapped[c] ??= []).push("extra"));
  return (
    <Table<Column> rowKey="name" size="middle" pagination={false} dataSource={table.columns}
      columns={[
        { title: "#", width: 56, render: (_, __, i) => i + 1 },
        { title: "Name", dataIndex: "name" },
        { title: "Type", dataIndex: "type", render: (v: string) => <Tag>{v}</Tag> },
        { title: "Constraint", render: (_, c) => (c.primary_key ? <Tag color="gold">PRIMARY KEY</Tag> : c.nullable ? null : <Tag>NOT NULL</Tag>) },
        { title: "Master mapping", render: (_, c) => <Space size={4}>{(mapped[c.name] ?? []).map((m) => <Tag key={m} color="blue">{m}</Tag>)}{table.cursor_column === c.name && <Tag color="purple">cursor</Tag>}</Space> },
      ]} />
  );
}

function Records({ table }: { table: TableRow }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const size = 25;
  useEffect(() => {
    setLoading(true);
    api<{ total: number; items: Rec[] }>(`/api/v1/tables/${table.id}/records?limit=${size}&offset=${(page - 1) * size}&q=${encodeURIComponent(q)}`)
      .then((r) => { setRows(r.items); setTotal(r.total); }).catch(fail).finally(() => setLoading(false));
  }, [table.id, page, q]);
  return (
    <>
      <Input.Search allowClear placeholder="Search id, name, phone or email" style={{ maxWidth: 420, marginBottom: 12 }} onSearch={(v) => { setPage(1); setQ(v); }} />
      <Table<Rec> rowKey="id" loading={loading} dataSource={rows} locale={{ emptyText: table.master_enabled ? "No records ingested yet. Run a sync." : "Register this table as a master source to ingest its records." }}
        pagination={{ current: page, pageSize: size, total, showSizeChanger: false, hideOnSinglePage: true, onChange: setPage }}
        columns={[
          { title: "ID", dataIndex: "source_id" },
          { title: "Name", dataIndex: "name", render: (v: string) => <span dir="auto">{v}</span> },
          { title: "Phone", dataIndex: "phone" }, { title: "Email", dataIndex: "email" },
          { title: "City", dataIndex: "city", render: (v: string) => <span dir="auto">{v}</span> },
          { title: "Ingested", dataIndex: "ingested_at", render: (v: string) => new Date(v).toLocaleString() },
        ]} />
    </>
  );
}

function Changes({ table }: { table: TableRow }) {
  const [rows, setRows] = useState<Drift[]>([]);
  useEffect(() => { api<Drift[]>(`/api/v1/schema-drift?table_id=${table.id}`).then(setRows).catch(fail); }, [table.id]);
  return (
    <Table<Drift> rowKey="id" dataSource={rows} pagination={{ pageSize: 15, hideOnSinglePage: true }} locale={{ emptyText: "No schema changes detected." }}
      columns={[
        { title: "Detected", dataIndex: "detected_at", render: (v: string) => new Date(v).toLocaleString() },
        { title: "Change", dataIndex: "change_type", render: (v: string) => v.replace(/_/g, " ") },
        { title: "Column", dataIndex: "column_name" },
        { title: "Before", dataIndex: "before" }, { title: "After", dataIndex: "after" },
        { title: "Impact", dataIndex: "affects_mapping", render: (v: boolean) => (v ? <Tag color="error">breaks mapping</Tag> : <Tag>no impact</Tag>) },
      ]} />
  );
}

export default function TablePage({ role }: { role: string }) {
  const { id = "" } = useParams();
  const [table, setTable] = useState<TableRow | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState(0);
  const load = useCallback(() => { api<TableRow>(`/api/v1/tables/${id}`).then(setTable).catch(() => setMissing(true)); }, [id]);
  useEffect(load, [load]);
  if (missing) return <div className="page-card"><Alert type="error" showIcon message="Table not found" action={<Link to="/catalog">Back to Catalog</Link>} /></div>;
  if (!table) return <div className="page-card"><Spin /></div>;
  const sync = async (mode: "full" | "incremental") => {
    if (!(await startSync(table, mode))) return;
    setKey((k) => k + 1);
    [1500, 4000, 9000].forEach((ms) => setTimeout(() => { load(); setKey((k) => k + 1); }, ms)); // counters and records catch up when the run finishes
  };

  return (
    <>
      <div className="page-card entity-header">
        <div className="crumbs"><Link to="/catalog">Catalog</Link> / <Link to={`/catalog/services/${table.service_id}`}>{table.service_name}</Link> / <span>{tableLabel(table)}</span></div>
        <div className="entity-title">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{tableLabel(table)} {table.master_enabled ? <Tag color="success">master source</Tag> : <Tag>not registered</Tag>}{table.removed && <Tag color="error">removed at source</Tag>}</h1>
          </div>
          {canWrite(role) && (
            <Space wrap>
              <Button onClick={() => setEditing(true)}>{table.master_enabled ? "Edit mapping" : "Register as master source"}</Button>
              {table.master_enabled && table.cursor_column && <Button onClick={() => sync("incremental")}>Incremental sync</Button>}
              {table.master_enabled && <Button type="primary" onClick={() => sync("full")}>Sync</Button>}
            </Space>
          )}
        </div>
      </div>
      <div className="entity-layout">
        <div className="page-card entity-main">
          <Tabs destroyInactiveTabPane items={[
            { key: "schema", label: "Schema", children: <Schema table={table} /> },
            { key: "records", label: `Records (${table.records ?? 0})`, children: <Records key={key} table={table} /> },
            { key: "runs", label: "Runs", children: <RunsList tableId={table.id} refreshKey={key} /> },
            { key: "changes", label: "Schema changes", children: <Changes table={table} /> },
          ]} />
        </div>
        <aside className="page-card entity-panel">
          <h3>Details</h3>
          <Descriptions column={1} size="small" colon={false} layout="vertical">
            <Descriptions.Item label="Service"><Link to={`/catalog/services/${table.service_id}`}>{table.service_name}</Link></Descriptions.Item>
            <Descriptions.Item label="Entity type">{table.entity_type}</Descriptions.Item>
            <Descriptions.Item label="Columns">{table.columns.length}</Descriptions.Item>
            <Descriptions.Item label="Records">{table.records ?? 0}</Descriptions.Item>
            <Descriptions.Item label="Cursor column">{table.cursor_column ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Watermark">{table.watermark ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Last ingested">{table.last_ingested_at ? new Date(table.last_ingested_at).toLocaleString() : "—"}</Descriptions.Item>
          </Descriptions>
        </aside>
      </div>
      {editing && <Register table={table} onClose={() => setEditing(false)} onDone={() => { setEditing(false); load(); setKey((k) => k + 1); }} />}
    </>
  );
}
