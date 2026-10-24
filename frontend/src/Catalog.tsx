import { UploadOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Tooltip, Upload } from "antd";
import { useCallback, useEffect, useState } from "react";
import { api, getToken } from "./api";
import { canWrite, fail, PageTitle } from "./ui";

type FieldSpec = { name: string; label: string; secret: boolean; required: boolean; help: string; default: unknown; choices: string[] | null; kind: string };
type ConnectorType = { type: string; label: string; fields: FieldSpec[] };
type Service = { id: string; name: string; service_type: string; config: Record<string, unknown>; secrets_set: string[]; tables: number };
type Column = { name: string; type: string; primary_key: boolean };
type Table_ = {
  id: string; service_id: string; schema_name: string; table_name: string; columns: Column[]; removed: boolean;
  master_enabled: boolean; column_map: Record<string, string | string[]>; cursor_column: string | null;
  watermark: string | null; last_ingested_at: string | null;
};
type Run = {
  id: string; table_id: string | null; kind: string; mode: string; status: string; produced: number; added: number; updated: number;
  unchanged: number; deleted: number; failed: number; warning: string; error: string; created_at: string;
};
type Customer = { id: number; source_system: string; source_id: string; name: string; phone: string; email: string; city: string };

const CANONICAL = ["source_id", "name", "phone", "email", "city", "tax_id"] as const;
const STATUS_COLOR: Record<string, string> = { completed: "success", completed_with_warnings: "warning", failed: "error", running: "processing", queued: "default", finalizing: "processing" };

function NewService({ types, open, onClose, onCreated }: { types: ConnectorType[]; open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form] = Form.useForm();
  const [type, setType] = useState(types[0]?.type ?? "");
  useEffect(() => { if (!type && types.length) setType(types[0].type); }, [types, type]);
  const spec = types.find((t) => t.type === type);
  const submit = async (v: Record<string, unknown>) => {
    const config: Record<string, unknown> = {};
    const secrets: Record<string, unknown> = {};
    spec?.fields.forEach((f) => {
      const val = v[f.name];
      if (val !== undefined && val !== null && val !== "") (f.secret ? secrets : config)[f.name] = val;
    });
    try {
      await api("/api/v1/services", { method: "POST", body: JSON.stringify({ name: v.__name, service_type: type, config, secrets }) });
      form.resetFields(); onCreated(); onClose();
    } catch (e) { fail(e); }
  };
  return (
    <Modal title="Add New Service" open={open} onCancel={onClose} onOk={() => form.submit()} okText="Create" destroyOnClose width={560}>
      <Form form={form} layout="vertical" onFinish={submit} key={type}>
        <Form.Item label="Service type">
          <Select value={type} onChange={(v) => { setType(v); form.resetFields(); }} options={types.map((t) => ({ value: t.type, label: t.label }))} />
        </Form.Item>
        <Form.Item label="Name (used as the source system label)" name="__name" rules={[{ required: true, pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/, message: "Letters, digits, - or _" }]}><Input /></Form.Item>
        {spec?.fields.map((f) => (
          <Form.Item key={f.name} label={f.label} name={f.name} extra={f.help} initialValue={f.default ?? undefined} rules={[{ required: f.required }]}>
            {f.choices ? <Select options={f.choices.map((c) => ({ value: c, label: c === "\t" ? "tab" : c }))} />
              : f.secret ? <Input.Password autoComplete="new-password" />
              : f.kind === "number" ? <InputNumber style={{ width: "100%" }} /> : <Input />}
          </Form.Item>
        ))}
      </Form>
    </Modal>
  );
}

