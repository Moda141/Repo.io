import { CloudServerOutlined, DatabaseOutlined, FileTextOutlined } from "@ant-design/icons";
import { Button, Form, Modal, Select, Space, Table, Tag, message } from "antd";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { canWrite, fail } from "../ui";

export type FieldSpec = { name: string; label: string; secret: boolean; required: boolean; help: string; default: unknown; choices: string[] | null; kind: string };
export type ConnectorType = { type: string; label: string; fields: FieldSpec[] };
export type Service = {
  id: string; name: string; service_type: string; description: string; config: Record<string, unknown>;
  secrets_set: string[]; tables: number; records: number;
};
export type Column = { name: string; type: string; primary_key: boolean; nullable: boolean };
export type TableRow = {
  id: string; service_id: string; service_name: string; schema_name: string; table_name: string; columns: Column[]; removed: boolean;
  master_enabled: boolean; entity_type: string; column_map: Record<string, string | string[]>; cursor_column: string | null;
  watermark: string | null; last_ingested_at: string | null; records: number | null;
};
export type Run = {
  id: string; service_id: string; table_id: string | null; kind: string; mode: string; status: string; produced: number; added: number;
  updated: number; unchanged: number; deleted: number; failed: number; warning: string; error: string; created_at: string;
};

export const CANONICAL = ["source_id", "name", "phone", "email", "city", "tax_id"] as const;
export const STATUS_COLOR: Record<string, string> = {
  completed: "success", completed_with_warnings: "warning", failed: "error", running: "processing", queued: "default", finalizing: "processing",
};
export const tableLabel = (t: { schema_name: string; table_name: string }) => `${t.schema_name ? `${t.schema_name}.` : ""}${t.table_name}`;

export function Register({ table, onClose, onDone }: { table: TableRow; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm();
  const opts = table.columns.map((c) => ({ value: c.name, label: c.name }));
  const initial = Object.fromEntries(CANONICAL.map((k) => [k, typeof table.column_map[k] === "string" ? table.column_map[k] : undefined]));
  const save = async (enabled: boolean) => {
    const v = enabled ? await form.validateFields() : form.getFieldsValue();
    const column_map: Record<string, string> = {};
    CANONICAL.forEach((k) => { if (v[k]) column_map[k] = v[k]; });
    try {
      await api(`/api/v1/tables/${table.id}/master`, { method: "PUT", body: JSON.stringify({ enabled, column_map, cursor_column: v.cursor || null }) });
      message.success(enabled ? "Master source mapping saved" : "Unregistered");
      onDone();
    } catch (e) { fail(e); }
  };
  return (
    <Modal open title={`Master source mapping — ${table.table_name}`} onCancel={onClose} width={560} maskClosable={false}
      footer={[
        table.master_enabled && <Button key="un" danger onClick={() => save(false)}>Unregister</Button>,
        <Button key="c" onClick={onClose}>Cancel</Button>,
        <Button key="s" type="primary" onClick={() => save(true)}>{table.master_enabled ? "Update mapping" : "Register"}</Button>,
      ]}>
      <Form form={form} layout="vertical" initialValues={{ ...initial, cursor: table.cursor_column ?? undefined }}>
        {CANONICAL.map((k) => (
          <Form.Item key={k} label={k} name={k} rules={[{ required: k === "source_id" || k === "name" }]}><Select allowClear showSearch options={opts} placeholder="Column" /></Form.Item>
        ))}
        <Form.Item label="Cursor column (enables incremental sync)" name="cursor"><Select allowClear showSearch options={opts} /></Form.Item>
      </Form>
    </Modal>
  );
}

export async function startSync(t: { id: string }, mode: "full" | "incremental"): Promise<boolean> {
  try {
    await api(`/api/v1/tables/${t.id}/sync`, { method: "POST", body: JSON.stringify({ mode }) });
    message.info("Sync started. Follow it in the Runs tab.");
    return true;
  } catch (e) { fail(e); return false; }
}

/** Tables list used by the global Tables tab and the service page. */
export function TablesList({ role, serviceId, refreshKey, onChange }: { role: string; serviceId?: string; refreshKey?: number; onChange?: () => void }) {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [open, setOpen] = useState<TableRow | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api<TableRow[]>(`/api/v1/tables${serviceId ? `?service_id=${serviceId}` : ""}`).then(setTables).catch(fail).finally(() => setLoading(false));
  }, [serviceId]);
  useEffect(load, [load, refreshKey]);
  const changed = () => { load(); onChange?.(); };
  return (
    <>
      <Table<TableRow> rowKey="id" loading={loading} dataSource={tables} pagination={{ pageSize: 15, hideOnSinglePage: true }}
        locale={{ emptyText: "No tables yet. Run Discover on a service." }}
        columns={[
          { title: "Name", sorter: (a, b) => a.table_name.localeCompare(b.table_name), render: (_, t) => <Link to={`/catalog/tables/${t.id}`}>{tableLabel(t)}</Link> },
          ...(serviceId ? [] : [{ title: "Service", dataIndex: "service_name", render: (v: string, t: TableRow) => <Link to={`/catalog/services/${t.service_id}`}>{v}</Link> }]),
          { title: "Columns", render: (_, t) => t.columns.length },
          { title: "Records", dataIndex: "records", render: (v: number | null) => v ?? 0 },
          { title: "Master source", render: (_, t) => (t.master_enabled ? <Tag color="success">registered</Tag> : <Tag>not registered</Tag>) },
          { title: "Last ingested", dataIndex: "last_ingested_at", render: (v: string | null) => (v ? new Date(v).toLocaleString() : "—") },
          { title: "", align: "right" as const, render: (_: unknown, t: TableRow) => canWrite(role) && (
            <Space>
              <Button size="small" onClick={() => setOpen(t)}>{t.master_enabled ? "Mapping" : "Register"}</Button>
              {t.master_enabled && <Button size="small" type="primary" onClick={async () => { if (await startSync(t, "full")) changed(); }}>Sync</Button>}
            </Space>) },
        ]} />
      {open && <Register table={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); changed(); }} />}
    </>
  );
}

