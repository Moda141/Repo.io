import { CheckCircleFilled, CloseCircleFilled } from "@ant-design/icons";
import { Alert, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Steps, message } from "antd";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { fail, PageTitle } from "../ui";
import { ConnectorType, FieldSpec, typeIcon } from "./shared";

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
type TestResult = { ok: boolean; message: string };

function split(spec: ConnectorType, values: Record<string, unknown>) {
  const config: Record<string, unknown> = {};
  const secrets: Record<string, unknown> = {};
  spec.fields.forEach((f) => {
    const v = values[f.name];
    if (v !== undefined && v !== null && v !== "") (f.secret ? secrets : config)[f.name] = v;
  });
  return { config, secrets };
}

type CtrlProps = { id?: string; value?: unknown; onChange?: (v: unknown) => void };

/** Form.Item injects id/value/onChange into its direct child, so this wrapper must forward them. */
export function FieldInput({ f, ...p }: { f: FieldSpec } & CtrlProps) {
  if (f.choices) return <Select id={p.id} value={p.value as string | undefined} onChange={p.onChange} options={f.choices.map((c) => ({ value: c, label: c === "\t" ? "tab" : c }))} />;
  if (f.secret) return <Input.Password id={p.id} value={p.value as string | undefined} onChange={(e) => p.onChange?.(e.target.value)} autoComplete="new-password" />;
  if (f.kind === "number") return <InputNumber id={p.id} style={{ width: "100%" }} value={p.value as number | undefined} onChange={(v) => p.onChange?.(v)} />;
  return <Input id={p.id} value={p.value as string | undefined} onChange={(e) => p.onChange?.(e.target.value)} />;
}

/** Same flow as OpenMetadata's Add Service: select type, configure (name, description), connection details with Test Connection. */
export default function AddService() {
  const nav = useNavigate();
  const [types, setTypes] = useState<ConnectorType[]>([]);
  const [step, setStep] = useState(0);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [basics] = Form.useForm();
  const [conn] = Form.useForm();
  useEffect(() => { api<ConnectorType[]>("/api/v1/connector-types").then(setTypes).catch(fail); }, []);
  const spec = types.find((t) => t.type === type);

  const next = async () => {
    if (step === 0) { if (!type) { message.warning("Select a service type"); return; } setStep(1); }
    else if (step === 1) { await basics.validateFields(); setStep(2); }
  };
  const runTest = async () => {
    if (!spec) return;
    try { await conn.validateFields(); } catch { return; }
    setTesting(true); setTest(null);
    try { setTest(await api<TestResult>(`/api/v1/connector-types/${spec.type}/test`, { method: "POST", body: JSON.stringify(split(spec, conn.getFieldsValue())) })); }
    catch (e) { fail(e); } finally { setTesting(false); }
  };
  const save = async () => {
    if (!spec) return;
    await conn.validateFields();
    const b = basics.getFieldsValue();
    setSaving(true);
    try {
      const s = await api<{ id: string }>("/api/v1/services", { method: "POST", body: JSON.stringify({ name: b.name, description: b.description ?? "", service_type: spec.type, ...split(spec, conn.getFieldsValue()) }) });
      message.success("Service created");
      api(`/api/v1/services/${s.id}/discover`, { method: "POST" }).then(() => undefined, () => undefined).finally(() => nav(`/catalog/services/${s.id}`));
    } catch (e) { fail(e); setSaving(false); }
  };

  const shown = types.filter((t) => `${t.label} ${t.type}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="page-card">
      <div className="crumbs"><Link to="/catalog">Catalog</Link> / <span>Add New Service</span></div>
      <PageTitle title="Add New Service" />
      <Row gutter={32}>
        <Col xs={24} md={6}>
          <Steps direction="vertical" current={step} size="small" items={[{ title: "Select Service Type" }, { title: "Configure Service" }, { title: "Connection Details" }]} />
        </Col>
        <Col xs={24} md={18}>
          {step === 0 && (
            <>
              <Input.Search allowClear placeholder="Search service types" style={{ maxWidth: 360, marginBottom: 16 }} onChange={(e) => setSearch(e.target.value)} />
              <Row gutter={[16, 16]}>
                {shown.map((t) => (
                  <Col key={t.type} xs={24} sm={12} lg={8}>
                    <Card hoverable className={`type-card ${type === t.type ? "selected" : ""}`} onClick={() => setType(t.type)} data-testid={`type-${t.type}`}>
                      <div className="type-icon">{typeIcon(t.type)}</div>
                      <div className="type-name">{t.label}</div>
                    </Card>
                  </Col>
                ))}
                {shown.length === 0 && <Col span={24} className="text-muted">No service type matches.</Col>}
              </Row>
            </>
          )}
          <Form form={basics} layout="vertical" style={{ display: step === 1 ? "block" : "none", maxWidth: 560 }}>
            <Form.Item label="Service Name" name="name" extra="Used as the source system label on every record from this service." rules={[{ required: true, pattern: NAME_RE, message: "Letters, digits, - or _ (max 64), starting with a letter or digit" }]}><Input /></Form.Item>
            <Form.Item label="Description" name="description"><Input.TextArea rows={4} maxLength={1024} showCount /></Form.Item>
          </Form>
          <Form form={conn} layout="vertical" style={{ display: step === 2 ? "block" : "none", maxWidth: 560 }} onValuesChange={() => setTest(null)} key={type}>
            {spec?.fields.map((f) => (
              <Form.Item key={f.name} label={f.label} name={f.name} extra={f.help} initialValue={f.default ?? undefined} rules={[{ required: f.required }]}><FieldInput f={f} /></Form.Item>
            ))}
            <Space>
              <Button onClick={runTest} loading={testing}>Test Connection</Button>
              {test && (test.ok
                ? <span style={{ color: "var(--ant-success-color)" }}><CheckCircleFilled /> {test.message}</span>
                : <span style={{ color: "var(--ant-error-color)" }}><CloseCircleFilled /> {test.message}</span>)}
            </Space>
            {test && !test.ok && <Alert style={{ marginTop: 12 }} type="warning" showIcon message="The connection test failed. You can still save the service and fix the settings later." />}
          </Form>
          <div className="wizard-footer">
            <Button onClick={() => (step === 0 ? nav("/catalog") : setStep(step - 1))}>{step === 0 ? "Cancel" : "Back"}</Button>
            {step < 2 ? <Button type="primary" onClick={next}>Next</Button> : <Button type="primary" loading={saving} onClick={save}>Save</Button>}
          </div>
        </Col>
      </Row>
    </div>
  );
}
