sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/jobRuns",
	"repoio/proto/util/folders",
	"sap/m/MessageToast",
	"sap/m/Menu",
	"sap/m/MenuItem",
	"sap/m/Popover",
	"sap/m/List",
	"sap/m/StandardListItem"
], function (BaseController, R, Fld, MessageToast, Menu, MenuItem, Popover, List, StandardListItem) {
	"use strict";

	var STATUSES = ["succeeded", "succeededWithFailures", "failed", "timedOut", "running", "queued", "skipped", "canceled"],
		KINDS = ["ingest", "stream", "dq", "hk"],
		DIMS = ["kind", "status", "error"],
		COLS = ["type", "runAs", "launched", "duration", "error", "params"],
		ME = "محمد", // the signed-in user of the prototype
		VARIANTS = {
			standard: {},
			failed: { status: ["failed", "timedOut"], range: "168" },
			active: { status: ["running", "queued"] },
			mine: { runAs: "me" }
		};

	return BaseController.extend("repoio.proto.controller.JobRuns", {
		onInit: function () {
			var vm = this.viewModel();
			if (!vm.getProperty("/jr")) {
				var oCols = {};
				COLS.forEach(function (k) { oCols[k] = k !== "params"; });
				var oSaved = this.store("repoio-jr-cols");
				if (oSaved) { Object.keys(oSaved).forEach(function (k) { oCols[k] = !!oSaved[k]; }); }
				vm.setProperty("/jr", { f: this._emptyFilters(), cols: oCols, rows: [], count: 0, bucket: null, showFolders: this._foldersDefault(),
					filterMode: "visual", mode: "hybrid", viewBy: "time", chartType: "column", variant: "standard", tokens: [] });
			}
			this.router().getRoute("jobs").attachPatternMatched(this._onMatched, this);
		},

		_emptyFilters: function () { return { folder: "", name: "", kind: [], runAs: "all", range: "48", status: [], runId: "", error: [] }; },

		_onMatched: function () {
			var oRuns = this.getOwnerComponent().getModel("runs");
			oRuns.dataLoaded().then(function () {
				var that = this, vm = this.viewModel();
				this._jobs = {};
				oRuns.getProperty("/jobs").forEach(function (j) { this._jobs[j.id] = j; }.bind(this));
				this._now = R.parse(oRuns.getProperty("/now"));
				this._dimText = { time: this.text("jr.dim.time"), kind: this.text("jr.col.type"), status: this.text("jr.col.status"), error: this.text("jr.col.error"),
					domain: this.text("rp.dim.domain"), runAs: this.text("jr.col.runAs"), launched: this.text("jr.col.launched") };
				vm.setProperty("/jr/dims", ["time", "status", "kind", "error", "domain", "launched", "runAs"].map(function (d) { return { key: d, text: that._dimText[d] }; }));
				vm.setProperty("/jr/vf", { kind: this.text("jr.vf.by", [this._dimText.kind]), status: this.text("jr.vf.by", [this._dimText.status]), error: this.text("jr.vf.by", [this._dimText.error]) });
				var seen = {};
				oRuns.getProperty("/runs").forEach(function (r) { if (r.error) { seen[r.error] = 1; } });
				this._codes = Object.keys(seen).sort();
				vm.setProperty("/jr/dimItems", {
					kind: KINDS.map(function (k) { return { key: k, text: that.text("jr.kind." + k) }; }),
					status: STATUSES.map(function (s) { return { key: s, text: that.text("jr.st." + s) }; }),
					error: this._codes.map(function (k) { return { key: k, text: k }; })
				});
				// Opened from another page (e.g. "Open in monitor" on a data sync): filter by that job.
				var sPending = vm.getProperty("/jrPending");
				if (sPending) { vm.setProperty("/jr/f", Object.assign(this._emptyFilters(), { name: sPending, range: "168" })); vm.setProperty("/jrPending", null); }
				this._tree();
				this._apply();
			}.bind(this));
		},

		/* Folders (ADR-0005): jobs grouped as dags/<domain>/<repository>/<kind>/ or platform/<kind>/. */
		_seg: function (j) { return j.folder ? j.folder.split("/") : ["platform", "other"]; },
		_tree: function () {
			var that = this, k = this.viewModel().getProperty("/jr/f/folder"), jobs = this._jobs;
			this.viewModel().setProperty("/jr/tree", Fld.tree(this, Object.keys(jobs).map(function (id) { return that._seg(jobs[id]); }), this.text("fld.allJobs"), k));
			this.viewModel().setProperty("/jr/crumbs", Fld.crumbs(k));
			Fld.reveal(this.byId("jrTree"), k);
		},
		_goFolder: function (sKey) {
			this.viewModel().setProperty("/jr/f/folder", sKey);
			this._tree();
			this._apply();
		},
		onFolder: function (oEvent) { this._goFolder(oEvent.getParameter("listItem").getBindingContext("view").getProperty("key")); },
		onCrumb: function (oEvent) { this._goFolder(oEvent.getSource().getBindingContext("view").getProperty("key")); },
		/* The folders panel starts open on wide screens; below 1440px it starts closed so the runs table keeps every column. A saved choice wins. */
		_foldersDefault: function () { var v = this.store("repoio-jr-folders"); return v === null ? window.innerWidth >= 1440 : v !== false; },
		/* The switch always shows the page you are on: snap back to "runs" before leaving, since this view stays cached. */
		onSwitch: function (oEvent) {
			var k = oEvent.getParameter("item").getKey();
			oEvent.getSource().setSelectedKey("runs");
			if (k === "streams") { this.router().navTo("streams"); }
		},
		/* Hide from the panel's own header; show again from the "Folders" button on the runs toolbar. The choice is remembered. */
		onToggleFolders: function () {
			var b = !this.viewModel().getProperty("/jr/showFolders");
			this.viewModel().setProperty("/jr/showFolders", b);
			this.store("repoio-jr-folders", b);
		},

		/* One page of runs (Previous / Next instead of "More"). */
		_slice: function () {
			var vm = this.viewModel(), p = vm.getProperty("/jr/page"), n = vm.getProperty("/jr/size");
			vm.setProperty("/jr/rows", (this._rows || []).slice((p - 1) * n, p * n));
		},
		onPage: function (oEvent) {
			var vm = this.viewModel();
			vm.setProperty("/jr/page", oEvent.getParameter("page"));
			vm.setProperty("/jr/size", oEvent.getParameter("pageSize"));
			this._slice();
		},

		listTitle: function (n) { return this.text("jr.list.title", [n || 0]); },

		/* ---------- filtering ---------- */
		_kindOf: function (j) { return j.kind === "push" ? "ingest" : j.kind; },
		/* Runs in the time range and every filter except skipDim (a visual filter counts across its own values)
		   and except the time bucket, which only narrows the table. */
		_inRange: function (skipDim) {
			var vm = this.viewModel(), f = vm.getProperty("/jr/f"), now = this._now,
				from = new Date(now.getTime() - Number(f.range) * 3600e3), jobs = this._jobs,
				q = (f.name || "").trim().toLowerCase(), id = (f.runId || "").trim().toLowerCase(), that = this;
			return this.getOwnerComponent().getModel("runs").getProperty("/runs").filter(function (r) {
				var j = jobs[r.job], t = R.parse(R.finished(r.status) && r.end ? r.end : r.start);
				if (r.status === "running" || r.status === "queued") { t = now; }
				if (t < from) { return false; }
				if (!Fld.inFolder(that._seg(j), f.folder)) { return false; }
				if (skipDim !== "kind" && f.kind.length && f.kind.indexOf(that._kindOf(j)) < 0) { return false; }
				if (f.runAs === "me" && r.runAs !== ME) { return false; }
				if (q && (j.id + " " + j.title_en + " " + j.title_ar).toLowerCase().indexOf(q) < 0) { return false; }
				if (id && r.id.toLowerCase().indexOf(id) < 0) { return false; }
				if (skipDim !== "status" && f.status.length && f.status.indexOf(r.status) < 0) { return false; }
				if (skipDim !== "error" && f.error.length && f.error.indexOf(r.error) < 0) { return false; }
				return true;
			});
		},

		_bucketHours: function () { return Number(this.viewModel().getProperty("/jr/f/range")) > 48 ? 12 : 2; },

		_apply: function () {
			var vm = this.viewModel(), lang = this.lang(), jobs = this._jobs, that = this,
				aIn = this._inRange(), b = vm.getProperty("/jr/bucket");
			var aRows = aIn.filter(function (r) {
				if (!b) { return true; }
				var t = R.parse(r.end || r.start).getTime();
				return R.finished(r.status) && t >= b[0] && t < b[1];
			}).map(function (r) {
				var j = jobs[r.job], over = j.exp && r.status === "running" && r.sec > j.exp * 1.5;
				return {
					id: r.id, job: j.id, title: lang === "ar" ? j.title_ar : j.title_en, kindIcon: R.kindIcon(j.kind), kindText: R.kindText(that, j.kind),
					startText: R.date(r.start, lang), runAs: r.runAs, launchedText: that.text("jr.launched." + r.launched),
					durText: r.runType === "permanent" && r.status === "running" ? that.text("jr.d.endless") : r.status === "queued" ? "—" : R.dur(r.sec),
					overdue: !!over, overdueText: over ? that.text("jr.overdue", [R.dur(j.exp)]) : "",
					status: r.status, statusText: that.text("jr.st." + r.status), statusState: R.state(r.status), statusIcon: R.icon(r.status),
					highlight: ["failed", "timedOut"].indexOf(r.status) > -1 ? "Error" : r.status === "succeededWithFailures" ? "Warning" : "None",
					error: r.error, paramText: R.params(r.params), active: r.status === "running" || r.status === "queued", airflow: j.orch === "airflow"
				};
			});
			this._rows = aRows;
			vm.setProperty("/jr/count", aRows.length);
			vm.setProperty("/jr/page", 1);
			if (!vm.getProperty("/jr/size")) { vm.setProperty("/jr/size", 25); }
			this._slice();
			this._tokens();
			this._charts();
		},

		/* Active filters as tokens (shown in both filter modes), plus the variant name with "*" when changed. */
		_tokens: function () {
			var vm = this.viewModel(), f = vm.getProperty("/jr/f"), that = this, t = [];
			if (f.folder) { t.push({ dim: "folder", text: this.text("jr.f.folder") + ": " + f.folder }); }
			f.kind.forEach(function (k) { t.push({ dim: "kind", key: k, text: that._dimText.kind + ": " + that.text("jr.kind." + k) }); });
			f.status.forEach(function (k) { t.push({ dim: "status", key: k, text: that._dimText.status + ": " + that.text("jr.st." + k) }); });
			f.error.forEach(function (k) { t.push({ dim: "error", key: k, text: that._dimText.error + ": " + k }); });
			if (f.runAs === "me") { t.push({ dim: "runAs", text: this.text("jr.f.runAs") + ": " + this.text("jr.f.me") }); }
			if ((f.name || "").trim()) { t.push({ dim: "name", text: this.text("jr.f.name") + ": " + f.name.trim() }); }
			if ((f.runId || "").trim()) { t.push({ dim: "runId", text: this.text("jr.f.runId") + ": " + f.runId.trim() }); }
			vm.setProperty("/jr/tokens", t);
			var v = vm.getProperty("/jr/variant"), dirty = JSON.stringify(this._norm(f)) !== JSON.stringify(this._norm(VARIANTS[v]));
			vm.setProperty("/jr/variantText", this.text(v === "standard" ? "rp.var.standard" : "jr.var." + v) + (dirty ? "*" : ""));
			vm.setProperty("/jr/variants", Object.keys(VARIANTS).map(function (k) {
				return { key: k, text: that.text(k === "standard" ? "rp.var.standard" : "jr.var." + k), current: k === v };
			}));
		},
		_norm: function (o) {
			o = o || {};
			return { kind: (o.kind || []).slice().sort(), status: (o.status || []).slice().sort(), error: (o.error || []).slice().sort(),
				runAs: o.runAs || "all", range: o.range || "48", folder: o.folder || "", name: (o.name || "").trim(), runId: (o.runId || "").trim() };
		},

		/* ---------- charts: three visual filters and the main chart ---------- */
		_keyOf: function (d, r) {
			var j = this._jobs[r.job];
			if (d === "kind") { return this._kindOf(j); }
			if (d === "domain") { return this._seg(j)[0]; }
			return r[d];
		},
		_nameOf: function (d, k) {
			if (d === "kind") { return this.text("jr.kind." + k); }
			if (d === "status") { return this.text("jr.st." + k); }
			if (d === "launched") { return this.text("jr.launched." + k); }
			if (d === "runAs") { return R.person(k, this.lang()); }
			if (d === "domain") { return Fld._label(this, [k], 0) || k; }
			return k;
		},
		/* Counts per value, in a stable order; error codes only for runs that have one. */
		_count: function (d, rows) {
			var m = {}, that = this, order = d === "kind" ? KINDS : d === "status" ? STATUSES : null;
			if (order) { order.forEach(function (k) { m[k] = 0; }); }
			rows.forEach(function (r) {
				var k = that._keyOf(d, r);
				if (!k) { return; }
				m[k] = (m[k] || 0) + 1;
			});
			var keys = order || Object.keys(m).sort(function (a, b) { return m[b] - m[a] || (a < b ? -1 : 1); });
			return { keys: keys, m: m };
		},
		_col: function (d, k) {
			var f = this.viewModel().getProperty("/jr/f/" + d);
			return !f || !f.length ? "#5b8fc7" : f.indexOf(k) > -1 ? "#2f6497" : "#c3d6ea";
		},

		_charts: function () {
			var that = this, c = this.colors, rtl = this.isRtl(), lang = this.lang(), lbl = { fontSize: 11, color: c.label },
				f = this.viewModel().getProperty("/jr/f");

			// Type: horizontal bars with the value inside the bar (as in the Fiori ALP).
			var ck = this._count("kind", this._inRange("kind"));
			this.byId("vfKind").setOption({
				animation: false, grid: { left: rtl ? 8 : 92, right: rtl ? 92 : 8, top: 4, bottom: 4 },
				xAxis: { type: "value", inverse: rtl, show: false },
				yAxis: { type: "category", inverse: true, position: rtl ? "right" : "left", data: ck.keys.map(function (k) { return that._nameOf("kind", k); }),
					axisLabel: Object.assign({ width: 84, overflow: "truncate" }, lbl), axisTick: { show: false }, axisLine: { lineStyle: { color: "#6a6d70" } } },
				tooltip: { trigger: "item" },
				series: [{ type: "bar", barWidth: "62%", data: ck.keys.map(function (k) { return { value: ck.m[k], key: k, itemStyle: { color: that._col("kind", k) } }; }),
					label: { show: true, position: rtl ? "insideLeft" : "insideRight", color: "#fff", fontSize: 11, formatter: function (p) { return p.value || ""; } } }]
			});

			// Status: donut with a legend that carries the counts, in the run status colours.
			var cs = this._count("status", this._inRange("status")), sk = cs.keys.filter(function (k) { return cs.m[k] > 0 || f.status.indexOf(k) > -1; });
			this.byId("vfStatus").setOption({
				animation: false, tooltip: { trigger: "item" },
				legend: { orient: "vertical", [rtl ? "left" : "right"]: 0, top: "middle", itemWidth: 10, itemHeight: 10, itemGap: 4, textStyle: lbl,
					formatter: function (n) { var k = sk.filter(function (x) { return that._nameOf("status", x) === n; })[0]; return n + "   " + cs.m[k]; } },
				series: [{ type: "pie", radius: ["42%", "78%"], center: [rtl ? "75%" : "25%", "50%"], label: { show: false },
					data: sk.map(function (k) { return { name: that._nameOf("status", k), value: cs.m[k], key: k,
						itemStyle: { color: !f.status.length || f.status.indexOf(k) > -1 ? R.COLOR[k] : "#eceff2" } }; }) }]
			});

			// Error code: the top five codes as bars (codes are long, so they get their own label column);
			// the tooltip shows when each code was last seen.
			var aErr = this._inRange("error"), ce = this._count("error", aErr), last = {};
			aErr.forEach(function (r) { if (r.error && (!last[r.error] || r.start > last[r.error])) { last[r.error] = r.start; } });
			var ek = ce.keys.slice(0, 5);
			f.error.forEach(function (k) { if (ek.indexOf(k) < 0) { ek.push(k); } });
			this.byId("vfError").setOption({
				animation: false, grid: { left: rtl ? 8 : 150, right: rtl ? 150 : 8, top: 4, bottom: 4 },
				xAxis: { type: "value", inverse: rtl, show: false },
				yAxis: { type: "category", inverse: true, position: rtl ? "right" : "left", data: ek,
					axisLabel: { width: 142, overflow: "truncate", fontSize: 10, color: c.label, fontFamily: "72Mono, Consolas, monospace" },
					axisTick: { show: false }, axisLine: { lineStyle: { color: "#6a6d70" } } },
				tooltip: { trigger: "item", formatter: function (p) { return p.name + "<br/>" + that.text("jr.top.tip", [p.value, last[p.name] ? R.date(last[p.name], lang) : "—"]); } },
				graphic: ek.length ? [] : [{ type: "text", left: "center", top: "middle", style: { text: this.text("jr.top.none"), fill: c.label, fontSize: 12 } }],
				series: [{ type: "bar", barWidth: "62%", data: ek.map(function (k) { return { value: ce.m[k] || 0, key: k, itemStyle: { color: that._col("error", k) } }; }),
					label: { show: true, position: rtl ? "insideLeft" : "insideRight", color: "#fff", fontSize: 11, formatter: function (p) { return p.value || ""; } } }]
			}, true);
			this._mainChart();
		},

		_mainChart: function () {
			var vm = this.viewModel(), d = vm.getProperty("/jr/viewBy");
			vm.setProperty("/jr/chartTitle", this.text("rp.chartTitle", [this.text(d === "time" ? "jr.chart.title" : "jr.measure"), this._dimText[d]]));
			if (d === "time") { this._timeChart(this._inRange()); return; }
			var that = this, c = this.colors, rtl = this.isRtl(), type = vm.getProperty("/jr/chartType"), lbl = { fontSize: 11, color: c.label },
				cnt = this._count(d, this._inRange()), ks = cnt.keys.filter(function (k) { return cnt.m[k] > 0; }),
				names = ks.map(function (k) { return that._nameOf(d, k); }), measure = this.text("jr.measure"),
				color = function (k) { return d === "status" ? R.COLOR[k] : DIMS.indexOf(d) > -1 ? that._col(d, k) : "#5899da"; }, o;
			if (type === "donut") {
				o = { animation: false, tooltip: { trigger: "item" }, legend: { orient: "vertical", [rtl ? "left" : "right"]: 16, top: "middle", textStyle: lbl },
					series: [{ type: "pie", radius: ["45%", "75%"], label: { show: true, formatter: "{c}", fontSize: 11 },
						data: ks.map(function (k, i) { return { name: names[i], value: cnt.m[k], key: k, itemStyle: d === "status" || DIMS.indexOf(d) > -1 ? { color: color(k) } : undefined }; }) }],
					color: ["#2f6497", "#5b8fc7", "#8fb5dd", "#c3d6ea", "#5fae7c", "#e3a256", "#df7a7a"] };
			} else {
				var bar = type === "bar", cat = { type: "category", data: names, axisLabel: Object.assign({ interval: 0, width: bar ? 92 : 110, overflow: "truncate" }, lbl), axisTick: { show: false }, axisLine: { lineStyle: { color: c.grid } } },
					val = { type: "value", axisLabel: lbl, splitLine: { lineStyle: { color: c.grid } }, minInterval: 1 };
				o = { animation: false, tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
					grid: { left: rtl ? 16 : (bar ? 104 : 40), right: rtl ? (bar ? 104 : 40) : 16, top: 16, bottom: 46 },
					legend: { bottom: 0, [rtl ? "right" : "left"]: 8, textStyle: lbl, data: [measure] },
					xAxis: bar ? Object.assign(val, { inverse: rtl }) : Object.assign(cat, { inverse: rtl }),
					yAxis: bar ? Object.assign(cat, { inverse: true, position: rtl ? "right" : "left" }) : Object.assign(val, { position: rtl ? "right" : "left" }),
					series: [{ name: measure, type: "bar", barMaxWidth: 64, itemStyle: { color: "#5899da" },
						label: { show: true, position: bar ? (rtl ? "left" : "right") : "top", fontSize: 11, color: c.text },
						data: ks.map(function (k) { return { value: cnt.m[k], key: k, itemStyle: { color: color(k) } }; }) }] };
			}
			if (!ks.length) { o.graphic = [{ type: "text", left: "center", top: "middle", style: { text: this.text("jr.noData"), fill: c.label, fontSize: 13 } }]; }
			this.byId("jrChart").setOption(o, true);
		},

		/* View by time: finished runs per time bucket, stacked by outcome (Databricks "finished runs count"). */
		_timeChart: function (aIn) {
			var hrs = this._bucketHours(), range = Number(this.viewModel().getProperty("/jr/f/range")), lang = this.lang(),
				end = new Date(this._now), n = Math.ceil(range / hrs), keys = ["succeeded", "succeededWithFailures", "failed", "skipped"], that = this;
			end.setMinutes(0, 0, 0); end = new Date(end.getTime() + 3600e3);
			var start = end.getTime() - n * hrs * 3600e3, cats = [], series = {}, edges = [];
			keys.forEach(function (k) { series[k] = new Array(n).fill(0); });
			for (var i = 0; i < n; i++) {
				var t0 = start + i * hrs * 3600e3;
				edges.push([t0, t0 + hrs * 3600e3]);
				cats.push(R.short(new Date(t0), lang));
			}
			aIn.forEach(function (r) {
				if (!R.finished(r.status)) { return; }
				var i = Math.floor((R.parse(r.end || r.start).getTime() - start) / (hrs * 3600e3));
				if (i < 0 || i >= n) { return; }
				var k = r.status === "timedOut" ? "failed" : r.status === "canceled" ? "skipped" : r.status;
				series[k][i]++;
			});
			this._edges = edges; this._cats = cats;
			var rtl = this.isRtl(), c = this.colors;
			this.byId("jrChart").setOption({
				animation: false,
				grid: { left: rtl ? 16 : 40, right: rtl ? 40 : 16, top: 30, bottom: 26 },
				legend: { top: 0, left: rtl ? 8 : "auto", right: rtl ? "auto" : 8, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11, color: c.label } },
				tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
				xAxis: { type: "category", inverse: rtl, data: cats, axisLabel: { fontSize: 10, color: c.label, interval: Math.max(0, Math.floor(n / 8) - 1) }, axisTick: { show: false }, axisLine: { lineStyle: { color: c.grid } } },
				yAxis: { type: "value", minInterval: 1, position: rtl ? "right" : "left", splitLine: { lineStyle: { color: c.grid } }, axisLabel: { fontSize: 10, color: c.label } },
				series: keys.map(function (k) {
					return { name: that.text("jr.st." + k), type: "bar", stack: "runs", barMaxWidth: 24, data: series[k], itemStyle: { color: R.COLOR[k] }, emphasis: { focus: "series" } };
				})
			}, true);
		},

		/* View by time: a bar shows only that period in the table. Other views: a bar toggles that value as a filter. */
		onChartSelect: function (oEvent) {
			var vm = this.viewModel(), d = vm.getProperty("/jr/viewBy"), data = oEvent.getParameter("data");
			if (d !== "time") {
				if (DIMS.indexOf(d) > -1 && data && data.key) { this._toggle(d, data.key); }
				else if (d === "runAs" && data && data.key) { vm.setProperty("/jr/f/runAs", data.key === ME ? "me" : "all"); this._apply(); }
				return;
			}
			var i = oEvent.getParameter("dataIndex");
			if (i === undefined || !this._edges[i]) { return; }
			var e = this._edges[i], lang = this.lang();
			vm.setProperty("/jr/bucket", e);
			vm.setProperty("/jr/bucketText", this.text("jr.f.bucket", [R.short(new Date(e[0]), lang) + " – " + R.short(new Date(e[1]), lang).split(" ").pop()]));
			this._apply();
		},
		onVfSelect: function (oEvent) {
			var data = oEvent.getParameter("data");
			if (data && data.key) { this._toggle(oEvent.getSource().data("dim"), data.key); }
		},
		_toggle: function (d, k) {
			var vm = this.viewModel(), a = vm.getProperty("/jr/f/" + d).slice(), i = a.indexOf(k);
			if (i > -1) { a.splice(i, 1); } else { a.push(k); }
			vm.setProperty("/jr/f/" + d, a);
			this._apply();
		},
		onVfPick: function (oEvent) {
			this.viewModel().setProperty("/jr/filterMode", "compact");
			MessageToast.show(this.text("rp.t.vfPick", [this._dimText[oEvent.getSource().data("dim")]]));
		},
		onTokenDelete: function (oEvent) {
			var t = oEvent.getSource().getBindingContext("view").getObject(), vm = this.viewModel();
			if (DIMS.indexOf(t.dim) > -1) { this._toggle(t.dim, t.key); return; }
			if (t.dim === "folder") { this._goFolder(""); return; }
			vm.setProperty("/jr/f/" + t.dim, t.dim === "runAs" ? "all" : "");
			this._apply();
		},
		onViewBy: function () {
			var vm = this.viewModel();
			if (vm.getProperty("/jr/viewBy") === "time") { vm.setProperty("/jr/chartType", "column"); }
			this._mainChart();
		},
		onChartType: function () { this._mainChart(); },
		onMode: function () { var that = this; setTimeout(function () { that._mainChart(); }, 0); },
		onAdapt: function () { this.viewModel().setProperty("/jr/filterMode", "compact"); },

		_setVariant: function (k) {
			var vm = this.viewModel();
			vm.setProperty("/jr/variant", k);
			vm.setProperty("/jr/f", Object.assign(this._emptyFilters(), JSON.parse(JSON.stringify(VARIANTS[k]))));
			vm.setProperty("/jr/bucket", null);
			this._tree();
			this._apply();
		},
		onVariant: function (oEvent) { this._setVariant(oEvent.getParameter("item").getKey()); },

		onFilter: function () { this._apply(); },
		onRange: function () { this.viewModel().setProperty("/jr/bucket", null); this._apply(); },
		onClearBucket: function () { this.viewModel().setProperty("/jr/bucket", null); this._apply(); },
		onClearFilters: function () {
			var vm = this.viewModel();
			vm.setProperty("/jr/f", this._emptyFilters());
			vm.setProperty("/jr/bucket", null);
			this._tree();
			this._apply();
		},
		onRefresh: function () { this._apply(); MessageToast.show(this.text("jr.t.refreshed")); },
		onExport: function () { MessageToast.show(this.text("jr.t.export", [this.fmt.num((this._rows || []).length)])); },

		_row: function (oEvent) { return oEvent.getSource().getBindingContext("view").getObject(); },

		onOpenRun: function (oEvent) { this.router().navTo("jobRun", { runId: this._row(oEvent).id }); },

		onStop: function (oEvent) { MessageToast.show(this.text("jr.t.stopped", [this._row(oEvent).id])); },

		onRowMenu: function (oEvent) {
			var o = this._row(oEvent), oBtn = oEvent.getSource(), that = this,
				oRun = this.getOwnerComponent().getModel("runs").getProperty("/runs").filter(function (r) { return r.id === o.id; })[0],
				oJob = this._jobs[o.job], oFix = R.fixFor(this, oRun.error, oJob);
			var oMenu = new Menu({ items: [
				new MenuItem({ text: this.text("jr.a.open"), icon: "sap-icon://detail-view", press: function () { that.router().navTo("jobRun", { runId: o.id }); } }),
				new MenuItem({ text: this.text("jr.a.airflow"), icon: "sap-icon://popup-window", visible: o.airflow, press: function () { R.openAirflow(that, oBtn, oJob, oRun); } }),
				new MenuItem({ text: this.text("jr.a.replay"), icon: "sap-icon://replay", enabled: R.finished(oRun.status), press: function () { R.requestReplay(that, oJob, oRun, that.lang()); } }),
				new MenuItem({ text: oFix ? this.text("jr.fix.menu", [oFix.text]) : "", icon: "sap-icon://wrench", visible: !!oFix, press: function () { R.runFix(that, oRun.error, oJob, oRun, that.lang()); } }),
				new MenuItem({ text: this.text("jr.a.stop"), icon: "sap-icon://stop", visible: o.active, press: function () { MessageToast.show(that.text("jr.t.stopped", [o.id])); } }),
				new MenuItem({ text: this.text("jr.a.copyId"), icon: "sap-icon://copy", press: function () {
					try { navigator.clipboard.writeText(o.id).catch(function () { /* clipboard blocked */ }); } catch (e) { /* clipboard blocked */ }
					MessageToast.show(that.text("jr.t.copied", [o.id]));
				} })
			], closed: function () { oMenu.destroy(); } });
			this.getView().addDependent(oMenu);
			oMenu.openBy(oBtn);
		},

		/* Show or hide columns (Databricks "Columns" button); remembered per browser. */
		onColumns: function (oEvent) {
			var vm = this.viewModel(), that = this, oCols = vm.getProperty("/jr/cols"),
				LBL = { type: "jr.col.type", runAs: "jr.col.runAs", launched: "jr.col.launched", duration: "jr.col.duration", error: "jr.col.error", params: "jr.col.params" },
				oList = new List({ mode: "MultiSelect", items: COLS.map(function (k) {
					return new StandardListItem({ title: that.text(LBL[k]), selected: !!oCols[k] }).data("col", k);
				}), selectionChange: function (e) {
					e.getParameter("listItems").forEach(function (it) { vm.setProperty("/jr/cols/" + it.data("col"), it.getSelected()); });
					that.store("repoio-jr-cols", vm.getProperty("/jr/cols"));
				} }),
				oPop = new Popover({ title: this.text("jr.columns"), placement: "Bottom", contentWidth: "14rem", content: [oList], afterClose: function () { oPop.destroy(); } });
			this.getView().addDependent(oPop);
			oPop.openBy(oEvent.getSource());
		}
	});
});
