import { useCallback, useEffect, useState } from "react";
import { api, ApiError, getToken } from "./api";

type FieldSpec = { name: string; label: string; secret: boolean; required: boolean; help: string; default: unknown; choices: string[] | null; kind: string };
type ConnectorType = { type: string; label: string; fields: FieldSpec[] };
type Service = { id: string; name: string; service_type: string; config: Record<string, unknown>; secrets_set: string[]; tables: number };
type Column = { name: string; type: string; primary_key: boolean };
type Table = {
  id: string; service_id: string; schema_name: string; table_name: string; columns: Column[]; removed: boolean;
  master_enabled: boolean; column_map: Record<string, string | string[]>; cursor_column: string | null;
  watermark: string | null; last_ingested_at: string | null;
};
type Run = {
  id: string; table_id: string | null; service_id: string; kind: string; mode: string; status: string; produced: number;
  added: number; updated: number; unchanged: number; deleted: number; failed: number; warning: string; error: string; created_at: string;
};
type SourceRow = { source_system: string; records: number };
type Customer = { id: number; source_system: string; source_id: string; name: string; phone: string; email: string; city: string };

const CANONICAL = ["source_id", "name", "phone", "email", "city", "tax_id"] as const;
const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Request failed");
const canWrite = (role: string) => role === "admin" || role === "steward";

function ServiceForm({ types, onCreated }: { types: ConnectorType[]; onCreated: () => void }) {
  const [type, setType] = useState(types[0]?.type ?? "");
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const spec = types.find((t) => t.type === type);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const config: Record<string, string> = {};
    const secrets: Record<string, string> = {};
    spec?.fields.forEach((f) => {
      const v = values[f.name];
      if (v !== undefined && v !== "") (f.secret ? secrets : config)[f.name] = v;
    });
    try {
      await api("/api/v1/services", { method: "POST", body: JSON.stringify({ name, service_type: type, config, secrets }) });
      setName(""); setValues({}); onCreated();
    } catch (err) { setError(msg(err)); }
  };
  return (
    <form className="card stack" onSubmit={submit}>
      <h3>New service</h3>
      <div className="row">
        <label className="grow">Connector
          <select value={type} onChange={(e) => { setType(e.target.value); setValues({}); }}>
            {types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
        </label>
        <label className="grow">Name (used as the source system label)<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      </div>
      {spec?.fields.map((f) => (
        <label key={f.name}>{f.label}{f.required && <span className="req"> *</span>}
          {f.choices ? (
            <select value={values[f.name] ?? String(f.default ?? "")} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
              {f.choices.map((c) => <option key={c} value={c}>{c === "\t" ? "tab" : c}</option>)}
            </select>
          ) : (
            <input type={f.secret ? "password" : f.kind === "number" ? "number" : "text"} autoComplete="off"
              placeholder={f.default != null ? String(f.default) : ""} value={values[f.name] ?? ""}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
          )}
          {f.help && <span className="muted">{f.help}</span>}
        </label>
      ))}
      {error && <p className="error">{error}</p>}
      <div><button type="submit">Create service</button></div>
    </form>
  );
}

