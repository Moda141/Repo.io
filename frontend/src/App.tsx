import {
  BarChartOutlined, BellOutlined, CheckSquareOutlined, CodeOutlined, ContactsOutlined, DatabaseOutlined, FileTextOutlined,
  LogoutOutlined, SafetyCertificateOutlined, SettingOutlined, StarOutlined, UserOutlined,
} from "@ant-design/icons";
import { AutoComplete, Button, Card, Dropdown, Empty, Form, Input, Modal, Tag } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, getToken, setToken } from "./api";
import Catalog from "./Catalog";
import Settings from "./Settings";
import Tickets from "./Tickets";
import { PageTitle } from "./ui";

export type Me = { id: string; email: string; display_name: string; role: string };
type Hit = { id: number; source_system: string; source_id: string; name: string; phone: string };

const TABS = [
  { id: "catalog", label: "Catalog", icon: <DatabaseOutlined />, milestone: "" },
  { id: "tasks", label: "Tasks", icon: <CheckSquareOutlined />, milestone: "M4" },
  { id: "customer360", label: "Customer 360", icon: <ContactsOutlined />, milestone: "M3" },
  { id: "golden", label: "Golden Records", icon: <StarOutlined />, milestone: "M3" },
  { id: "dq", label: "Data Quality", icon: <SafetyCertificateOutlined />, milestone: "M4" },
  { id: "sql", label: "SQL Editor", icon: <CodeOutlined />, milestone: "M4" },
  { id: "tickets", label: "Tickets", icon: <FileTextOutlined />, milestone: "" },
  { id: "insights", label: "Data Insights", icon: <BarChartOutlined />, milestone: "M5.5" },
] as const;
type TabId = (typeof TABS)[number]["id"] | "settings";

function Login({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (v: { email: string; password: string }) => {
    setError(""); setBusy(true);
    try {
      const r = await api<{ access_token: string }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(v) });
      setToken(r.access_token);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally { setBusy(false); }
  };
  return (
    <div className="login-wrap">
      <Card className="login-card">
        <img src="/logo.svg" alt="Repo.io" />
        <Form layout="vertical" onFinish={submit} initialValues={{ email: "admin@example.com" }}>
          <Form.Item label="Email" name="email" rules={[{ required: true }]}><Input autoComplete="username" size="large" /></Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true }]} validateStatus={error ? "error" : undefined} help={error || undefined}>
            <Input.Password autoComplete="current-password" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={busy}>Login</Button>
        </Form>
      </Card>
    </div>
  );
}

/** Global search in the header, like OpenMetadata's: type and get suggestions across mirrored records. */
function GlobalSearch() {
  const [options, setOptions] = useState<{ value: string; label: React.ReactNode }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onSearch = (q: string) => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setOptions([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const hits = await api<Hit[]>(`/api/v1/customers/search?q=${encodeURIComponent(q)}&limit=8`);
        setOptions(hits.map((h) => ({
          value: `${h.id}`,
          label: <div><div dir="auto"><b>{h.name}</b></div><div className="text-muted">{h.source_system} · {h.source_id}{h.phone ? ` · ${h.phone}` : ""}</div></div>,
        })));
      } catch { setOptions([]); }
    }, 250);
  };
  return (
    <div className="search-container">
      <AutoComplete options={options} onSearch={onSearch} style={{ width: "100%" }} dropdownMatchSelectWidth>
        <Input.Search placeholder="Search for customers by name, phone or email" allowClear />
      </AutoComplete>
    </div>
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

  const logout = () => Modal.confirm({ title: "Logout", content: "Are you sure you want to logout?", okText: "Logout", onOk: () => { setToken(null); setMe(null); } });
  const current = TABS.find((t) => t.id === tab);
  const item = (id: TabId, label: string, icon: React.ReactNode, soon = "") => (
    <button key={id} className={`nav-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)} data-testid={`sidebar-${id}`}>
      {icon}<span>{label}</span>{soon && <span className="soon">{soon}</span>}
    </button>
  );
  return (
    <div className="app-container">
      <aside className="app-sidebar">
        <div className="logo-container"><img src="/monogram.svg" alt="Repo.io" /></div>
        <div className="menu-container">
          <div className="top-menu">{TABS.map((t) => item(t.id, t.label, t.icon, t.milestone))}</div>
          <div className="bottom-menu">
            {item("settings", "Settings", <SettingOutlined />)}
            <button className="nav-item" onClick={logout}><LogoutOutlined /><span>Logout</span></button>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-navbar-header">
          <div className="navbar-container">
            <GlobalSearch />
            <div className="nav-bar-side-items">
              <BellOutlined style={{ fontSize: 20 }} title="Notifications" />
              <Dropdown trigger={["click"]} menu={{ items: [
                { key: "who", label: <div><b>{me.display_name || me.email}</b><div className="text-muted">{me.email}</div></div>, disabled: true },
                { key: "settings", label: "Settings", icon: <SettingOutlined />, onClick: () => setTab("settings") },
                { key: "logout", label: "Logout", icon: <LogoutOutlined />, onClick: logout },
              ] }}>
                <div className="app-user-icon"><UserOutlined style={{ fontSize: 20 }} /><span className="username">{me.display_name || me.email}</span><Tag>{me.role}</Tag></div>
              </Dropdown>
            </div>
          </div>
        </header>
        <main className="app-content">
          {tab === "catalog" ? <Catalog role={me.role} /> : tab === "tickets" ? <Tickets role={me.role} />
            : tab === "settings" ? <Settings me={me} />
            : (
              <div className="page-card">
                <PageTitle title={current?.label ?? ""} />
                <Empty description={`Planned for milestone ${current?.milestone}`} />
              </div>
            )}
        </main>
      </div>
    </div>
  );
}
