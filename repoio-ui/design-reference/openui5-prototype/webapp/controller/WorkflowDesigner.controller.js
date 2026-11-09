sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/flowModel",
	"repoio/proto/util/people",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/TextArea",
	"sap/m/Input",
	"sap/m/Label",
	"sap/m/Select",
	"sap/m/Text",
	"sap/m/Title",
	"sap/m/ResponsivePopover",
	"sap/m/List",
	"sap/m/StandardListItem",
	"sap/m/MessagePopover",
	"sap/m/MessageItem",
	"sap/m/MessageStrip",
	"sap/m/VBox",
	"sap/m/HBox",
	"sap/ui/core/Item",
	"sap/ui/layout/form/SimpleForm",
	"sap/base/i18n/ResourceBundle"
], function (BaseController, Flow, People, MessageToast, MessageBox, Dialog, Button, TextArea, Input, Label, Select, Text, Title,
	ResponsivePopover, List, StandardListItem, MessagePopover, MessageItem, MessageStrip, VBox, HBox, Item, SimpleForm, ResourceBundle) {
	"use strict";

	/*
	 * New workflow (J7) — Repo.io flow designer (ADR-0002). Steps: Begin, Template, Validation, Approval, Script,
	 * Write-back, Notification, Condition, End. The flow compiles to BPMN 2.0 for Flowable; the engine,
	 * versioning and audit do not change.
	 *
	 * Prototype only: the directory, templates, allowlists, rules, sample requests and run statistics are sample
	 * data, and the Test run is a preview computed in the browser. In the product the test run calls the
	 * workflow service (scripts in the isolated workers) and Runs reads the engine's history.
	 */
	var ME = "محمد"; // the signed-in designer in the prototype
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
	var SIZE = { begin: { w: 104, h: 40 }, end: { w: 132, h: 40 }, script: { w: 236, h: 140 }, card: { w: 236, h: 124 } };
	var VARIABLES = ["request.id", "request.title", "requester.name", "decision", "comment", "record.business_name", "link"];
	var FX = ["const", "upper", "trim", "truncate", "concat", "default"];
	var SQL_SAMPLE = "-- Read-only: runs through Trino with your grants.\n-- :field placeholders come from the template.\nSELECT master_id, business_name, tax_number\nFROM golden.customer\nWHERE tax_number = :tax_number\n  AND master_id <> :customer_id";
	var PY_SAMPLE = "# record: the request fields from the template.\n# Return ok(record) to continue, or fail(field, message).\ndef run(record):\n    name = (record[\"business_name\"] or \"\").strip()\n    record[\"business_name\"] = \" \".join(name.split())\n    if record[\"country\"] == \"EG\" and not record[\"tax_number\"]:\n        return fail(\"tax_number\", \"Tax number is required in Egypt\")\n    return ok(record)\n";
	var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
	var srcOf = function (v) { return typeof v === "string" ? v : (v && v.src) || ""; };

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
				name: "", tech: "", domain: "", owner: ME, version: 2, state: "draft", readOnly: false, dirty: false, mode: "design", overlay: "",
				canUndo: false, canRedo: false, showProps: true, rtl: this.isRtl(), canvas: { nodes: [], edges: [], width: 0, height: 0 },
				sel: {}, steps: [], issues: [], issueCount: 0, msgLang: ar ? "ar" : "en", hasPublished: true, reviewer: "", roText: "",
				test: { active: false }, compare: { active: false }, versions: [],
				templates: W.templates.map(function (t) {
					return { key: t.key, text: ar ? t.ar : t.en, domain: t.domain, domainText: that._domainText(t.domain), version: "v" + t.version };
				}),
				people: People.names().map(function (n) { var p = People.get(n); return { key: n, text: ar ? n : p.en, role: ar ? p.role_ar : p.role_en }; }),
				teams: TEAMS.map(function (t) { return { key: t.key, text: ar ? t.ar : t.en, count: that.text("wf.members", [t.members.length]) }; }),
				who: [{ key: "", text: this.text("wf.none"), group: "" }].concat(TEAMS.map(function (t) {
					return { key: "team:" + t.key, text: (ar ? t.ar : t.en), group: that.text("wf.ap.team") };
				})).concat(People.names().map(function (n) { return { key: "user:" + n, text: that._personText(n), group: that.text("wf.ap.users") }; })),
				connections: this.data().getProperty("/connections").filter(function (c) { return c.props && c.props.writeback; }).map(function (c) {
					return { key: c.id, text: ar ? c.name : (c.nameEn || c.name), sys: c.type === "c4c" ? "c4c" : "erp" };
				}),
				rules: W.rules.map(function (r) { return { key: r.key, text: ar ? r.ar : r.en, kind: r.kind, engine: r.engine }; }),
				vars: VARIABLES.map(function (v) { return { key: v }; }),
				catalog: this._catalog().map(function (c) { return { key: c.key, text: c.text }; }),
				fxTypes: [{ key: "", text: this.text("fd.fx.none") }].concat(FX.map(function (k) { return { key: k, text: that.text("fd.fx." + k) }; }))
			});
			this._hist = []; this._fut = [];
		},

		/* ---------- labels and lookups ---------- */

		_domainText: function (d) {
			var x = (this.data().getProperty("/domains") || []).filter(function (o) { return d && o.id === d.toLowerCase() + "s"; })[0];
			return x ? this.domainName(x) : (d || "—");
		},
		_domainOwner: function (d) {
			var x = (this.data().getProperty("/domains") || []).filter(function (o) { return d && o.id === d.toLowerCase() + "s"; })[0];
			return x ? x.owner : "";
		},
		_tpl: function (k) { return this._W.templates.filter(function (t) { return t.key === k; })[0]; },
		_tplNode: function (f) { return (f || this._flow).ordered().filter(function (n) { return n.type === "template"; })[0]; },
		_templateKey: function () { var t = this._flow && this._tplNode(); return t ? t.props.template : ""; },
		/* The template version this workflow is pinned to (newer versions need an explicit upgrade). */
		_tplVersion: function (f) {
			var n = this._tplNode(f), t = n && this._tpl(n.props.template);
			if (!t) { return null; }
			var v = n.props.version || t.versions[t.versions.length - 1].v;
			return t.versions.filter(function (x) { return x.v === v; })[0];
		},
		_tplFields: function (f) {
			var v = this._tplVersion(f), ar = this.lang() === "ar";
			return v ? v.fields.map(function (x) {
				return { name: x.name, type: x.type, label: ar ? x.ar : x.en, key: x.key, req: x.req, codeList: x.codeList, group: "" };
			}) : [];
		},
		_sep: function () { return this.lang() === "ar" ? "، " : ", "; },
		_rule: function (k) { return this._W.rules.filter(function (r) { return r.key === k; })[0]; },
		_conn: function (k) { return this.viewModel().getProperty("/wf/connections").filter(function (c) { return c.key === k; })[0]; },
		_team: function (k) { return TEAMS.filter(function (x) { return x.key === k; })[0]; },
		_teamText: function (k) { var t = this._team(k); return t ? (this.lang() === "ar" ? t.ar : t.en) : ""; },
		_personText: function (n) { var p = People.get(n); return p ? (this.lang() === "ar" ? n : p.en) : n; },
		_whoText: function (k) {
			if (!k) { return ""; }
			return k.indexOf("team:") === 0 ? this._teamText(k.slice(5)) : this._personText(k.replace(/^user:/, ""));
		},
		_whoMembers: function (k) {
			if (!k) { return []; }
			return k.indexOf("team:") === 0 ? ((this._team(k.slice(5)) || {}).members || []).slice() : [k.replace(/^user:/, "")];
		},
		_approverText: function (p) {
			if (p.mode === "parallel") { return (p.groups || []).filter(function (g) { return g.who; }).length ? this.text("fd.groupsN", [(p.groups || []).length]) : ""; }
			if (p.approverType === "team") { return this._teamText(p.approverTeam); }
			var a = p.approvers || [];
			return a.length ? this._personText(a[0]) + (a.length > 1 ? " +" + (a.length - 1) : "") : "";
		},
		_recipientText: function (k) {
			if (k === "requester" || k === "approvers") { return this.text("fd.rcp." + k); }
			return this._whoText(k);
		},
		_targetFields: function (p) {
			var c = this._conn(p.connection), t = this._tpl(this._templateKey());
			return c && t ? ((this._W.targets[c.sys] || {})[t.domain] || []) : [];
		},
		_label: function (n) {
			if (n.type === "port") { return this.text("fd.port." + n.port); }
			if (n.type === "rework") { return this.text("fd.rework"); }
			if (n.name) { return n.name; }
			if (n.type === "template") { var t = this._tpl(n.props.template); return t ? (this.lang() === "ar" ? t.ar : t.en) : this.text("fd.n.template"); }
			if (n.type === "end") { return this.text("fd.out." + (n.props.outcome || "completed")); }
			return this.text("fd.n." + n.type);
		},

		/* ---------- sample workflows (the example opens as draft v2 of a published v1) ---------- */

		_base: function (tpl, version) {
			return Flow.fromJSON({ root: "begin_1", seq: 10, nodes: {
				begin_1: { id: "begin_1", type: "begin", name: "", props: {}, next: { out: "template_1" } },
				template_1: { id: "template_1", type: "template", name: "", props: { template: tpl || "", version: version || "" }, next: { out: "end_1" } },
				end_1: { id: "end_1", type: "end", name: "", props: { outcome: "completed" }, next: {} }
			} });
		},
		_automap: function (f, id) {
			var save = this._flow; this._flow = f;
			var n = f.node(id), have = {}; n.props.mapping = {};
			this._tplFields(f).forEach(function (x) { have[x.name] = true; });
			this._targetFields(n.props).forEach(function (t) { if (t.src && have[t.src]) { n.props.mapping[t.name] = t.src; } });
			this._flow = save;
		},
		_customerFlow: function (withScript) {
			var T = this.text.bind(this), f = this._base("TPL_CUSTOMER_CREATE", "3"), that = this;
			var notif = function (k) { return Object.assign({ channels: ["inApp", "email"], recipients: ["requester"] }, that._msg(k)); };
			var v = f.insert("template_1", "out", "validation", { rule: "match_duplicate", source: "golden", threshold: 0.85, severity: "block", fields: [] }, T("fd.ex.dupCheck"));
			f.insert(v, "failed", "notification", notif("dup"), T("fd.ex.tellRequester"));
			var a = f.insert(v, "passed", "approval", { mode: "single", approverType: "team", approverTeam: "customer_stewards", approvers: [], rule: "any",
				sla: "P3D", escalateTo: "team:governance_board", allowReturn: true, maxReturns: 2, sod: true, delegate: true, groups: [] }, T("fd.ex.stewardReview"));
			f.insert(a, "rejected", "notification", notif("rej"), T("fd.ex.tellRequester"));
			var w = f.insert(a, "approved", "writeBack", { connection: "C4C_PROD", entity: "Customer", conflict: "review", retries: 3, mapping: {} }, T("fd.ex.toC4c"));
			f.insert(w, "out", "notification", Object.assign(notif("done"), { recipients: ["requester", "approvers"] }), T("fd.ex.tellDone"));
			this._automap(f, w);
			// Name to C4C is upper-limited to 40 characters: a transformation on the mapping.
			f.node(w).props.mapping.Name = { src: "business_name", fx: { type: "truncate", arg: "40" } };
			if (withScript) {
				f.insert(a, "approved", "script", { language: "python", code: PY_SAMPLE, timeoutMin: 5 }, T("fd.ex.cleanName"));
				f.node(a).props.sla = "P2D";
			}
			return f;
		},
		_msg: function (k) {
			var en = this._bundle("en"), ar = this._bundle("ar"), K = "fd.ex." + k;
			return { subjectEn: en.getText(K + "Subject"), subjectAr: ar.getText(K + "Subject"), messageEn: en.getText(K + "Message"), messageAr: ar.getText(K + "Message") };
		},
		/* Both languages of a message come from the bundles, whatever the UI language is. */
		_bundle: function (lang) {
			this._bundles = this._bundles || {};
			if (!this._bundles[lang]) {
				this._bundles[lang] = ResourceBundle.create({ url: sap.ui.require.toUrl("repoio/proto/i18n/i18n.properties"), locale: lang, supportedLocales: ["", "en", "ar"], fallbackLocale: "en" });
			}
			return this._bundles[lang];
		},
		_vendorFlow: function () {
			var T = this.text.bind(this), f = this._base("TPL_VENDOR_CREATE", "1"), that = this;
			var v = f.insert("template_1", "out", "validation", { rule: "dq_tax_eg", source: "golden", threshold: 0.85, severity: "block", fields: [] }, T("fd.n.validation"));
			f.insert(v, "failed", "notification", Object.assign({ channels: ["inApp"], recipients: ["requester"] }, that._msg("rej")), T("fd.ex.tellRequester"));
			var a = f.insert(v, "passed", "approval", { mode: "parallel", groups: [{ who: "team:vendor_stewards", rule: "any" }, { who: "user:محمد", rule: "any" }],
				approverType: "users", approvers: [], rule: "any", sla: "P2D", escalateTo: "team:governance_board", allowReturn: true, maxReturns: 2, sod: true, delegate: true }, T("fd.ex.parallelReview"));
			var w = f.insert(a, "approved", "writeBack", { connection: "S4_HANA", entity: "Vendor", conflict: "review", retries: 3, mapping: {} }, T("fd.ex.toErp"));
			f.insert(w, "out", "notification", Object.assign({ channels: ["email"], recipients: ["requester"] }, that._msg("done")), T("fd.ex.tellDone"));
			this._automap(f, w);
			return f;
		},
		_addressFlow: function () {
			var T = this.text.bind(this), f = this._base("TPL_CUSTOMER_CHANGE", "2"), that = this;
			var c = f.insert("template_1", "out", "condition", { field: "country", op: "ne", value: "EG" }, T("fd.ex.abroad"));
			f.insert(c, "yes", "approval", { mode: "single", approverType: "team", approverTeam: "governance_board", approvers: [], rule: "any", sla: "P3D", escalateTo: "",
				allowReturn: false, sod: true, delegate: true, groups: [] }, T("fd.ex.boardReview"));
			var w = f.insert(c, "no", "writeBack", { connection: "C4C_PROD", entity: "Customer", conflict: "review", retries: 3, mapping: {} }, T("fd.ex.toC4c"));
			this._automap(f, w);
			return f;
		},
		/* Workflows that already exist and can be copied (prototype sample). */
		_catalog: function () {
			var T = this.text.bind(this);
			return [
				{ key: "cust", text: T("fd.ex.name") + " · v1", build: this._customerFlow.bind(this, false), name: T("fd.ex.name") },
				{ key: "vend", text: T("fd.ex.vendorName") + " · v2", build: this._vendorFlow.bind(this), name: T("fd.ex.vendorName") },
				{ key: "addr", text: T("fd.ex.addressName") + " · v1", build: this._addressFlow.bind(this), name: T("fd.ex.addressName") }
			];
		},

		_loadExample: function () {
			var T = this.text.bind(this), m = this.viewModel();
			var v1 = this._customerFlow(false), v2 = this._customerFlow(true);
			this._store = { 1: v1.toJSON() };
			this._flow = v2;
			m.setProperty("/wf/name", T("fd.ex.name")); m.setProperty("/wf/tech", "WF_CUSTOMER_CREATE_C4C");
			m.setProperty("/wf/version", 2); m.setProperty("/wf/state", "draft"); m.setProperty("/wf/readOnly", false); m.setProperty("/wf/hasPublished", true);
			m.setProperty("/wf/versions", [
				{ v: 2, state: "draft", stateText: T("onto.state.draft"), date: T("wf.notSaved") },
				{ v: 1, state: "published", stateText: T("onto.state.published"), date: "2026-10-12 · " + this._personText("سارة عادل") }
			]);
			this._hist = []; this._fut = [];
			this._render(); this._select(""); this._statusText();
			m.setProperty("/wf/dirty", false);
		},

		_replaceWith: function (f, name, tech) {
			var m = this.viewModel(), T = this.text.bind(this);
			this._clearOverlays();
			this._flow = f; this._store = {};
			m.setProperty("/wf/name", name); m.setProperty("/wf/tech", tech);
			m.setProperty("/wf/version", 1); m.setProperty("/wf/state", "draft"); m.setProperty("/wf/readOnly", false); m.setProperty("/wf/hasPublished", false);
			m.setProperty("/wf/mode", "design");
			m.setProperty("/wf/versions", [{ v: 1, state: "draft", stateText: T("onto.state.draft"), date: T("wf.notSaved") }]);
			this._hist = []; this._fut = [];
			this._render(); this._select(""); this._statusText(); m.setProperty("/wf/dirty", true);
			var c = this.byId("canvas"); setTimeout(function () { c.fit(); }, 30);
		},
		onNewBlank: function () {
			var that = this;
			MessageBox.confirm(this.text("fd.blankConfirm"), { onClose: function (a) {
				if (a === MessageBox.Action.OK) { that._replaceWith(that._base("", ""), that.text("wf.untitled"), "WF_NEW"); that._select("template_1"); }
			} });
		},
		onCopyFrom: function (e) {
			var key = e.getParameter("item").data("key"), x = this._catalog().filter(function (c) { return c.key === key; })[0], that = this;
			if (!x) { return; }
			MessageBox.confirm(this.text("fd.copyConfirm", [x.text]), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				that._replaceWith(x.build(), that.text("fd.copyOf", [x.name]), "WF_COPY_" + key.toUpperCase());
				MessageToast.show(that.text("fd.copied", [x.text]));
			} });
		},

		/* ---------- canvas model ---------- */

		_size: function (n) { return SIZE[n.type] || SIZE.card; },

		_card: function (n, issues, f) {
			var p = n.props || {}, T = this.text.bind(this), c = { title: this._label(n), icon: NODE_ICON[n.type], lines: [], badges: [] }, that = this;
			switch (n.type) {
			case "begin": c.title = T("fd.n.begin"); break;
			case "template":
				var t = this._tpl(p.template), v = this._tplVersion(f);
				c.subtitle = t ? this._domainText(t.domain) + " · v" + (v ? v.v : t.version) : T("fd.pickTemplate");
				if (v) { c.lines = [{ k: T("fd.fields"), v: String(v.fields.length) }, { k: T("fd.required"), v: String(v.fields.filter(function (x) { return x.req; }).length) }]; }
				if (t && v && v.v !== t.version) { c.badges.push(T("fd.newerTemplate", [t.version])); }
				break;
			case "approval":
				c.subtitle = p.mode === "parallel" ? T("fd.parallelGroups", [(p.groups || []).length]) :
					(p.approverType === "team" ? T("wf.ap.team") : T("wf.ap.users")) + ": " + (this._approverText(p) || "—");
				c.lines = p.mode === "parallel" ? (p.groups || []).slice(0, 2).map(function (g, i) { return { k: String(i + 1), v: that._whoText(g.who) || "—" }; }) :
					[{ k: T("wf.rule"), v: T(p.approverType === "team" ? (p.rule === "all" ? "wf.rule.allMembers" : "wf.rule.anyMember") : (p.rule === "all" ? "wf.rule.all" : "wf.rule.any")) }];
				c.lines.push({ k: T("fd.sla"), v: (p.sla ? T("fd.sla." + p.sla) : "—") + (p.escalateTo ? " → " + this._whoText(p.escalateTo) : "") });
				if (p.allowReturn) { c.badges.push(T("fd.badge.return")); }
				if (p.sod !== false) { c.badges.push(T("fd.badge.sod")); }
				if (p.delegate) { c.badges.push(T("fd.badge.delegate")); }
				break;
			case "notification":
				c.subtitle = (p.channels || []).map(function (x) { return T("fd.ch." + x); }).join(" + ") || "—";
				c.lines = [{ k: T("fd.to"), v: (p.recipients || []).map(function (r) { return that._recipientText(r); }).join(that._sep()) || "—" }];
				c.note = (this.lang() === "ar" ? p.subjectAr || p.messageAr : p.subjectEn || p.messageEn) || "";
				if (p.messageAr && p.messageEn) { c.badges.push("AR + EN"); }
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
				var cn = this._conn(p.connection), tf = this._targetFields(p), mp = p.mapping || {};
				var fxN = Object.keys(mp).filter(function (k) { return mp[k] && mp[k].fx; }).length;
				c.subtitle = cn ? cn.text : T("fd.pickConnection");
				c.lines = [{ k: T("wf.entity"), v: p.entity ? this._domainText(p.entity) : "—" }, { k: T("fd.mapped"), v: Object.keys(mp).length + " / " + tf.length },
					{ k: T("fd.conflict"), v: T("wf.conflict." + (p.conflict || "review")) }];
				if (fxN) { c.badges.push(T("fd.badge.fx", [fxN])); }
				break;
			case "condition":
				c.subtitle = T("fd.n.condition");
				c.code = p.field ? this._condFieldText(p.field, f) + " " + T("fd.op." + (p.op || "eq") + ".sym") + (/(empty|notEmpty)/.test(p.op) ? "" : " " + (p.value || "")) : "";
				break;
			case "end": c.outcome = p.outcome || "completed"; break;
			}
			c.issues = (issues || []).join(" · ");
			return c;
		},

		/* Draw a flow (the draft, or a saved version in Runs). Overlays decorate nodes and edges. */
		_render: function () {
			var m = this.viewModel(), mode = m.getProperty("/wf/mode"), f = mode === "runs" ? this._runsFlow() : this._flow, that = this, sel = m.getProperty("/wf/sel/id");
			var issues = mode === "runs" ? [] : this._validate(), byNode = {};
			issues.forEach(function (i) { if (i.id) { (byNode[i.id] = byNode[i.id] || []).push(i.text); } });
			var lay = f.layout(function (n) { return that._size(n); }, { gapX: 72, gapY: 46 });
			var ov = this._overlay(f);
			var nodes = Object.keys(lay.pos).map(function (id) {
				var n = f.node(id), p = lay.pos[id];
				return Object.assign({ id: id, type: n.type, x: p.x, y: p.y, w: p.w, h: p.h, selected: id === sel }, that._card(n, byNode[id], f), ov.nodes[id] || {});
			});
			var edges = lay.edges.map(function (e) {
				var two = Flow.PORTS[f.node(e.from).type].length > 1;
				return { from: e.from, to: e.to, port: e.port, label: two ? that.text("fd.port." + e.port) : "", negative: /^(rejected|failed|no)$/.test(e.port),
					run: !!(ov.edges && ov.edges[e.from + ">" + e.to]) };
			});
			m.setProperty("/wf/canvas", { nodes: nodes, edges: edges, width: lay.width, height: lay.height, overlay: ov.kind || "" });
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
			this._clearOverlays(true);
			this._render(); this._select(this._flow.node(id) ? id : "");
		},

		/* ---------- selection and properties ---------- */

		onCanvasSelect: function (e) {
			var id = e.getParameter("id"), m = this.viewModel();
			if (m.getProperty("/wf/mode") === "runs") { this._selectRunStat(id); return; }
			if (m.getProperty("/wf/test/active") && !id) { this._showTest(); return; }
			if (m.getProperty("/wf/compare/active") && !id) { this._showCompare(); return; }
			this._select(id);
		},
		onStepPress: function (e) { var id = e.getParameter("listItem").data("id"); this._select(id); this.byId("canvas").reveal(id); },

		_select: function (id) {
			var m = this.viewModel(), n = id ? this._flow.node(id) : null, that = this, issues = m.getProperty("/wf/issues") || [];
			var sel = { id: id || "", type: n ? n.type : "process", icon: n ? NODE_ICON[n.type] : "sap-icon://process", typeText: this.text("fd.n." + (n ? n.type : "process")),
				title: n ? this._label(n) : m.getProperty("/wf/name"), name: n ? (n.name || "") : m.getProperty("/wf/name"), removable: n ? this._flow.removable(id) : false,
				issues: issues.filter(function (i) { return id ? i.id === id : !i.id; }).map(function (i) { return i.text; }).join("\n") };
			if (n) {
				var p = clone(n.props || {});
				Object.assign(sel, p);
				if (n.type === "approval") {
					sel.mode = p.mode || "single";
					sel.approverType = p.approverType || "users"; sel.approvers = p.approvers || []; sel.hasApprovers = sel.approvers.length > 0;
					sel.teamMembers = ((this._team(p.approverTeam) || {}).members || []).map(function (x) { return { name: x }; });
					sel.groups = (p.groups || []).map(function (g, i) { return { i: i, who: g.who || "", rule: g.rule || "any", n: i + 1 }; });
					sel.allowReturn = !!p.allowReturn; sel.sod = p.sod !== false; sel.delegate = !!p.delegate; sel.maxReturns = p.maxReturns || 2;
					var away = this._W.outOfOffice || {};
					sel.awayNote = this._approverPool(p).filter(function (x) { return away[x]; }).map(function (x) {
						return that.text("fd.awayNote", [that._personText(x), away[x].until, that._personText(away[x].delegate)]);
					}).join("\n");
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
					var tf = this._targetFields(p), cn = this._conn(p.connection), tpl = this._tpl(this._templateKey()), T = this.text.bind(this);
					sel.targetCount = tf.length; sel.mappedCount = Object.keys(p.mapping || {}).length;
					sel.noAllowlist = !!p.connection && !tf.length;
					sel.targetFields = tf; sel.mapping = clone(p.mapping || {});
					var fxLabels = {}; FX.forEach(function (k) { fxLabels[k] = T("fd.fxs." + k); });
					sel.mapTexts = { all: T("fd.map.all"), mapped: T("fd.map.mapped"), unmapped: T("fd.map.unmapped"), search: T("fd.map.search"),
						src: tpl ? (this.lang() === "ar" ? tpl.ar : tpl.en) : T("fd.n.template"), tgt: cn ? cn.text : "",
						unmap: T("fd.map.unmap"), valueMap: T("fd.map.valueMap"), auto: T("fd.map.auto"), hint: T("fd.map.hint"), count: T("fd.map.count"),
						fxTip: T("fd.fx.tip"), fx: fxLabels };
				}
				if (n.type === "template") {
					var t = this._tpl(p.template), v = this._tplVersion();
					sel.tplDomain = t ? this._domainText(t.domain) : ""; sel.tplVersion = v ? v.v : "";
					sel.newer = t && v && v.v !== t.version ? t.version : "";
				}
				if (n.type === "condition") { sel.condFields = this._condFields(id); sel.valueHint = this._condValueHint(p.field, id); }
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
			this._clearOverlays(true);
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
			var k = e.getSource().getSelectedKey(), t = this._tpl(k);
			// A newly chosen template starts on its latest version.
			this._upd({ template: k, version: t ? t.version : "" });
			this._flow.ordered().forEach(function (n) { if (n.type === "writeBack") { n.props.entity = t ? t.domain : ""; } });
			this._render(); this._select(this.viewModel().getProperty("/wf/sel/id"));
			if (t) { MessageToast.show(this.text("fd.templateSet", [this.lang() === "ar" ? t.ar : t.en])); }
		},

		/* Approval: single or parallel groups; rework; segregation of duties; delegation. */
		onApproverType: function (e) { this._upd({ approverType: e.getParameter("item").getKey() }); },
		onApprovers: function (e) { this._upd({ approvers: e.getSource().getSelectedKeys() }); },
		onRule: function (e) { this._upd({ rule: e.getParameter("item").getKey() }); },
		onApprovalMode: function (e) {
			var k = e.getParameter("item").getKey(), s = this.viewModel().getProperty("/wf/sel");
			var groups = s.groups && s.groups.length ? s.groups.map(function (g) { return { who: g.who, rule: g.rule }; }) :
				[{ who: s.approverType === "team" && s.approverTeam ? "team:" + s.approverTeam : "", rule: "any" }, { who: "", rule: "any" }];
			this._upd({ mode: k, groups: groups });
		},
		_groups: function () { return clone(this._flow.node(this.viewModel().getProperty("/wf/sel/id")).props.groups || []); },
		onGroupWho: function (e) {
			var g = this._groups(), i = e.getSource().getBindingContext("view").getProperty("i");
			g[i].who = e.getSource().getSelectedKey(); this._upd({ groups: g });
		},
		onGroupRule: function (e) {
			var g = this._groups(), i = e.getSource().getBindingContext("view").getProperty("i");
			g[i].rule = e.getParameter("item").getKey(); this._upd({ groups: g });
		},
		onGroupRuleSel: function (e) {
			var g = this._groups(), i = e.getSource().getBindingContext("view").getProperty("i");
			g[i].rule = e.getSource().getSelectedKey(); this._upd({ groups: g });
		},
		onAddGroup: function () { var g = this._groups(); g.push({ who: "", rule: "any" }); this._upd({ groups: g }); },
		onRemoveGroup: function (e) {
			var g = this._groups(), i = e.getSource().getBindingContext("view").getProperty("i");
			if (g.length <= 2) { MessageToast.show(this.text("fd.v.twoGroups", [""])); return; }
			g.splice(i, 1); this._upd({ groups: g });
		},
		_approverPool: function (p) {
			var that = this;
			if (p.mode === "parallel") { return [].concat.apply([], (p.groups || []).map(function (g) { return that._whoMembers(g.who); })); }
			return p.approverType === "team" ? ((this._team(p.approverTeam) || {}).members || []).slice() : (p.approvers || []).slice();
		},

		/* Notification: in-app and/or email; message in Arabic and English. */
		onChannel: function () {
			var s = this.viewModel().getProperty("/wf/sel"), ch = [];
			if (s.inApp) { ch.push("inApp"); } if (s.email) { ch.push("email"); }
			this._upd({ channels: ch });
		},
		onRecipients: function (e) { this._upd({ recipients: e.getSource().getSelectedKeys() }); },
		onInsertVar: function (e) {
			var v = "{" + e.getSource().data("var") + "}", s = this.viewModel().getProperty("/wf/sel"), k = this.viewModel().getProperty("/wf/msgLang") === "ar" ? "messageAr" : "messageEn";
			var o = {}; o[k] = (s[k] || "") + (s[k] && !/\s$/.test(s[k]) ? " " : "") + v; this._upd(o);
		},
		varText: function (k) { return "{" + k + "}"; },
		newerText: function (v) { return v ? this.text("fd.newerTemplateLong", [v]) : ""; },
		_recipientOptions: function (id) {
			var that = this, prevApproval = this._flow.ancestors(id).some(function (a) { return a.type === "approval"; });
			return [{ key: "requester", text: this.text("fd.rcp.requester"), group: "" }]
				.concat(prevApproval ? [{ key: "approvers", text: this.text("fd.rcp.approvers"), group: "" }] : [])
				.concat(TEAMS.map(function (t) { return { key: "team:" + t.key, text: that._teamText(t.key), group: that.text("wf.ap.team") }; }))
				.concat(People.names().map(function (n) { return { key: "user:" + n, text: that._personText(n), group: that.text("wf.ap.users") }; }));
		},

		/* Validation step. */
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

		/* Condition: template fields and the outputs of earlier steps. */
		_condFields: function (id, f) {
			f = f || this._flow;
			var that = this, T = this.text.bind(this), tpl = this._tplFields(f).map(function (x) { return { key: x.name, text: x.label, extra: x.name, group: T("fd.cond.grpTemplate") }; });
			var outs = [];
			f.ancestors(id).forEach(function (a) {
				(Flow.OUTPUTS[a.type] || []).forEach(function (o) {
					if (o.matchOnly && !((that._rule(a.props.rule) || {}).kind === "match")) { return; }
					outs.push({ key: "step:" + a.id + "." + o.name, text: that._label(a) + " → " + T("fd.out2." + o.name), extra: o.values ? o.values.join(" | ") : o.type, group: T("fd.cond.grpSteps") });
				});
			});
			return tpl.concat(outs);
		},
		_condFieldText: function (key, f) {
			if (!key) { return ""; }
			if (key.indexOf("step:") !== 0) { return key; }
			var parts = key.slice(5).split("."), n = (f || this._flow).node(parts[0]);
			return (n ? this._label(n) : parts[0]) + "." + parts[1];
		},
		_condValueHint: function (key) {
			if (!key || key.indexOf("step:") !== 0) { return ""; }
			var parts = key.slice(5).split("."), n = this._flow.node(parts[0]), o = n && (Flow.OUTPUTS[n.type] || []).filter(function (x) { return x.name === parts[1]; })[0];
			return o && o.values ? this.text("fd.cond.values", [o.values.join(", ")]) : o && o.type === "decimal" ? this.text("fd.cond.number") : "";
		},
		onCondField: function (e) { this._upd({ field: e.getSource().getSelectedKey() }); },

		/* Script step: language, code, template fields. */
		_syncEditor: function () {
			var ed = this.byId("codeEditor"), s = this.viewModel().getProperty("/wf/sel");
			if (!ed || s.type !== "script") { return; }
			ed.setFields(this._tplFields()); ed.setLanguage(s.language || "python"); ed.setValue(s.code || "");
			ed.setEditable(!this.viewModel().getProperty("/wf/readOnly"));
		},
		onLanguage: function (e) {
			var k = e.getParameter("item").getKey(), s = this.viewModel().getProperty("/wf/sel"), code = s.code;
			if (!code || code === PY_SAMPLE || code === SQL_SAMPLE) { code = k === "sql" ? SQL_SAMPLE : PY_SAMPLE; }
			this._upd({ language: k, code: code });
		},
		onCode: function (e) {
			if (this.viewModel().getProperty("/wf/readOnly")) { return; }
			var id = this.viewModel().getProperty("/wf/sel/id"), n = this._flow.node(id), that = this;
			if (!n) { return; }
			if (!this._codeSnap) { this._snap(); this._codeSnap = true; }
			n.props.code = e.getParameter("value");
			clearTimeout(this._codeT);
			this._codeT = setTimeout(function () { that._codeSnap = false; that._render(); }, 600);
		},
		onInsertField: function (e) {
			var f = e.getSource().data("field"), lang = this.viewModel().getProperty("/wf/sel/language");
			this.byId("codeEditor").insertText(lang === "sql" ? ":" + f : "record[\"" + f + "\"]");
		},

		/* Write-back: connection, Mapping section, transformations. */
		onConnection: function (e) {
			var k = e.getSource().getSelectedKey(), dom = this.viewModel().getProperty("/wf/domain");
			this._upd({ connection: k, entity: dom, mapping: {} });
		},
		onMapping: function (e) { this._upd({ mapping: e.getParameter("mapping") }); },
		_fxApply: function (fx, rec, sample) {
			var v = fx && fx.type === "const" ? "" : String(rec == null ? "" : rec);
			if (!fx || !fx.type) { return v; }
			switch (fx.type) {
			case "const": return String(fx.arg || "");
			case "upper": return v.toUpperCase();
			case "trim": return v.replace(/\s+/g, " ").trim();
			case "truncate": return v.slice(0, parseInt(fx.arg, 10) || v.length);
			case "concat": return [v, sample && fx.src2 ? sample[fx.src2] || "" : ""].filter(Boolean).join(fx.arg || " ");
			case "default": return v.trim() ? v : String(fx.arg || "");
			}
			return v;
		},
		onTransform: function (e) {
			if (this.viewModel().getProperty("/wf/readOnly")) { return; }
			var that = this, T = this.text.bind(this), target = e.getParameter("target"), id = this.viewModel().getProperty("/wf/sel/id");
			var mp = clone(this._flow.node(id).props.mapping || {}), cur = mp[target], fx = (cur && cur.fx) || { type: "", arg: "", src2: "" };
			var tf = this._targetFields(this._flow.node(id).props).filter(function (t) { return t.name === target; })[0] || {};
			var sample = (this._W.samples.filter(function (s) { return s.template === that._templateKey(); })[0] || { values: {} }).values;
			var fields = this._tplFields();
			var oType = new Select({ width: "100%", selectedKey: fx.type, items: this.viewModel().getProperty("/wf/fxTypes").map(function (x) { return new Item({ key: x.key, text: x.text }); }) });
			var oSrc = new Select({ width: "100%", selectedKey: srcOf(cur), forceSelection: false,
				items: [new Item({ key: "", text: T("wf.none") })].concat(fields.map(function (f) { return new Item({ key: f.name, text: f.label + " · " + f.name }); })) });
			var oArg = new Input({ value: fx.arg || (fx.type === "truncate" && tf.maxLen ? String(tf.maxLen) : ""), valueLiveUpdate: true });
			var oSrc2 = new Select({ width: "100%", selectedKey: fx.src2 || "", forceSelection: false,
				items: [new Item({ key: "", text: T("wf.none") })].concat(fields.map(function (f) { return new Item({ key: f.name, text: f.label + " · " + f.name }); })) });
			var oArgL = new Label({ text: "" }), oSrc2L = new Label({ text: T("fd.fx.second") }), oPrev = new Text({ text: "" }).addStyleClass("repoioFxPrev");
			var sync = function () {
				var k = oType.getSelectedKey();
				oArg.setVisible(/^(const|truncate|concat|default)$/.test(k)); oArgL.setVisible(oArg.getVisible());
				oArgL.setText(T("fd.fx.arg." + (k || "const")));
				oSrc2.setVisible(k === "concat"); oSrc2L.setVisible(k === "concat");
				oSrc.setEnabled(k !== "const");
				var val = that._fxApply({ type: k, arg: oArg.getValue(), src2: oSrc2.getSelectedKey() }, sample[oSrc.getSelectedKey()], sample);
				oPrev.setText(T("fd.fx.preview") + ": " + (val === "" ? "∅" : "“" + val + "”") + (tf.maxLen && val.length > tf.maxLen ? "  ⚠ " + T("fd.fx.tooLong", [tf.maxLen]) : ""));
			};
			[oType, oSrc, oSrc2].forEach(function (c) { c.attachChange(sync); });
			oArg.attachLiveChange(sync);
			var pop = new ResponsivePopover({
				title: T("fd.fx.title", [target]), contentWidth: "20rem", placement: "Auto",
				content: [new VBox({ items: [
					new Label({ text: T("fd.fx.type") }), oType, new Label({ text: T("fd.templateField") }).addStyleClass("sapUiTinyMarginTop"), oSrc,
					oArgL.addStyleClass("sapUiTinyMarginTop"), oArg, oSrc2L.addStyleClass("sapUiTinyMarginTop"), oSrc2, oPrev.addStyleClass("sapUiSmallMarginTop")
				] }).addStyleClass("sapUiSmallMargin")],
				beginButton: new Button({ text: T("fd.fx.apply"), type: "Emphasized", press: function () {
					var k = oType.getSelectedKey(), s = oSrc.getSelectedKey();
					if (!k && !s) { delete mp[target]; }
					else if (!k) { mp[target] = s; }
					else { mp[target] = { src: k === "const" ? "" : s, fx: { type: k, arg: oArg.getValue(), src2: oSrc2.getSelectedKey() } }; }
					pop.close(); that._upd({ mapping: mp });
				} }),
				endButton: new Button({ text: T("common.cancel"), press: function () { pop.close(); } }),
				afterClose: function () { pop.destroy(); }
			});
			this.getView().addDependent(pop);
			sync();
			pop.openBy(e.getParameter("domRef"));
		},

		/* ---------- template version pinning and upgrade ---------- */

		onTemplateUpgrade: function () {
			var that = this, T = this.text.bind(this), node = this._tplNode(), t = this._tpl(node.props.template);
			var latest = t.versions[t.versions.length - 1], impact = this._upgradeImpact(latest.changes || []);
			var items = (latest.changes || []).map(function (c) {
				return new StandardListItem({ title: T("fd.up." + c.type, [c.from || c.name, c.to || ""]), icon: { renamed: "sap-icon://edit", removed: "sap-icon://less", added: "sap-icon://add" }[c.type],
					wrapping: true });
			});
			var impactItems = impact.map(function (x) {
				return new StandardListItem({ title: x.step, description: x.text, info: T("fd.up.act." + x.action), infoState: x.action === "migrate" ? "Success" : "Warning", wrapping: true, icon: NODE_ICON[x.type] });
			});
			var oDlg = new Dialog({
				title: T("fd.up.title", [this.lang() === "ar" ? t.ar : t.en, node.props.version, latest.v]), contentWidth: "36rem", resizable: true, draggable: true,
				content: [new VBox({ items: [
					new Title({ text: T("fd.up.changes", [latest.v, latest.date]), level: "H3", titleStyle: "H6" }), new List({ items: items, showSeparators: "Inner" }),
					new Title({ text: T("fd.up.impact"), level: "H3", titleStyle: "H6" }).addStyleClass("sapUiSmallMarginTop"),
					impactItems.length ? new List({ items: impactItems, showSeparators: "Inner" }) : new Text({ text: T("fd.up.noImpact") }),
					new MessageStrip({ text: T("fd.up.note"), showIcon: true }).addStyleClass("sapUiSmallMarginTop")
				] }).addStyleClass("sapUiSmallMargin")],
				beginButton: new Button({ text: T("fd.up.apply", [latest.v]), type: "Emphasized", enabled: !this.viewModel().getProperty("/wf/readOnly"), press: function () {
					oDlg.close(); that._applyUpgrade(latest);
				} }),
				endButton: new Button({ text: T("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg); oDlg.open();
		},
		/* Which steps a template change touches, and whether it can be migrated automatically. */
		_upgradeImpact: function (changes) {
			var that = this, out = [], T = this.text.bind(this);
			var uses = function (n, field) {
				var p = n.props || {};
				switch (n.type) {
				case "writeBack": return Object.keys(p.mapping || {}).filter(function (k) { var v = p.mapping[k]; return srcOf(v) === field || (v && v.fx && v.fx.src2 === field); }).length > 0;
				case "script": return new RegExp("record\\[\"" + field + "\"\\]|:" + field + "\\b").test(p.code || "");
				case "condition": return p.field === field;
				case "validation": return (p.fields || []).indexOf(field) > -1;
				}
				return false;
			};
			changes.filter(function (c) { return c.type !== "added"; }).forEach(function (c) {
				var field = c.from || c.name;
				that._flow.ordered().forEach(function (n) {
					if (uses(n, field)) {
						out.push({ id: n.id, type: n.type, step: that._label(n), action: c.type === "renamed" ? "migrate" : "review",
							text: c.type === "renamed" ? T("fd.up.renameIn", [field, c.to]) : T("fd.up.removedIn", [field]) });
					}
				});
			});
			return out;
		},
		_applyUpgrade: function (latest) {
			var f = this._flow, node = this._tplNode();
			this._snap();
			(latest.changes || []).forEach(function (c) {
				f.ordered().forEach(function (n) {
					var p = n.props || {};
					if (c.type === "renamed") {
						if (n.type === "writeBack") {
							Object.keys(p.mapping || {}).forEach(function (k) {
								var v = p.mapping[k];
								if (v === c.from) { p.mapping[k] = c.to; }
								else if (v && typeof v === "object") { if (v.src === c.from) { v.src = c.to; } if (v.fx && v.fx.src2 === c.from) { v.fx.src2 = c.to; } }
							});
						}
						if (n.type === "script") { p.code = (p.code || "").split("record[\"" + c.from + "\"]").join("record[\"" + c.to + "\"]").replace(new RegExp(":" + c.from + "\\b", "g"), ":" + c.to); }
						if (n.type === "condition" && p.field === c.from) { p.field = c.to; }
						if (n.type === "validation") { p.fields = (p.fields || []).map(function (x) { return x === c.from ? c.to : x; }); }
					}
					// Removed fields are not dropped silently: validation flags every remaining use.
				});
			});
			node.props.version = latest.v;
			this._render(); this._select(node.id);
			MessageToast.show(this.text("fd.up.done", [latest.v, this.viewModel().getProperty("/wf/issueCount")]));
		},

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
				approval: { mode: "single", approverType: "users", approvers: [], approverTeam: "", rule: "any", sla: "P2D", escalateTo: "", groups: [],
					allowReturn: true, maxReturns: 2, sod: true, delegate: true },
				notification: { channels: ["inApp"], recipients: ["requester"], subjectEn: "", subjectAr: "", messageEn: "", messageAr: "" },
				script: { language: "python", code: PY_SAMPLE, timeoutMin: 5 },
				validation: { rule: "", fields: [], source: "golden", threshold: 0.85, severity: "block" },
				writeBack: { connection: "", entity: dom, conflict: "review", retries: 3, mapping: {} },
				condition: { field: "", op: "eq", value: "" }
			}[type];
		},
		_insert: function (from, port, type) {
			this._snap();
			this._clearOverlays(true);
			var id = this._flow.insert(from, port, type, this._defaults(type), "");
			this._render(); this._select(id);
			var c = this.byId("canvas"); setTimeout(function () { c.reveal(id); c.focusNode(id); }, 50);
		},
		onRemove: function (e) { this._remove(e.getParameter ? e.getParameter("id") : this.viewModel().getProperty("/wf/sel/id")); },
		onRemoveSel: function () { this._remove(this.viewModel().getProperty("/wf/sel/id")); },
		_remove: function (id) {
			var f = this._flow, that = this;
			if (this.viewModel().getProperty("/wf/readOnly") || !f.removable(id)) { return; }
			var side = f.sideBranchSize(id), go = function () { that._snap(); that._clearOverlays(true); f.remove(id); that._render(); that._select(""); };
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
				case "approval":
					if (p.mode === "parallel") {
						if ((p.groups || []).length < 2) { add(n, "fd.v.twoGroups"); }
						(p.groups || []).forEach(function (g, i) { if (!g.who) { add(n, "fd.v.groupEmpty", [i + 1]); } });
					} else if (!that._approverText(p)) { add(n, "wf.v.noApprover"); }
					break;
				case "notification":
					if (!(p.channels || []).length) { add(n, "fd.v.noChannel"); }
					if (!(p.recipients || []).length) { add(n, "fd.v.noRecipient"); }
					if (!(p.messageAr || "").trim()) { add(n, "fd.v.noMessageAr"); }
					if (!(p.messageEn || "").trim()) { add(n, "fd.v.noMessageEn"); }
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
					(p.fields || []).forEach(function (x) { if (!fields[x]) { add(n, "fd.v.unknownField", [x]); } });
					break;
				case "writeBack":
					if (!p.connection) { add(n, "wf.v.noTarget"); break; }
					var tf = that._targetFields(p), mp = p.mapping || {};
					if (!tf.length) { add(n, "fd.v.noAllowlist"); break; }
					if (!Object.keys(mp).length) { add(n, "wf.v.noMapping"); }
					tf.filter(function (t) { return t.key && !mp[t.name]; }).forEach(function (t) { add(n, "fd.v.keyUnmapped", [t.name]); });
					Object.keys(mp).forEach(function (k) {
						var s = srcOf(mp[k]), s2 = mp[k] && mp[k].fx && mp[k].fx.src2;
						if (s && !fields[s]) { add(n, "fd.v.unknownField", [s]); }
						if (s2 && !fields[s2]) { add(n, "fd.v.unknownField", [s2]); }
					});
					break;
				case "condition":
					var ok = p.field && that._condFields(n.id).some(function (x) { return x.key === p.field; });
					if (!p.field) { add(n, "fd.v.noConditionField"); } else if (!ok) { add(n, "fd.v.unknownField", [that._condFieldText(p.field)]); }
					else if (!/(empty|notEmpty)/.test(p.op) && !String(p.value || "").trim()) { add(n, "fd.v.noConditionValue"); }
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

		/* ---------- overlays: test run, compare, runs ---------- */

		_overlay: function (f) {
			var m = this.viewModel();
			if (m.getProperty("/wf/mode") === "runs") { return this._runsOverlay(f); }
			if (m.getProperty("/wf/test/active") && this._testResult) { return { kind: "run", nodes: this._testResult.nodes, edges: this._testResult.edges }; }
			if (m.getProperty("/wf/compare/active") && this._diff) {
				var nodes = {}, d = this._diff, T = this.text.bind(this);
				f.ordered().forEach(function (n) {
					var k = d.added.indexOf(n.id) > -1 ? "added" : d.changed.indexOf(n.id) > -1 ? "changed" : "same";
					nodes[n.id] = { diff: k, tag: k === "same" ? "" : T("fd.cmp." + k), tagKind: k === "added" ? "ok" : "warn" };
				});
				return { kind: "diff", nodes: nodes };
			}
			return { nodes: {} };
		},
		_clearOverlays: function (bKeepMode) {
			var m = this.viewModel();
			this._testResult = null; this._diff = null;
			m.setProperty("/wf/test", { active: false }); m.setProperty("/wf/compare", { active: false });
			if (!bKeepMode) { m.setProperty("/wf/mode", "design"); }
		},
		onClearOverlay: function () {
			this._clearOverlays(true);
			this.viewModel().setProperty("/wf/readOnly", this.viewModel().getProperty("/wf/state") !== "draft");
			this._render(); this._select("");
		},

		/* --- Test run: a preview of the path a sample request takes (nothing is written). --- */
		onTestRun: function () {
			var that = this, T = this.text.bind(this), key = this._templateKey();
			var samples = this._W.samples.filter(function (s) { return s.template === key; });
			if (!key || !samples.length) { MessageToast.show(T("fd.test.noSamples")); return; }
			var approvals = this._flow.ordered().filter(function (n) { return n.type === "approval"; });
			var oSample = new Select({ width: "100%", items: samples.map(function (s) { return new Item({ key: s.key, text: s.id + " · " + (that.lang() === "ar" ? s.ar : s.en) }); }) });
			var oReq = new Select({ width: "100%", items: People.names().map(function (n) { return new Item({ key: n, text: that._personText(n) }); }) });
			var syncReq = function () { var s = samples.filter(function (x) { return x.key === oSample.getSelectedKey(); })[0]; oReq.setSelectedKey(s.requester); };
			oSample.attachChange(syncReq); syncReq();
			var decisions = approvals.map(function (a) {
				return { id: a.id, sel: new Select({ width: "100%", selectedKey: "approved", items: ["approved", "returned", "rejected"].map(function (k) { return new Item({ key: k, text: T("fd.test.dec." + k) }); }) }) };
			});
			var form = new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanL: 4, labelSpanM: 4, labelSpanS: 12, columnsL: 1, columnsM: 1,
				content: [new Label({ text: T("fd.test.sample") }), oSample, new Label({ text: T("fd.rcp.requester") }), oReq]
					.concat([].concat.apply([], decisions.map(function (d) { return [new Label({ text: T("fd.test.decisionAt", [that._label(that._flow.node(d.id))]) }), d.sel]; }))) });
			var oDlg = new Dialog({
				title: T("fd.test.title"), contentWidth: "32rem", draggable: true,
				content: [new MessageStrip({ text: T("fd.test.note"), showIcon: true }).addStyleClass("sapUiSmallMargin"), form],
				beginButton: new Button({ text: T("fd.test.run"), type: "Emphasized", icon: "sap-icon://media-play", press: function () {
					var dec = {}; decisions.forEach(function (d) { dec[d.id] = d.sel.getSelectedKey(); });
					var s = clone(samples.filter(function (x) { return x.key === oSample.getSelectedKey(); })[0]);
					s.requester = oReq.getSelectedKey();
					oDlg.close(); that._runTest(s, dec);
				} }),
				endButton: new Button({ text: T("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg); oDlg.open();
		},

		_runTest: function (sample, decisions) {
			var that = this, T = this.text.bind(this), f = this._flow, rec = clone(sample.values), steps = {}, rows = [], nodes = {}, edges = {}, payload = [];
			var away = this._W.outOfOffice || {}, codes = this._W.codes || {};
			var fill = function (s) {
				return String(s || "").replace(/\{([\w.]+)\}/g, function (all, k) {
					return { "request.id": sample.id, "request.title": that.lang() === "ar" ? sample.ar : sample.en, "requester.name": that._personText(sample.requester),
						"decision": (steps.lastDecision || ""), "comment": T("fd.test.comment"), "record.business_name": rec.business_name, "link": "repo.io/cr/" + sample.id }[k] || all;
				});
			};
			var row = function (n, state, text, details, msg) {
				rows.push({ id: n.id, title: that._label(n), icon: NODE_ICON[n.type], state: state, text: text, details: details || "", msgAr: msg ? msg.ar : "", msgEn: msg ? msg.en : "" });
			};
			var go = function (id, from) {
				if (!id) { return; }
				var n = f.node(id), p = n.props || {}, port = "out", tag = "", kind = "ok", stop = false;
				if (from) { edges[from + ">" + id] = true; }
				switch (n.type) {
				case "begin": tag = sample.id; row(n, "Success", T("fd.test.submitted", [sample.id, that._personText(sample.requester)])); break;
				case "template": var v = that._tplVersion(); tag = "v" + (v ? v.v : ""); row(n, "Success", T("fd.test.tpl", [v ? v.v : ""])); break;
				case "validation":
					var r = that._rule(p.rule) || {}, fails = [], score = null;
					if (r.key === "match_duplicate") {
						score = sample.matchScore;
						if (score >= (p.threshold || 0.85)) { fails.push(T("fd.test.dup", [score, sample.matchWith || "—", p.threshold])); }
					} else if (r.key === "dq_required") {
						that._tplFields().filter(function (x) { return x.req && !String(rec[x.name] || "").trim(); }).forEach(function (x) { fails.push(T("fd.test.missing", [x.label])); });
					} else if (r.key === "dq_tax_eg") {
						if (!/^\d{9}$/.test(String(rec.tax_number || ""))) { fails.push(T("fd.test.badTax", [rec.tax_number || "∅"])); }
					} else if (r.key === "dq_email") {
						if (rec.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rec.email)) { fails.push(T("fd.test.badEmail", [rec.email])); }
					} else if (r.key === "dq_codes_ref") {
						that._tplFields().filter(function (x) { return x.codeList && rec[x.name] && !(codes[x.name] && codes[x.name].values[rec[x.name]]); })
							.forEach(function (x) { fails.push(T("fd.test.badCode", [x.label, rec[x.name]])); });
					}
					var failed = fails.length && p.severity !== "warn";
					port = failed ? "failed" : "passed";
					steps[id] = { result: port, score: score };
					tag = score != null ? T("fd.test.score", [score]) : T("fd.port." + port); kind = failed ? "bad" : fails.length ? "warn" : "ok";
					row(n, failed ? "Error" : fails.length ? "Warning" : "Success", fails.length ? fails.join(" · ") : T("fd.test.passed"));
					break;
				case "approval":
					var pool = that._approverPool(p), notes = [], dec = decisions[id] || "approved";
					if (p.sod !== false && pool.indexOf(sample.requester) > -1) {
						pool = pool.filter(function (x) { return x !== sample.requester; });
						notes.push(T("fd.test.sod", [that._personText(sample.requester)]));
					}
					if (p.delegate) {
						pool = pool.map(function (x) {
							if (away[x]) { notes.push(T("fd.test.delegated", [that._personText(x), that._personText(away[x].delegate)])); return away[x].delegate; }
							return x;
						}).filter(function (x) { return x !== sample.requester; });
					}
					if (!pool.length) {
						var esc = that._whoMembers(p.escalateTo).filter(function (x) { return x !== sample.requester; });
						notes.push(esc.length ? T("fd.test.noOne", [that._whoText(p.escalateTo)]) : T("fd.test.noOneAtAll"));
						pool = esc;
					}
					if (p.mode === "parallel") { notes.unshift(T("fd.test.groups", [(p.groups || []).map(function (g) { return that._whoText(g.who); }).join(" + ")])); }
					var who = pool.map(function (x) { return that._personText(x); }).join(that._sep()) || "—";
					if (dec === "returned") {
						notes.push(p.allowReturn ? T("fd.test.returned") : T("fd.test.noReturn"));
						dec = p.allowReturn ? "approved" : "rejected";
					}
					port = dec === "rejected" ? "rejected" : "approved";
					steps.lastDecision = T("fd.port." + port);
					steps[id] = { decision: port, approver: pool[0] || "" };
					tag = T("fd.port." + port); kind = port === "approved" ? "ok" : "bad";
					row(n, port === "approved" ? "Success" : "Error", T("fd.test.approvers", [who]) + (notes.length ? " · " + notes.join(" · ") : ""));
					break;
				case "script":
					if (p.language === "python" && p.code === PY_SAMPLE) {
						// The sample script is previewed with its known effect; real scripts run in the isolated workers.
						rec.business_name = String(rec.business_name || "").trim().split(/\s+/).join(" ");
						if (rec.country === "EG" && !String(rec.tax_number || "").trim()) {
							stop = true; steps[id] = { status: "fail" };
							tag = T("fd.test.fail"); kind = "bad";
							row(n, "Error", T("fd.test.scriptFail", ["tax_number", T("fd.test.taxReq")]));
						} else { steps[id] = { status: "ok" }; tag = "ok"; row(n, "Success", T("fd.test.scriptOk", [rec.business_name])); }
					} else { steps[id] = { status: "ok" }; tag = T("fd.test.notSimulated"); kind = "muted"; row(n, "None", T("fd.test.scriptWorker")); }
					break;
				case "writeBack":
					var cn = that._conn(p.connection), mp = p.mapping || {};
					that._targetFields(p).forEach(function (t) {
						var v = mp[t.name]; if (!v) { return; }
						var s = srcOf(v), val = that._fxApply(v.fx, rec[s], rec), note = [];
						if (t.codeList && s && codes[s] && codes[s].values[val]) { note.push(T("fd.test.codeMapped", [val, codes[s].values[val][cn.sys]])); val = codes[s].values[val][cn.sys]; }
						if (t.maxLen && val.length > t.maxLen) { note.push(T("fd.fx.tooLong", [t.maxLen])); }
						if (v.fx) { note.push(T("fd.fxs." + v.fx.type) + (v.fx.arg ? " " + v.fx.arg : "")); }
						payload.push({ target: t.name, value: val === "" ? "∅" : val, from: s || "—", note: note.join(" · "), warn: t.maxLen && val.length > t.maxLen });
					});
					steps[id] = { status: "written" };
					tag = T("fd.test.payload", [payload.length]);
					row(n, "Information", T("fd.test.wb", [cn ? cn.text : "—", payload.length]));
					break;
				case "notification":
					var rcp = (p.recipients || []).map(function (r) { return that._recipientText(r); }).join(that._sep());
					tag = (p.channels || []).map(function (c) { return T("fd.ch." + c); }).join(" + ");
					row(n, "Information", T("fd.test.sent", [rcp]), "", { ar: fill(p.messageAr), en: fill(p.messageEn) });
					break;
				case "condition":
					var ref = p.field || "", val2 = ref.indexOf("step:") === 0 ? (steps[ref.slice(5).split(".")[0]] || {})[ref.split(".").pop()] : rec[ref];
					var a = String(val2 == null ? "" : val2), b = String(p.value || ""), num = !isNaN(parseFloat(a)) && !isNaN(parseFloat(b)), res;
					switch (p.op) {
					case "ne": res = a !== b; break; case "gt": res = num ? parseFloat(a) > parseFloat(b) : a > b; break;
					case "lt": res = num ? parseFloat(a) < parseFloat(b) : a < b; break; case "empty": res = !a.trim(); break; case "notEmpty": res = !!a.trim(); break;
					default: res = a === b;
					}
					port = res ? "yes" : "no"; tag = T("fd.port." + port);
					row(n, "Information", T("fd.test.cond", [that._condFieldText(ref), a || "∅", T("fd.port." + port)]));
					break;
				case "end":
					tag = T("fd.out." + (p.outcome || "completed")); kind = p.outcome === "rejected" ? "bad" : "ok";
					row(n, p.outcome === "rejected" ? "Error" : "Success", T("fd.test.ended", [tag]));
					break;
				}
				nodes[id] = { run: stop || kind === "bad" && n.type !== "end" ? "fail" : "on", tag: tag, tagKind: kind };
				if (stop) { rows.push({ id: id, title: T("fd.test.backTo"), icon: "sap-icon://undo", state: "Warning", text: T("fd.test.backText"), details: "" }); return; }
				if (n.type !== "end") { go(n.next[port] || n.next[Flow.PORTS[n.type][0]], id); }
			};
			go(f.root, null);
			f.ordered().forEach(function (n) { if (!nodes[n.id]) { nodes[n.id] = { run: "off" }; } });
			this._testResult = { nodes: nodes, edges: edges };
			var m = this.viewModel();
			m.setProperty("/wf/compare", { active: false }); this._diff = null;
			m.setProperty("/wf/test", { active: true, sample: sample.id + " · " + (this.lang() === "ar" ? sample.ar : sample.en), requester: this._personText(sample.requester),
				rows: rows, payload: payload, hasPayload: payload.length > 0 });
			this._render(); this._showTest();
		},
		_showTest: function () {
			this.viewModel().setProperty("/wf/sel", { id: "", type: "test", icon: "sap-icon://media-play", title: this.text("fd.test.results"), typeText: this.viewModel().getProperty("/wf/test/sample") });
			this.viewModel().setProperty("/wf/showProps", true);
		},
		onTestRowPress: function (e) { var id = e.getParameter("listItem").data("id"); this.byId("canvas").reveal(id); },

		/* --- Compare with another version --- */
		onCompare: function (e) {
			var that = this, T = this.text.bind(this), cur = this.viewModel().getProperty("/wf/version");
			var vs = Object.keys(this._store || {}).filter(function (v) { return +v !== cur; });
			if (!vs.length) { MessageToast.show(T("fd.cmp.none")); return; }
			var list = new List({ items: vs.map(function (v) {
				return new StandardListItem({ type: "Active", title: T("fd.cmp.with", [v]), icon: "sap-icon://compare", press: function () { pop.close(); that._compare(+v); } });
			}) });
			var pop = new ResponsivePopover({ title: T("fd.cmp.title"), placement: "Bottom", contentWidth: "16rem", content: [list], afterClose: function () { pop.destroy(); } });
			this.getView().addDependent(pop); pop.openBy(e.getSource());
		},
		_compare: function (v) {
			var d = Flow.diff(this._store[v], this._flow.toJSON()), that = this, T = this.text.bind(this), m = this.viewModel();
			this._testResult = null; m.setProperty("/wf/test", { active: false });
			this._diff = d;
			var row = function (id, kind) {
				var n = that._flow.node(id) || id;
				return { id: n.id || "", title: that._label(n), icon: NODE_ICON[n.type], kind: T("fd.cmp." + kind), state: kind === "added" ? "Success" : kind === "removed" ? "Error" : "Warning",
					details: kind === "changed" ? that._changeText(Flow.fromJSON(that._store[v]).node(id), that._flow.node(id)) : "" };
			};
			m.setProperty("/wf/compare", { active: true, version: v, rows: d.added.map(function (id) { return row(id, "added"); })
				.concat(d.changed.map(function (id) { return row(id, "changed"); }))
				.concat(d.removed.map(function (n) { return { id: "", title: that._label(n), icon: NODE_ICON[n.type], kind: T("fd.cmp.removed"), state: "Error", details: "" }; })) });
			this._render(); this._showCompare();
		},
		/* A short, readable list of what changed on a step. */
		_changeText: function (a, b) {
			var T = this.text.bind(this), out = [], pa = a.props || {}, pb = b.props || {};
			if ((a.name || "") !== (b.name || "")) { out.push(T("fd.cmp.renamed", [a.name || "—", b.name || "—"])); }
			Object.keys(Object.assign({}, pa, pb)).forEach(function (k) {
				if (JSON.stringify(pa[k]) !== JSON.stringify(pb[k])) {
					var s = function (v) { return v == null || v === "" ? "—" : typeof v === "object" ? "…" : String(v); };
					out.push(k + ": " + s(pa[k]) + " → " + s(pb[k]));
				}
			});
			if (JSON.stringify(a.next) !== JSON.stringify(b.next)) { out.push(T("fd.cmp.pathChanged")); }
			return out.join("\n");
		},
		_showCompare: function () {
			this.viewModel().setProperty("/wf/sel", { id: "", type: "compare", icon: "sap-icon://compare", title: this.text("fd.cmp.with", [this.viewModel().getProperty("/wf/compare/version")]),
				typeText: this.text("fd.cmp.sub", [this.viewModel().getProperty("/wf/version")]) });
			this.viewModel().setProperty("/wf/showProps", true);
		},
		onCompareRowPress: function (e) { var id = e.getParameter("listItem").data("id"); if (id) { this.byId("canvas").reveal(id); } },

		/* --- Runs: how the published version behaves (sample statistics in the prototype) --- */
		_runsVersion: function () {
			var rows = this.viewModel().getProperty("/wf/versions") || [];
			var p = rows.filter(function (r) { return r.state === "published"; })[0];
			return p ? p.v : null;
		},
		_runsFlow: function () { var v = this._runsVersion(); return v && this._store[v] ? Flow.fromJSON(this._store[v]) : this._flow; },
		onMode: function (e) {
			var k = e.getParameter("item").getKey(), m = this.viewModel();
			if (k === "runs" && !this._runsVersion()) { MessageToast.show(this.text("fd.runs.none")); m.setProperty("/wf/mode", "design"); return; }
			this._clearOverlays(true);
			m.setProperty("/wf/mode", k);
			m.setProperty("/wf/readOnly", k === "runs" || m.getProperty("/wf/state") !== "draft");
			this._render();
			if (k === "runs") { this._selectRunStat(""); } else { this._select(""); }
			var c = this.byId("canvas"); setTimeout(function () { c.fit(); }, 30);
		},
		_stat: function (n, i) {
			var T = this.text.bind(this), seed = (i * 37 + n.id.length * 11) % 10;
			switch (n.type) {
			case "template": return { started: 214, stats: [{ icon: "sap-icon://inbox", text: "214", title: T("fd.runs.started") }] };
			case "validation": return { failedPct: 9 + seed % 3, stats: [{ icon: "sap-icon://error", text: (9 + seed % 3) + "%", title: T("fd.runs.failed"), bad: true }] };
			case "approval": return { waiting: 7, avg: "1.8", breaches: 2, stats: [{ icon: "sap-icon://pending", text: "7", title: T("fd.runs.waiting") },
				{ icon: "sap-icon://time-entry-request", text: T("fd.runs.days", ["1.8"]), title: T("fd.runs.avg") }, { icon: "sap-icon://alert", text: "2", title: T("fd.runs.breaches"), bad: true }] };
			case "writeBack": return { waiting: 1, failedPct: 3, avg: "38s", stats: [{ icon: "sap-icon://pending", text: "1", title: T("fd.runs.waiting") }, { icon: "sap-icon://error", text: "3%", title: T("fd.runs.failed"), bad: true }] };
			case "notification": return { sent: 120 + seed * 9, stats: [{ icon: "sap-icon://email", text: String(120 + seed * 9), title: T("fd.runs.sent") }] };
			case "end": var c = n.props.outcome === "rejected" ? 11 + seed : 182; return { count: c, stats: [{ text: String(c), title: T("fd.runs.ended"), bad: n.props.outcome === "rejected" }] };
			}
			return {};
		},
		_runsOverlay: function (f) {
			var nodes = {}, that = this;
			f.ordered().forEach(function (n, i) { var s = that._stat(n, i); nodes[n.id] = { stats: s.stats }; });
			return { kind: "runs", nodes: nodes };
		},
		_selectRunStat: function (id) {
			var m = this.viewModel(), f = this._runsFlow(), T = this.text.bind(this), that = this, v = this._runsVersion();
			var all = f.ordered(), n = id ? f.node(id) : null;
			var rows = (n ? [n] : all.filter(function (x) { return x.type !== "begin"; })).map(function (x) {
				var s = that._stat(x, all.indexOf(x));
				return { id: x.id, title: that._label(x), icon: NODE_ICON[x.type], text: (s.stats || []).map(function (st) { return st.title + ": " + st.text; }).join(" · ") };
			});
			var waiting = n && n.type === "approval" ? [
				{ cr: "CR-2026-0518", who: this._teamText(n.props.approverTeam) || this._approverText(n.props), age: T("fd.runs.days", ["3.4"]), late: true },
				{ cr: "CR-2026-0521", who: this._personText("سارة عادل"), age: T("fd.runs.days", ["2.1"]), late: true },
				{ cr: "CR-2026-0530", who: this._personText("سارة عادل"), age: T("fd.runs.days", ["0.6"]), late: false }] : [];
			m.setProperty("/wf/runs", { version: v, rows: rows, waiting: waiting, hasWaiting: waiting.length > 0 });
			m.setProperty("/wf/sel", { id: id || "", type: "runs", icon: n ? NODE_ICON[n.type] : "sap-icon://line-chart", title: n ? this._label(n) : T("fd.runs.title", [v]),
				typeText: T("fd.runs.sub", [v]) });
			var cv = m.getProperty("/wf/canvas"); cv.nodes.forEach(function (x) { x.selected = x.id === id; }); m.setProperty("/wf/canvas", Object.assign({}, cv));
			m.setProperty("/wf/showProps", true);
		},

		/* ---------- lifecycle: save version, submit for publishing approval, publish, new version ---------- */

		_statusText: function () {
			var m = this.viewModel(), v = m.getProperty("/wf/version"), s = m.getProperty("/wf/state");
			m.setProperty("/wf/statusText", this.text("fd.state." + s) + " · v" + v);
			m.setProperty("/wf/roText", s === "review" ? this.text("fd.reviewNote", [v, m.getProperty("/wf/reviewer")]) : this.text("wf.roNote", [v]));
		},
		_now: function () { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()); },
		_setVersionRow: function (state, who) {
			var m = this.viewModel(), v = m.getProperty("/wf/version"), rows = m.getProperty("/wf/versions");
			var row = rows.filter(function (r) { return r.v === v; })[0];
			row.state = state; row.stateText = this.text("fd.state." + state); row.date = this._now() + " · " + this._personText(who || ME);
			if (state === "published") { rows.forEach(function (r) { if (r !== row && r.state === "published") { r.state = "retired"; r.stateText = this.text("fd.state.retired"); } }, this); }
			m.setProperty("/wf/versions", rows.slice());
		},
		onSave: function () {
			this._store[this.viewModel().getProperty("/wf/version")] = this._flow.toJSON();
			this._setVersionRow("draft");
			this.viewModel().setProperty("/wf/dirty", false);
			MessageToast.show(this.text("wf.saved", [this.viewModel().getProperty("/wf/version")]));
		},
		/* Who approves publishing: the domain owner, or the governance board when the owner is the designer. */
		_publishApprover: function () {
			var owner = this._domainOwner(this.viewModel().getProperty("/wf/domain"));
			return owner && owner !== ME ? { key: "user:" + owner, text: this._personText(owner) } : { key: "team:governance_board", text: this._teamText("governance_board") };
		},
		onPublish: function () {
			var issues = this._validate(), that = this, m = this.viewModel();
			if (issues.length) { this.onValidate(); MessageToast.show(this.text("wf.publishBlocked")); return; }
			var v = m.getProperty("/wf/version"), ap = this._publishApprover();
			MessageBox.confirm(this.text("fd.submitConfirm", [v, ap.text]), {
				title: this.text("fd.submit"),
				onClose: function (a) {
					if (a !== MessageBox.Action.OK) { return; }
					that._store[v] = that._flow.toJSON();
					m.setProperty("/wf/reviewer", ap.text);
					m.setProperty("/wf/state", "review"); m.setProperty("/wf/readOnly", true); m.setProperty("/wf/dirty", false);
					that._setVersionRow("review"); that._statusText(); that._render(); that._select("");
					MessageToast.show(that.text("fd.submitted", [ap.text]));
				}
			});
		},
		/* Prototype: act as the publishing approver. */
		onApprovePublish: function () {
			var m = this.viewModel(), v = m.getProperty("/wf/version");
			m.setProperty("/wf/state", "published"); m.setProperty("/wf/readOnly", true); m.setProperty("/wf/hasPublished", true);
			this._setVersionRow("published", m.getProperty("/wf/reviewer")); this._statusText(); this._render(); this._select("");
			MessageToast.show(this.text("wf.published", [v]));
		},
		onRejectPublish: function () {
			var m = this.viewModel(), that = this;
			MessageBox.warning(this.text("fd.rejectPublishText", [m.getProperty("/wf/reviewer")]), { onClose: function () {
				m.setProperty("/wf/state", "draft"); m.setProperty("/wf/readOnly", false);
				that._setVersionRow("draft"); that._statusText(); that._render(); that._select("");
			} });
		},
		onNewVersion: function () {
			var m = this.viewModel(), v = m.getProperty("/wf/version") + 1, rows = m.getProperty("/wf/versions");
			this._store[v - 1] = this._store[v - 1] || this._flow.toJSON();
			rows.unshift({ v: v, state: "draft", stateText: this.text("onto.state.draft"), date: this.text("wf.notSaved") });
			m.setProperty("/wf/versions", rows.slice()); m.setProperty("/wf/version", v);
			m.setProperty("/wf/state", "draft"); m.setProperty("/wf/readOnly", false); m.setProperty("/wf/mode", "design");
			this._hist = []; this._fut = [];
			this._clearOverlays(); this._statusText(); this._render(); this._select("");
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

		onFit: function () { this.byId("canvas").fit(); },
		onWorkflows: function () { this.navKey("workflowsList"); }
	});
});
