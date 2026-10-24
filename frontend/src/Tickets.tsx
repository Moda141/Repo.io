import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Form, Input, InputNumber, Select, Space, Table, Tabs, Tag, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { canWrite, fail, PageTitle } from "./ui";

type Domain = { id: string; name: string; description: string };
type FieldDef = { key: string; label: string; type: string; required: boolean; options: string[]; help: string };
type Template = {
  id: string; name: string; description: string; domain_id: string; domain_name: string;
  request_type: string; fields: FieldDef[]; is_active: boolean;
};
type TicketRow = { id: string; template_name: string; domain_name: string; requester_email: string; status: string; created_at: string };

const FIELD_TYPES = ["text", "textarea", "number", "email", "phone", "date", "select", "boolean"];
const blankField = (): FieldDef => ({ key: "", label: "", type: "text", required: false, options: [], help: "" });
/** Keys must be latin identifiers; derive one from a latin label, otherwise the user types it. */
const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1");

function TemplateBuilder({ domains, onCreated }: { domains: Domain[]; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domainId, setDomainId] = useState("");
  const [fields, setFields] = useState<FieldDef[]>([{ ...blankField(), label: "Name", key: "name", required: true }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!domainId && domains.length) setDomainId(domains[0].id); }, [domains, domainId]);
  const update = (i: number, patch: Partial<FieldDef>) => setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const submit = async () => {
    setError(""); setBusy(true);
    try {
      await api("/api/v1/ticket-templates", {
        method: "POST",
        body: JSON.stringify({ name, description, domain_id: domainId, request_type: "new_customer", fields }),
      });
      message.success("Template saved");
      setName(""); setDescription(""); setFields([{ ...blankField(), label: "Name", key: "name", required: true }]);
      onCreated();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Request failed"); } finally { setBusy(false); }
  };

  return (
    <div className="page-card">
      <Form layout="vertical" onFinish={submit}>
        <Space align="start" wrap style={{ width: "100%" }}>
          <Form.Item label="Template name" required><Input style={{ width: 320 }} value={name} onChange={(e) => setName(e.target.value)} dir="auto" /></Form.Item>
          <Form.Item label="Domain" required>
            <Select style={{ width: 240 }} value={domainId || undefined} onChange={setDomainId} options={domains.map((d) => ({ value: d.id, label: d.name }))} />
          </Form.Item>
        </Space>
        <Form.Item label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} dir="auto" /></Form.Item>
        <Table<FieldDef & { _i: number }>
          size="small" pagination={false} rowKey="_i" dataSource={fields.map((f, i) => ({ ...f, _i: i }))}
          columns={[
            { title: "Label", render: (_, f, i) => <Input dir="auto" value={f.label} onChange={(e) => update(i, { label: e.target.value, key: f.key && f.key !== slug(f.label) ? f.key : slug(e.target.value) })} /> },
            { title: "Key", render: (_, f, i) => <Input value={f.key} onChange={(e) => update(i, { key: e.target.value })} placeholder="lowercase_key" /> },
            { title: "Type", width: 140, render: (_, f, i) => <Select style={{ width: "100%" }} value={f.type} onChange={(v) => update(i, { type: v })} options={FIELD_TYPES.map((t) => ({ value: t }))} /> },
            { title: "Options (comma separated)", render: (_, f, i) => <Input disabled={f.type !== "select"} value={f.options.join(", ")} onChange={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /> },
            { title: "Mandatory", width: 100, align: "center", render: (_, f, i) => <Checkbox checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} /> },
            { title: "", width: 50, render: (_, __, i) => <Button type="text" danger icon={<DeleteOutlined />} disabled={fields.length === 1} onClick={() => setFields((fs) => fs.filter((_x, idx) => idx !== i))} /> },
          ]}
        />
        <Space style={{ marginTop: 12 }}>
          <Button icon={<PlusOutlined />} onClick={() => setFields((fs) => [...fs, blankField()])}>Add field</Button>
          <Button type="primary" htmlType="submit" loading={busy}>Save template</Button>
        </Space>
        <p className="text-muted">Mandatory fields must be filled to submit a ticket; optional fields can be left empty. At least one field must be mandatory.</p>
        {error && <Alert type="error" showIcon message={error} />}
      </Form>
    </div>
  );
}

