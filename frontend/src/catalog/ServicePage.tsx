import { UploadOutlined } from "@ant-design/icons";
import { Alert, Button, Descriptions, Form, Modal, Popconfirm, Space, Spin, Tabs, Tag, Upload, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getToken } from "../api";
import { canWrite, fail } from "../ui";
import { FieldInput } from "./AddService";
import { ConnectorType, RunsList, Service, TablesList, typeIcon } from "./shared";

function Connection({ service, type, role, onSaved }: { service: Service; type?: ConnectorType; role: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  if (!type) return null;
  const save = async () => {
    const v = await form.validateFields();
    const config: Record<string, unknown> = {};
    const secrets: Record<string, unknown> = {};
    type.fields.forEach((f) => { const x = v[f.name]; if (x !== undefined && x !== null && x !== "") (f.secret ? secrets : config)[f.name] = x; });
    setBusy(true);
    try {
      await api(`/api/v1/services/${service.id}`, { method: "PUT", body: JSON.stringify({ config, secrets }) });
      message.success("Connection updated"); setEditing(false); onSaved();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  return (
    <>
      <Descriptions bordered column={1} size="small" labelStyle={{ width: 260 }}>
        {type.fields.map((f) => (
          <Descriptions.Item key={f.name} label={f.label}>
            {f.secret ? (service.secrets_set.includes(f.name) ? "••••••••" : <span className="text-muted">not set</span>) : String(service.config[f.name] ?? "—")}
          </Descriptions.Item>
        ))}
      </Descriptions>
      {role === "admin" && <Button style={{ marginTop: 16 }} onClick={() => { form.resetFields(); setEditing(true); }}>Edit connection</Button>}
      <Modal title="Edit connection" open={editing} onCancel={() => setEditing(false)} onOk={save} okText="Save" confirmLoading={busy} destroyOnClose maskClosable={false}>
        <Form form={form} layout="vertical" initialValues={service.config}>
          {type.fields.map((f) => (
            <Form.Item key={f.name} label={f.label} name={f.name} extra={f.secret ? "Leave empty to keep the stored value." : f.help} rules={[{ required: f.required && !f.secret }]}><FieldInput f={f} /></Form.Item>
          ))}
        </Form>
      </Modal>
    </>
  );
}

export default function ServicePage({ role }: { role: string }) {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [type, setType] = useState<ConnectorType>();
  const [missing, setMissing] = useState(false);
  const [key, setKey] = useState(0);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => {
    api<Service>(`/api/v1/services/${id}`).then((s) => {
      setService(s);
      api<ConnectorType[]>("/api/v1/connector-types").then((ts) => setType(ts.find((t) => t.type === s.service_type))).catch(() => undefined);
    }).catch(() => setMissing(true));
  }, [id]);
  useEffect(load, [load]);
  if (missing) return <div className="page-card"><Alert type="error" showIcon message="Service not found" action={<Link to="/catalog">Back to Catalog</Link>} /></div>;
  if (!service) return <div className="page-card"><Spin /></div>;

  const test = async () => {
    setBusy("test");
    try { const r = await api<{ ok: boolean; message: string }>(`/api/v1/services/${id}/test`, { method: "POST" }); (r.ok ? message.success : message.error)(r.message); }
    catch (e) { fail(e); } finally { setBusy(""); }
  };
  const discover = async () => {
    setBusy("discover");
    try {
      const r = await api<{ status: string; warning: string; error: string }>(`/api/v1/services/${id}/discover`, { method: "POST" });
      (r.status === "failed" ? message.error : r.warning ? message.warning : message.success)(`Discovery ${r.status.replace(/_/g, " ")}${r.warning ? ` — ${r.warning}` : ""}${r.error ? ` — ${r.error}` : ""}`);
      load(); setKey((k) => k + 1);
    } catch (e) { fail(e); } finally { setBusy(""); }
  };
  const upload = async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/v1/services/${id}/files`, { method: "POST", body, headers: { Authorization: `Bearer ${getToken() ?? ""}` } });
    if (res.ok) message.success(`Uploaded ${file.name}. Run Discover to see it.`);
    else message.error((await res.json().catch(() => ({}))).detail ?? "Upload failed");
  };
  const remove = async () => { try { await api(`/api/v1/services/${id}`, { method: "DELETE" }); message.success("Service deleted"); nav("/catalog"); } catch (e) { fail(e); } };

  return (
    <>
      <div className="page-card entity-header">
        <div className="crumbs"><Link to="/catalog">Catalog</Link> / <Link to="/catalog">Services</Link> / <span>{service.name}</span></div>
        <div className="entity-title">
          <div className="entity-icon">{typeIcon(service.service_type)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{service.name} <Tag>{type?.label ?? service.service_type}</Tag></h1>
            <p className="text-muted" style={{ margin: 0 }}>{service.description || "No description"}</p>
          </div>
          <Space wrap>
            {role === "admin" && <Button loading={busy === "test"} onClick={test}>Test Connection</Button>}
            {role === "admin" && service.service_type === "csv" && <Upload accept=".csv" showUploadList={false} beforeUpload={(f) => { upload(f); return false; }}><Button icon={<UploadOutlined />}>Upload CSV</Button></Upload>}
            {canWrite(role) && <Button type="primary" loading={busy === "discover"} onClick={discover}>Discover</Button>}
            {role === "admin" && <Popconfirm title={`Delete "${service.name}" and its catalog entries?`} okButtonProps={{ danger: true }} onConfirm={remove}><Button danger>Delete</Button></Popconfirm>}
          </Space>
        </div>
      </div>
      <div className="page-card">
        <Tabs destroyInactiveTabPane items={[
          { key: "tables", label: `Tables (${service.tables})`, children: <TablesList role={role} serviceId={service.id} refreshKey={key} onChange={load} /> },
          { key: "runs", label: "Runs", children: <RunsList serviceId={service.id} refreshKey={key} /> },
          { key: "connection", label: "Connection", children: <Connection service={service} type={type} role={role} onSaved={load} /> },
        ]} />
      </div>
    </>
  );
}
