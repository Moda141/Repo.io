import { Alert, Button, Form, Input, InputNumber, Popconfirm, Table, Tabs, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Me } from "./App";
import { fail, PageTitle } from "./ui";

type TokenRow = { id: string; name: string; token_type: string; expires_at: string | null; revoked: boolean; created_at: string };
type Health = { status: string; checks: Record<string, { ok: boolean; error?: string }> };

function Tokens({ me }: { me: Me }) {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [fresh, setFresh] = useState("");
  const load = useCallback(() => { api<TokenRow[]>("/api/v1/tokens").then(setTokens).catch(fail); }, []);
  useEffect(load, [load]);
  const create = async (v: { name: string; days: number }) => {
    try {
      const r = await api<TokenRow & { token: string }>("/api/v1/tokens", { method: "POST", body: JSON.stringify({ name: v.name, expires_in_days: v.days }) });
      setFresh(r.token); load();
    } catch (e) { fail(e); }
  };
  const revoke = async (id: string) => { try { await api(`/api/v1/tokens/${id}`, { method: "DELETE" }); load(); } catch (e) { fail(e); } };
  return (
    <>
      <p className="text-muted">Signed in as {me.email} ({me.role}). A personal access token inherits your permissions and is shown only once.</p>
      <Form layout="inline" onFinish={create} initialValues={{ days: 30 }} style={{ marginBottom: 16 }}>
        <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="Token name" /></Form.Item>
        <Form.Item name="days" tooltip="Expires in days"><InputNumber min={1} max={365} addonAfter="days" /></Form.Item>
        <Button type="primary" htmlType="submit">Generate New Token</Button>
      </Form>
      {fresh && <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="Copy this token now; it will not be shown again" description={<div className="token-box">{fresh}</div>} closable onClose={() => setFresh("")} />}
      <Table rowKey="id" size="middle" dataSource={tokens} pagination={false} columns={[
        { title: "Name", dataIndex: "name" },
        { title: "Type", dataIndex: "token_type" },
        { title: "Expires", dataIndex: "expires_at", render: (v) => (v ? new Date(v).toLocaleDateString() : "never") },
        { title: "Status", dataIndex: "revoked", render: (v) => <Tag color={v ? "default" : "success"}>{v ? "revoked" : "active"}</Tag> },
        { title: "", render: (_, t) => !t.revoked && <Popconfirm title="Revoke this token?" onConfirm={() => revoke(t.id)}><Button danger type="link">Revoke</Button></Popconfirm> },
      ]} />
    </>
  );
}

function HealthCheck() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => { api<Health>("/api/v1/health").then(setHealth).catch(() => setHealth(null)); }, []);
  if (!health) return <p className="text-muted">Unavailable</p>;
  return (
    <Table rowKey="k" pagination={false} dataSource={Object.entries(health.checks).map(([k, v]) => ({ k, ...v }))} columns={[
      { title: "Check", dataIndex: "k" },
      { title: "Status", dataIndex: "ok", render: (ok) => <Tag color={ok ? "success" : "error"}>{ok ? "working" : "failing"}</Tag> },
      { title: "Details", dataIndex: "error" },
    ]} />
  );
}

export default function Settings({ me }: { me: Me }) {
  return (
    <div className="page-card">
      <PageTitle title="Settings" />
      <Tabs items={[
        { key: "tokens", label: "Access Tokens", children: <Tokens me={me} /> },
        { key: "health", label: "Health Check", children: <HealthCheck /> },
        { key: "roles", label: "Roles & Policies", children: <Alert type="info" showIcon message="Planned for milestone M5" /> },
        { key: "prefs", label: "Preferences", children: <Alert type="info" showIcon message="Planned for milestone M5" /> },
      ]} />
    </div>
  );
}