function TicketForm({ template, onDone }: { template: Template; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));

  const submit = async () => {
    setErrors({}); setBusy(true);
    const data: Record<string, unknown> = {};
    for (const f of template.fields) {
      const v = values[f.key];
      if (v === undefined || v === "" || v === null) continue; // optional + empty: omit
      data[f.key] = f.type === "number" ? Number(v) : v;
    }
    try {
      await api("/api/v1/tickets", { method: "POST", body: JSON.stringify({ template_id: template.id, data }) });
      setValues({}); message.success("Ticket submitted"); onDone();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      fail(err);
    } finally { setBusy(false); }
  };

  return (
    <div className="page-card">
      <h3 style={{ marginTop: 0 }}>{template.name} <Tag color="blue">{template.domain_name}</Tag></h3>
      {template.description && <p className="text-muted">{template.description}</p>}
      <Form layout="vertical" onFinish={submit}>
        {template.fields.map((f) => {
          const v = values[f.key];
          let input: React.ReactNode;
          if (f.type === "textarea") input = <Input.TextArea dir="auto" rows={3} value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} />;
          else if (f.type === "select") input = <Select allowClear value={(v as string) || undefined} onChange={(x) => set(f.key, x)} options={f.options.map((o) => ({ value: o }))} />;
          else if (f.type === "boolean") input = <Checkbox checked={Boolean(v)} onChange={(e) => set(f.key, e.target.checked)} />;
          else if (f.type === "number") input = <InputNumber className="full-width" value={v as number | null | undefined} onChange={(x) => set(f.key, x)} />;
          else input = <Input dir="auto" type={f.type === "date" ? "date" : f.type === "email" ? "email" : "text"} value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} />;
          return (
            <Form.Item
              key={f.key}
              label={<span dir="auto">{f.label}{!f.required && <span className="text-muted"> (optional)</span>}</span>}
              required={f.required} extra={f.help || undefined}
              validateStatus={errors[f.key] ? "error" : undefined} help={errors[f.key]}
            >{input}</Form.Item>
          );
        })}
        <Button type="primary" htmlType="submit" loading={busy}>Submit ticket</Button>
      </Form>
    </div>
  );
}

export default function Tickets({ role }: { role: string }) {
  const manage = canWrite(role);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selected, setSelected] = useState<string>();
  const [tab, setTab] = useState("new");

  const load = useCallback(() => {
    api<Domain[]>("/api/v1/domains").then(setDomains).catch(() => setDomains([]));
    api<Template[]>("/api/v1/ticket-templates").then(setTemplates).catch(() => setTemplates([]));
    api<TicketRow[]>("/api/v1/tickets").then(setTickets).catch(() => setTickets([]));
  }, []);
  useEffect(load, [load]);
  const current = templates.find((t) => t.id === selected);

  const newRequest = (
    <>
      <div className="page-card">
        <Form layout="vertical">
          <Form.Item label="Request template" style={{ marginBottom: 0 }}>
            <Select
              style={{ maxWidth: 480 }} placeholder="Choose a template…" value={selected} onChange={setSelected}
              options={domains.map((d) => ({ label: d.name, options: templates.filter((t) => t.domain_id === d.id).map((t) => ({ value: t.id, label: t.name })) })).filter((g) => g.options.length)}
            />
          </Form.Item>
        </Form>
        {templates.length === 0 && <p className="text-muted" style={{ marginTop: 12 }}>No templates yet.{manage ? " Create one from the “Create template” tab." : " Ask a steward to create one."}</p>}
      </div>
      {current && <TicketForm key={current.id} template={current} onDone={load} />}
    </>
  );

  return (
    <>
      <div className="page-card">
        <PageTitle title="Tickets" sub="Requests for new records, built from templates that define each domain's mandatory and optional fields." />
        <Tabs
          activeKey={tab} onChange={setTab}
          items={[
            { key: "new", label: "New request", children: newRequest },
            ...(manage ? [{ key: "template", label: "Create template", children: <TemplateBuilder domains={domains} onCreated={() => { load(); setTab("new"); }} /> }] : []),
          ]}
        />
      </div>
      <div className="page-card">
        <h3 style={{ marginTop: 0 }}>{manage ? "All tickets" : "My tickets"}</h3>
        <Table<TicketRow>
          rowKey="id" size="middle" dataSource={tickets} pagination={{ pageSize: 10, hideOnSinglePage: true }}
          columns={[
            { title: "Template", dataIndex: "template_name", render: (v: string) => <span dir="auto">{v}</span> },
            { title: "Domain", dataIndex: "domain_name" },
            { title: "Requester", dataIndex: "requester_email" },
            { title: "Status", dataIndex: "status", render: (v: string) => <Tag>{v}</Tag> },
            { title: "Created", dataIndex: "created_at", render: (v: string) => new Date(v).toLocaleString() },
          ]}
        />
      </div>
    </>
  );
}