/** Sync runs list (auto-refreshes while something is running). */
export function RunsList({ serviceId, tableId, refreshKey }: { serviceId?: string; tableId?: string; refreshKey?: number }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    const q = new URLSearchParams({ limit: "50" });
    if (serviceId) q.set("service_id", serviceId);
    if (tableId) q.set("table_id", tableId);
    api<Run[]>(`/api/v1/sync-runs?${q}`).then(setRuns).catch(() => undefined).finally(() => setLoading(false));
  }, [serviceId, tableId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    if (!runs.some((r) => ["queued", "running", "finalizing"].includes(r.status))) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [runs, load]);
  return (
    <Table<Run> rowKey="id" loading={loading} dataSource={runs} pagination={{ pageSize: 15, hideOnSinglePage: true }} locale={{ emptyText: "No runs yet." }}
      columns={[
        { title: "When", dataIndex: "created_at", render: (v: string) => new Date(v).toLocaleString() },
        { title: "Kind", dataIndex: "kind" },
        { title: "Mode", dataIndex: "mode" },
        { title: "Status", dataIndex: "status", render: (v: string) => <Tag color={STATUS_COLOR[v]}>{v.replace(/_/g, " ")}</Tag> },
        { title: "Read", dataIndex: "produced" },
        { title: "Added", dataIndex: "added" },
        { title: "Updated", dataIndex: "updated" },
        { title: "Unchanged", dataIndex: "unchanged" },
        { title: "Deleted", dataIndex: "deleted" },
        { title: "Failed", dataIndex: "failed", render: (v: number) => (v ? <Tag color="error">{v}</Tag> : 0) },
        { title: "Notes", render: (_: unknown, r: Run) => <span className="text-muted">{r.error || r.warning}</span> },
      ]} />
  );
}

export function typeIcon(type: string) {
  return type === "csv" ? <FileTextOutlined /> : type === "sap_c4c" ? <CloudServerOutlined /> : <DatabaseOutlined />;
}
