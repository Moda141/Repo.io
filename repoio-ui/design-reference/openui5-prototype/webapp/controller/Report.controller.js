sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast"
], function (BaseController, MessageToast) {
	"use strict";

	var DIMS = ["line", "region", "source", "dq"],
		SAMPLE = "RPT_CUSTOMER_GOLDEN",
		VARIANTS = {
			standard: {},
			cairoSchools: { line: ["schools"], region: ["cairo"] },
			lowDq: { dq: ["lt70", "70"] }
		};

	function bucket(n) { return n < 70 ? "lt70" : n < 85 ? "70" : n < 95 ? "85" : "95"; }

	/* J14: analytical list report. In the product the rows come from the report's governed view
	   (Trino over Iceberg), already filtered by the viewer's role→domain grants; here from model/analytics.json. */
	return BaseController.extend("repoio.proto.controller.Report", {
		onInit: function () {
			this.viewModel().setProperty("/rp", { filterMode: "visual", mode: "hybrid", viewBy: "region", chartType: "column", q: "",
				f: { line: [], region: [], source: [], dq: [] }, tokens: [], page: 1, size: 25, variant: "standard" });
			this.router().getRoute("report").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this, sId = oEvent.getParameter("arguments").id, oM = this.getOwnerComponent().getModel("analytics");
			oM.dataLoaded().then(function () {
				var r = oM.getProperty("/reports").filter(function (x) { return x.id === sId; })[0] || oM.getProperty("/reports")[0],
					ar = that.lang() === "ar", vm = that.viewModel(), alp = oM.getProperty("/alp");
				that._report = r;
				that._alp = alp;
				that._dimText = {};
				that._names = {};
				DIMS.forEach(function (d) {
					that._dimText[d] = that.text("rp.dim." + d);
					that._names[d] = {};
					alp.dims[d].forEach(function (v) { that._names[d][v.key] = ar ? v.ar : v.en; });
				});
				vm.setProperty("/rp/title", ar ? r.ar : r.en);
				vm.setProperty("/rp/subtitle", that.text("rp.subtitle", [r.source, that.text("rl.type." + r.type)]));
				vm.setProperty("/rp/sampleNote", r.id === SAMPLE ? "" : that.text("rp.sampleNote"));
				vm.setProperty("/rp/dimText", that._dimText);
				vm.setProperty("/rp/dims", ["region", "line", "source", "dq"].map(function (d) { return { key: d, text: that._dimText[d] }; }));
				vm.setProperty("/rp/vf", { line: that.text("rp.vf.by", [that._dimText.line]), source: that.text("rp.vf.by", [that._dimText.source]), dq: that.text("rp.vf.by", [that._dimText.dq]) });
				var items = {};
				DIMS.forEach(function (d) { items[d] = alp.dims[d].map(function (v) { return { key: v.key, text: that._names[d][v.key] }; }); });
				vm.setProperty("/rp/dimItems", items);
				that._setVariant("standard");
			});
		},

		onBack: function () { this.router().navTo("reports"); },

		/* ---------- filtering ---------- */
		_rowsFor: function (skipDim) {
			var vm = this.viewModel(), f = vm.getProperty("/rp/f"), q = (vm.getProperty("/rp/q") || "").trim().toLowerCase();
			return this._alp.rows.filter(function (r) {
				if (q && [r.id, r.ar, r.en].join(" ").toLowerCase().indexOf(q) < 0) { return false; }
				return DIMS.every(function (d) {
					var v = d === "dq" ? bucket(r.dq) : r[d];
					return d === skipDim || !f[d].length || f[d].indexOf(v) > -1;
				});
			});
		},

		_apply: function (bResetPage) {
			var that = this, vm = this.viewModel(), ar = this.lang() === "ar", f = vm.getProperty("/rp/f");
			var rows = this._rowsFor().sort(function (a, b) { return a.changed < b.changed ? 1 : -1; }).map(function (r) {
				return Object.assign({}, r, {
					name: ar ? r.ar : r.en, lineText: that._names.line[r.line], regionText: that._names.region[r.region], sourceText: that._names.source[r.source],
					dqState: r.dq < 70 ? "Error" : r.dq < 85 ? "Warning" : "Success",
					statusText: that.text("rp.st." + r.status), statusState: r.status === "blocked" ? "Error" : "None"
				});
			});
			this._rows = rows;
			vm.setProperty("/rp/count", rows.length);
			vm.setProperty("/rp/tableTitle", this.text("rp.records", [this.fmt.num(rows.length)]));
			if (bResetPage) { vm.setProperty("/rp/page", 1); }
			this._slice();
			var tokens = [];
			DIMS.forEach(function (d) { f[d].forEach(function (k) { tokens.push({ dim: d, key: k, text: that._dimText[d] + ": " + that._names[d][k] }); }); });
			vm.setProperty("/rp/tokens", tokens);
			var v = vm.getProperty("/rp/variant"), dirty = JSON.stringify(this._norm(f)) !== JSON.stringify(this._norm(VARIANTS[v]));
			vm.setProperty("/rp/variantText", this.text("rp.var." + v) + (dirty ? "*" : ""));
			vm.setProperty("/rp/variants", Object.keys(VARIANTS).map(function (k) { return { key: k, text: that.text("rp.var." + k), current: k === v }; }));
			this._charts();
		},
		_norm: function (o) { var n = {}; DIMS.forEach(function (d) { n[d] = ((o || {})[d] || []).slice().sort(); }); return n; },
		_slice: function () {
			var vm = this.viewModel(), p = vm.getProperty("/rp/page"), n = vm.getProperty("/rp/size");
			vm.setProperty("/rp/rows", (this._rows || []).slice((p - 1) * n, p * n));
		},
		onPage: function (oEvent) {
			var vm = this.viewModel();
			vm.setProperty("/rp/page", oEvent.getParameter("page"));
			vm.setProperty("/rp/size", oEvent.getParameter("pageSize"));
			this._slice();
		},

		_toggle: function (d, k) {
			var vm = this.viewModel(), a = vm.getProperty("/rp/f/" + d).slice(), i = a.indexOf(k);
			if (i > -1) { a.splice(i, 1); } else { a.push(k); }
			vm.setProperty("/rp/f/" + d, a);
			this._apply(true);
		},
		_count: function (d, rows) {
			var m = {};
			this._alp.dims[d].forEach(function (v) { m[v.key] = 0; });
			rows.forEach(function (r) { m[d === "dq" ? bucket(r.dq) : r[d]]++; });
			return m;
		},

		/* ---------- charts (visual filters + main chart) ---------- */
		_charts: function () {
			var that = this, c = this.colors, rtl = this.isRtl(), f = this.viewModel().getProperty("/rp/f");
			var col = function (d, k) { return !f[d].length ? "#5b8fc7" : f[d].indexOf(k) > -1 ? "#2f6497" : "#c3d6ea"; };
			var keys = function (d) { return that._alp.dims[d].map(function (v) { return v.key; }); };
			var lbl = { fontSize: 11, color: c.label };

			// Business line: horizontal bars with the value inside the bar (as in the Fiori ALP).
			var dl = "line", kl = keys(dl), ml = this._count(dl, this._rowsFor(dl));
			this.byId("vfLine").setOption({
				animation: false, grid: { left: rtl ? 8 : 92, right: rtl ? 92 : 8, top: 4, bottom: 4 },
				xAxis: { type: "value", inverse: rtl, show: false },
				yAxis: { type: "category", inverse: true, position: rtl ? "right" : "left", data: kl.map(function (k) { return that._names[dl][k]; }),
					axisLabel: Object.assign({ width: 84, overflow: "truncate" }, lbl), axisTick: { show: false }, axisLine: { lineStyle: { color: "#6a6d70" } } },
				tooltip: { trigger: "item" },
				series: [{ type: "bar", barWidth: "62%", data: kl.map(function (k) { return { value: ml[k], key: k, itemStyle: { color: col(dl, k) } }; }),
					label: { show: true, position: "insideRight", color: "#fff", fontSize: 11 } }]
			});
			// Source system: donut with legend.
			var ds = "source", ks = keys(ds), ms = this._count(ds, this._rowsFor(ds)), pal = ["#2f6497", "#5b8fc7", "#8fb5dd", "#c3d6ea"];
			this.byId("vfSource").setOption({
				animation: false, tooltip: { trigger: "item" },
				legend: { orient: "vertical", [rtl ? "left" : "right"]: 0, top: "middle", itemWidth: 10, itemHeight: 10, textStyle: lbl,
					formatter: function (n) { var k = ks.filter(function (x) { return that._names[ds][x] === n; })[0]; return n + "   " + ms[k]; } },
				series: [{ type: "pie", radius: ["42%", "78%"], center: [rtl ? "70%" : "30%", "50%"], label: { show: false },
					data: ks.map(function (k, i) { return { name: that._names[ds][k], value: ms[k], key: k,
						itemStyle: { color: !f[ds].length || f[ds].indexOf(k) > -1 ? pal[i] : "#e5ecf3" } }; }) }]
			});
			// DQ score bucket: line with labelled points.
			var dd = "dq", kd = keys(dd), md = this._count(dd, this._rowsFor(dd));
			this.byId("vfDq").setOption({
				animation: false, grid: { left: 12, right: 12, top: 18, bottom: 20 },
				xAxis: { type: "category", inverse: rtl, data: kd.map(function (k) { return that._names[dd][k]; }), axisLabel: lbl, axisTick: { show: false }, axisLine: { lineStyle: { color: "#6a6d70" } } },
				yAxis: { type: "value", show: false }, tooltip: { trigger: "item" },
				series: [{ type: "line", symbolSize: 8, lineStyle: { color: "#5b8fc7" }, label: { show: true, position: "top", fontSize: 11, color: c.text },
					data: kd.map(function (k) { return { value: md[k], key: k, itemStyle: { color: col(dd, k) } }; }) }]
			});
			this._mainChart();
		},

		_mainChart: function () {
			var that = this, vm = this.viewModel(), c = this.colors, rtl = this.isRtl(), d = vm.getProperty("/rp/viewBy"),
				type = vm.getProperty("/rp/chartType"), ks = this._alp.dims[d].map(function (v) { return v.key; }),
				m = this._count(d, this._rowsFor()), names = ks.map(function (k) { return that._names[d][k]; }),
				lbl = { fontSize: 11, color: c.label }, measure = this.text("rp.measure");
			vm.setProperty("/rp/chartTitle", this.text("rp.chartTitle", [measure, this._dimText[d]]));
			var o;
			if (type === "donut") {
				o = { animation: false, tooltip: { trigger: "item" }, legend: { orient: "vertical", [rtl ? "left" : "right"]: 16, top: "middle", textStyle: lbl },
					series: [{ type: "pie", radius: ["45%", "75%"], label: { show: true, formatter: "{c}", fontSize: 11 },
						data: ks.map(function (k, i) { return { name: names[i], value: m[k], key: k }; }) }],
					color: ["#2f6497", "#5b8fc7", "#8fb5dd", "#c3d6ea", "#5fae7c", "#e3a256"] };
			} else {
				var bar = type === "bar", cat = { type: "category", data: names, axisLabel: lbl, axisTick: { show: false }, axisLine: { lineStyle: { color: c.grid } } },
					val = { type: "value", axisLabel: lbl, splitLine: { lineStyle: { color: c.grid } }, minInterval: 1 };
				o = { animation: false, tooltip: { trigger: "axis" },
					grid: { left: rtl ? 16 : (bar ? 100 : 40), right: rtl ? (bar ? 100 : 40) : 16, top: 16, bottom: 46 },
					legend: { bottom: 0, [rtl ? "right" : "left"]: 8, textStyle: lbl, data: [measure] },
					xAxis: bar ? Object.assign(val, { inverse: rtl }) : Object.assign(cat, { inverse: rtl }),
					yAxis: bar ? Object.assign(cat, { inverse: true, position: rtl ? "right" : "left" }) : Object.assign(val, { position: rtl ? "right" : "left" }),
					series: [{ name: measure, type: "bar", barMaxWidth: 64, itemStyle: { color: "#5899da" },
						label: { show: true, position: bar ? (rtl ? "left" : "right") : "top", fontSize: 11, color: c.text },
						data: ks.map(function (k) { return { value: m[k], key: k }; }) }] };
			}
			this.byId("mainChart").setOption(o);
		},

		onVfSelect: function (oEvent) {
			var data = oEvent.getParameter("data");
			if (data && data.key) { this._toggle(oEvent.getSource().data("dim"), data.key); }
		},
		onMainSelect: function (oEvent) {
			var data = oEvent.getParameter("data");
			if (data && data.key) { this._toggle(this.viewModel().getProperty("/rp/viewBy"), data.key); }
		},
		onVfPick: function (oEvent) {
			this.viewModel().setProperty("/rp/filterMode", "compact");
			MessageToast.show(this.text("rp.t.vfPick", [this._dimText[oEvent.getSource().data("dim")]]));
		},
		onCompact: function () { this._apply(true); },
		onSearch: function () { this._apply(true); },
		onTokenDelete: function (oEvent) {
			var t = oEvent.getSource().getBindingContext("view").getObject();
			this._toggle(t.dim, t.key);
		},
		onClearFilters: function () {
			this.viewModel().setProperty("/rp/f", { line: [], region: [], source: [], dq: [] });
			this.viewModel().setProperty("/rp/q", "");
			this._apply(true);
		},
		onViewBy: function () { this._mainChart(); },
		onChartType: function () { this._mainChart(); },
		onMode: function () { var that = this; setTimeout(function () { that._mainChart(); }, 0); },

		_setVariant: function (k) {
			var vm = this.viewModel(), v = VARIANTS[k], f = {};
			DIMS.forEach(function (d) { f[d] = (v[d] || []).slice(); });
			vm.setProperty("/rp/variant", k);
			vm.setProperty("/rp/f", f);
			this._apply(true);
		},
		onVariant: function (oEvent) { this._setVariant(oEvent.getParameter("item").getKey()); },

		onAdapt: function () { this.viewModel().setProperty("/rp/filterMode", "compact"); },
		onShare: function () { MessageToast.show(this.text("rp.t.share")); },
		onBroadcast: function () { this.router().navTo("broadcasts", { query: { report: this._report.id } }); },
		onExport: function () { MessageToast.show(this.text("rp.t.export", [this.fmt.num(this._rows.length)])); },
		onRow: function (oEvent) {
			MessageToast.show(this.text("rp.t.record", [oEvent.getSource().getBindingContext("view").getProperty("id")]));
		}
	});
});
