import { PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Input, Select, Space, Table, Tabs, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { fail, PageTitle } from "../ui";
import { ConnectorType, RunsList, Service, TablesList, typeIcon } from "./shared";

function ServicesTable({ role }: { role: string }) {
  const nav = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [types, setTypes] = useState<ConnectorType[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<Service[]>("/api/v1/services").then(setServices).catch(fail).finally(() => setLoading(false));
    api<ConnectorType[]>("/api/v1/connector-types").then(setTypes).catch(() => undefined);
  }, []);
  const label = (t: string) => types.find((x) => x.type === t)?.label ?? t;
  const rows = useMemo(
    () => services.filter((s) => (!type || s.service_type === type) && (!q || `${s.name} ${s.description}`.toLowerCase().includes(q.toLowerCase()))),
    [services, q, type],
  );
  return (
    <>
      <div className="list-toolbar">
        <Space wrap>
          <Input.Search allowClear placeholder="Search services" style={{ width: 280 }} onChange={(e) => setQ(e.target.value)} />
          <Select allowClear placeholder="Service type" style={{ width: 200 }} value={type} onChange={setType} options={types.map((t) => ({ value: t.type, label: t.label }))} />
        </Space>
        {role === "admin" && <Button type="primary" icon={<PlusOutlined />} onClick={() => nav("/catalog/add-service")} data-testid="add-service">Add New Service</Button>}
      </div>
      <Table<Service> rowKey="id" loading={loading} dataSource={rows} pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{ emptyText: services.length ? "No service matches the filters." : role === "admin" ? "No services yet. Click “Add New Service” to connect a source." : "No services yet." }}
        columns={[
          { title: "Name", sorter: (a, b) => a.name.localeCompare(b.name), render: (_, s) => <Space>{typeIcon(s.service_type)}<Link to={`/catalog/services/${s.id}`}>{s.name}</Link></Space> },
          { title: "Type", dataIndex: "service_type", render: (v: string) => <Tag>{label(v)}</Tag> },
          { title: "Description", dataIndex: "description", ellipsis: true, render: (v: string) => v || <span className="text-muted">No description</span> },
          { title: "Tables", dataIndex: "tables", sorter: (a, b) => a.tables - b.tables },
          { title: "Records", dataIndex: "records", sorter: (a, b) => a.records - b.records },
        ]} />
    </>
  );
}

export default function ServicesPage({ role }: { role: string }) {
  return (
    <div className="page-card">
      <PageTitle title="Catalog" sub="Mirror of the data coming from your sources. Connect a service, discover its tables, then register a table as a master source." />
      {role === "viewer" && <Alert type="info" showIcon style={{ marginBottom: 12 }} message="You have read-only access." />}
      <Tabs destroyInactiveTabPane items={[
        { key: "services", label: "Services", children: <ServicesTable role={role} /> },
        { key: "tables", label: "Tables", children: <TablesList role={role} /> },
        { key: "runs", label: "Runs", children: <RunsList /> },
      ]} />
    </div>
  );
}
