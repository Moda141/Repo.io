import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

type Domain = { id: string; name: string; description: string };
type FieldDef = { key: string; label: string; type: string; required: boolean; options: string[]; help: string };
type Template = {
  id: string; name: string; description: string; domain_id: string; domain_name: string;
  request_type: string; fields: FieldDef[]; is_active: boolean;
};
type TicketRow = {
  id: string; template_name: string; domain_name: string; requester_email: string;
  status: string; data: Record<string, unknown>; created_at: string;
};

const FIELD_TYPES = ["text", "textarea", "number", "email", "phone", "date", "select", "boolean"];

const blankField = (): FieldDef => ({ key: "", label: "", type: "text", required: false, options: [], help: "" });

/** Keys must be latin identifiers; derive one from a latin label, otherwise the user types it. */
const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1");

const errorText = (err: unknown): string => {
  if (err instanceof ApiError) return err.message;
  return "Request failed";
};

function TemplateBuilder({ domains, onCreated }: { domains: Domain[]; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domainId, setDomainId] = useState("");
  const [fields, setFields] = useState<FieldDef[]>([{ ...blankField(), label: "Name", key: "name", required: true }]);
  const [error, setError] = useState("");

  useEffect(() => { if (!domainId && domains.length) setDomainId(domains[0].id); }, [domains, domainId]);

  const update = (i: number, patch: Partial<FieldDef>) =>
    setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/v1/ticket-templates", {
        method: "POST",
        body: JSON.stringify({ name, description, domain_id: domainId, request_type: "new_customer", fields }),
      });
      setName(""); setDescription(""); setFields([{ ...blankField(), label: "Name", key: "name", required: true }]);
      onCreated();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <form onSubmit={submit} className="card stack">
      <h3>Create template</h3>
      <div className="row">
        <label className="grow">Template name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Domain
          <select value={domainId} onChange={(e) => setDomainId(e.target.value)} required>
            {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      </div>
      <label>Description<input value={description} onChange={(e) => setDescription(e.target.value)} /></label>

      <table className="fields">
        <thead><tr><th>Label</th><th>Key</th><th>Type</th><th>Options (comma separated)</th><th>Mandatory</th><th /></tr></thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={i}>
              <td><input dir="auto" value={f.label} required onChange={(e) => update(i, { label: e.target.value, key: f.key && f.key !== slug(f.label) ? f.key : slug(e.target.value) })} /></td>
              <td><input value={f.key} required pattern="[a-z][a-z0-9_]*" title="lowercase latin letters, digits, underscores" onChange={(e) => update(i, { key: e.target.value })} /></td>
              <td>
                <select value={f.type} onChange={(e) => update(i, { type: e.target.value })}>
                  {FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </td>
              <td><input disabled={f.type !== "select"} required={f.type === "select"} value={f.options.join(", ")} onChange={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></td>
              <td className="center"><input type="checkbox" checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} /></td>
              <td><button type="button" className="link" disabled={fields.length === 1} onClick={() => setFields((fs) => fs.filter((_, idx) => idx !== i))}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button type="button" className="secondary" onClick={() => setFields((fs) => [...fs, blankField()])}>Add field</button>
        <button type="submit">Save template</button>
      </div>
      <p className="muted">Mandatory fields must be filled to submit a ticket; optional fields can be left empty. At least one field must be mandatory.</p>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function TicketForm({ template, onDone }: { template: Template; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({}); setMessage("");
    const data: Record<string, unknown> = {};
    for (const f of template.fields) {
      const v = values[f.key];
      if (v === undefined || v === "") continue; // optional + empty: omit
      data[f.key] = f.type === "number" ? Number(v) : v;
    }
    try {
      await api("/api/v1/tickets", { method: "POST", body: JSON.stringify({ template_id: template.id, data }) });
      setValues({}); setMessage("Ticket submitted"); onDone();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setMessage(errorText(err));
    }
  };

  return (
    <form onSubmit={submit} className="card stack">
      <h3>{template.name} <span className="chip">{template.domain_name}</span></h3>
      {template.description && <p className="muted">{template.description}</p>}
      {template.fields.map((f) => (
        <label key={f.key}>
          <span dir="auto">{f.label}{f.required && <b className="req"> *</b>}{!f.required && <span className="muted"> (optional)</span>}</span>
          {f.type === "textarea" ? (
            <textarea dir="auto" value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
          ) : f.type === "select" ? (
            <select value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">—</option>
              {f.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : f.type === "boolean" ? (
            <input type="checkbox" checked={Boolean(values[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
          ) : (
            <input
              dir="auto"
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : "text"}
              value={String(values[f.key] ?? "")}
              onChange={(e) => set(f.key, e.target.value)}
            />
          )}
          {errors[f.key] && <span className="error">{errors[f.key]}</span>}
        </label>
      ))}
      <div className="row"><button type="submit">Submit ticket</button></div>
      {message && <p className={Object.keys(errors).length ? "error" : "muted"}>{message}</p>}
    </form>
  );
}

export default function Tickets({ role }: { role: string }) {
  const canManage = role === "admin" || role === "steward";
  const [domains, setDomains] = useState<Domain[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<"new" | "template">("new");

  const load = useCallback(() => {
    api<Domain[]>("/api/v1/domains").then(setDomains).catch(() => setDomains([]));
    api<Template[]>("/api/v1/ticket-templates").then(setTemplates).catch(() => setTemplates([]));
    api<TicketRow[]>("/api/v1/tickets").then(setTickets).catch(() => setTickets([]));
  }, []);
  useEffect(load, [load]);

  const current = templates.find((t) => t.id === selected);

  return (
    <section>
      <h2>Tickets</h2>
      <div className="tabs">
        <button className={mode === "new" ? "on" : ""} onClick={() => setMode("new")}>New request</button>
        {canManage && <button className={mode === "template" ? "on" : ""} onClick={() => setMode("template")}>Create template</button>}
      </div>

      {mode === "template" && canManage ? (
        <TemplateBuilder domains={domains} onCreated={() => { load(); setMode("new"); }} />
      ) : (
        <>
          <label>Request template
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Choose a template…</option>
              {domains.map((d) => (
                <optgroup key={d.id} label={d.name}>
                  {templates.filter((t) => t.domain_id === d.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {templates.length === 0 && <p className="muted">No templates yet.{canManage ? " Create one from the “Create template” tab." : " Ask a steward to create one."}</p>}
          {current && <TicketForm key={current.id} template={current} onDone={load} />}
        </>
      )}

      <h3>{canManage ? "All tickets" : "My tickets"}</h3>
      <table>
        <thead><tr><th>Template</th><th>Domain</th><th>Requester</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id}><td dir="auto">{t.template_name}</td><td>{t.domain_name}</td><td>{t.requester_email}</td><td>{t.status}</td><td>{new Date(t.created_at).toLocaleString()}</td></tr>
          ))}
          {tickets.length === 0 && <tr><td colSpan={5} className="muted">No tickets yet.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
