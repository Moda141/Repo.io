sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/flowModel",
	"repoio/proto/util/people",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/TextArea",
	"sap/m/ResponsivePopover",
	"sap/m/List",
	"sap/m/StandardListItem",
	"sap/m/MessagePopover",
	"sap/m/MessageItem",
	"sap/m/MessageStrip",
	"sap/m/VBox",
	"sap/ui/model/json/JSONModel"
], function (BaseController, Flow, People, MessageToast, MessageBox, Dialog, Button, TextArea, ResponsivePopover, List, StandardListItem,
	MessagePopover, MessageItem, MessageStrip, VBox, JSONModel) {
	"use strict";

	/*
	 * New workflow (J7) — Repo.io flow designer (ADR-0002). Nodes: Begin, Template, Approval, Notification,
	 * Script, Validation, Write-back, Condition, End. The flow compiles to BPMN 2.0 for Flowable; the engine,
	 * versioning and audit are unchanged. Sample directory, templates, allowlists and rules (prototype only).
	 */
	var TEAMS = [
		{ key: "customer_stewards", en: "Customer data stewards", ar: "أمناء بيانات العملاء", members: ["سارة عادل"] },
		{ key: "vendor_stewards", en: "Vendor data stewards", ar: "أمناء بيانات الموردين", members: ["هالة سمير", "عمر طارق"] },
		{ key: "product_stewards", en: "Product data stewards", ar: "أمناء بيانات المنتجات", members: ["كريم فوزي", "نور الدين"] },
		{ key: "data_management", en: "Data management", ar: "إدارة البيانات", members: ["محمد", "أحمد ناصر"] },
		{ key: "governance_board", en: "Data governance board", ar: "مجلس حوكمة البيانات", members: ["محمد", "سارة عادل", "هالة سمير", "كريم فوزي"] }
	];
	var NODE_ICON = {
		begin: "sap-icon://media-play", template: "sap-icon://form", approval: "sap-icon://approvals", notification: "sap-icon://bell",
		script: "sap-icon://syntax", validation: "sap-icon://validate", writeBack: "sap-icon://upload-to-cloud", condition: "sap-icon://split", end: "sap-icon://stop"
	};
	var SIZE = { begin: { w: 104, h: 40 }, end: { w: 132, h: 40 }, script: { w: 236, h: 140 }, card: { w: 236, h: 116 } };
	var VARIABLES = ["request.id", "request.title", "requester.name", "decision", "comment", "record.business_name", "link"];
	var SQL_SAMPLE = "-- Read-only: runs through Trino with your grants.\n-- :field placeholders come from the template.\nSELECT master_id, business_name, tax_number\nFROM golden.customer\nWHERE tax_number = :tax_number\n  AND master_id <> :customer_id";
	var PY_SAMPLE = "# record: the request fields from the template.\n# Return ok(record) to continue, or fail(field, message).\ndef run(record):\n    name = (record[\"business_name\"] or \"\").strip()\n    record[\"business_name\"] = \" \".join(name.split())\n    if record[\"country\"] == \"EG\" and not record[\"tax_number\"]:\n        return fail(\"tax_number\", \"Tax number is required in Egypt\")\n    return ok(record)\n";

	return BaseController.extend("repoio.proto.controller.WorkflowDesigner", {

		onInit: function () {
			this.router().getRoute("workflow").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			if (this._flow) { return; }
			var that = this, oData = this.data();
			var start = function () { that._initModel(); that._loadExample(); };
			if (oData.dataLoaded) { oData.dataLoaded().then(start); } else { start(); }
		},

		_initModel: function () {
			var that = this, ar = this.lang() === "ar", W = this.data().getProperty("/workflow");
			this._W = W;
			this.viewModel().setProperty("/wf", {
				name: "", tech: "", domain: "", owner: "محمد", desc: "", version: 1, state: "draft", readOnly: false, dirty: false,
				canUndo: false, canRedo: false, showProps: true, rtl: this.isRtl(), canvas: { nodes: [], edges: [], width: 0, height: 0 },
				sel: {}, steps: [], issues: [], issueCount: 0,
				versions: [{ v: 1, state: "draft", stateText: this.text("onto.state.draft"), date: this.text("wf.notSaved") }],
				templates: W.templates.map(function (t) {
					return { key: t.key, text: ar ? t.ar : t.en, domain: t.domain, domainText: that._domainText(t.domain), version: "v" + t.version };
				}),
				people: People.names().map(function (n) { var p = People.get(n); return { key: n, text: ar ? n : p.en, role: ar ? p.role_ar : p.role_en }; }),
				teams: TEAMS.map(function (t) { return { key: t.key, text: ar ? t.ar : t.en, count: that.text("wf.members", [t.members.length]) }; }),
				escalation: [{ key: "", text: this.text("wf.none"), group: "" }].concat(TEAMS.map(function (t) {
					return { key: "team:" + t.key, text: (ar ? t.ar : t.en), group: that.text("wf.ap.team") };
				})).concat(People.names().map(function (n) { return { key: "user:" + n, text: that._personText(n), group: that.text("wf.ap.users") }; })),
				connections: this.data().getProperty("/connections").filter(function (c) { return c.props && c.props.writeback; }).map(function (c) {
					return { key: c.id, text: ar ? c.name : (c.nameEn || c.name), sys: c.type === "c4c" ? "c4c" : "erp" };
				}),
				rules: W.rules.map(function (r) { return { key: r.key, text: ar ? r.ar : r.en, kind: r.kind, engine: r.engine }; }),
				vars: VARIABLES.map(function (v) { return { key: v }; })
			});
			this._hist = []; this._fut = [];
		},

		/* ---------- labels and lookups ---------- */

		_domainText: function (d) {
			var x = (this.data().getProperty("/domains") || []).filter(function (o) { return o.entity === d || o.id === d.toLowerCase() + "s"; })[0];
			return x ? this.domainName(x) : d;
		},
		_tpl: function (k) { return this._W.templates.filter(function (t) { return t.key === k; })[0]; },
		_tplFields: function () {
			var t = this._tpl(this._templateKey()), ar = this.lang() === "ar";
			return t ? t.fields.map(function (f) { return { name: f.name, type: f.type, label: ar ? f.ar : f.en, key: f.key, req: f.req, codeList: f.codeList }; }) : [];
		},
		_templateKey: function () {
			var t = this._flow && this._flow.ordered().filter(function (n) { return n.type === "template"; })[0];
			return t ? t.props.template : "";
		},
		_rule: function (k) { return this._W.rules.filter(function (r) { return r.key === k; })[0]; },
		_conn: function (k) { return this.viewModel().getProperty("/wf/connections").filter(function (c) { return c.key === k; })[0]; },
		_team: function (k) { return TEAMS.filter(function (x) { return x.key === k; })[0]; },
		_teamText: function (k) { var t = this._team(k); return t ? (this.lang() === "ar" ? t.ar : t.en) : ""; },
		_personText: function (n) { var p = People.get(n); return p ? (this.lang() === "ar" ? n : p.en) : n; },
		_whoText: function (k) {
			if (!k) { return ""; }
			return k.indexOf("team:") === 0 ? this._teamText(k.slice(5)) : this._personText(k.replace(/^user:/, ""));
		},
		_approverText: function (p) {
			if (p.approverType === "team") { return this._teamText(p.approverTeam); }
			var a = p.approvers || [];
			return a.length ? this._personText(a[0]) + (a.length > 1 ? " +" + (a.length - 1) : "") : "";
		},
		_recipientText: function (k) {
			if (k === "requester" || k === "approvers") { return this.text("fd.rcp." + k); }
			return this._whoText(k);
		},
		_targetFields: function (p) {
			var c = this._conn(p.connection), dom = this._tpl(this._templateKey()) && this._tpl(this._templateKey()).domain;
			return c && dom ? ((this._W.targets[c.sys] || {})[dom] || []) : [];
		},
		_label: function (n) {
			if (n.type === "port") { return this.text("fd.port." + n.port); }
			if (n.name) { return n.name; }
			if (n.type === "template") { var t = this._tpl(n.props.template); return t ? (this.lang() === "ar" ? t.ar : t.en) : this.text("fd.n.template"); }
			if (n.type === "end") { return this.text("fd.out." + (n.props.outcome || "completed")); }
			return this.text("fd.n." + n.type);
		},

		/* ---------- the example flow a new workflow opens with ---------- */

		_loadExample: function () {
			var f = Flow.fromJSON({ root: "begin_1", seq: 10, nodes: {
				begin_1: { id: "begin_1", type: "begin", name: "", props: {}, next: { out: "template_1" } },
				template_1: { id: "template_1", type: "template", name: "", props: { template: "TPL_CUSTOMER_CREATE" }, next: { out: "end_1" } },
				end_1: { id: "end_1", type: "end", name: "", props: { outcome: "completed" }, next: {} }
			} });
			var T = this.text.bind(this);
			var v = f.insert("template_1", "out", "validation", { rule: "match_duplicate", source: "golden", threshold: 0.85, severity: "block", fields: [] }, T("fd.ex.dupCheck"));
			f.insert(v, "failed", "notification", { channels: ["inApp", "email"], recipients: ["requester"], subject: T("fd.ex.dupSubject"), message: T("fd.ex.dupMessage") }, T("fd.ex.tellRequester"));
			var a = f.insert(v, "passed", "approval", { approverType: "team", approverTeam: "customer_stewards", approvers: [], rule: "any", sla: "P2D", escalateTo: "team:governance_board" }, T("fd.ex.stewardReview"));
			f.insert(a, "rejected", "notification", { channels: ["inApp", "email"], recipients: ["requester"], subject: T("fd.ex.rejSubject"), message: T("fd.ex.rejMessage") }, T("fd.ex.tellRequester"));
			var s = f.insert(a, "approved", "script", { language: "python", code: PY_SAMPLE, timeoutMin: 5 }, T("fd.ex.cleanName"));
			var w = f.insert(s, "out", "writeBack", { connection: "C4C_PROD", entity: "Customer", conflict: "review", retries: 3, mapping: {} }, T("fd.ex.toC4c"));
			f.insert(w, "out", "notification", { channels: ["inApp", "email"], recipients: ["requester", "approvers"], subject: T("fd.ex.doneSubject"), message: T("fd.ex.doneMessage") }, T("fd.ex.tellDone"));
			this._flow = f;
			// Pre-map the write-back with the allowlist's suggestions, like "Auto-map" would.
			var wn = f.node(w); this._targetFields(wn.props).forEach(function (t) { if (t.src) { wn.props.mapping[t.name] = t.src; } });
			var m = this.viewModel();
			m.setProperty("/wf/name", T("fd.ex.name")); m.setProperty("/wf/tech", "WF_CUSTOMER_CREATE_C4C");
			this._hist = []; this._fut = [];
			this._render();
			this._select("");
			this._statusText();
			m.setProperty("/wf/dirty", false);
		},

		onStartBlank: function () {
			var that = this;
			MessageBox.confirm(this.text("fd.blankConfirm"), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				that._snap();
				that._flow = Flow.fromJSON({ root: "begin_1", seq: 10, nodes: {
					begin_1: { id: "begin_1", type: "begin", name: "", props: {}, next: { out: "template_1" } },
					template_1: { id: "template_1", type: "template", name: "", props: { template: "" }, next: { out: "end_1" } },
					end_1: { id: "end_1", type: "end", name: "", props: { outcome: "completed" }, next: {} }
				} });
				that.viewModel().setProperty("/wf/name", that.text("wf.untitled")); that.viewModel().setProperty("/wf/tech", "WF_NEW");
				that._render(); that._select("template_1");
				that.byId("canvas").fit();
			} });
		},

		/* ---------- canvas model ---------- */

		_size: function (n) { return SIZE[n.type] || SIZE.card; },

		_card: function (n, issues) {
			var p = n.props || {}, T = this.text.bind(this), c = { title: this._label(n), icon: NODE_ICON[n.type], lines: [] }, that = this;
			switch (n.type) {
			case "begin": c.title = T("fd.n.begin"); break;
			case "template":
				var t = this._tpl(p.template);
				c.subtitle = t ? this._domainText(t.domain) + " · v" + t.version : T("fd.pickTemplate");
				if (t) { c.lines = [{ k: T("fd.fields"), v: String(t.fields.length) }, { k: T("fd.required"), v: String(t.fields.filter(function (f) { return f.req; }).length) }]; }
				break;
			case "approval":
				c.subtitle = (p.approverType === "team" ? T("wf.ap.team") : T("wf.ap.users")) + ": " + (this._approverText(p) || "—");
				c.lines = [{ k: T("wf.rule"), v: T(p.approverType === "team" ? (p.rule === "all" ? "wf.rule.allMembers" : "wf.rule.anyMember") : (p.rule === "all" ? "wf.rule.all" : "wf.rule.any")) },
					{ k: T("fd.sla"), v: p.sla ? T("fd.sla." + p.sla) : "—" }, { k: T("fd.escalate"), v: this._whoText(p.escalateTo) || "—" }];
				break;
			case "notification":
				c.subtitle = (p.channels || []).map(function (x) { return T("fd.ch." + x); }).join(" + ") || "—";
				c.lines = [{ k: T("fd.to"), v: (p.recipients || []).map(function (r) { return that._recipientText(r); }).join("، ") || "—" }];
				c.note = p.subject || p.message || "";
				break;
			case "script":
				c.subtitle = T("fd.lang." + (p.language || "python"));
				c.code = String(p.code || "").split("\n").filter(function (l) { return l.trim() && !/^\s*(#|--)/.test(l); }).slice(0, 4).join("\n");
				break;
			case "validation":
				var r = this._rule(p.rule);
				c.subtitle = r ? r.engine : T("fd.pickRule");
				if (r) {
					c.lines = [{ k: T("fd.rule"), v: this.lang() === "ar" ? r.ar : r.en }];
					if (r.kind === "match") { c.lines.push({ k: T("fd.compareWith"), v: this._sourceText(p.source) }, { k: T("fd.threshold"), v: String(p.threshold) }); }
					else { c.lines.push({ k: T("fd.onFail"), v: T("fd.sev." + (p.severity || "block")) }); }
				}
				break;
			case "writeBack":
				var cn = this._conn(p.connection), tf = this._targetFields(p);
				c.subtitle = cn ? cn.text : T("fd.pickConnection");
				c.lines = [{ k: T("wf.entity"), v: p.entity ? this._domainText(p.entity) : "—" }, { k: T("fd.mapped"), v: Object.keys(p.mapping || {}).length + " / " + tf.length },
					{ k: T("fd.conflict"), v: T("wf.conflict." + (p.conflict || "review")) }];
				break;
			case "condition":
				c.subtitle = T("fd.n.condition");
				c.code = p.field ? p.field + " " + T("fd.op." + (p.op || "eq") + ".sym") + (/(empty|notEmpty)/.test(p.op) ? "" : " '" + (p.value || "") + "'") : "";
				break;
			case "end": c.outcome = p.outcome || "completed"; break;
			}
			c.issues = (issues || []).join(" · ");
			return c;
		},

		_render: function () {
			var f = this._flow, that = this, m = this.viewModel(), sel = m.getProperty("/wf/sel/id");
			var issues = this._validate(), byNode = {};
			issues.forEach(function (i) { if (i.id) { (byNode[i.id] = byNode[i.id] || []).push(i.text); } });
			var lay = f.layout(function (n) { return that._size(n); }, { gapX: 72, gapY: 40 });
			var nodes = Object.keys(lay.pos).map(function (id) {
				var n = f.node(id), p = lay.pos[id];
				return Object.assign({ id: id, type: n.type, x: p.x, y: p.y, w: p.w, h: p.h, selected: id === sel }, that._card(n, byNode[id]));
			});
			var edges = lay.edges.map(function (e) {
				var two = Flow.PORTS[f.node(e.from).type].length > 1;
				return { from: e.from, to: e.to, port: e.port, label: two ? that.text("fd.port." + e.port) : "", negative: /^(rejected|failed|no)$/.test(e.port) };
			});
			m.setProperty("/wf/canvas", { nodes: nodes, edges: edges, width: lay.width, height: lay.height });
			m.setProperty("/wf/issues", issues);
			m.setProperty("/wf/issueCount", issues.length);
			m.setProperty("/wf/steps", f.ordered().filter(function (n) { return n.type !== "begin"; }).map(function (n) {
				return { id: n.id, title: that._label(n), type: that.text("fd.n." + n.type), icon: NODE_ICON[n.type], bad: !!byNode[n.id] };
			}));
			var t = this._tpl(this._templateKey());
			m.setProperty("/wf/domain", t ? t.domain : "");
			m.setProperty("/wf/domainText", t ? this._domainText(t.domain) : "—");
			m.setProperty("/wf/fields", this._tplFields());
			m.setProperty("/wf/canUndo", this._hist.length > 0);
			m.setProperty("/wf/canRedo", this._fut.length > 0);
		},

		/* Undo / redo: snapshots of the flow before every change. */
		_snap: function () {
			this._hist.push(JSON.stringify(this._flow.toJSON())); if (this._hist.length > 50) { this._hist.shift(); }
			this._fut = []; this.viewModel().setProperty("/wf/dirty", true);
		},
		onUndo: function () {
			if (this.viewModel().getProperty("/wf/readOnly") || !this._hist.length) { return; }
			this._fut.push(JSON.stringify(this._flow.toJSON()));
			this._flow = Flow.fromJSON(JSON.parse(this._hist.pop()));
			this._afterHistory();
		},
		onRedo: function () {
			if (this.viewModel().getProperty("/wf/readOnly") || !this._fut.length) { return; }
			this._hist.push(JSON.stringify(this._flow.toJSON()));
			this._flow = Flow.fromJSON(JSON.parse(this._fut.pop()));
			this._afterHistory();
		},
		_afterHistory: function () {
			var id = this.viewModel().getProperty("/wf/sel/id");
			this._render(); this._select(this._flow.node(id) ? id : "");
		},

		/* ---------- selection and properties ---------- */

		onCanvasSelect: function (e) { this._select(e.getParameter("id")); },
		onStepPress: function (e) { var id = e.getParameter("listItem").data("id"); this._select(id); this.byId("canvas").reveal(id); },

		_select: function (id) {
			var m = this.viewModel(), n = id ? this._flow.node(id) : null, that = this, issues = m.getProperty("/wf/issues") || [];
			var sel = { id: id || "", type: n ? n.type : "process", icon: n ? NODE_ICON[n.type] : "sap-icon://process", typeText: this.text("fd.n." + (n ? n.type : "process")),
				title: n ? this._label(n) : m.getProperty("/wf/name"), name: n ? (n.name || "") : m.getProperty("/wf/name"), removable: n ? this._flow.removable(id) : false,
				issues: issues.filter(function (i) { return id ? i.id === id : !i.id; }).map(function (i) { return i.text; }).join("\n") };
			if (n) {
				var p = JSON.parse(JSON.stringify(n.props || {}));
				Object.assign(sel, p);
				if (n.type === "approval") {
					sel.approverType = p.approverType || "users"; sel.approvers = p.approvers || []; sel.hasApprovers = sel.approvers.length > 0;
					sel.teamMembers = ((this._team(p.approverTeam) || {}).members || []).map(function (x) { return { name: x }; });
				}
				if (n.type === "notification") {
					sel.inApp = (p.channels || []).indexOf("inApp") > -1; sel.email = (p.channels || []).indexOf("email") > -1;
					sel.recipientOptions = this._recipientOptions(id);
				}
				if (n.type === "validation") {
					var r = this._rule(p.rule) || {};
					sel.ruleKind = r.kind || ""; sel.ruleEngine = r.engine || ""; sel.ruleDesc = r.descEn ? (this.lang() === "ar" ? r.descAr : r.descEn) : "";
					sel.fixedFields = (r.fields || []).join(", "); sel.sources = this._sources();
					sel.thresholdPct = Math.round((p.threshold || 0.85) * 100);
				}
				if (n.type === "writeBack") {
					var tf = this._targetFields(p);
					sel.targetCount = tf.length; sel.mappedCount = Object.keys(p.mapping || {}).length;
					var cn = this._conn(p.connection), tpl = this._tpl(this._templateKey()), T = this.text.bind(this);
					sel.targetFields = tf; sel.mapping = Object.assign({}, p.mapping || {});
					sel.mapTexts = { all: T("fd.map.all"), mapped: T("fd.map.mapped"), unmapped: T("fd.map.unmapped"), search: T("fd.map.search"),
						src: tpl ? (this.lang() === "ar" ? tpl.ar : tpl.en) : T("fd.n.template"), tgt: cn ? cn.text : "",
						unmap: T("fd.map.unmap"), valueMap: T("fd.map.valueMap"), auto: T("fd.map.auto"), hint: T("fd.map.hint"), count: T("fd.map.count") };
					sel.noAllowlist = !!p.connection && !tf.length;
				}
				if (n.type === "template") {
					var t = this._tpl(p.template);
					sel.tplDomain = t ? this._domainText(t.domain) : ""; sel.tplVersion = t ? "v" + t.version : "";
				}
			}
			m.setProperty("/wf/sel", sel);
			var cv = m.getProperty("/wf/canvas");
			cv.nodes.forEach(function (x) { x.selected = x.id === id; });
			m.setProperty("/wf/canvas", Object.assign({}, cv));
			if (id) { m.setProperty("/wf/showProps", true); }
			if (n && n.type === "script") { setTimeout(function () { that._syncEditor(); }, 0); }
		},
		onCloseProps: function () { this.viewModel().setProperty("/wf/showProps", false); },
		onShowWorkflow: function () { this._select(""); },

		/* Write a node's props (or name) from the properties panel. */
		_upd: function (props, name) {
			if (this.viewModel().getProperty("/wf/readOnly")) { return; }
			var id = this.viewModel().getProperty("/wf/sel/id"), n = this._flow.node(id); if (!n) { return; }
			this._snap();
			Object.assign(n.props, props || {});
			if (name !== undefined) { n.name = name; }
			this._render(); this._select(id);
		},
		onNodeName: function (e) {
			var id = this.viewModel().getProperty("/wf/sel/id");
			if (!id) { this.viewModel().setProperty("/wf/name", e.getParameter("value")); this.viewModel().setProperty("/wf/dirty", true); this._render(); return; }
			this._upd(null, e.getParameter("value").trim());
		},
		onProp: function (e) {
			var src = e.getSource(), k = src.data("prop"), v;
			if (src.getSelectedKey) { v = src.getSelectedKey(); } else if (src.getSelected) { v = src.getSelected(); } else if (src.getValue) { v = src.getValue(); }
			var o = {}; o[k] = v; this._upd(o);
		},
		onPropNum: function (e) { var o = {}; o[e.getSource().data("prop")] = e.getSource().getValue(); this._upd(o); },
		onTemplate: function (e) {
			var k = e.getSource().getSelectedKey(), t = this._tpl(k), that = this;
			this._upd({ template: k });
			// Write-back targets the template's domain.
			this._flow.ordered().forEach(function (n) { if (n.type === "writeBack") { n.props.entity = t ? t.domain : ""; } });
			this._render(); this._select(this.viewModel().getProperty("/wf/sel/id"));
			if (t) { MessageToast.show(that.text("fd.templateSet", [this.lang() === "ar" ? t.ar : t.en])); }
		},
		onApproverType: function (e) { this._upd({ approverType: e.getParameter("item").getKey() }); },
		onApprovers: function (e) { this._upd({ approvers: e.getSource().getSelectedKeys() }); },
		onRule: function (e) { this._upd({ rule: e.getParameter("item").getKey() }); },
		onChannel: function () {
			var s = this.viewModel().getProperty("/wf/sel"), ch = [];
			if (s.inApp) { ch.push("inApp"); } if (s.email) { ch.push("email"); }
			this._upd({ channels: ch });
		},
		onRecipients: function (e) { this._upd({ recipients: e.getSource().getSelectedKeys() }); },
		onInsertVar: function (e) {
			var v = "{" + e.getSource().data("var") + "}", s = this.viewModel().getProperty("/wf/sel");
			this._upd({ message: (s.message || "") + (s.message && !/\s$/.test(s.message) ? " " : "") + v });
		},
		_recipientOptions: function (id) {
			var that = this, prevApproval = this._flow.ancestors(id).some(function (a) { return a.type === "approval"; });
			return [{ key: "requester", text: this.text("fd.rcp.requester"), group: "" }]
				.concat(prevApproval ? [{ key: "approvers", text: this.text("fd.rcp.approvers"), group: "" }] : [])
				.concat(TEAMS.map(function (t) { return { key: "team:" + t.key, text: that._teamText(t.key), group: that.text("wf.ap.team") }; }))
				.concat(People.names().map(function (n) { return { key: "user:" + n, text: that._personText(n), group: that.text("wf.ap.users") }; }));
		},
		_sources: function () {
			var dom = this.viewModel().getProperty("/wf/domain"), ar = this.lang() === "ar", that = this;
			return [{ key: "golden", text: this.text("fd.src.golden", [dom ? this._domainText(dom) : "—"]) }].concat(
				this.data().getProperty("/connections").filter(function (c) { return c.type !== "file"; }).map(function (c) {
					return { key: c.id, text: that.text("fd.src.conn", [ar ? c.name : (c.nameEn || c.name)]) };
				}));
		},
		_sourceText: function (k) { var s = this._sources().filter(function (x) { return x.key === k; })[0]; return s ? s.text : "—"; },
		onThreshold: function (e) { this._upd({ threshold: Math.round(e.getParameter("value")) / 100 }); },
		onValidationRule: function (e) {
			var r = this._rule(e.getSource().getSelectedKey());
			this._upd({ rule: r.key, fields: r.kind === "dq" && !r.fields.length ? this._tplFields().filter(function (f) { return f.req; }).map(function (f) { return f.name; }) : [] });
		},
		onValidationFields: function (e) { this._upd({ fields: e.getSource().getSelectedKeys() }); },

		/* Script node: language, code, template fields. */
		_syncEditor: function () {
			var ed = this.byId("codeEditor"), s = this.viewModel().getProperty("/wf/sel");
			if (!ed || s.type !== "script") { return; }
			ed.setFields(this._tplFields()); ed.setLanguage(s.language || "python"); ed.setValue(s.code || "");
			ed.setEditable(!this.viewModel().getProperty("/wf/readOnly"));
		},
		onLanguage: function (e) {
			var k = e.getParameter("item").getKey(), s = this.viewModel().getProperty("/wf/sel");
			var code = s.code;
			if (!code || code === PY_SAMPLE || code === SQL_SAMPLE) { code = k === "sql" ? SQL_SAMPLE : PY_SAMPLE; }
			this._upd({ language: k, code: code });
		},
		onCode: function (e) {
			if (this.viewModel().getProperty("/wf/readOnly")) { return; }
			var id = this.viewModel().getProperty("/wf/sel/id"), n = this._flow.node(id), that = this;
			if (!n) { return; }
			// Typing should not re-render the editor: update the node and refresh the canvas lazily.
			if (!this._codeSnap) { this._snap(); this._codeSnap = true; }
			n.props.code = e.getParameter("value");
			clearTimeout(this._codeT);
			this._codeT = setTimeout(function () { that._codeSnap = false; that._render(); }, 600);
		},
		onInsertField: function (e) {
			var f = e.getSource().data("field"), lang = this.viewModel().getProperty("/wf/sel/language");
			this.byId("codeEditor").insertText(lang === "sql" ? ":" + f : "record[\"" + f + "\"]");
		},

		/* Write-back: connection; the field mapping lives in the panel's Mapping section. */
		onConnection: function (e) {
			var k = e.getSource().getSelectedKey(), dom = this.viewModel().getProperty("/wf/domain");
			this._upd({ connection: k, entity: dom, mapping: {} });
		},
		/* Mapping section: every change is kept on the step (validation flags unmapped key fields). */
		onMapping: function (e) { this._upd({ mapping: e.getParameter("mapping") }); },

		/* ---------- insert and remove steps ---------- */

		onInsert: function (e) {
			if (this.viewModel().getProperty("/wf/readOnly")) { return; }
			var from = e.getParameter("from"), port = e.getParameter("port"), that = this, T = this.text.bind(this);
			var list = new List({ mode: "None", items: Flow.INSERTABLE.map(function (t) {
				return new StandardListItem({ type: "Active", title: T("fd.n." + t), description: T("fd.d." + t), icon: NODE_ICON[t], wrapping: true,
					press: function () { pop.close(); that._insert(from, port, t); } });
			}) }).addStyleClass("repoioFlowMenu");
			var pop = new ResponsivePopover({ title: T("fd.addStep"), placement: "Auto", contentWidth: "22rem", content: [list], afterClose: function () { pop.destroy(); } });
			this.getView().addDependent(pop);
			pop.openBy(e.getParameter("domRef"));
		},
		_defaults: function (type) {
			var dom = this.viewModel().getProperty("/wf/domain");
			return {
				approval: { approverType: "users", approvers: [], approverTeam: "", rule: "any", sla: "P2D", escalateTo: "" },
				notification: { channels: ["inApp"], recipients: ["requester"], subject: "", message: "" },
				script: { language: "python", code: PY_SAMPLE, timeoutMin: 5 },
				validation: { rule: "", fields: [], source: "golden", threshold: 0.85, severity: "block" },
				writeBack: { connection: "", entity: dom, conflict: "review", retries: 3, mapping: {} },
				condition: { field: "", op: "eq", value: "" }
			}[type];
		},
		_insert: function (from, port, type) {
			this._snap();
			var id = this._flow.insert(from, port, type, this._defaults(type), "");
			this._render(); this._select(id);
			var c = this.byId("canvas"); setTimeout(function () { c.reveal(id); c.focusNode(id); }, 50);
		},
		onRemove: function (e) { this._remove(e.getParameter ? e.getParameter("id") : this.viewModel().getProperty("/wf/sel/id")); },
		onRemoveSel: function () { this._remove(this.viewModel().getProperty("/wf/sel/id")); },
		_remove: function (id) {
			var f = this._flow, that = this;
			if (this.viewModel().getProperty("/wf/readOnly") || !f.removable(id)) { return; }
			var side = f.sideBranchSize(id), go = function () { that._snap(); f.remove(id); that._render(); that._select(""); };
			if (side) { MessageBox.confirm(this.text("fd.removeConfirm", [this._label(f.node(id)), side]), { onClose: function (a) { if (a === MessageBox.Action.OK) { go(); } } }); }
			else { go(); }
		},

		/* ---------- validation (J7 step 5) ---------- */

		_validate: function () {
			var f = this._flow, T = this.text.bind(this), out = [], that = this, fields = {}, tplKey = this._templateKey();
			if (!f) { return out; }
			this._tplFields().forEach(function (x) { fields[x.name] = true; });
			var add = function (n, key, args) { out.push({ id: n ? n.id : "", text: T(key, [n ? that._label(n) : ""].concat(args || [])) }); };
			if (!(this.viewModel().getProperty("/wf/name") || "").trim()) { add(null, "wf.v.noName"); }
			f.ordered().forEach(function (n) {
				var p = n.props || {};
				switch (n.type) {
				case "template": if (!tplKey) { add(n, "fd.v.noTemplate"); } break;
				case "approval": if (!that._approverText(p)) { add(n, "wf.v.noApprover"); } break;
				case "notification":
					if (!(p.channels || []).length) { add(n, "fd.v.noChannel"); }
					if (!(p.recipients || []).length) { add(n, "fd.v.noRecipient"); }
					if (!(p.message || "").trim()) { add(n, "fd.v.noMessage"); }
					break;
				case "script": if (!(p.code || "").trim()) { add(n, "fd.v.noCode"); }
					((p.code || "").match(p.language === "sql" ? /:(\w+)/g : /record\["(\w+)"\]/g) || []).forEach(function (m) {
						var fn = m.replace(/^:/, "").replace(/^record\["|"\]$/g, "");
						if (tplKey && !fields[fn]) { add(n, "fd.v.unknownField", [fn]); }
					});
					break;
				case "validation":
					var r = that._rule(p.rule);
					if (!r) { add(n, "fd.v.noRule"); } else if (r.kind === "match" && !p.source) { add(n, "fd.v.noSource"); }
					else if (r.kind === "dq" && !r.fields.length && !(p.fields || []).length) { add(n, "fd.v.noRuleFields"); }
					break;
				case "writeBack":
					if (!p.connection) { add(n, "wf.v.noTarget"); break; }
					var tf = that._targetFields(p), mp = p.mapping || {};
					if (!tf.length) { add(n, "fd.v.noAllowlist"); break; }
					if (!Object.keys(mp).length) { add(n, "wf.v.noMapping"); }
					tf.filter(function (t) { return t.key && !mp[t.name]; }).forEach(function (t) { add(n, "fd.v.keyUnmapped", [t.name]); });
					Object.keys(mp).forEach(function (k) { if (!fields[mp[k]]) { add(n, "fd.v.unknownField", [mp[k]]); } });
					break;
				case "condition":
					if (!p.field) { add(n, "fd.v.noConditionField"); } else if (!fields[p.field]) { add(n, "fd.v.unknownField", [p.field]); }
					else if (!/(empty|notEmpty)/.test(p.op) && !(p.value || "").trim()) { add(n, "fd.v.noConditionValue"); }
					break;
				}
			});
			return out;
		},

		onValidate: function (e) {
			var issues = this._validate(), that = this;
			this._render();
			if (!issues.length) { MessageToast.show(this.text("wf.v.ok")); return issues; }
			var oPop = new MessagePopover({
				items: issues.map(function (i) { return new MessageItem({ type: "Error", title: i.text, activeTitle: !!i.id, key: i.id }); }),
				activeTitlePress: function (ev) { var id = ev.getParameter("item").getKey(); that._select(id); that.byId("canvas").reveal(id); },
				afterClose: function () { oPop.destroy(); }
			});
			this.getView().addDependent(oPop);
			oPop.openBy(e && e.getSource ? e.getSource() : this.byId("validateBtn"));
			return issues;
		},

		/* ---------- lifecycle: save version, publish (immutable), new version, BPMN export ---------- */

		_statusText: function () {
			var m = this.viewModel(), v = m.getProperty("/wf/version"), s = m.getProperty("/wf/state");
			m.setProperty("/wf/statusText", (s === "published" ? this.text("onto.state.published") : this.text("wf.draftNotPublished")) + " · v" + v);
			m.setProperty("/wf/roText", this.text("wf.roNote", [v]));
		},
		_now: function () { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()); },
		_setVersionRow: function (state) {
			var m = this.viewModel(), v = m.getProperty("/wf/version"), rows = m.getProperty("/wf/versions");
			var row = rows.filter(function (r) { return r.v === v; })[0];
			row.state = state; row.stateText = this.text(state === "published" ? "onto.state.published" : "onto.state.draft"); row.date = this._now() + " · " + this._personText("محمد");
			m.setProperty("/wf/versions", rows.slice());
		},
		onSave: function () {
			this._saved = JSON.stringify(this._flow.toJSON());
			this._setVersionRow("draft");
			this.viewModel().setProperty("/wf/dirty", false);
			MessageToast.show(this.text("wf.saved", [this.viewModel().getProperty("/wf/version")]));
		},
		onPublish: function () {
			var issues = this._validate(), that = this;
			if (issues.length) { this.onValidate(); MessageToast.show(this.text("wf.publishBlocked")); return; }
			var v = this.viewModel().getProperty("/wf/version");
			MessageBox.confirm(this.text("wf.publishConfirm", [v]), {
				title: this.text("wf.publish"),
				onClose: function (a) {
					if (a !== MessageBox.Action.OK) { return; }
					var m = that.viewModel();
					that._saved = JSON.stringify(that._flow.toJSON());
					m.setProperty("/wf/state", "published"); m.setProperty("/wf/readOnly", true); m.setProperty("/wf/dirty", false);
					that._setVersionRow("published"); that._statusText();
					that._select(m.getProperty("/wf/sel/id"));
					MessageToast.show(that.text("wf.published", [v]));
				}
			});
		},
		onNewVersion: function () {
			var m = this.viewModel(), v = m.getProperty("/wf/version") + 1, rows = m.getProperty("/wf/versions");
			rows.unshift({ v: v, state: "draft", stateText: this.text("onto.state.draft"), date: this.text("wf.notSaved") });
			m.setProperty("/wf/versions", rows.slice()); m.setProperty("/wf/version", v);
			m.setProperty("/wf/state", "draft"); m.setProperty("/wf/readOnly", false);
			this._hist = []; this._fut = [];
			this._statusText(); this._render(); this._select(m.getProperty("/wf/sel/id"));
			MessageToast.show(this.text("wf.newVersionMade", [v]));
		},
		bpmn: function () {
			var m = this.viewModel();
			return this._flow.toBpmn({ tech: m.getProperty("/wf/tech"), name: m.getProperty("/wf/name"), domain: m.getProperty("/wf/domain"), version: m.getProperty("/wf/version") },
				this._label.bind(this));
		},
		onExport: function () {
			var that = this, xml = this.bpmn(), file = this.viewModel().getProperty("/wf/tech") + "-v" + this.viewModel().getProperty("/wf/version") + ".bpmn";
			var oDlg = new Dialog({
				title: that.text("wf.exportTitle"), contentWidth: "48rem", resizable: true, draggable: true,
				content: [new VBox({ items: [
					new MessageStrip({ text: that.text("fd.exportNote"), showIcon: true }).addStyleClass("sapUiSmallMarginBottom"),
					new TextArea({ editable: false, width: "100%", rows: 22 }).addStyleClass("repoioMono repoioTtl").setValue(xml)
				] }).addStyleClass("sapUiSmallMargin")],
				buttons: [
					new Button({ text: that.text("onto.download"), icon: "sap-icon://download", type: "Emphasized", press: function () {
						try {
							var a = document.createElement("a");
							a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
							a.download = file; document.body.appendChild(a); a.click(); a.remove();
						} catch (err) { MessageToast.show(that.text("onto.downloadBlocked")); }
					} }),
					new Button({ text: that.text("common.close"), press: function () { oDlg.close(); } })
				],
				afterClose: function () { oDlg.destroy(); }
			});
			that.getView().addDependent(oDlg);
			oDlg.open();
		},

		varText: function (k) { return "{" + k + "}"; },
		onFit: function () { this.byId("canvas").fit(); },
		onWorkflows: function () { this.navKey("workflowsList"); }
	});
});