function Services({ role, onChange }: { role: string; onChange: () => void }) {
  const [types, setTypes] = useState<ConnectorType[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const load = useCallback(() => { api<Service[]>("/api/v1/services").then(setServices); }, []);
  useEffect(() => { load(); api<ConnectorType[]>("/api/v1/connector-types").then(setTypes); }, [load]);
  const say = (id: string, text: string) => setNote((n) => ({ ...n, [id]: text }));
  const act = async (s: Service, kind: "test" | "discover") => {
    say(s.id, "Working…");
    try {
      const r = await api<{ ok?: boolean; message?: string; status?: string; warning?: string; error?: string }>(`/api/v1/services/${s.id}/${kind}`, { method: "POST" });
      say(s.id, kind === "test" ? `${r.ok ? "✔" : "✖"} ${r.message}` : `Discovery ${r.status}${r.warning ? ` — ${r.warning}` : ""}${r.error ? ` — ${r.error}` : ""}`);
      load(); onChange();
    } catch (e) { say(s.id, msg(e)); }
  };
  const upload = async (s: Service, file: File | undefined) => {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/v1/services/${s.id}/files`, { method: "POST", body, headers: { Authorization: `Bearer ${getToken() ?? ""}` } });
    say(s.id, res.ok ? `Uploaded ${file.name}. Run Discover to see it.` : ((await res.json().catch(() => ({}))).detail ?? "Upload failed"));
  };
  const remove = async (s: Service) => {
    if (!confirm(`Delete service "${s.name}" and its catalog entries?`)) return;
    try { await api(`/api/v1/services/${s.id}`, { method: "DELETE" }); load(); onChange(); } catch (e) { say(s.id, msg(e)); }
  };
  return (
    <>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Tables</th><th>Status</th><th /></tr></thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td><td>{s.service_type}</td><td>{s.tables}</td><td className="muted">{note[s.id]}</td>
              <td>
                {role === "admin" && <button className="secondary" onClick={() => act(s, "test")}>Test</button>}{" "}
                {canWrite(role) && <button className="secondary" onClick={() => act(s, "discover")}>Discover</button>}{" "}
                {role === "admin" && s.service_type === "csv" && (
                  <label className="secondary" style={{ display: "inline" }}>
                    <input type="file" accept=".csv" hidden onChange={(e) => { upload(s, e.target.files?.[0]); e.target.value = ""; }} />
                    <span className="filebtn">Upload CSV</span>
                  </label>
                )}{" "}
                {role === "admin" && <button className="link" onClick={() => remove(s)}>Delete</button>}
              </td>
            </tr>
          ))}
          {services.length === 0 && <tr><td colSpan={5} className="muted">No services yet.</td></tr>}
        </tbody>
      </table>
      {role === "admin" && types.length > 0 && <ServiceForm types={types} onCreated={() => { load(); onChange(); }} />}
    </>
  );
}

function Register({ table, onDone }: { table: Table; onDone: () => void }) {
  const names = table.columns.map((c) => c.name);
  const init = (k: string) => (typeof table.column_map[k] === "string" ? (table.column_map[k] as string) : "");
  const [map, setMap] = useState<Record<string, string>>(Object.fromEntries(CANONICAL.map((k) => [k, init(k)])));
  const [cursor, setCursor] = useState(table.cursor_column ?? "");
  const [error, setError] = useState("");
  const save = async (enabled: boolean) => {
    setError("");
    const column_map: Record<string, string> = {};
    CANONICAL.forEach((k) => { if (map[k]) column_map[k] = map[k]; });
    try {
      await api(`/api/v1/tables/${table.id}/master`, { method: "PUT", body: JSON.stringify({ enabled, column_map, cursor_column: cursor || null }) });
      onDone();
    } catch (e) { setError(msg(e)); }
  };
  return (
    <div className="card stack">
      <strong>{table.table_name} — master source mapping</strong>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {CANONICAL.map((k) => (
          <label key={k}>{k}{(k === "source_id" || k === "name") && <span className="req"> *</span>}
            <select value={map[k]} onChange={(e) => setMap({ ...map, [k]: e.target.value })}>
              <option value="">—</option>{names.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        ))}
        <label>Cursor (incremental)
          <select value={cursor} onChange={(e) => setCursor(e.target.value)}><option value="">none</option>{names.map((n) => <option key={n}>{n}</option>)}</select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button onClick={() => save(true)}>{table.master_enabled ? "Update mapping" : "Register as master source"}</button>
        {table.master_enabled && <button className="secondary" onClick={() => save(false)}>Unregister</button>}
      </div>
    </div>
  );
}

function Tables({ role, onChange }: { role: string; onChange: () => void }) {
  const [tables, setTables] = useState<Table[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const load = useCallback(() => { api<Table[]>("/api/v1/tables").then(setTables); }, []);
  useEffect(load, [load]);
  const sync = async (t: Table, mode: "full" | "incremental") => {
    setNote("Sync started…");
    try {
      const r = await api<Run>(`/api/v1/tables/${t.id}/sync`, { method: "POST", body: JSON.stringify({ mode }) });
      setNote(`Sync ${r.id.slice(0, 8)} ${r.status}. See the Runs tab for the result.`);
      onChange();
    } catch (e) { setNote(msg(e)); }
  };
  return (
    <>
      {note && <p className="muted">{note}</p>}
      <table>
        <thead><tr><th>Table</th><th>Columns</th><th>Master</th><th>Watermark</th><th>Last ingested</th><th /></tr></thead>
        <tbody>
          {tables.map((t) => (
            <tr key={t.id}>
              <td>{t.schema_name ? `${t.schema_name}.` : ""}{t.table_name}</td><td>{t.columns.length}</td>
              <td>{t.master_enabled ? "registered" : "—"}</td><td>{t.watermark ?? "—"}</td>
              <td>{t.last_ingested_at ? new Date(t.last_ingested_at).toLocaleString() : "—"}</td>
              <td>
                {canWrite(role) && <button className="secondary" onClick={() => setOpen(open === t.id ? null : t.id)}>{t.master_enabled ? "Mapping" : "Register"}</button>}{" "}
                {canWrite(role) && t.master_enabled && <button onClick={() => sync(t, "full")}>Sync (full)</button>}{" "}
                {canWrite(role) && t.master_enabled && t.cursor_column && <button className="secondary" onClick={() => sync(t, "incremental")}>Incremental</button>}
              </td>
            </tr>
          ))}
          {tables.length === 0 && <tr><td colSpan={6} className="muted">No tables yet. Create a service and run Discover.</td></tr>}
        </tbody>
      </table>
      {tables.filter((t) => t.id === open).map((t) => <Register key={t.id} table={t} onDone={() => { setOpen(null); load(); onChange(); }} />)}
    </>
  );
}

function Runs({ refreshKey }: { refreshKey: number }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const load = useCallback(() => { api<Run[]>("/api/v1/sync-runs?limit=50").then(setRuns); }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    if (!runs.some((r) => ["queued", "running", "finalizing"].includes(r.status))) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [runs, load]);
  return (
    <table>
      <thead><tr><th>When</th><th>Kind</th><th>Mode</th><th>Status</th><th>Read</th><th>+</th><th>~</th><th>=</th><th>−</th><th>Failed</th><th>Notes</th></tr></thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id}>
            <td>{new Date(r.created_at).toLocaleString()}</td><td>{r.kind}</td><td>{r.mode}</td><td>{r.status}</td>
            <td>{r.produced}</td><td>{r.added}</td><td>{r.updated}</td><td>{r.unchanged}</td><td>{r.deleted}</td><td>{r.failed}</td>
            <td className="muted">{r.error || r.warning}</td>
          </tr>
        ))}
        {runs.length === 0 && <tr><td colSpan={11} className="muted">No runs yet.</td></tr>}
      </tbody>
    </table>
  );
}

function Records() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  useEffect(() => { api<SourceRow[]>("/api/v1/catalog/sources").then(setSources).catch(() => setSources([])); }, []);
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) setRows(await api<Customer[]>(`/api/v1/customers/search?q=${encodeURIComponent(q)}`));
  };
  return (
    <>
      <div className="chips">{sources.map((s) => <span key={s.source_system} className="chip">{s.source_system}: {s.records}</span>)}</div>
      <form onSubmit={search} className="row">
        <input placeholder="Search name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit">Search</button>
      </form>
      {rows.length > 0 && (
        <table>
          <thead><tr><th>Source</th><th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th>City</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.id}><td>{r.source_system}</td><td>{r.source_id}</td><td dir="auto">{r.name}</td><td>{r.phone}</td><td>{r.email}</td><td dir="auto">{r.city}</td></tr>)}
          </tbody>
        </table>
      )}
    </>
  );
}

export default function Catalog({ role }: { role: string }) {
  const [tab, setTab] = useState<"services" | "tables" | "runs" | "records">("services");
  const [key, setKey] = useState(0);
  const bump = () => setKey((k) => k + 1);
  return (
    <section>
      <h2>Catalog — mirrored sources</h2>
      <div className="tabs">
        {(["services", "tables", "runs", "records"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>
      {tab === "services" && <Services key={key} role={role} onChange={bump} />}
      {tab === "tables" && <Tables key={key} role={role} onChange={bump} />}
      {tab === "runs" && <Runs refreshKey={key} />}
      {tab === "records" && <Records key={key} />}
    </section>
  );
}
