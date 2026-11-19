sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/GroupHeaderListItem",
	"sap/base/i18n/ResourceBundle",
	"repoio/proto/util/dq"
], function (BaseController, MessageToast, MessageBox, GroupHeaderListItem, ResourceBundle, DQ) {
	"use strict";

	var ME = "محمد", PEOPLE = ["سارة عادل", "أحمد ناصر", "منى فاروق"], SEVS = ["quarantine", "flag", "warn"],
		BLOCKED = /\b(import\s+(os|subprocess|socket|requests|urllib|http)|from\s+(os|subprocess|socket|requests|urllib|http)\b|open\s*\(|eval\s*\(|exec\s*\()/;
	var uid = 0;

	/* J10: test editor (visual builder or Python). */
	return BaseController.extend("repoio.proto.controller.DqEditor", {
		onInit: function () {
			this.viewModel().setProperty("/dqe", { mode: "builder", cur: {}, py: { log: [] }, cols: [], palette: [] });
			this.router().getRoute("dqEdit").attachPatternMatched(this._onMatched, this);
			// Test names are kept in Arabic and English; both bundles fill the suggested names
			var url = sap.ui.require.toUrl("repoio/proto/i18n/i18n.properties");
			this._bundles = Promise.all(["ar", "en"].map(function (l) {
				return ResourceBundle.create({ url: url, locale: l, supportedLocales: ["", "ar", "en"], fallbackLocale: "", async: true });
			}));
		},

		_onMatched: function (oEvent) {
			var that = this, a = oEvent.getParameter("arguments"), q = a["?query"] || {}, C = this.getOwnerComponent();
			Promise.all([DQ.load(this), C.getModel("rules").dataLoaded(), C.getModel("tables").dataLoaded(), C.getModel("stewardship").dataLoaded(), this._bundles,
				C.getModel("admin").dataLoaded()]).then(function (r) {
				that._m = r[0];
				that._B = { ar: r[4][0], en: r[4][1] };
				that._dqCfg = C.getModel("admin").getProperty("/system/dataQuality");
				var tests = that._m.getProperty("/tests"), edit = a.id !== "new" ? tests.filter(function (t) { return t.id === a.id; })[0] : null,
					from = q.from ? tests.filter(function (t) { return t.id === q.from; })[0] : null, base = edit || from;
				that._edit = edit;
				that._init(q.mode === "python" || (base && base.author === "python") ? "python" : "builder", base, !!edit);
			});
		},

		_init: function (mode, base, isEdit) {
			var that = this, T = this.text.bind(this), vm = this.viewModel(), m = this._m, ar = this.lang() === "ar",
				repos = this.data().getProperty("/repos"), tables = this.getOwnerComponent().getModel("tables").getProperty("/tables");
			vm.setProperty("/dqe", {
				mode: mode, isNew: !isEdit, cq: "", cur: {}, cols: [], palette: [],
				title: isEdit ? T("dqe.titleEdit", [base.id]) : T("dqe.titleNew"),
				crumb: isEdit ? base.id : T("dq.new"),
				modeText: T("dq.author." + mode), modeIcon: mode === "python" ? "sap-icon://syntax" : "sap-icon://drag-and-drop",
				level: base ? base.level : "repository", repo: base && base.repo ? base.repo : "customer-master",
				tableKey: base && base.level === "source" ? base.source + "." + base.schema + "." + base.table : "c4c.sales.customer",
				repoOpts: Object.keys(repos).map(function (k) { return { key: k, text: repos[k].name }; }),
				tableOpts: Object.keys(tables).map(function (k) { var p = k.split("."); return { key: k, text: DQ.SRC[p[0]] + " · " + p[1] + "." + p[2] }; }),
				lists: (m.getProperty("/refLists") || []).map(function (l) { return { key: l.key, text: (ar ? l.ar : l.en) + " (" + l.count + ")", systems: l.systems }; }),
				presets: (m.getProperty("/presets") || []).map(function (p) { return { key: p.key, text: T("dq.preset." + p.key) }; }),
				dimOpts: m.getProperty("/dims").map(function (k) { return { key: k, text: T("dq.dim." + k) }; }),
				reviewers: PEOPLE.map(function (p) { return { key: p, text: p }; }),
				pkgText: T("dq.pkgs", [(m.getProperty("/allowedPackages") || []).join(" · ")]),
				py: { log: [], running: false }
			});
			this._loadTarget(base, isEdit);
			if (mode === "python") { this._initPy(base, isEdit); }
			this._state();
		},

		/* ---------- target: repository or source table ---------- */
		onLevel: function () { this._retarget(); },
		onTarget: function () { this._retarget(); },
		_retarget: function () {
			var vm = this.viewModel(), repo = vm.getProperty("/dqe/level") === "repository";
			this._loadTarget(null, false);
			if (vm.getProperty("/dqe/mode") === "python") {
				vm.setProperty("/dqe/py/column", (vm.getProperty("/dqe/colOpts")[0] || {}).key || "");
				vm.setProperty("/dqe/py/sevIdx", SEVS.indexOf(repo ? "flag" : "warn"));
				vm.setProperty("/dqe/py/threshold", this._defTh().value);
				vm.setProperty("/dqe/pyFields", this._cols.filter(function (c) { return c.kind !== "table"; }).map(function (c) { return { name: c.key, type: c.kind, label: c.label }; }));
			}
			this._state();
		},
		_loadTarget: function (base, isEdit) {
			var that = this, T = this.text.bind(this), vm = this.viewModel(), ar = this.lang() === "ar", lvl = vm.getProperty("/dqe/level"), cols = [];
			var tests = this._m.getProperty("/tests"), mine;
			cols.push({ key: "", name: "", label: T("dqe.wholeTable"), icon: "sap-icon://table-view", meta: T("dqe.tableLevel"), kind: "table" });
			if (lvl === "repository") {
				var repo = vm.getProperty("/dqe/repo"), rc = this.getOwnerComponent().getModel("rules").getProperty("/repoColumns/" + repo) || [];
				rc.filter(function (c) { return !c.derived; }).forEach(function (c) {
					cols.push({ key: c.col, name: c.col, label: ar ? c.ar : c.en, icon: that._icon(c.kind), meta: T("dqe.kind." + (c.kind || "text")), kind: c.kind || "text" });
				});
				mine = tests.filter(function (t) { return t.level === "repository" && t.repo === repo; });
				this._target = { level: lvl, repo: repo, table: "staged." + ({ customers: "customer", products: "product", vendors: "vendor", authors: "author", employees: "employee", stores: "store" })[this.data().getProperty("/repos/" + repo + "/domainId")] };
			} else {
				var key = vm.getProperty("/dqe/tableKey"), X = this.getOwnerComponent().getModel("tables").getProperty("/tables/" + key) || { columns: [] }, p = key.split(".");
				X.columns.forEach(function (c) {
					cols.push({ key: c.name, name: c.name, label: ar ? c.ar : c.en, icon: that._icon(c.type === "Date" ? "date" : /Int|Dec|Num/.test(c.type) ? "number" : "text"),
						meta: c.type + " · " + T("dqe.empty", [c.nullPct.toFixed(1)]), kind: c.type === "Date" ? "date" : "text" });
				});
				mine = tests.filter(function (t) { return t.level === "source" && t.source === p[0] && t.schema === p[1] && t.table === p[2]; });
				this._target = { level: lvl, source: p[0], schema: p[1], table: p[2] };
			}
			// Tests that already exist show on their columns (a column a test names but the list lacks is added)
			mine.forEach(function (t) {
				if (!cols.some(function (c) { return c.key === t.column; })) {
					cols.push({ key: t.column, name: t.column, label: t.column, icon: that._icon("text"), meta: T("dqe.kind.text"), kind: "text" });
				}
			});
			cols.forEach(function (c) { c.checks = []; });
			mine.forEach(function (t) {
				var c = cols.filter(function (x) { return x.key === t.column; })[0];
				c.checks.push(that._fromTest(t, isEdit && base && base.id === t.id));
			});
			this._cols = cols;
			this._sel = { col: "", uid: 0 };
			// Duplicate: the copy starts as a new check on the same column
			if (base && !isEdit && this.viewModel().getProperty("/dqe/mode") === "builder") {
				var c0 = cols.filter(function (x) { return x.key === base.column; })[0], n = this._fromTest(base, true);
				n.isNew = true; n.testId = ""; n.uid = ++uid;
				n.ar = n.ar + " " + T("dqe.copySuffixAr"); n.en = n.en ? n.en + " (copy)" : "";
				c0.checks.push(n);
				this._sel = { col: c0.key, uid: n.uid };
			} else if (base && isEdit) {
				var mineChk = (cols.filter(function (x) { return x.key === base.column; })[0] || { checks: [] }).checks.filter(function (k) { return k.testId === base.id; })[0];
				if (mineChk) { this._sel = { col: base.column, uid: mineChk.uid }; }
			}
			this._render();
		},
		_icon: function (kind) { return { number: "sap-icon://number-sign", date: "sap-icon://calendar", table: "sap-icon://table-view", code: "sap-icon://list", array: "sap-icon://multi-select" }[kind] || "sap-icon://text"; },
		_fromTest: function (t, editable) {
			return { uid: ++uid, testId: t.id, isNew: false, edited: false, editable: !!editable, check: t.check, params: JSON.parse(JSON.stringify(t.params || {})),
				threshold: t.threshold, severity: t.severity, dim: t.dim, ar: DQ.name({ lang: function () { return "ar"; }, text: this._tx("ar") }, t),
				en: DQ.name({ lang: function () { return "en"; }, text: this._tx("en") }, t), status: t.status };
		},
		_tx: function (l) { var B = this._B[l]; return function (k, a) { return B.getText(k, a); }; },

		/* ---------- palette, columns, selection ---------- */
		groupDim: function (oCtx) { return { key: oCtx.getProperty("dim"), text: this.text("dq.dim." + oCtx.getProperty("dim")) }; },
		groupHeader: function (oGroup) { return new GroupHeaderListItem({ title: oGroup.text }); },
		_render: function () {
			var that = this, T = this.text.bind(this), vm = this.viewModel(), q = (vm.getProperty("/dqe/cq") || "").toLowerCase(), m = this._m,
				selCol = this._cols.filter(function (c) { return c.key === that._sel.col; })[0], dims = m.getProperty("/dims");
			vm.setProperty("/dqe/palette", m.getProperty("/checks").filter(function (c) { return c.key !== "python"; }).map(function (c) {
				var fits = selCol && (c.level === "table" ? selCol.kind === "table" : selCol.kind !== "table");
				return { key: c.key, dim: c.dim, dimOrder: dims.indexOf(c.dim), icon: c.icon, name: T("dq.chk." + c.key), desc: T("dqe.desc." + c.key),
					canAdd: !!fits, addTip: selCol ? T("dqe.addTo", [selCol.label]) : T("dqe.selectCol") };
			}));
			vm.setProperty("/dqe/cols", this._cols.filter(function (c) { return !q || (c.label + " " + c.name).toLowerCase().indexOf(q) > -1 || c.checks.length; }).map(function (c) {
				return Object.assign({}, c, { selected: c.key === that._sel.col, checks: c.checks.map(function (k) {
					var st = k.isNew ? "Information" : k.edited ? "Warning" : "None";
					return { uid: k.uid, col: c.key, text: T("dq.chk." + k.check) + (k.isNew ? " · " + T("dqe.new") : k.edited ? " · " + T("dqe.edited") : ""), status: st,
						isNew: k.isNew || k.edited, sel: k.uid === that._sel.uid, tip: (that.lang() === "ar" ? k.ar : k.en || k.ar) + (k.testId ? " · " + k.testId : "") };
				}) });
			}));
			var nNew = this._changes().length, total = this._cols.reduce(function (s, c) { return s + c.checks.length; }, 0);
			vm.setProperty("/dqe/colsTitle", T("dqe.cols", [this._cols.length - 1, total]));
			vm.setProperty("/dqe/colOpts", this._cols.filter(function (c) { return c.kind !== "table"; }).map(function (c) { return { key: c.key, text: c.label + " · " + c.name }; }));
			vm.setProperty("/dqe/levelHint", T("dq.tabHint." + vm.getProperty("/dqe/level")));
			this._cur();
			this._state(nNew);
		},
		onColSearch: function () { this._render(); },
		onColSelect: function (oEvent) {
			var c = oEvent.getParameter("listItem").getBindingContext("view").getObject();
			this._sel = { col: c.key, uid: c.checks.length === 1 ? c.checks[0].uid : 0 };
			this._render();
		},
		onTag: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject();
			this._sel = { col: o.col, uid: o.uid };
			this._render();
		},
		_find: function (u) { var r = null; this._cols.forEach(function (c) { c.checks.forEach(function (k) { if (k.uid === u) { r = { col: c, chk: k }; } }); }); return r; },

		/* Drag a check onto a column (UI5 drag and drop) */
		onDrop: function (oEvent) {
			var chk = oEvent.getParameter("draggedControl").getBindingContext("view").getObject(),
				col = oEvent.getParameter("droppedControl").getBindingContext("view").getObject();
			this._add(chk.key, col.key);
		},
		/* Keyboard and touch: select a column, then Add */
		onAddCheck: function (oEvent) { this._add(oEvent.getSource().getBindingContext("view").getProperty("key"), this._sel.col); },
		_add: function (key, colKey) {
			var T = this.text.bind(this), meta = DQ.check(this._m, key), col = this._cols.filter(function (c) { return c.key === colKey; })[0];
			if (!col) { return; }
			if ((meta.level === "table") !== (col.kind === "table")) {
				MessageToast.show(T(meta.level === "table" ? "dqe.t.tableOnly" : "dqe.t.columnOnly", [T("dq.chk." + key)]));
				return;
			}
			var repo = this._target.level === "repository", label = { ar: this._labelIn("ar", col), en: this._labelIn("en", col) },
				k = { uid: ++uid, testId: "", isNew: true, editable: true, check: key, params: this._defaults(key, col), dim: meta.dim,
					threshold: this._defTh().value, severity: repo ? "flag" : "warn", reason: "", approver: "",
					ar: this._B.ar.getText("dq.auto." + key, [label.ar]), en: this._B.en.getText("dq.auto." + key, [label.en]) };
			col.checks.push(k);
			this._sel = { col: col.key, uid: k.uid };
			MessageToast.show(T("dqe.t.added", [T("dq.chk." + key), col.label]));
			this._render();
		},
		_labelIn: function (l, col) {
			if (this._target.level === "repository") {
				var c = (this.getOwnerComponent().getModel("rules").getProperty("/repoColumns/" + this._target.repo) || []).filter(function (x) { return x.col === col.key; })[0];
				return c ? c[l] : col.name;
			}
			var X = this.getOwnerComponent().getModel("tables").getProperty("/tables/" + this.viewModel().getProperty("/dqe/tableKey")) || { columns: [] },
				d = X.columns.filter(function (x) { return x.name === col.key; })[0];
			return d ? d[l] : col.name;
		},
		_defaults: function (key, col) {
			var n = (col.key || "").toLowerCase(), preset = /mobile|whatsapp/.test(n) ? "egPhone" : /phone/.test(n) ? "egLandline" : /email/.test(n) ? "email" : /tax/.test(n) ? "tax9" : /isbn/.test(n) ? "isbn13" : "custom",
				rx = (this._m.getProperty("/presets").filter(function (p) { return p.key === preset; })[0] || {}).regex || "";
			switch (key) {
				case "inList": return { list: /state|governorate/.test(n) ? "governorates" : /territor/.test(n) ? "territories" : /stage/.test(n) ? "schoolStages" : /account_type/.test(n) ? "accountTypes" : "governorates" };
				case "pattern": return { preset: preset, regex: rx };
				case "length": return /tax/.test(n) ? { min: 9, max: 9 } : /national/.test(n) ? { min: 14, max: 14 } : { min: 1, max: 100 };
				case "range": return { min: 0, max: 1000 };
				case "rowCount": return { min: 1, max: 2000000 };
				case "requiredWhen": return { whenCol: "account_type", whenVal: "" };
				case "fresh": return { hours: 24 };
				default: return {};
			}
		},

		/* ---------- properties of the selected check ---------- */
		_cur: function () {
			var T = this.text.bind(this), vm = this.viewModel(), f = this._find(this._sel.uid);
			if (!f) { vm.setProperty("/dqe/cur", {}); return; }
			var k = f.chk, meta = DQ.check(this._m, k.check), lst = vm.getProperty("/dqe/lists").filter(function (l) { return l.key === k.params.list; })[0];
			this._chk = k;
			vm.setProperty("/dqe/cur", {
				key: k.uid, check: k.check, icon: meta.icon, checkText: T("dq.chk." + k.check), dimText: T("dq.dim." + k.dim), desc: T("dqe.desc." + k.check),
				ar: k.ar, en: k.en, params: JSON.parse(JSON.stringify(k.params)), threshold: k.threshold, sevIdx: SEVS.indexOf(k.severity),
				sevHint: T("dq.sevHint." + k.severity), thLabel: T("dqe.f.threshold", [f.col.label]),
				editable: k.editable, isNew: k.isNew, lockText: k.editable ? "" : T("dqe.locked", [k.testId]), testId: k.testId,
				listHint: lst ? T("dqe.listHint", [lst.systems.join(", ")]) : "", regexState: "None", canTry: true,
				reason: k.reason || "", approver: k.approver || "", thHint: this._defTh().text,
				tryText: "", tryFails: []
			});
			this._approvalUi();
			this._ge();
		},
		/* Default threshold for the target: the repository's own target (set by its data owner), else the platform default
		   (System configuration → Data quality). */
		_defTh: function () {
			var c = this._dqCfg || { repositoryThreshold: 99, sourceThreshold: 95, repoTargets: [] }, t = this._target || {};
			if (t.level === "repository") {
				var own = (c.repoTargets || []).filter(function (x) { return x.repo === t.repo; })[0];
				if (own) { return { value: own.threshold, text: this.text("dqe.th.repo", [own.threshold, own.owner]) }; }
				return { value: c.repositoryThreshold, text: this.text("dqe.th.platform", [c.repositoryThreshold]) };
			}
			return { value: c.sourceThreshold, text: this.text("dqe.th.platform", [c.sourceThreshold]) };
		},
		/* Four eyes: tests that hold records, thresholds below the default (or every change, per System configuration)
		   wait for a second person's approval; flag and warn-only tests at or above the default go live at once. */
		_why: function (sev, th) {
			var c = this._dqCfg || {};
			if (c.approvalFor === "all") { return "all"; }
			if (sev === "quarantine") { return "hold"; }
			if (th < this._defTh().value) { return "below"; }
			return "";
		},
		_approvalUi: function () {
			var vm = this.viewModel(), c = vm.getProperty("/dqe/cur"), sev = SEVS[c.sevIdx], th = Number(c.threshold), why = this._why(sev, th);
			vm.setProperty("/dqe/cur/below", th < this._defTh().value);
			vm.setProperty("/dqe/cur/needsApp", !!why && c.editable);
			vm.setProperty("/dqe/cur/appText", why ? this.text("dqe.app." + why) : "");
		},
		/* Copy the panel back to the check; a change to an existing test makes it "edited" (a new version on save) */
		_sync: function () {
			var k = this._chk, c = this.viewModel().getProperty("/dqe/cur");
			if (!k || !k.editable) { return; }
			k.ar = c.ar; k.en = c.en; k.params = JSON.parse(JSON.stringify(c.params)); k.threshold = Number(c.threshold); k.severity = SEVS[c.sevIdx] || k.severity;
			k.reason = c.reason; k.approver = c.approver;
			if (!k.isNew) { k.edited = true; }
			this.viewModel().setProperty("/dqe/cur/sevHint", this.text("dq.sevHint." + k.severity));
			this._approvalUi();
			this.viewModel().setProperty("/dqe/cur/tryText", "");
			this._ge();
			this._render();
		},
		onProp: function () { this._sync(); },
		onTh: function () { this._sync(); },
		onSev: function () { this._sync(); },
		onPreset: function () {
			var vm = this.viewModel(), k = vm.getProperty("/dqe/cur/params/preset"), p = this._m.getProperty("/presets").filter(function (x) { return x.key === k; })[0];
			if (p && p.key !== "custom") { vm.setProperty("/dqe/cur/params/regex", p.regex); }
			this._sync();
		},
		onRegex: function () {
			var vm = this.viewModel(), ok = true;
			try { new RegExp(vm.getProperty("/dqe/cur/params/regex")); } catch (e) { ok = false; }
			vm.setProperty("/dqe/cur/regexState", ok ? "None" : "Error");
			vm.setProperty("/dqe/cur/params/preset", "custom");
			if (ok) { this._sync(); }
		},
		onRemove: function () {
			var f = this._find(this._sel.uid);
			if (!f || !f.chk.isNew) { return; }
			f.col.checks = f.col.checks.filter(function (k) { return k.uid !== f.chk.uid; });
			this._sel.uid = 0;
			this._render();
		},
		onOpenExisting: function () { this.router().navTo("dqTest", { id: this.viewModel().getProperty("/dqe/cur/testId") }); },

		/* The expectation the DQ service will store (Great Expectations 1.x, read only) */
		_ge: function () {
			var k = this._chk, f = this._find(k.uid), col = f ? f.col.key : "", p = k.params, mostly = (k.threshold / 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""),
				meta = "meta={\"severity\": \"" + k.severity + "\", \"dimension\": \"" + k.dim + "\"" + (k.testId ? ", \"repoio_test\": \"" + k.testId + "\"" : "") + "}",
				arg = function (s) { return "    " + s + ","; }, c = "column=\"" + col + "\"", out;
			switch (k.check) {
				case "notNull": out = ["ExpectColumnValuesToNotBeNull(", arg(c)]; break;
				case "requiredWhen": out = ["ExpectColumnValuesToNotBeNull(", arg(c), arg("row_condition='" + p.whenCol + "==\"" + p.whenVal + "\"'"), arg("condition_parser=\"great_expectations\"")]; break;
				case "unique": out = ["ExpectColumnValuesToBeUnique(", arg(c)]; break;
				case "inList": out = ["ExpectColumnValuesToBeInSet(", arg(c), arg("value_set=reference_list(\"" + p.list + "\")  # from the reference data API")]; break;
				case "pattern": out = ["ExpectColumnValuesToMatchRegex(", arg(c), arg("regex=r\"" + p.regex + "\"")]; break;
				case "length": out = ["ExpectColumnValueLengthsToBeBetween(", arg(c), arg("min_value=" + p.min), arg("max_value=" + p.max)]; break;
				case "range": out = ["ExpectColumnValuesToBeBetween(", arg(c), arg("min_value=" + p.min), arg("max_value=" + p.max)]; break;
				case "notFuture": out = ["ExpectColumnValuesToBeBetween(", arg(c), arg("max_value={\"$PARAMETER\": \"now()\"}")]; break;
				case "rowCount": out = ["ExpectTableRowCountToBeBetween(", arg("min_value=" + p.min), arg("max_value=" + p.max)]; break;
				case "fresh": out = ["ExpectColumnMaxToBeBetween(", arg("column=\"changed\""), arg("min_value={\"$PARAMETER\": \"now() - timedelta(hours=" + p.hours + ")\"}")]; break;
				default: out = ["# custom expectation"];
			}
			if (["rowCount", "fresh"].indexOf(k.check) < 0 && out.length > 1) { out.push(arg("mostly=" + mostly)); }
			out.push(arg(meta), ")");
			this.byId("dqeGe").setValue("import great_expectations as gx\n\ngx.expectations." + out.join("\n"));
		},

		/* Try on sample records. In the product this is a call to the DQ service (POST /dq/tests/preview) that runs the
		   expectation on a sample of staged records; the prototype imitates it on the sample rows it has. */
		onTry: function () {
			var T = this.text.bind(this), vm = this.viewModel(), k = this._chk, f = this._find(k.uid), col = f.col.key, vals = this._sample(col), p = k.params;
			if (k.check === "rowCount" || k.check === "fresh") {
				vm.setProperty("/dqe/cur/tryText", T("dqe.try.table")); vm.setProperty("/dqe/cur/tryState", "Success"); vm.setProperty("/dqe/cur/tryIcon", "sap-icon://sys-enter-2");
				vm.setProperty("/dqe/cur/tryFails", []); return;
			}
			if (!vals.length) {
				vm.setProperty("/dqe/cur/tryText", T("dqe.try.none")); vm.setProperty("/dqe/cur/tryState", "None"); vm.setProperty("/dqe/cur/tryIcon", "sap-icon://message-information");
				vm.setProperty("/dqe/cur/tryFails", []); return;
			}
			var empty = function (v) { return v === null || v === undefined || String(v).trim() === ""; }, rx = null, seen = {};
			try { rx = p.regex ? new RegExp(p.regex) : null; } catch (e) { rx = null; }
			var bad = vals.filter(function (v) {
				switch (k.check) {
					case "notNull": case "requiredWhen": return empty(v);
					case "unique": var d = !empty(v) && seen[v]; seen[v] = true; return d;
					case "pattern": return !empty(v) && rx && !rx.test(String(v));
					case "length": return !empty(v) && (String(v).length < p.min || String(v).length > p.max);
					case "range": return !empty(v) && (isNaN(Number(v)) || Number(v) < p.min || Number(v) > p.max);
					case "notFuture": return !empty(v) && String(v) > "2026-11-17";
					case "inList": return !empty(v) && !/^[0-9A-Z]{2,6}(-[A-Z0-9]{1,4})?$/.test(String(v)) || /^[A-Z]{4,}$/.test(String(v));
					default: return false;
				}
			}), pass = 100 * (vals.length - bad.length) / vals.length, ok = pass >= k.threshold;
			vm.setProperty("/dqe/cur/tryText", T("dqe.try.result", [vals.length, vals.length - bad.length, bad.length, pass.toFixed(1)]));
			vm.setProperty("/dqe/cur/tryState", ok ? "Success" : "Error");
			vm.setProperty("/dqe/cur/tryIcon", ok ? "sap-icon://sys-enter-2" : "sap-icon://error");
			vm.setProperty("/dqe/cur/tryFails", bad.slice(0, 5).map(function (v) { return { t: empty(v) ? T("qa.empty") : String(v) }; }));
		},
		_sample: function (col) {
			if (this._target.level === "repository") {
				var q = this.getOwnerComponent().getModel("stewardship").getProperty("/quarantine") || [], repo = this._target.repo;
				return q.filter(function (x) { return x.repo === repo && Object.prototype.hasOwnProperty.call(x.record, col); }).map(function (x) { return x.record[col]; });
			}
			var X = this.getOwnerComponent().getModel("tables").getProperty("/tables/" + this.viewModel().getProperty("/dqe/tableKey")) || {};
			return (X.sample || []).concat((X.errors || []).map(function (e) { return e.row; })).filter(function (r) { return Object.prototype.hasOwnProperty.call(r, col); })
				.map(function (r) { return r[col]; });
		},

		/* ---------- Python ---------- */
		_initPy: function (base, isEdit) {
			var vm = this.viewModel(), repo = vm.getProperty("/dqe/level") === "repository", tpl = this._m.getProperty("/pythonTemplate"),
				col = base ? base.column : (vm.getProperty("/dqe/colOpts")[0] || {}).key || "";
			vm.setProperty("/dqe/py", {
				column: col, ar: base ? DQ.name({ lang: function () { return "ar"; }, text: this._tx("ar") }, base) + (isEdit ? "" : " " + this.text("dqe.copySuffixAr")) : "",
				en: base && base.en ? base.en + (isEdit ? "" : " (copy)") : "", dim: base ? base.dim : "consistency",
				threshold: base ? base.threshold : this._defTh().value, sevIdx: SEVS.indexOf(base ? base.severity : repo ? "flag" : "warn"), reason: "",
				reviewer: base && base.reviewer ? base.reviewer : "", code: base ? (base.params || {}).code : tpl.replace("COLUMN", col),
				log: [], running: false, thLabel: this.text("dqe.f.thresholdPy")
			});
			vm.setProperty("/dqe/pyFields", this._cols.filter(function (c) { return c.kind !== "table"; }).map(function (c) { return { name: c.key, type: c.kind, label: c.label }; }));
			this.byId("dqePy").setValue(vm.getProperty("/dqe/py/code"));
			this._pyDirty = false;
		},
		onCode: function (oEvent) { this.viewModel().setProperty("/dqe/py/code", oEvent.getParameter("value")); this._pyDirty = true; this._state(); },
		onPyProp: function () { this._pyDirty = true; this._state(); },
		/* Sample run in an isolated worker (no network, allowed packages only). The prototype imitates the worker's log. */
		onPyRun: function () {
			var that = this, T = this.text.bind(this), vm = this.viewModel(), code = vm.getProperty("/dqe/py/code") || "",
				tgt = this._target.level === "repository" ? this._target.table : this._target.schema + "." + this._target.table,
				lines = [T("dqe.log.queued"), T("dqe.log.pkgs"), T("dqe.log.load", [tgt])];
			vm.setProperty("/dqe/py/running", true);
			vm.setProperty("/dqe/py/log", []);
			vm.setProperty("/dqe/py/runText", T("dqe.run.running"));
			vm.setProperty("/dqe/py/runState", "Information");
			vm.setProperty("/dqe/py/runIcon", "sap-icon://in-progress");
			var blocked = BLOCKED.exec(code), syntax = !/def\s+\w+\s*\(/.test(code) || !/@(column|column_pair|table)_check\(/.test(code);
			var step = function (i) {
				if (i < lines.length && !(blocked && i === 2)) {
					vm.setProperty("/dqe/py/log", vm.getProperty("/dqe/py/log").concat([{ t: lines[i] }]));
					setTimeout(function () { step(i + 1); }, 450);
					return;
				}
				var out, ok;
				if (blocked) { out = [T("dqe.log.blocked", [blocked[0].trim()])]; ok = false; }
				else if (syntax) { out = [T("dqe.log.noCheck")]; ok = false; }
				else {
					var f = 7 + (code.length % 9), n = 1000;
					out = [T("dqe.log.ran", [n, n - f, f]), T("dqe.log.done", ["3.4"])]; ok = true;
				}
				vm.setProperty("/dqe/py/log", vm.getProperty("/dqe/py/log").concat(out.map(function (t) { return { t: t }; })));
				vm.setProperty("/dqe/py/running", false);
				vm.setProperty("/dqe/py/runText", ok ? T("dqe.run.ok") : T("dqe.run.fail"));
				vm.setProperty("/dqe/py/runState", ok ? "Success" : "Error");
				vm.setProperty("/dqe/py/runIcon", ok ? "sap-icon://sys-enter-2" : "sap-icon://error");
				that._pyRanOk = ok;
				that._state();
			};
			step(0);
		},

		/* ---------- save ---------- */
		_changes: function () {
			var out = [];
			(this._cols || []).forEach(function (c) { c.checks.forEach(function (k) { if (k.isNew || k.edited) { out.push({ col: c, chk: k }); } }); });
			return out;
		},
		_state: function () {
			var T = this.text.bind(this), vm = this.viewModel(), mode = vm.getProperty("/dqe/mode");
			if (mode === "python") {
				var py = vm.getProperty("/dqe/py") || {};
				var below = Number(py.threshold) < this._defTh().value;
				vm.setProperty("/dqe/py/below", below);
				vm.setProperty("/dqe/py/thHint", this._defTh().text);
				vm.setProperty("/dqe/canSave", !!(py.ar && py.ar.trim() && py.code && py.code.trim() && py.column && (!below || (py.reason && py.reason.trim()))));
				vm.setProperty("/dqe/primaryText", T("dqe.sendReview"));
				vm.setProperty("/dqe/footText", T("dqe.foot.python"));
				return;
			}
			var that = this, def = this._defTh().value, ch = this._changes(), valid = ch.every(function (x) {
				var p = x.chk.params, k = x.chk, why = that._why(k.severity, k.threshold);
				return k.ar && k.ar.trim() && (k.check !== "pattern" || p.regex) && (k.check !== "requiredWhen" || (p.whenCol && p.whenVal)) &&
					(k.threshold >= def || (k.reason && k.reason.trim())) && (!why || k.approver);
			}), nApp = ch.filter(function (x) { return !!that._why(x.chk.severity, x.chk.threshold); }).length, nNow = ch.length - nApp;
			vm.setProperty("/dqe/canSave", ch.length > 0 && valid);
			vm.setProperty("/dqe/primaryText", nApp && !nNow ? T("dqe.sendApproval", [nApp]) : nApp ? T("dqe.saveMixed", [nNow, nApp]) : T("dqe.activate", [ch.length]));
			vm.setProperty("/dqe/footText", ch.length ? T("dqe.foot.n", [ch.length]) + (valid ? "" : " · " + T("dqe.foot.invalid")) : T("dqe.foot.none"));
		},
		onPrimary: function () { this._save(this.viewModel().getProperty("/dqe/mode") === "python" ? "inReview" : "active"); },
		onDraft: function () { this._save("draft"); },
		_save: function (status) {
			var that = this, T = this.text.bind(this), vm = this.viewModel(), tests = this._m.getProperty("/tests"), tgt = this._target, saved = [];
			var next = function () { return "DQ-" + (Math.max.apply(null, tests.map(function (t) { return Number(t.id.slice(3)) || 0; })) + 1); };
			var put = function (o) {
				var ex = o.id ? tests.filter(function (t) { return t.id === o.id; })[0] : null;
				if (ex) { Object.assign(ex, o, { version: ex.version + 1, changed: "2026-11-17" }); saved.push(ex.id); return; }
				o.id = next();
				tests.push(Object.assign({ level: tgt.level, repo: tgt.repo || "", source: tgt.source || "", schema: tgt.schema || "", table: tgt.table, key: o.id.toLowerCase(),
					owner: ME, version: 1, changed: "2026-11-17", held: 0, runs: [], rows: 0, schedule: tgt.level === "repository" ? "stream" : "nightly" }, o));
				saved.push(o.id);
			};
			if (vm.getProperty("/dqe/mode") === "python") {
				var py = vm.getProperty("/dqe/py");
				if (status === "inReview" && !py.reviewer) { MessageBox.warning(T("dqe.needReviewer")); return; }
				if (status === "inReview" && !this._pyRanOk) { MessageBox.warning(T("dqe.needRun")); return; }
				put({ id: this._edit ? this._edit.id : "", check: "python", column: py.column, dim: py.dim, threshold: Number(py.threshold), severity: SEVS[py.sevIdx],
					author: "python", status: status, ar: py.ar, en: py.en, reviewer: py.reviewer, reason: py.reason || "",
					params: { code: py.code, expectation: ((/name="([^"]+)"/.exec(py.code) || [])[1]) || "expect_custom" } });
			} else {
				var nApp = 0;
				this._changes().forEach(function (x) {
					var k = x.chk, why = that._why(k.severity, k.threshold), st = status === "draft" ? "draft" : why ? "inReview" : "active";
					if (st === "inReview") { nApp++; }
					put({ id: k.testId, check: k.check, column: x.col.key, dim: k.dim, threshold: k.threshold, severity: k.severity, author: "builder",
						status: st, ar: k.ar, en: k.en, params: k.params, reviewer: why ? k.approver : "", reason: k.reason || "" });
				});
				if (status !== "draft" && nApp) { status = nApp === saved.length ? "inReview" : "mixed"; }
			}
			this._m.setProperty("/tests", tests.slice());
			MessageToast.show(T(status === "draft" ? "dqe.t.draft" : status === "inReview" ? "dqe.t.review" : status === "mixed" ? "dqe.t.mixed" : "dqe.t.active", [saved.length, saved.join(", ")]));
			if (saved.length === 1) { this.router().navTo("dqTest", { id: saved[0] }, true); } else { this.router().navTo("dqTests", {}, true); }
		},
		onCancel: function () {
			var that = this, dirty = this._changes().length || this._pyDirty, go = function () {
				if (that._edit) { that.router().navTo("dqTest", { id: that._edit.id }, true); } else { that.router().navTo("dqTests", {}, true); }
			};
			if (!dirty) { go(); return; }
			MessageBox.confirm(this.text("dqe.discard"), { onClose: function (a) { if (a === MessageBox.Action.OK) { go(); } } });
		}
	});
});
