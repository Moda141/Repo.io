import { useCallback, useEffect, useState } from "react";
import { api, ApiError, getToken, setToken } from "./api";
import Catalog from "./Catalog";
import Tickets from "./Tickets";

type Me = { id: string; email: string; display_name: string; role: string };
type TokenRow = { id: string; name: string; token_type: string; expires_at: string | null; revoked: boolean; created_at: string };
type Health = { status: string; checks: Record<string, { ok: boolean; error?: string }> };

const TABS = [
  { id: "catalog", label: "Catalog", milestone: "" },
  { id: "tasks", label: "Tasks", milestone: "M4" },
  { id: "customer360", label: "Customer 360", milestone: "M3" },
  { id: "golden", label: "Golden Records", milestone: "M3" },
  { id: "dq", label: "Data Quality", milestone: "M4" },
  { id: "sql", label: "SQL Editor", milestone: "M4" },
  { id: "tickets", label: "Tickets", milestone: "" },
  { id: "insights", label: "Data Insights", milestone: "M5.5" },
  { id: "settings", label: "Settings", milestone: "" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const r = await api<{ access_token: string }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setToken(r.access_token);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    }
  };
  return (
    <form className="card login" onSubmit={submit}>
      <img className="login-logo" src="/logo.svg" alt="Repo.io" />
      <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
      {error && <p className="error">{error}</p>}
      <button type="submit">Sign in</button>
    </form>
  );
}

function Settings({ me }: { me: Me }) {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [name, setName] = useState("");
  const [days, setDays] = useState(30);
  const [fresh, setFresh] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const load = useCallback(() => { api<TokenRow[]>("/api/v1/tokens").then(setTokens); }, []);
  useEffect(() => { load(); api<Health>("/api/v1/health").then(setHealth).catch(() => setHealth(null)); }, [load]);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api<TokenRow & { token: string }>("/api/v1/tokens", { method: "POST", body: JSON.stringify({ name, expires_in_days: days }) });
    setFresh(r.token); setName(""); load();
  };
  const revoke = async (id: string) => { await api(`/api/v1/tokens/${id}`, { method: "DELETE" }); load(); };
  return (
    <section>
      <h2>Settings</h2>
      <h3>Access Tokens</h3>
      <p className="muted">Signed in as {me.email} ({me.role}). A personal access token inherits your permissions and is shown only once.</p>
      <form onSubmit={create} className="row">
        <input placeholder="Token name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} title="Expires in days" />
        <button type="submit">Generate New Token</button>
      </form>
      {fresh && <pre className="token">{fresh}</pre>}
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Expires</th><th>Status</th><th /></tr></thead>
        <tbody>
          {tokens.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td><td>{t.token_type}</td><td>{t.expires_at ? new Date(t.expires_at).toLocaleDateString() : "never"}</td>
              <td>{t.revoked ? "revoked" : "active"}</td>
              <td>{!t.revoked && <button onClick={() => revoke(t.id)}>Revoke</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Health Check</h3>
      {health ? (
        <ul>{Object.entries(health.checks).map(([k, v]) => <li key={k}>{k}: {v.ok ? "working" : `failing — ${v.error ?? ""}`}</li>)}</ul>
      ) : <p className="muted">Unavailable</p>}
      <p className="muted">Roles & Policies and Preferences arrive in M5.</p>
    </section>
  );
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<TabId>("catalog");
  const refresh = useCallback(() => {
    if (!getToken()) { setMe(null); setChecked(true); return; }
    api<Me>("/api/v1/auth/me").then(setMe).catch(() => { setToken(null); setMe(null); }).finally(() => setChecked(true));
  }, []);
  useEffect(refresh, [refresh]);
  if (!checked) return null;
  if (!me) return <Login onDone={refresh} />;
  const current = TABS.find((t) => t.id === tab)!;
  return (
    <div className="shell">
      <nav>
        <div className="brand"><img src="/monogram.svg" alt="" width={30} height={30} /><h1>Repo.io</h1></div>
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? "active" : ""} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
        <button className="signout" onClick={() => { setToken(null); setMe(null); }}>Sign out</button>
      </nav>
      <main>
        {tab === "catalog" ? <Catalog role={me.role} /> : tab === "settings" ? <Settings me={me} /> : tab === "tickets" ? <Tickets role={me.role} /> : (
          <section><h2>{current.label}</h2><p className="muted">Planned for milestone {current.milestone}.</p></section>
        )}
      </main>
    </div>
  );
}
