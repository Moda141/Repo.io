sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/jobRuns",
	"sap/m/MessageToast",
	"sap/m/Menu",
	"sap/m/MenuItem",
	"sap/m/Popover",
	"sap/m/List",
	"sap/m/StandardListItem"
], function (BaseController, R, MessageToast, Menu, MenuItem, Popover, List, StandardListItem) {
	"use strict";

	var STATUSES = ["succeeded", "succeededWithFailures", "failed", "timedOut", "running", "queued", "skipped", "canceled"],
		COLS = ["type", "runAs", "launched", "duration", "error", "params"],
		ME = "محمد"; // the signed-in user of the prototype

	return BaseController.extend("repoio.proto.controller.JobRuns", {
		onInit: function () {
			var vm = this.viewModel();
			if (!vm.getProperty("/jr")) {
				var oCols = {};
				COLS.forEach(function (k) { oCols[k] = k !== "params"; });
				var oSaved = this.store("repoio-jr-cols");
				if (oSaved) { Object.keys(oSaved).forEach(function (k) { oCols[k] = !!oSaved[k]; }); }
				vm.setProperty("/jr", { f: this._emptyFilters(), cols: oCols, rows: [], top: [], count: 0, bucket: null });
			}
			this.router().getRoute("jobs").attachPatternMatched(this._onMatched, this);
		},

		_emptyFilters: function () { return { name: "", kind: "all", runAs: "all", range: "48", status: [], runId: "", error: "" }; },

		_onMatched: function () {
			var oRuns = this.getOwnerComponent().getModel("runs");
			oRuns.dataLoaded().then(function () {
				this._jobs = {};
				oRuns.getProperty("/jobs").forEach(function (j) { this._jobs[j.id] = j; }.bind(this));
				this._now = R.parse(oRuns.getProperty("/now"));
				var vm = this.viewModel();
				vm.setProperty("/jr/statuses", STATUSES.map(function (s) { return { key: s, text: this.text("jr.st." + s) }; }.bind(this)));
				this._apply();
			}.bind(this));
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

		/* Runs in the time range and every filter except the chart bucket (the chart shows those). */
		_inRange: function () {
			var vm = this.viewModel(), f = vm.getProperty("/jr/f"), now = this._now,
				from = new Date(now.getTime() - Number(f.range) * 3600e3), jobs = this._jobs,
				q = (f.name || "").trim().toLowerCase(), id = (f.runId || "").trim().toLowerCase();
			return this.getOwnerComponent().getModel("runs").getProperty("/runs").filter(function (r) {
				var j = jobs[r.job], t = R.parse(R.finished(r.status) && r.end ? r.end : r.start);
				if (r.status === "running" || r.status === "queued") { t = now; }
				if (t < from) { return false; }
				if (f.kind !== "all" && !(j.kind === f.kind || (f.kind === "ingest" && j.kind === "push"))) { return false; }
				if (f.runAs === "me" && r.runAs !== ME) { return false; }
				if (q && (j.id + " " + j.title_en + " " + j.title_ar).toLowerCase().indexOf(q) < 0) { return false; }
				if (id && r.id.toLowerCase().indexOf(id) < 0) { return false; }
				if (f.status.length && f.status.indexOf(r.status) < 0) { return false; }
				if (f.error && r.error !== f.error) { return false; }
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
			this._errorCodes(aIn);
			this._top(aIn);
			this._chart(aIn);
		},

		_errorCodes: function (aIn) {
			var vm = this.viewModel(), seen = {};
			this.getOwnerComponent().getModel("runs").getProperty("/runs").forEach(function (r) { if (r.error) { seen[r.error] = 1; } });
			vm.setProperty("/jr/errorCodes", [{ key: "", text: this.text("jr.f.anyError") }].concat(Object.keys(seen).sort().map(function (k) { return { key: k, text: k }; })));
		},

		_top: function (aIn) {
			var m = {}, lang = this.lang();
			aIn.forEach(function (r) {
				if (!r.error) { return; }
				var o = m[r.error] || (m[r.error] = { code: r.error, count: 0, lastRaw: "" });
				o.count++;
				if (r.start > o.lastRaw) { o.lastRaw = r.start; }
			});
			var a = Object.keys(m).map(function (k) { m[k].last = R.date(m[k].lastRaw, lang); return m[k]; })
				.sort(function (x, y) { return y.count - x.count || (y.lastRaw > x.lastRaw ? 1 : -1); }).slice(0, 5);
			this.viewModel().setProperty("/jr/top", a);
		},

		/* Finished runs per time bucket, stacked by outcome (Databricks "finished runs count"). */
		_chart: function (aIn) {
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
				grid: { left: rtl ? 12 : 30, right: rtl ? 30 : 12, top: 26, bottom: 22 },
				legend: { top: 0, left: rtl ? 0 : "auto", right: rtl ? "auto" : 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11, color: c.label } },
				tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
				xAxis: { type: "category", inverse: rtl, data: cats, axisLabel: { fontSize: 10, color: c.label, interval: Math.max(0, Math.floor(n / 6) - 1) }, axisTick: { show: false }, axisLine: { lineStyle: { color: c.grid } } },
				yAxis: { type: "value", minInterval: 1, position: rtl ? "right" : "left", splitLine: { lineStyle: { color: c.grid } }, axisLabel: { fontSize: 10, color: c.label } },
				series: keys.map(function (k) {
					return { name: that.text("jr.st." + k), type: "bar", stack: "runs", barMaxWidth: 18, data: series[k], itemStyle: { color: R.COLOR[k] }, emphasis: { focus: "series" } };
				})
			});
		},

		onChartSelect: function (oEvent) {
			var i = oEvent.getParameter("dataIndex");
			if (i === undefined || !this._edges[i]) { return; }
			var vm = this.viewModel(), e = this._edges[i], lang = this.lang();
			vm.setProperty("/jr/bucket", e);
			vm.setProperty("/jr/bucketText", this.text("jr.f.bucket", [R.short(new Date(e[0]), lang) + " – " + R.short(new Date(e[1]), lang).split(" ").pop()]));
			this._apply();
		},

		onClearBucket: function () { this.viewModel().setProperty("/jr/bucket", null); this._apply(); },

		onFilter: function () { this._apply(); },
		onRange: function () { this.viewModel().setProperty("/jr/bucket", null); this._apply(); },
		onClearFilters: function () {
			var vm = this.viewModel();
			vm.setProperty("/jr/f", this._emptyFilters());
			vm.setProperty("/jr/bucket", null);
			this._apply();
		},
		onRefresh: function () { this._apply(); MessageToast.show(this.text("jr.t.refreshed")); },

		onTopPress: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(), vm = this.viewModel();
			vm.setProperty("/jr/f/error", o.code);
			this._apply();
		},

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
					try { navigator.clipboard.writeText(o.id); } catch (e) { /* clipboard blocked */ }
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
