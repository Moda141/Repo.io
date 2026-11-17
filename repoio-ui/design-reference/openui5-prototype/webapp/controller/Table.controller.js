sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/Column",
	"sap/m/ColumnListItem",
	"sap/m/Text",
	"sap/m/ObjectStatus",
	"sap/m/VBox",
	"repoio/proto/util/gridTable"
], function (BaseController, MessageToast, Column, ColumnListItem, Text, ObjectStatus, VBox, Grid) {
	"use strict";

	var RESULT = { pass: ["Success", "sap-icon://sys-enter-2"], warn: ["Warning", "sap-icon://alert"], fail: ["Error", "sap-icon://error"] };

	/* Source table (SAP Datasphere Data Builder table editor pattern). Read only; sample values from model/tables.json. */
	return BaseController.extend("repoio.proto.controller.Table", {
		onInit: function () {
			this.viewModel().setProperty("/tb", { tab: "general", preview: true, pv: "data", max: false, tf: "all", cq: "" });
			this.router().getRoute("table").attachPatternMatched(this._onMatched, this);
		},
		_onMatched: function (oEvent) {
			var that = this, C = this.getOwnerComponent();
			this._a = oEvent.getParameter("arguments");
			Promise.all([this.data().dataLoaded(), C.getModel("tables").dataLoaded()]).then(function () { that._show(); });
		},

		_show: function () {
			var that = this, T = this.text.bind(this), a = this._a, D = this.data(), ar = this.lang() === "ar", n = this.fmt.num,
				S = D.getProperty("/sources/" + a.source), tbl = S && S.tables.filter(function (t) { return t.schema === a.schema && t.id === a.table; })[0],
				X = this.getOwnerComponent().getModel("tables").getProperty("/tables/" + a.source + "." + a.schema + "." + a.table);
			if (!tbl || !X) { this.router().navTo("domains", {}, true); return; }
			var repos = D.getProperty("/repos"), domains = D.getProperty("/domains");
			this._key = a.source + "." + a.schema + "." + a.table;
			this._X = X;
			this._cols = X.columns.map(function (c) {
				return { key: c.key, label: ar ? c.ar : c.en, name: c.name, type: c.type, notNull: c.notNull, pii: c.pii,
					termText: c.term ? (ar ? c.termAr : c.termEn) : "", nullText: c.nullPct.toFixed(1) + "%",
					nullState: c.nullPct >= 20 ? "Error" : c.nullPct >= 5 ? "Warning" : "Success",
					usedText: c.usedIn.length ? c.usedIn.map(function (u) { return u.repo; }).join(", ") : T("src.notUsed") };
			});
			var tests = X.tests.map(function (x) {
				return { rule: ar ? x.ar : x.en, column: x.column || "—", result: x.result, resultText: T("tb.r." + x.result), state: RESULT[x.result][0], icon: RESULT[x.result][1],
					failedText: x.failed > 0 ? n(x.failed) : "—", pctText: x.pct ? x.pct.toFixed(1) + "%" : "—", date: x.date };
			});
			this._tests = tests;
			var cnt = function (r) { return tests.filter(function (x) { return x.result === r; }).length; },
				failed = cnt("fail"), score = tbl.quality, target = D.getProperty("/target");
			var deps = tbl.usedIn.map(function (u) {
				var r = repos[u.id], d = domains.filter(function (x) { return x.id === r.domainId; })[0];
				var cols = X.columns.filter(function (c) { return c.usedIn.some(function (v) { return v.repoId === u.id; }); });
				return { id: u.id, name: r.name, domain: that.domainName(d), model: r.model, colsText: T("tb.d.colsN", [cols.length]),
					statusText: T("health." + r.healthKey), state: r.healthState };
			});
			var assoc = X.associations.map(function (s) {
				var p = s.target.split("."), src = D.getProperty("/sources/" + p[0]), t = src.tables.filter(function (x) { return x.schema === p[1] && x.id === p[2]; })[0];
				return { name: s.name, target: s.target, targetName: (t ? t.name : p[2]) + " · " + src.name, on: s.on };
			});
			var g = function (label, value, opt) { return Object.assign({ label: T(label), value: value, type: "text", dir: "Inherit" }, opt || {}); };
			this.viewModel().setProperty("/tb", Object.assign(this.viewModel().getProperty("/tb"), {
				tab: this.viewModel().getProperty("/tb/tab") || "general", cq: "", tf: "all",
				name: tbl.name, schema: tbl.schema, sourceName: S.name, sourceId: a.source,
				storageText: T("tb.storage." + X.storage), storageIcon: X.storage === "file" ? "sap-icon://document" : "sap-icon://cloud",
				qualityText: this.fmt.pct(score), qualityState: tbl.qualityState,
				general: [
					g("dsp.businessName", tbl.name), g("dsp.technicalName", a.table.toUpperCase(), { dir: "LTR", mono: true }),
					g("tb.source", S.name + " · " + S.type), g("src.schemaName", tbl.schema, { dir: "LTR", mono: true }),
					g("tb.usage", T("tb.usage." + X.usage)), g("tb.storage", T("tb.storage." + X.storage)),
					g("tb.delta", "", { type: "switch", on: X.delta }), g("tb.deltaTable", X.deltaTable || "—", { dir: "LTR", mono: true }),
					g("repo.rows", n(tbl.rows), { dir: "LTR" }), g("src.columns", String(X.columns.length), { dir: "LTR" }),
					g("src.profiled", tbl.profiled, { dir: "LTR" }), g("domain.owner", X.owner, { type: "person" })
				],
				colsTab: T("tb.tab.columns", [X.columns.length]), columns: this._cols,
				assocTab: T("tb.tab.assoc", [assoc.length]), associations: assoc,
				desc: ar ? X.descAr : X.descEn, descUpdated: T("tb.descUpdated", [X.descUpdated]),
				terms: X.terms.map(function (k) { var t = that.getOwnerComponent().getModel("tables").getProperty("/terms/" + k); return { text: ar ? t.ar : t.en }; }),
				sensText: T("tb.sens." + X.sensitivity), sensState: X.sensitivity === "confidential" ? "Warning" : "Information",
				retention: T("tb.ret." + X.retention), owner: X.owner, steward: X.steward,
				kpis: [
					{ label: T("tbl.dqScore"), value: score.toFixed(1), unit: "%", state: tbl.qualityState },
					{ label: T("tb.target"), value: String(target), unit: "%", state: "None" },
					{ label: T("tbl.sinceYesterday"), value: (score - X.trend[X.trend.length - 2] >= 0 ? "+" : "") + (score - X.trend[X.trend.length - 2]).toFixed(1), unit: "", state: score >= X.trend[X.trend.length - 2] ? "Success" : "Error" },
					{ label: T("tbl.failedTests"), value: String(failed), unit: T("tb.ofN", [tests.length]), state: failed ? "Error" : "Success" },
					{ label: T("tbl.lastRun"), value: tbl.profiled, unit: "", state: "None" }
				],
				dims: X.dims.map(function (d) {
					var st = d.value >= target ? "Success" : d.value >= 80 ? "Warning" : "Error",
						col = { Success: "--sapPositiveElementColor", Warning: "--sapCriticalElementColor", Error: "--sapNegativeElementColor" }[st];
					return { label: T("tb.dim." + d.key), weightText: T("tb.weight", [d.weight]), value: d.value, text: d.value.toFixed(1) + "%", state: st,
						bar: "<div class=\"repoioBar\" role=\"presentation\"><span style=\"width:" + d.value + "%;background:var(" + col + ")\"></span><i style=\"inset-inline-start:" + target + "%\"></i></div>" };
				}),
				tests: tests, testsTitle: T("tb.testsN", [tests.length]),
				tc: { all: T("tb.tc.all", [tests.length]), fail: T("tb.tc.fail", [failed]), warn: T("tb.tc.warn", [cnt("warn")]), pass: T("tb.tc.pass", [cnt("pass")]) },
				depsTab: T("tb.tab.deps", [deps.length]), deps: deps,
				dataTab: T("tb.dataTabShort", [tbl.name]), errTab: T("tb.errTab", [X.errors.length])
			}));
			this._trend(X, target);
			this._grids();
		},

		/* Data preview: grid tables (sap.ui.table) built once and refilled per table. Errors list the failed check as a token
		   and mark the failing value. */
		_grids: function () {
			var that = this, X = this._X, ar = this.lang() === "ar", T = this.text.bind(this), n = this.fmt.num,
				tb = this.viewModel().getProperty("/tb"),
				cols = X.columns.map(function (c) { return { key: c.name, label: c.name, sub: ar ? c.ar : c.en, mono: c.key, bad: true, width: c.type === "Date" ? "8rem" : "11rem" }; });
			[["tbDataBox", "_gData"], ["tbErrBox", "_gErr"]].forEach(function (x) { if (that[x[1]]) { that[x[1]].destroy(); that[x[1]] = null; } that.byId(x[0]).destroyItems(); });
			this._gData = Grid.create({ title: T("tb.gridData", [tb.name, X.sample.length, n(this.data().getProperty("/sources/" + this._a.source).tables
				.filter(function (t) { return t.id === that._a.table; })[0].rows)]), columns: cols, rows: X.sample, fixed: 1, itemsText: T("tb.items"),
				onExport: this.onExportRows.bind(this), exportText: T("tb.exportRows") });
			this._gErr = Grid.create({ title: T("tb.gridErr", [X.errors.length]), itemsText: T("tb.items"), fixed: 1, noData: T("tb.noErrors"),
				columns: [{ key: "_checks", label: T("tb.failedChecks"), tokens: true, width: "13rem" }].concat(cols),
				rows: X.errors.map(function (e) { return Object.assign({}, e.row, { _bad: e.column, _checks: [ar ? e.ar : e.en] }); }) });
			this.byId("tbDataBox").addItem(this._gData);
			this.byId("tbErrBox").addItem(this._gErr);
		},
		onExportRows: function () {
			var X = this._X, rows = [X.columns.map(function (c) { return c.name; })].concat(X.sample.map(function (r) { return X.columns.map(function (c) { return r[c.name] === null ? "" : r[c.name]; }); }));
			this._download(rows, this._key + "-sample.csv");
		},
		_download: function (rows, name) {
			var csv = rows.map(function (r) { return r.map(function (v) { return "\"" + String(v).replace(/"/g, "\"\"") + "\""; }).join(","); }).join("\n"),
				a = document.createElement("a");
			a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
			a.download = name;
			a.click();
			setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
		},
		_trend: function (X, target) {
			var c = this.colors, rtl = this.isRtl(), days = (this.data().getProperty("/trend") || []).map(function (t) { return t.d; }).slice(-X.trend.length);
			this.byId("tbTrend").setOption({
				animation: false, grid: { left: rtl ? 8 : 36, right: rtl ? 36 : 8, top: 12, bottom: 22 }, tooltip: { trigger: "axis" },
				xAxis: { type: "category", inverse: rtl, data: days, axisLabel: { color: c.label, fontSize: 11 }, axisLine: { lineStyle: { color: c.grid } } },
				yAxis: { type: "value", position: rtl ? "right" : "left", min: function (v) { return Math.floor(Math.min(v.min, target) - 3); }, max: 100,
					axisLabel: { color: c.label, fontSize: 11 }, splitLine: { lineStyle: { color: c.grid } } },
				series: [{ type: "line", data: X.trend, smooth: true, symbolSize: 5, lineStyle: { color: c.brand, width: 2 }, itemStyle: { color: c.brand },
					areaStyle: { color: "rgba(88,153,218,0.12)" },
					markLine: { silent: true, symbol: "none", lineStyle: { color: "#256f3a", type: "dashed" }, label: { formatter: this.text("tb.targetLine", [target]), color: "#256f3a", fontSize: 11, position: "insideEndTop" },
						data: [{ yAxis: target }] } }]
			});
		},

		onColSearch: function (e) {
			var q = (e.getParameter("newValue") || "").toLowerCase();
			this.viewModel().setProperty("/tb/columns", this._cols.filter(function (c) { return !q || (c.label + " " + c.name + " " + c.termText).toLowerCase().indexOf(q) > -1; }));
		},
		onTestFilter: function () {
			var f = this.viewModel().getProperty("/tb/tf");
			this.viewModel().setProperty("/tb/tests", this._tests.filter(function (x) { return f === "all" || x.result === f; }));
		},
		onAssoc: function (e) {
			var p = e.getSource().getBindingContext("view").getProperty("target").split(".");
			this.router().navTo("table", { source: p[0], schema: p[1], table: p[2] });
		},
		onDep: function (e) { this.router().navTo("repository", { repo: e.getSource().getBindingContext("view").getProperty("id") }); },
		onMax: function () { this.viewModel().setProperty("/tb/max", !this.viewModel().getProperty("/tb/max")); },
		onClosePreview: function () { this.viewModel().setProperty("/tb/preview", false); },
		onRunDq: function () { MessageToast.show(this.text("tb.t.runDq", [this.viewModel().getProperty("/tb/name")])); },
		onRequest: function () { MessageToast.show(this.text("tbl.requestToast")); },
		onExport: function () {
			var rows = [["technical_name", "business_name", "data_type", "key", "not_null", "empty_pct"]].concat(this._X.columns.map(function (c) {
				return [c.name, c.en, c.type, c.key, c.notNull, c.nullPct];
			}));
			this._download(rows, this._key + "-columns.csv");
		},
		onCopyLink: function () {
			var that = this, done = function () { MessageToast.show(that.text("cat.linkCopied")); };
			try { navigator.clipboard.writeText(window.location.href).then(done, done); } catch (err) { done(); }
		},
		onToCatalog: function () { this.router().navTo("domains"); },
		onToSource: function () { this.router().navTo("domains", { item: this.viewModel().getProperty("/tb/sourceName") }); },
		onBack: function () { window.history.go(-1); },
		onExit: function () { if (this._gData) { this._gData.destroy(); } if (this._gErr) { this._gErr.destroy(); } }
	});
});