function Services({ role, onChange }: { role: string; onChange: () => void }) {
  const [types, setTypes] = useState<ConnectorType[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string>("");
  const load = useCallback(() => { api<Service[]>("/api/v1/services").then(setServices).catch(fail); }, []);
  useEffect(() => { load(); api<ConnectorType[]>("/api/v1/connector-types").then(setTypes).catch(fail); }, [load]);
  const act = async (s: Service, kind: "test" | "discover") => {
    setBusy(s.id + kind);
    try {
      const r = await api<{ ok?: boolean; message?: string; status?: string; warning?: string; error?: string }>(`/api/v1/services/${s.id}/${kind}`, { method: "POST" });
      if (kind === "test") (r.ok ? message.success : message.error)(r.message);
      else (r.status === "failed" ? message.error : r.warning ? message.warning : message.success)(`Discovery ${r.status}${r.warning ? ` — ${r.warning}` : ""}${r.error ? ` — ${r.error}` : ""}`);
      load(); onChange();
    } catch (e) { fail(e); } finally { setBusy(""); }
  };
  const upload = async (s: Service, file: File) => {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/v1/services/${s.id}/files`, { method: "POST", body, headers: { Authorization: `Bearer ${getToken() ?? ""}` } });
    if (res.ok) message.success(`Uploaded ${file.name}. Run Discover to see it.`);
    else message.error((await res.json().catch(() => ({}))).detail ?? "Upload failed");
  };
  const remove = async (s: Service) => { try { await api(`/api/v1/services/${s.id}`, { method: "DELETE" }); load(); onChange(); } catch (e) { fail(e); } };
  return (
    <>
      {role === "admin" && <div style={{ textAlign: "right", marginBottom: 12 }}><Button type="primary" onClick={() => setAdding(true)}>Add New Service</Button></div>}
      <Table rowKey="id" dataSource={services} pagination={false} locale={{ emptyText: "No services yet." }} columns={[
        { title: "Name", dataIndex: "name" },
        { title: "Type", dataIndex: "service_type", render: (v) => <Tag>{v}</Tag> },
        { title: "Tables", dataIndex: "tables" },
        { title: "", align: "right", render: (_, s) => (
          <Space>
            {role === "admin" && <Button loading={busy === s.id + "test"} onClick={() => act(s, "test")}>Test connection</Button>}
            {canWrite(role) && <Button loading={busy === s.id + "discover"} onClick={() => act(s, "discover")}>Discover</Button>}
            {role === "admin" && s.service_type === "csv" && <Upload accept=".csv" showUploadList={false} beforeUpload={(f) => { upload(s, f); return false; }}><Button icon={<UploadOutlined />}>Upload CSV</Button></Upload>}
            {role === "admin" && <Popconfirm title={`Delete "${s.name}" and its catalog entries?`} onConfirm={() => remove(s)}><Button danger type="link">Delete</Button></Popconfirm>}
          </Space>) },
      ]} />
      <NewService types={types} open={adding} onClose={() => setAdding(false)} onCreated={() => { load(); onChange(); }} />
    </>
  );
}

function Register({ table, onClose, onDone }: { table: Table_; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm();
  const opts = table.columns.map((c) => ({ value: c.name, label: c.name }));
  const initial = Object.fromEntries(CANONICAL.map((k) => [k, typeof table.column_map[k] === "string" ? table.column_map[k] : undefined]));
  const save = async (enabled: boolean) => {
    const v = enabled ? await form.validateFields() : form.getFieldsValue();
    const column_map: Record<string, string> = {};
    CANONICAL.forEach((k) => { if (v[k]) column_map[k] = v[k]; });
    try {
      await api(`/api/v1/tables/${table.id}/master`, { method: "PUT", body: JSON.stringify({ enabled, column_map, cursor_column: v.cursor || null }) });
      onDone();
    } catch (e) { fail(e); }
  };
  return (
    <Modal open title={`Master source mapping — ${table.table_name}`} onCancel={onClose} width={560}
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

function Tables({ role, onChange }: { role: string; onChange: () => void }) {
  const [tables, setTables] = useState<Table_[]>([]);
  const [open, setOpen] = useState<Table_ | null>(null);
  const load = useCallback(() => { api<Table_[]>("/api/v1/tables").then(setTables).catch(fail); }, []);
  useEffect(load, [load]);
  const sync = async (t: Table_, mode: "full" | "incremental") => {
    try {
      await api<Run>(`/api/v1/tables/${t.id}/sync`, { method: "POST", body: JSON.stringify({ mode }) });
      message.info("Sync started. Follow it in the Runs tab.");
      onChange();
    } catch (e) { fail(e); }
  };
  return (
    <>
      <Table rowKey="id" dataSource={tables} pagination={{ pageSize: 20, hideOnSinglePage: true }} locale={{ emptyText: "No tables yet. Add a service and run Discover." }} columns={[
        { title: "Table", render: (_, t) => `${t.schema_name ? `${t.schema_name}.` : ""}${t.table_name}` },
        { title: "Columns", render: (_, t) => <Tooltip title={t.columns.map((c) => c.name).join(", ")}>{t.columns.length}</Tooltip> },
        { title: "Master source", render: (_, t) => (t.master_enabled ? <Tag color="success">registered</Tag> : <Tag>not registered</Tag>) },
        { title: "Watermark", dataIndex: "watermark", render: (v) => v ?? "—" },
        { title: "Last ingested", dataIndex: "last_ingested_at", render: (v) => (v ? new Date(v).toLocaleString() : "—") },
        { title: "", align: "right", render: (_, t) => canWrite(role) && (
          <Space>
            <Button onClick={() => setOpen(t)}>{t.master_enabled ? "Mapping" : "Register"}</Button>
            {t.master_enabled && <Button type="primary" onClick={() => sync(t, "full")}>Sync (full)</Button>}
            {t.master_enabled && t.cursor_column && <Button onClick={() => sync(t, "incremental")}>Incremental</Button>}
          </Space>) },
      ]} />
      {open && <Register table={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load(); onChange(); }} />}
    </>
  );
}

function Runs({ refreshKey }: { refreshKey: number }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const load = useCallback(() => { api<Run[]>("/api/v1/sync-runs?limit=50").then(setRuns).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    if (!runs.some((r) => ["queued", "running", "finalizing"].includes(r.status))) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [runs, load]);
  return (
    <Table rowKey="id" dataSource={runs} pagination={{ pageSize: 20, hideOnSinglePage: true }} locale={{ emptyText: "No runs yet." }} columns={[
      { title: "When", dataIndex: "created_at", render: (v) => new Date(v).toLocaleString() },
      { title: "Kind", dataIndex: "kind" },
      { title: "Mode", dataIndex: "mode" },
      { title: "Status", dataIndex: "status", render: (v) => <Tag color={STATUS_COLOR[v]}>{v.replaceAll("_", " ")}</Tag> },
      { title: "Read", dataIndex: "produced" },
      { title: "Added", dataIndex: "added" },
      { title: "Updated", dataIndex: "updated" },
      { title: "Unchanged", dataIndex: "unchanged" },
      { title: "Deleted", dataIndex: "deleted" },
      { title: "Failed", dataIndex: "failed", render: (v) => (v ? <Tag color="error">{v}</Tag> : 0) },
      { title: "Notes", render: (_, r) => <span className="text-muted">{r.error || r.warning}</span> },
    ]} />
  );
}

function Records() {
  const [sources, setSources] = useState<{ source_system: string; records: number }[]>([]);
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => { api<typeof sources>("/api/v1/catalog/sources").then(setSources).catch(() => setSources([])); }, []);
  const search = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try { setRows(await api<Customer[]>(`/api/v1/customers/search?q=${encodeURIComponent(q)}`)); } catch (e) { fail(e); } finally { setLoading(false); }
  };
  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>{sources.map((s) => <Tag key={s.source_system} color="blue">{s.source_system}: {s.records}</Tag>)}</Space>
      <Input.Search placeholder="Search name, phone or email" enterButton onSearch={search} loading={loading} style={{ maxWidth: 480, display: "flex", marginBottom: 12 }} />
      <Table rowKey="id" dataSource={rows} pagination={{ pageSize: 25, hideOnSinglePage: true }} columns={[
        { title: "Source", dataIndex: "source_system" }, { title: "ID", dataIndex: "source_id" },
        { title: "Name", dataIndex: "name", render: (v) => <span dir="auto">{v}</span> },
        { title: "Phone", dataIndex: "phone" }, { title: "Email", dataIndex: "email" },
        { title: "City", dataIndex: "city", render: (v) => <span dir="auto">{v}</span> },
      ]} />
    </>
  );
}

export default function Catalog({ role }: { role: string }) {
  const [key, setKey] = useState(0);
  const bump = () => setKey((k) => k + 1);
  return (
    <div className="page-card">
      <PageTitle title="Catalog" sub="Mirror of the data coming from your sources. Register a table as a master source to ingest its records." />
      {role === "viewer" && <Alert type="info" showIcon style={{ marginBottom: 12 }} message="You have read-only access." />}
      <Tabs destroyInactiveTabPane items={[
        { key: "services", label: "Services", children: <Services key={key} role={role} onChange={bump} /> },
        { key: "tables", label: "Tables", children: <Tables key={key} role={role} onChange={bump} /> },
        { key: "runs", label: "Runs", children: <Runs refreshKey={key} /> },
        { key: "records", label: "Records", children: <Records /> },
      ]} />
    </div>
  );
}
