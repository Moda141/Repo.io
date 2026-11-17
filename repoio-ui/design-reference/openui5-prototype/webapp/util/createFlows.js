sap.ui.define([
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Label",
	"sap/m/Input",
	"sap/m/TextArea",
	"sap/m/Select",
	"sap/m/MultiComboBox",
	"sap/m/StepInput",
	"sap/m/MessageStrip",
	"sap/m/List",
	"sap/m/StandardListItem",
	"sap/m/Text",
	"sap/ui/core/Item",
	"sap/ui/core/ListItem",
	"sap/ui/layout/form/SimpleForm",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"repoio/proto/util/people"
], function (Dialog, Button, Label, Input, TextArea, Select, MultiComboBox, StepInput, MessageStrip, List, StandardListItem, Text, Item,
	ListItem, SimpleForm, JSONModel, MessageToast, People) {
	"use strict";

	/* Create flows of Domain management (prototype). Each dialog validates on the client for guidance only; in the
	   product the domain, repository and connection APIs validate again and own the result. Nothing here writes
	   master data: a domain is a contract change requested for approval, a repository starts as a draft, and a data
	   source becomes a draft replication flow that only feeds the repository after it is deployed. */

	var CONN_SOURCE = { c4c: "c4c", hana: "s4", file: "csv" }; // connection type → catalogued source (sample data)
	var CONN_ICON = { c4c: "sap-icon://customer-briefing", hana: "sap-icon://database", mssql: "sap-icon://it-host", file: "sap-icon://excel-attachment" };

	var snakeUpper = function (s) { return String(s || "").normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase(); };

	function open(ctrl, oDlg, oModel) {
		oDlg.setModel(oModel, "d");
		oDlg.addStyleClass("repoioCreateDlg");
		ctrl.getView().addDependent(oDlg);
		oDlg.attachAfterClose(function () { oDlg.destroy(); });
		oDlg.open();
		return oDlg;
	}
	function vs(m, field, ok) { m.setProperty("/vs/" + field, ok ? "None" : "Error"); return ok; }
	function people(ctrl) {
		var en = ctrl.lang() === "en";
		return People.names().map(function (n) { var p = People.get(n); return { key: n, text: en ? p.en : n, sub: en ? p.role_en : p.role_ar }; });
	}

	return {
		/* Domains are a closed list in the data contract (repoio-spec, README §3). A new domain is therefore a request
		   that platform administrators approve together with a contract version, not an immediate create. */
		createDomain: function (ctrl, onDone) {
			var T = ctrl.text.bind(ctrl), D = ctrl.data(), ids = D.getProperty("/domains").map(function (d) { return d.id; }),
				m = new JSONModel({ nameAr: "", nameEn: "", tech: "", team: "", owner: "محمد", desc: "", icon: "sap-icon://database", vs: {},
					people: people(ctrl),
					icons: ["database", "customer", "supplier", "product", "employee", "retail-store", "course-book", "map-2", "contacts"]
						.map(function (i) { return { key: "sap-icon://" + i, text: T("cdom.icon." + i) }; }) });
			var auto = true;
			var oDlg = new Dialog({ title: T("cdom.title"), contentWidth: "36rem", resizable: true, draggable: true,
				content: [
					new MessageStrip({ text: T("cdom.rule"), type: "Warning", showIcon: true }).addStyleClass("sapUiSmallMargin"),
					new SimpleForm({ editable: true, layout: "ColumnLayout", columnsM: 1, columnsL: 1, columnsXL: 1, labelSpanL: 4, content: [
						new Label({ text: T("cdom.nameAr"), required: true }),
						new Input({ value: "{d>/nameAr}", valueState: "{d>/vs/nameAr}", textDirection: "RTL", maxLength: 60 }),
						new Label({ text: T("cdom.nameEn"), required: true }),
						new Input({ value: "{d>/nameEn}", valueState: "{d>/vs/nameEn}", textDirection: "LTR", maxLength: 60, liveChange: function (e) {
							if (auto) { m.setProperty("/tech", snakeUpper(e.getParameter("value")).toLowerCase()); } } }),
						new Label({ text: T("cdom.tech"), required: true }),
						new Input({ value: "{d>/tech}", valueState: "{d>/vs/tech}", valueStateText: T("cdom.v.tech"), textDirection: "LTR",
							liveChange: function () { auto = false; } }).addStyleClass("repoioMono"),
						new Label({ text: T("cdom.team") }),
						new Input({ value: "{d>/team}", placeholder: T("cdom.teamPh") }),
						new Label({ text: T("domain.owner"), required: true }),
						new Select({ selectedKey: "{d>/owner}", width: "100%", items: { path: "d>/people", template: new ListItem({ key: "{d>key}", text: "{d>text}", additionalText: "{d>sub}" }) },
							showSecondaryValues: true }),
						new Label({ text: T("cdom.icon") }),
						new Select({ selectedKey: "{d>/icon}", width: "100%", items: { path: "d>/icons", template: new ListItem({ key: "{d>key}", text: "{d>text}", icon: "{d>key}" }) } }),
						new Label({ text: T("cdom.desc") }),
						new TextArea({ value: "{d>/desc}", rows: 3, width: "100%", maxLength: 300, placeholder: T("cdom.descPh") })
					] })
				],
				beginButton: new Button({ text: T("cdom.submit"), type: "Emphasized", press: function () {
					var v = m.getData(), ok = [vs(m, "nameAr", !!v.nameAr.trim()), vs(m, "nameEn", !!v.nameEn.trim()),
						vs(m, "tech", /^[a-z][a-z0-9_]{2,30}$/.test(v.tech) && ids.indexOf(v.tech) < 0)].every(Boolean);
					if (!ok) { return; }
					var req = "DR-2026-" + String(7 + Math.floor(Math.random() * 90)).padStart(4, "0");
					oDlg.close();
					MessageToast.show(T("cdom.t.sent", [req]));
					if (onDone) { onDone({ id: req, name: ctrl.lang() === "ar" ? v.nameAr : v.nameEn, tech: v.tech, owner: v.owner }); }
				} }),
				endButton: new Button({ text: T("common.cancel"), press: function () { oDlg.close(); } })
			});
			return open(ctrl, oDlg, m);
		},

		/* A repository starts as a draft inside its domain (ADR-0001). Next steps: add data sources, create its match
		   model in Models & rules, then publish. */
		createRepository: function (ctrl, domainId, onDone) {
			var T = ctrl.text.bind(ctrl), D = ctrl.data(), repos = D.getProperty("/repos"),
				d = D.getProperty("/domains").filter(function (x) { return x.id === domainId; })[0],
				codes = Object.keys(repos).map(function (k) { return repos[k].code; }),
				m = new JSONModel({ name: "", code: "", desc: "", owners: [d.owner], prefix: "GR-" + domainId.charAt(0).toUpperCase() + "-", cap: 100000,
					tags: [], vs: {}, people: people(ctrl), domainText: ctrl.domainName(d),
					tagOpts: ["PII", "Tier 1", "Tier 2", "Tier 3"].map(function (t) { return { key: t, text: t }; }) });
			var auto = true, setCode = function (name) {
				var c = snakeUpper(name);
				if (!/^[A-Z]/.test(c)) { c = snakeUpper(d.nameEn) + "_REPO_" + (d.repos.length + 1); }
				m.setProperty("/code", c);
			};
			var oDlg = new Dialog({ title: T("crepo.title"), contentWidth: "36rem", resizable: true, draggable: true,
				content: [
					new MessageStrip({ text: T("crepo.note"), type: "Information", showIcon: true }).addStyleClass("sapUiSmallMargin"),
					new SimpleForm({ editable: true, layout: "ColumnLayout", columnsM: 1, columnsL: 1, columnsXL: 1, content: [
						new Label({ text: T("domains.col.domain") }),
						new Text({ text: "{d>/domainText}" }),
						new Label({ text: T("crepo.name"), required: true }),
						new Input({ value: "{d>/name}", valueState: "{d>/vs/name}", maxLength: 60, liveChange: function (e) { if (auto) { setCode(e.getParameter("value")); } } }),
						new Label({ text: T("dsp.technicalName"), required: true }),
						new Input({ value: "{d>/code}", valueState: "{d>/vs/code}", valueStateText: T("crepo.v.code"), textDirection: "LTR",
							liveChange: function () { auto = false; } }).addStyleClass("repoioMono"),
						new Label({ text: T("repo.owners"), required: true }),
						new MultiComboBox({ selectedKeys: "{d>/owners}", valueState: "{d>/vs/owners}", width: "100%",
							items: { path: "d>/people", template: new Item({ key: "{d>key}", text: "{d>text}" }) } }),
						new Label({ text: T("crepo.prefix") }),
						new Input({ value: "{d>/prefix}", textDirection: "LTR", maxLength: 12 }).addStyleClass("repoioMono"),
						new Label({ text: T("crepo.cap") }),
						new StepInput({ value: "{d>/cap}", min: 1000, max: 100000000, step: 50000, width: "12rem" }),
						new Label({ text: T("cat.tags") }),
						new MultiComboBox({ selectedKeys: "{d>/tags}", width: "100%", items: { path: "d>/tagOpts", template: new Item({ key: "{d>key}", text: "{d>text}" }) } }),
						new Label({ text: T("cdom.desc") }),
						new TextArea({ value: "{d>/desc}", rows: 2, width: "100%", maxLength: 300 })
					] })
				],
				beginButton: new Button({ text: T("crepo.create"), type: "Emphasized", press: function () {
					var v = m.getData(), ok = [vs(m, "name", !!v.name.trim()), vs(m, "code", /^[A-Z][A-Z0-9_]{2,40}$/.test(v.code) && codes.indexOf(v.code) < 0),
						vs(m, "owners", v.owners.length > 0)].every(Boolean);
					if (!ok) { return; }
					var id = v.code.toLowerCase().replace(/_/g, "-");
					while (repos[id]) { id += "-2"; }
					repos[id] = { id: id, domainId: d.id, domainName: d.name, name: v.name.trim(), code: v.code, status: "Draft", statusKey: "draft",
						healthState: "Information", healthKey: "draft", desc: v.desc, prefix: v.prefix,
						owners: v.owners.map(function (n) { return { name: n, initials: (People.get(n) || {}).initials || n.slice(0, 2) }; }),
						tags: v.tags, model: "—", golden: 0, quality: null, qualityState: "None", deployed: "", sourceIds: [], cap: v.cap, pipes: 0, flow: [],
						sourceRows: [], goldenRecords: [] };
					d.repos.push(id);
					d.repoCount = d.repos.length;
					d.repoNames = (d.repoNames || []).concat([{ id: id, name: v.name.trim(), healthState: "Information", healthKey: "draft", golden: 0 }]);
					D.refresh(true);
					oDlg.close();
					MessageToast.show(T("crepo.t.created", [v.name.trim()]));
					if (onDone) { onDone(id); }
				} }),
				endButton: new Button({ text: T("common.cancel"), press: function () { oDlg.close(); } })
			});
			return open(ctrl, oDlg, m);
		},

		/* Adds a source to a repository from an admin-managed connection (Connections hub). It becomes a draft
		   replication flow in Data sync (J15); records only arrive after the flow is deployed and its first run
		   passes the quality checks. */
		addDataSource: function (ctrl, repoId, onDone) {
			var T = ctrl.text.bind(ctrl), D = ctrl.data(), r = D.getProperty("/repos/" + repoId), sources = D.getProperty("/sources"), en = ctrl.lang() === "en",
				conns = (D.getProperty("/connections") || []).map(function (c) {
					var sid = CONN_SOURCE[c.type] || null, used = sid && r.sourceIds.indexOf(sid) > -1;
					return { key: c.id, text: (en ? c.nameEn : c.name) + (used ? " — " + T("cds.already") : ""), sid: sid, state: c.state, used: used,
						icon: CONN_ICON[c.type] || "sap-icon://connected", type: c.type, enabled: !used };
				}),
				first = conns.filter(function (c) { return c.enabled; })[0],
				m = new JSONModel({ conn: first ? first.key : "", conns: conns, objects: [], prio: r.sourceRows.length + 1, max: r.sourceRows.length + 1,
					load: "initialDelta", paused: false, noCatalog: false, vs: {} });
			var refresh = function () {
				var c = conns.filter(function (x) { return x.key === m.getProperty("/conn"); })[0] || {}, S = c.sid ? sources[c.sid] : null;
				m.setProperty("/paused", c.state === "paused");
				m.setProperty("/noCatalog", !S);
				m.setProperty("/objects", S ? S.tables.map(function (t) {
					return { key: t.schema + "." + t.id, title: t.name, desc: t.schema + " / " + t.id, info: ctrl.fmt.num(t.rows) + " " + T("repo.rows"), selected: false };
				}) : []);
			};
			refresh();
			var oList = new List({ mode: "MultiSelect", includeItemNavigation: false, growing: true, growingThreshold: 8, noDataText: T("cds.noObjects"),
				items: { path: "d>/objects", template: new StandardListItem({ title: "{d>title}", description: "{d>desc}", info: "{d>info}", selected: "{d>selected}",
					icon: "sap-icon://table-view" }) } }).addStyleClass("repoioCdsList");
			var oDlg = new Dialog({ title: T("cds.title", [r.name]), contentWidth: "38rem", resizable: true, draggable: true,
				content: [
					new SimpleForm({ editable: true, layout: "ColumnLayout", columnsM: 1, columnsL: 1, columnsXL: 1, content: [
						new Label({ text: T("cds.conn"), required: true }),
						new Select({ selectedKey: "{d>/conn}", width: "100%", valueState: "{d>/vs/conn}", change: refresh,
							items: { path: "d>/conns", template: new ListItem({ key: "{d>key}", text: "{d>text}", icon: "{d>icon}", enabled: "{d>enabled}" }) } }),
						new Label({ text: T("rp.prio") + " (" + T("cds.prioHint") + ")" }),
						new StepInput({ value: "{d>/prio}", min: 1, max: "{d>/max}", width: "8rem" }),
						new Label({ text: T("cds.load") }),
						new Select({ selectedKey: "{d>/load}", width: "100%", items: [
							new Item({ key: "initialDelta", text: T("cds.load.initialDelta") }), new Item({ key: "initial", text: T("cds.load.initial") })] })
					] }),
					new MessageStrip({ text: T("cds.paused"), type: "Warning", showIcon: true, visible: "{d>/paused}" }).addStyleClass("sapUiSmallMarginBeginEnd sapUiTinyMarginBottom"),
					new MessageStrip({ text: T("cds.noCatalog"), type: "Information", showIcon: true, visible: "{d>/noCatalog}" }).addStyleClass("sapUiSmallMarginBeginEnd sapUiTinyMarginBottom"),
					new Label({ text: T("cds.objects"), required: true, visible: "{= !${d>/noCatalog} }" }).addStyleClass("sapUiSmallMarginBeginEnd"),
					oList,
					new MessageStrip({ text: T("cds.note"), type: "Information", showIcon: true }).addStyleClass("sapUiSmallMargin")
				],
				beginButton: new Button({ text: T("cds.add"), type: "Emphasized", press: function () {
					var v = m.getData(), c = conns.filter(function (x) { return x.key === v.conn; })[0], picked = v.objects.filter(function (o) { return o.selected; });
					if (!vs(m, "conn", !!c && c.enabled)) { return; }
					if (!v.noCatalog && !picked.length) { MessageToast.show(T("cds.v.objects")); return; }
					var sid = c.sid || ("src-" + c.key.toLowerCase()), S = sources[sid],
						rows = S ? S.tables.filter(function (t) { return picked.some(function (p) { return p.key === t.schema + "." + t.id; }); }) : [];
					rows.forEach(function (t) { if (!t.usedIn.some(function (u) { return u.id === r.id; })) { t.usedIn.push({ id: r.id, name: r.name }); } });
					r.sourceRows.forEach(function (s) { if (s.priority >= v.prio) { s.priority += 1; } });
					r.sourceRows.push({ id: sid, name: S ? S.name : c.text, host: S ? S.host : "—", type: S ? S.type : c.type, priority: v.prio, tables: rows.length,
						rows: rows.reduce(function (a, t) { return a + t.rows; }, 0), quality: null, qualityState: "None", contributes: 0, goldenCount: 0,
						sync: "—", state: "None", pending: true });
					r.sourceIds.push(sid);
					D.refresh(true);
					oDlg.close();
					MessageToast.show(T("cds.t.added", [S ? S.name : c.text]));
					if (onDone) { onDone(sid); }
				} }),
				endButton: new Button({ text: T("common.cancel"), press: function () { oDlg.close(); } })
			});
			return open(ctrl, oDlg, m);
		}
	};
});
