sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/workflowTemplates",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/TextArea",
	"sap/m/List",
	"sap/m/StandardListItem",
	"sap/m/ResponsivePopover",
	"sap/m/GroupHeaderListItem",
	"sap/ui/core/CustomData"
], function (BaseController, Templates, MessageToast, MessageBox, Dialog, Button, TextArea, List, StandardListItem, ResponsivePopover,
	GroupHeaderListItem, CustomData) {
	"use strict";

	var DOMAINS = ["Customer", "Vendor", "Product", "Author", "Employee", "Store"];
	/* Sample reference data for the prototype (real values come from RBAC config, the script registry and the connections registry). */
	var ROLES = [
		{ key: "customer_steward", en: "Customer data steward", ar: "أمين بيانات العملاء" },
		{ key: "vendor_steward", en: "Vendor data steward", ar: "أمين بيانات الموردين" },
		{ key: "product_steward", en: "Product data steward", ar: "أمين بيانات المنتجات" },
		{ key: "domain_owner", en: "Domain owner", ar: "مالك المجال" },
		{ key: "finance_approver", en: "Finance approver", ar: "معتمد مالي" },
		{ key: "sales_ops", en: "Sales operations", ar: "عمليات المبيعات" }
	];
	var SCRIPTS = [
		{ key: "segment_customers", file: "segment_customers.py", versions: ["3", "2", "1"] },
		{ key: "normalize_arabic_names", file: "normalize_arabic_names.py", versions: ["5", "4"] },
		{ key: "flag_tax_anomalies", file: "flag_tax_anomalies.py", versions: ["2", "1"] }
	];
	/* Field-level write-back allowlists per target system and entity (README §2.4: versioned configuration). */
	var ALLOW = {
		c4c: { Customer: [["business_name", "Name"], ["tax_number", "TaxNumber"], ["country", "CountryCode"], ["customer_group", "CustomerGroupCode"]] },
		erp: {
			Customer: [["business_name", "NAME1"], ["tax_number", "STCD1"], ["country", "LAND1"], ["customer_group", "KDGRP"]],
			Vendor: [["business_name", "NAME1"], ["tax_number", "STCD1"], ["payment_terms", "ZTERM"]],
			Product: [["business_name", "MAKTX"], ["isbn", "EAN11"]]
		}
	};
	var BLOCKS = [
		{ key: "approval", group: "steps", icon: "sap-icon://approvals", def: { type: "bpmn:UserTask", attrs: { "repoio:taskType": "approval", "repoio:approvalRule": "any" } } },
		{ key: "python", group: "steps", icon: "sap-icon://syntax", def: { type: "bpmn:ServiceTask", attrs: { "repoio:taskType": "python", "repoio:retries": 2, "repoio:timeoutMin": "15" } } },
		{ key: "writeBack", group: "steps", icon: "sap-icon://upload-to-cloud", def: { type: "bpmn:ServiceTask", attrs: { "repoio:taskType": "writeBack", "repoio:conflictPolicy": "review", "repoio:retries": 3, "repoio:backoff": "exponential" } } },
		{ key: "condition", group: "flow", icon: "sap-icon://split", def: { type: "bpmn:ExclusiveGateway" } },
		{ key: "parallel", group: "flow", icon: "sap-icon://combine", def: { type: "bpmn:ParallelGateway" } },
		{ key: "timer", group: "flow", icon: "sap-icon://fob-watch", def: { type: "bpmn:IntermediateCatchEvent", timer: "PT24H" } },
		{ key: "end", group: "flow", icon: "sap-icon://stop", def: { type: "bpmn:EndEvent", attrs: { "repoio:outcome": "completed" } } }
	];
	var GROUP_ORDER = { steps: 1, flow: 2, templates: 3 };

	return BaseController.extend("repoio.proto.controller.WorkflowDesigner", {
		onInit: function () {
			this.router().getRoute("workflow").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			if (this._started) { return; }
			this._started = true;
			var that = this, ar = this.lang() === "ar";
			var conns = (this.data().getProperty("/connections") || []).filter(function (c) { return c.type === "c4c" || c.type === "hana"; });
			this.viewModel().setProperty("/wf", {
				proc: { name: "" }, state: "draft", statusText: "", roText: "", readOnly: false, dirty: false, canUndo: false, canRedo: false,
				showProps: true, q: "", sel: {}, steps: [], stepCount: 0, version: 1,
				versions: [{ v: 1, state: "draft", stateText: this.text("onto.state.draft"), date: this.text("wf.notSaved") }],
				domains: DOMAINS.map(function (d) { return { key: d, text: that._domainText(d) }; }),
				roles: ROLES.map(function (r) { return { key: r.key, text: ar ? r.ar : r.en }; }),
				rolesOpt: [{ key: "", text: this.text("wf.none") }].concat(ROLES.map(function (r) { return { key: r.key, text: ar ? r.ar : r.en }; })),
				scripts: SCRIPTS,
				wbConnections: conns.map(function (c) {
					return { key: c.id, sys: c.type === "c4c" ? "c4c" : "erp", text: that.text(c.type === "c4c" ? "wf.sys.c4c" : "wf.sys.erp") + " · " + c.id };
				}),
				blocks: []
			});
			this._blocks();
			this._statusText();
			var d = this.byId("designer");
			Templates.build && d.importXML(Templates.build("approvalWriteBack", this.text.bind(this))).then(function () {
				that._afterImport();
			});
		},

		_domainText: function (d) {
			var c = (this.data().getProperty("/ontology/concepts") || []).filter(function (x) { return x.id === d; })[0];
			return c ? (this.lang() === "ar" ? c.nameAr : c.nameEn) : d;
		},
		_roleText: function (k) { var r = ROLES.filter(function (x) { return x.key === k; })[0]; return r ? (this.lang() === "ar" ? r.ar : r.en) : ""; },

		/* ---------- left: building blocks ---------- */

		_blocks: function () {
			var that = this, q = (this.viewModel().getProperty("/wf/q") || "").toLowerCase();
			var rows = BLOCKS.map(function (b) {
				return { key: b.key, group: b.group, groupOrder: GROUP_ORDER[b.group], icon: b.icon, title: that.text("wf.b." + b.key), desc: that.text("wf.bd." + b.key), tip: that.text("wf.dragHint") };
			}).concat(Templates.keys.map(function (k) {
				return { key: "tpl:" + k, group: "templates", groupOrder: 3, icon: "sap-icon://process", title: that.text("wf.tpl." + k), desc: that.text("wf.tpld." + k), tip: "" };
			}));
			this.viewModel().setProperty("/wf/blocks", rows.filter(function (r) { return !q || (r.title + " " + r.desc).toLowerCase().indexOf(q) > -1; }));
		},
		blockGroup: function (ctx) {
			var g = ctx.getProperty("group");
			return { key: g, text: this.text("wf.g." + g) };
		},
		blockHeader: function (g) { return new GroupHeaderListItem({ title: g.text }); },
		onBlockSearch: function () { this._blocks(); },

		/* Make the step / flow blocks draggable onto the canvas (bpmn-js create, like its own palette). */
		onBlocksRendered: function () {
			var that = this, d = this.byId("designer");
			this.byId("blockList").getItems().forEach(function (it) {
				var key = it.data && it.data("key");
				var dom = it.getDomRef();
				if (!key || !dom || key.indexOf("tpl:") === 0 || dom._repoioDrag) { return; }
				dom._repoioDrag = true;
				dom.setAttribute("draggable", "true");
				dom.addEventListener("dragstart", function (e) {
					e.preventDefault();
					if (that.viewModel().getProperty("/wf/readOnly")) { return; }
					d.startCreate(e, that._def(key));
				});
			});
		},

		_def: function (key) {
			var b = BLOCKS.filter(function (x) { return x.key === key; })[0];
			var def = JSON.parse(JSON.stringify(b.def));
			def.name = key === "parallel" ? this.text("wf.tpl.n.all") : key === "end" ? this.text("wf.tpl.n.completed") : this.text("wf.b." + key);
			if (key === "condition") { def.name = this.text("wf.tpl.n.approved"); }
			return def;
		},

		onBlockPress: function (e) {
			var key = e.getParameter("listItem").data("key");
			if (key.indexOf("tpl:") === 0) { this._loadTemplate(key.slice(4)); return; }
			this._add(key);
		},
		onQuickAdd: function (e) { this._add(e.getSource().data("key")); },
		_add: function (key) {
			if (this.viewModel().getProperty("/wf/readOnly")) { return; }
			var id = this.byId("designer").append(this._def(key));
			if (id) { this._select(id); }
		},

		_loadTemplate: function (k) {
			var that = this;
			if (this.viewModel().getProperty("/wf/readOnly")) { return; }
			MessageBox.confirm(this.text("wf.replaceConfirm", [this.text("wf.tpl." + k)]), {
				onClose: function (a) {
					if (a !== MessageBox.Action.OK) { return; }
					that.byId("designer").importXML(Templates.build(k, that.text.bind(that))).then(function () {
						that._afterImport(); that.viewModel().setProperty("/wf/dirty", true);
					});
				}
			});
		},

		_afterImport: function () {
			var d = this.byId("designer");
			setTimeout(function () { d.fit(); }, 60); // fit once the page layout has settled
			this._select("");
			this._refreshSteps();
			this._badges();
			this.byId("designer").setMarkers([], "repoio-invalid");
		},

		/* ---------- canvas events ---------- */

		onSelection: function (e) { this._select(e.getParameter("id"), true); },
		onChanged: function () {
			var d = this.byId("designer"), m = this.viewModel();
			m.setProperty("/wf/canUndo", d.canUndo());
			m.setProperty("/wf/canRedo", d.canRedo());
			m.setProperty("/wf/dirty", true);
			clearTimeout(this._chg);
			this._chg = setTimeout(function () {
				this._refreshSteps(); this._badges();
				var id = m.getProperty("/wf/sel/id");
				if (id && !d.element(id)) { this._select(""); } else { this._select(id || "", true); }
			}.bind(this), 60);
		},
		onElementChanged: function () { /* handled through commandStack.changed */ },

		_kind: function (el) {
			if (!el) { return "process"; }
			var bo = el.businessObject, t = el.type;
			if (t === "bpmn:SequenceFlow") { return "flow"; }
			if (t === "bpmn:ExclusiveGateway") { return "exclusive"; }
			if (t === "bpmn:ParallelGateway") { return "parallel"; }
			if (t === "bpmn:StartEvent") { return "start"; }
			if (t === "bpmn:EndEvent") { return "end"; }
			if (t === "bpmn:IntermediateCatchEvent" && bo.eventDefinitions && bo.eventDefinitions[0] && bo.eventDefinitions[0].$type === "bpmn:TimerEventDefinition") { return "timer"; }
			var tt = bo.get("repoio:taskType");
			if (tt) { return tt; }
			if (/Task$/.test(t)) { return "task"; }
			return "other";
		},
		_kindIcon: function (k) {
			return { process: "sap-icon://process", approval: "sap-icon://approvals", python: "sap-icon://syntax", writeBack: "sap-icon://upload-to-cloud",
				exclusive: "sap-icon://split", parallel: "sap-icon://combine", timer: "sap-icon://fob-watch", start: "sap-icon://media-play",
				end: "sap-icon://stop", flow: "sap-icon://journey-arrive", task: "sap-icon://task", other: "sap-icon://border" }[k];
		},

		_select: function (id, bFromCanvas) {
			var d = this.byId("designer"), el = id ? d.element(id) : null, k = this._kind(el), m = this.viewModel(), that = this;
			var bo = el ? el.businessObject : d.root().businessObject, g = function (a) { return bo.get("repoio:" + a); };
			if (!bo) { return; } // selection events fire while a diagram is being cleared or imported
			var sel = { id: el ? el.id : "", kind: k, icon: this._kindIcon(k), typeText: this.text("wf.k." + k), name: bo.name || "",
				tech: el ? el.id : (bo.get("repoio:techName") || this._techName(bo.name || "")), isTask: /^(approval|python|writeBack|task)$/.test(k) };
			if (k === "process") {
				sel.domain = g("domain") || ""; sel.owner = g("owner") || "محمد";
				m.setProperty("/wf/proc/name", bo.name || this.text("wf.untitled"));
			}
			if (k === "approval") {
				sel.approverRole = g("approverRole") || ""; sel.approvalRule = g("approvalRule") || "any"; sel.dueIn = g("dueIn") || ""; sel.escalateTo = g("escalateTo") || "";
			}
			if (k === "python") {
				sel.scriptId = g("scriptId") || ""; sel.scriptVersion = g("scriptVersion") || ""; sel.retries = bo.get("repoio:retries") || 0; sel.timeoutMin = parseInt(g("timeoutMin") || "15", 10);
				sel.versionsOpt = this._versionsOpt(sel.scriptId);
			}
			if (k === "writeBack") {
				sel.connection = g("connection") || ""; sel.entity = g("entity") || d.root().businessObject.get("repoio:domain") || "Customer";
				sel.conflictPolicy = g("conflictPolicy") || "review"; sel.retries = bo.get("repoio:retries") || 0; sel.backoff = g("backoff") || "exponential";
				sel.mapping = this._mappingRows(this._sys(sel.connection), sel.entity, g("fieldMapping"));
			}
			if (k === "exclusive") {
				sel.paths = (el.outgoing || []).map(function (f) {
					var c = f.businessObject.conditionExpression, isDef = bo.default === f.businessObject;
					return { id: f.id, name: f.businessObject.name || that._name(f.target), cond: isDef ? that.text("wf.defaultPath") : (c ? c.body : that.text("wf.noCondition")),
						isDefault: isDef, missing: !isDef && !c && (el.outgoing || []).length > 1 };
				});
			}
			if (k === "flow") {
				var src = el.source, cexp = bo.conditionExpression ? bo.conditionExpression.body : "";
				sel.fromExclusive = !!src && src.type === "bpmn:ExclusiveGateway";
				sel.isDefault = sel.fromExclusive && src.businessObject.default === bo;
				var mm = /\$\{\s*([\w.]+)\s*(==|!=|>|<)\s*'?([^'}]*?)'?\s*\}/.exec(cexp || "");
				sel.cField = mm ? mm[1] : "decision"; sel.cOp = mm ? mm[2] : "=="; sel.cValue = mm ? mm[3] : ""; sel.cond = cexp || this.text("wf.noCondition");
				sel.typeText = this.text("wf.k.flow") + (src && el.target ? " · " + this._name(src) + " → " + this._name(el.target) : "");
			}
			if (k === "timer") {
				var body = ((bo.eventDefinitions[0].timeDuration || {}).body) || "PT24H", tm = /^P(?:T(\d+)([MH])|(\d+)D)$/.exec(body);
				sel.timer = body; sel.tAmount = tm ? parseInt(tm[1] || tm[3], 10) : 24; sel.tUnit = tm ? (tm[2] || "D") : "H";
			}
			if (k === "end") { sel.outcome = g("outcome") || "completed"; }
			m.setProperty("/wf/sel", sel);
			if (!bFromCanvas) { d.select(sel.id); }
		},
		_name: function (el) { return el ? (el.businessObject.name || this.text("wf.k." + this._kind(el))) : ""; },
		_techName: function (s) {
			var t = (String(s).match(/[A-Za-z0-9]+/g) || []).join("_").toUpperCase();
			return "WF_" + (t || "NEW_WORKFLOW").slice(0, 36);
		},
		_versionsOpt: function (script) {
			var s = SCRIPTS.filter(function (x) { return x.key === script; })[0], that = this;
			return s ? s.versions.map(function (v, i) { return { key: v, text: "v" + v + (i === 0 ? " · " + that.text("onto.state.published") : "") }; }) : [];
		},
		_sys: function (conn) {
			var c = this.viewModel().getProperty("/wf/wbConnections").filter(function (x) { return x.key === conn; })[0];
			return c ? c.sys : "";
		},
		_mappingRows: function (sys, entity, json) {
			var allow = (ALLOW[sys] || {})[entity] || [], on = {};
			try { (JSON.parse(json || "[]") || []).forEach(function (p) { on[p[0]] = true; }); } catch (e) { /* ignore */ }
			return allow.map(function (p) { return { golden: p[0], target: p[1], on: !!on[p[0]] }; });
		},

		/* ---------- property edits → BPMN (undoable bpmn-js commands) ---------- */

		_upd: function (props) {
			var id = this.viewModel().getProperty("/wf/sel/id");
			this.byId("designer").update(id, props);
		},
		onName: function (e) {
			var v = e.getParameter("value").trim(), k = this.viewModel().getProperty("/wf/sel/kind");
			if (!v && (k === "process" || this.viewModel().getProperty("/wf/sel/isTask"))) { MessageToast.show(this.text("onto.nameRequired")); this._select(this.viewModel().getProperty("/wf/sel/id"), true); return; }
			this._upd({ name: v });
		},
		onAttr: function (e) {
			var p = {}; p["repoio:" + e.getSource().data("attr")] = e.getSource().getSelectedKey();
			this._upd(p);
		},
		onAttrNum: function (e) {
			var a = e.getSource().data("attr"), p = {};
			p["repoio:" + a] = a === "retries" ? e.getParameter("value") : String(e.getParameter("value"));
			this._upd(p);
		},
		onProcAttr: function (e) { var p = {}; p["repoio:" + e.getSource().data("attr")] = e.getSource().getSelectedKey(); this.byId("designer").update("", p); },
		onRule: function (e) { this._upd({ "repoio:approvalRule": e.getParameter("item").getKey() }); },
		onScript: function (e) {
			var k = e.getSource().getSelectedKey(), s = SCRIPTS.filter(function (x) { return x.key === k; })[0];
			this._upd({ "repoio:scriptId": k, "repoio:scriptVersion": s ? s.versions[0] : "" });
		},
		onWbTarget: function () {
			var sel = this.viewModel().getProperty("/wf/sel"), sys = this._sys(sel.connection);
			var allow = (ALLOW[sys] || {})[sel.entity] || [];
			// A new target starts from its full allowlist; fields outside the allowlist can never be selected.
			this._upd({ "repoio:connection": sel.connection, "repoio:targetSystem": sys, "repoio:entity": sel.entity, "repoio:fieldMapping": JSON.stringify(allow) });
		},
		onMapping: function () {
			var rows = this.viewModel().getProperty("/wf/sel/mapping");
			this._upd({ "repoio:fieldMapping": JSON.stringify(rows.filter(function (r) { return r.on; }).map(function (r) { return [r.golden, r.target]; })) });
		},
		onCondition: function () {
			var s = this.viewModel().getProperty("/wf/sel"), v = String(s.cValue || "").replace(/'/g, "");
			var num = /^-?\d+(\.\d+)?$/.test(v);
			var body = "${" + s.cField + " " + s.cOp + " " + (num ? v : "'" + v + "'") + "}";
			var moddle = this.byId("designer").get("moddle");
			this._upd({ conditionExpression: moddle.create("bpmn:FormalExpression", { body: body }) });
		},
		onDefaultPath: function (e) {
			var d = this.byId("designer"), el = d.element(this.viewModel().getProperty("/wf/sel/id"));
			var on = e.getParameter("selected");
			d.get("modeling").updateProperties(el.source, { "default": on ? el.businessObject : null });
			if (on && el.businessObject.conditionExpression) { d.get("modeling").updateProperties(el, { conditionExpression: undefined }); }
		},
		onTimer: function () {
			var s = this.viewModel().getProperty("/wf/sel"), n = Math.max(1, parseInt(s.tAmount, 10) || 1);
			var body = s.tUnit === "D" ? "P" + n + "D" : "PT" + n + s.tUnit;
			var d = this.byId("designer"), el = d.element(s.id), def = el.businessObject.eventDefinitions[0];
			d.get("modeling").updateModdleProperties(el, def, { timeDuration: d.get("moddle").create("bpmn:FormalExpression", { body: body }) });
		},
		onTaskType: function (e) {
			var key = e.getSource().getSelectedKey(), d = this.byId("designer"), el = d.element(this.viewModel().getProperty("/wf/sel/id"));
			var b = BLOCKS.filter(function (x) { return x.key === key; })[0];
			var nu = d.get("bpmnReplace").replaceElement(el, { type: b.def.type });
			d.get("modeling").updateProperties(nu, b.def.attrs);
			this._select(nu.id);
		},
		onStepPress: function (e) { this._select(e.getParameter("listItem").data("id")); },
		onDeleteSel: function () { this.byId("designer").removeSelected(); },
		onCloseProps: function () { this.viewModel().setProperty("/wf/showProps", false); },
		onUndo: function () { this.byId("designer").undo(); },
		onRedo: function () { this.byId("designer").redo(); },
		onZoomIn: function () { this.byId("designer").zoomBy(1.2); },
		onZoomOut: function () { this.byId("designer").zoomBy(1 / 1.2); },
		onFit: function () { this.byId("designer").fit(); },
		onWorkflows: function () { this.navKey("workflowsList"); },

		/* ---------- steps list, badges ---------- */

		_refreshSteps: function () {
			var that = this, d = this.byId("designer"), errs = this._errIds || {};
			var order = { start: 0, approval: 1, python: 2, writeBack: 3, task: 4, exclusive: 5, parallel: 6, timer: 7, end: 8, other: 9 };
			var steps = d.elements().filter(function (e) { return e.type !== "bpmn:SequenceFlow"; }).map(function (e) {
				var k = that._kind(e);
				return { id: e.id, name: that._name(e), kind: k, typeText: that.text("wf.k." + k), icon: that._kindIcon(k), error: !!errs[e.id], x: e.x };
			}).sort(function (a, b) { return a.x - b.x || order[a.kind] - order[b.kind]; });
			this.viewModel().setProperty("/wf/steps", steps);
			this.viewModel().setProperty("/wf/stepCount", steps.length);
		},
		_badges: function () {
			var that = this, d = this.byId("designer"), out = [];
			d.elements().forEach(function (e) {
				var k = that._kind(e), bo = e.businessObject;
				if (k === "approval") { out.push({ id: e.id, kind: k, text: that._roleText(bo.get("repoio:approverRole")) || that.text("wf.v.noApproverShort") }); }
				if (k === "python") { var s = bo.get("repoio:scriptId"); out.push({ id: e.id, kind: k, text: s ? "Python · " + s + " v" + (bo.get("repoio:scriptVersion") || "?") : "Python" }); }
				if (k === "writeBack") { var sys = bo.get("repoio:targetSystem"); out.push({ id: e.id, kind: k, text: that.text("wf.k.writeBack") + (sys ? " · " + that.text("wf.sys." + sys) : "") }); }
				if (k === "parallel") { out.push({ id: e.id, kind: k, text: "ALL" }); }
			});
			d.setBadges(out);
		},

		/* ---------- validation (J7 step 5) ---------- */

		_validate: function () {
			var that = this, d = this.byId("designer"), els = d.elements(), nodes = els.filter(function (e) { return e.type !== "bpmn:SequenceFlow"; }), issues = [];
			var add = function (el, key, args, sev) { issues.push({ id: el ? el.id : "", text: that.text(key, args || [el ? that._name(el) : ""]), sev: sev || "Error" }); };
			var proc = d.root().businessObject;
			if (!(proc.name || "").trim()) { add(null, "wf.v.noName", [""]); }
			if (!proc.get("repoio:domain")) { add(null, "wf.v.noDomain", [""]); }
			var starts = nodes.filter(function (e) { return e.type === "bpmn:StartEvent"; }), ends = nodes.filter(function (e) { return e.type === "bpmn:EndEvent"; });
			if (starts.length !== 1) { add(null, starts.length ? "wf.v.manyStarts" : "wf.v.noStart", [""]); }
			if (!ends.length) { add(null, "wf.v.noEnd", [""]); }
			// reachability from the start
			var seen = {}, stack = starts.slice();
			while (stack.length) {
				var n = stack.pop();
				if (seen[n.id]) { continue; }
				seen[n.id] = true;
				(n.outgoing || []).forEach(function (f) { if (f.target) { stack.push(f.target); } });
			}
			nodes.forEach(function (e) {
				var k = that._kind(e), bo = e.businessObject, inn = (e.incoming || []).length, out = (e.outgoing || []).length;
				if (k !== "start" && !inn) { add(e, "wf.v.noIncoming"); }
				else if (k !== "end" && !out) { add(e, "wf.v.noOutgoing"); }
				else if (starts.length && !seen[e.id]) { add(e, k === "end" ? "wf.v.unreachableEnd" : "wf.v.unreachable"); }
				if (k === "approval" && !bo.get("repoio:approverRole")) { add(e, "wf.v.noApprover"); }
				if (k === "python" && !bo.get("repoio:scriptId")) { add(e, "wf.v.noScript"); }
				if (k === "writeBack") {
					if (!bo.get("repoio:connection")) { add(e, "wf.v.noTarget"); }
					else {
						var mp = []; try { mp = JSON.parse(bo.get("repoio:fieldMapping") || "[]"); } catch (x) { mp = []; }
						if (!mp.length) { add(e, "wf.v.noMapping"); }
					}
				}
				if (k === "task" || k === "other") { add(e, "wf.v.untyped", null, "Warning"); }
				if (k === "exclusive" && out > 1) {
					(e.outgoing || []).forEach(function (f) {
						if (bo.default !== f.businessObject && !f.businessObject.conditionExpression) { add(f, "wf.v.noCondition", [that._name(e)]); }
					});
				}
			});
			return issues;
		},

		onValidate: function (e) {
			var issues = this._validate(), that = this, d = this.byId("designer");
			this._errIds = {};
			issues.forEach(function (i) { if (i.id) { that._errIds[i.id] = true; } });
			d.setMarkers(Object.keys(this._errIds), "repoio-invalid");
			this._refreshSteps();
			if (!issues.length) { MessageToast.show(this.text("wf.v.ok")); return issues; }
			var oList = new List({ items: issues.map(function (i) {
				return new StandardListItem({ title: i.text, icon: i.sev === "Error" ? "sap-icon://error" : "sap-icon://alert", type: i.id ? "Active" : "Inactive",
					highlight: i.sev, wrapping: true, customData: [new CustomData({ key: "id", value: i.id })] });
			}), itemPress: function (ev) { that._select(ev.getParameter("listItem").data("id")); oPop.close(); } });
			var oPop = new ResponsivePopover({ title: this.text("wf.v.found", [issues.length]), placement: "Bottom", contentWidth: "26rem", content: [oList],
				afterClose: function () { oPop.destroy(); } });
			this.getView().addDependent(oPop);
			oPop.openBy(e && e.getSource ? e.getSource() : this.byId("validateBtn"));
			return issues;
		},

		/* ---------- lifecycle: save version, publish (immutable), new version ---------- */

		_statusText: function () {
			var m = this.viewModel(), v = m.getProperty("/wf/version"), s = m.getProperty("/wf/state");
			m.setProperty("/wf/statusText", (s === "published" ? this.text("onto.state.published") : this.text("wf.draftNotPublished")) + " · v" + v);
			m.setProperty("/wf/roText", this.text("wf.roNote", [v]));
		},
		_now: function () { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()); },
		_setVersionRow: function (state) {
			var m = this.viewModel(), v = m.getProperty("/wf/version"), rows = m.getProperty("/wf/versions");
			var row = rows.filter(function (r) { return r.v === v; })[0];
			row.state = state; row.stateText = this.text(state === "published" ? "onto.state.published" : "onto.state.draft"); row.date = this._now() + " · محمد";
			m.setProperty("/wf/versions", rows.slice());
		},

		onSave: function () {
			var that = this;
			this.byId("designer").saveXML().then(function (xml) {
				that._saved = xml;
				that._setVersionRow("draft");
				that.viewModel().setProperty("/wf/dirty", false);
				MessageToast.show(that.text("wf.saved", [that.viewModel().getProperty("/wf/version")]));
			});
		},

		onPublish: function () {
			var issues = this._validate().filter(function (i) { return i.sev === "Error"; }), that = this;
			if (issues.length) { this.onValidate(); MessageToast.show(this.text("wf.publishBlocked")); return; }
			var v = this.viewModel().getProperty("/wf/version");
			MessageBox.confirm(this.text("wf.publishConfirm", [v]), {
				title: this.text("wf.publish"),
				onClose: function (a) {
					if (a !== MessageBox.Action.OK) { return; }
					var m = that.viewModel();
					that.byId("designer").saveXML().then(function (xml) {
						that._saved = xml;
						m.setProperty("/wf/state", "published");
						m.setProperty("/wf/readOnly", true);
						m.setProperty("/wf/dirty", false);
						that._setVersionRow("published");
						that._statusText();
						that.byId("designer").setMarkers([], "repoio-invalid");
						MessageToast.show(that.text("wf.published", [v]));
					});
				}
			});
		},

		onNewVersion: function () {
			var m = this.viewModel(), v = m.getProperty("/wf/version") + 1, rows = m.getProperty("/wf/versions");
			rows.unshift({ v: v, state: "draft", stateText: this.text("onto.state.draft"), date: this.text("wf.notSaved") });
			m.setProperty("/wf/versions", rows.slice());
			m.setProperty("/wf/version", v);
			m.setProperty("/wf/state", "draft");
			m.setProperty("/wf/readOnly", false);
			this._statusText();
			MessageToast.show(this.text("wf.newVersionMade", [v]));
		},

		onExport: function () {
			var that = this;
			this.byId("designer").saveXML().then(function (xml) {
				var root = that.byId("designer").root().businessObject;
				var file = (root.get("repoio:techName") || that._techName(that.viewModel().getProperty("/wf/proc/name"))) + "-v" + that.viewModel().getProperty("/wf/version") + ".bpmn";
				var oDlg = new Dialog({
					title: that.text("wf.exportTitle"), contentWidth: "48rem", resizable: true, draggable: true,
					content: [new TextArea({ editable: false, width: "100%", rows: 24 }).addStyleClass("repoioMono repoioTtl").setValue(xml)],
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
			});
		}
	});
});
