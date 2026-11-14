sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast"
], function (BaseController, MessageToast) {
	"use strict";

	var STAGES = ["standardise", "dq", "match", "survivorship"],
		STATUS = { running: ["Success", "sap-icon://process"], stopped: ["None", "sap-icon://stop"], failed: ["Error", "sap-icon://error"] },
		LAG_WARN = 10000, BEHIND_WARN = 600;

	/* Streams (J10 step 1): one Spark Structured Streaming job per entity; lag, checkpoints, throughput and the DLQ. */
	return BaseController.extend("repoio.proto.controller.Streams", {
		onInit: function () {
			this.viewModel().setProperty("/st", { rows: [], kpis: [] });
			this.router().getRoute("streams").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			var that = this, oM = this.getOwnerComponent().getModel("runs");
			oM.dataLoaded().then(function () { that._d = oM.getData(); that._build(); });
		},

		_ago: function (sTs) {
			var min = Math.round((new Date(this._d.now.replace(" ", "T")) - new Date(sTs.replace(" ", "T"))) / 60000);
			return min < 1 ? this.text("st.justNow") : min < 60 ? this.text("st.minAgo", [min]) : this.text("st.hAgo", [Math.floor(min / 60), min % 60]);
		},
		_age: function (sTs) {
			var min = Math.round((new Date(this._d.now.replace(" ", "T")) - new Date(sTs.replace(" ", "T"))) / 60000);
			return min < 60 ? this.text("st.durM", [min]) : this.text("st.durH", [Math.floor(min / 60), min % 60]);
		},
		_behind: function (s) {
			return s < 60 ? this.text("st.behindS", [s]) : s < 3600 ? this.text("st.behindM", [Math.round(s / 60)]) : this.text("st.behindH", [Math.floor(s / 3600), Math.round((s % 3600) / 60)]);
		},

		_build: function () {
			var that = this, ar = this.lang() === "ar", vm = this.viewModel(), limit = this._d.streamsAlert.dlqPerHour, c = this.colors;
			var rows = this._d.streams.map(function (s) {
				var st = STATUS[s.status], hot = s.dlqHour >= limit, lagBad = s.lag >= LAG_WARN || s.behindSec >= BEHIND_WARN;
				return Object.assign({}, s, {
					title: ar ? s.title_ar : s.title_en, flowText: s.from + " → " + s.to, flowTip: s.from + " → " + s.to + " · " + that.text("st.group") + ": " + s.group,
					statusText: that.text("st.status." + s.status), statusState: st[0], statusIcon: st[1],
					stages: STAGES.map(function (k, i) {
						return { first: i === 0, state: s.stages[k], text: that.text("st.stage." + k), tip: that.text("st.stage." + k) + ": " + that.text("st.state." + s.stages[k]) };
					}),
					lagText: s.lag.toLocaleString("en-US"), lagState: s.status === "failed" ? "Error" : lagBad ? "Warning" : "None", behindText: that._behind(s.behindSec),
					checkpointText: that._ago(s.checkpoint), rateText: that.text("st.rate", [s.rate]),
					dlqText: s.dlq.toLocaleString("en-US"), dlqAlert: hot, dlqHourText: that.text("st.dlqHour", [s.dlqHour]),
					highlight: s.status === "failed" || hot ? "Error" : lagBad ? "Warning" : "None"
				});
			});
			var running = rows.filter(function (r) { return r.status === "running"; }).length,
				maxLag = rows.reduce(function (m, r) { return r.lag > m.lag ? r : m; }, rows[0]),
				dlq = rows.reduce(function (n, r) { return n + r.dlq; }, 0),
				oldest = rows.reduce(function (m, r) { return r.checkpoint < m.checkpoint ? r : m; }, rows[0]),
				hot = rows.filter(function (r) { return r.dlqAlert; });
			vm.setProperty("/st/rows", rows);
			vm.setProperty("/st/titleN", this.text("st.titleN", [rows.length]));
			vm.setProperty("/st/kpis", [
				{ label: this.text("st.k.running"), value: running + " / " + rows.length, unit: "", state: running < rows.length ? "Error" : "Success", hint: this.text("st.k.runningHint") },
				{ label: this.text("st.k.maxLag"), value: maxLag.lagText, unit: this.text("st.records"), state: maxLag.lagState, hint: maxLag.title + " · " + maxLag.behindText },
				{ label: this.text("st.k.dlq"), value: dlq.toLocaleString("en-US"), unit: this.text("st.records"), state: hot.length ? "Error" : "None", hint: this.text("st.k.dlqHint") },
				{ label: this.text("st.k.checkpoint"), value: this._age(oldest.checkpoint), unit: "", state: oldest.status === "failed" ? "Error" : "None", hint: oldest.title }
			]);
			vm.setProperty("/st/alertText", hot.length ? this.text("st.alert", [hot.map(function (r) { return r.title; }).join(", "), hot[0].dlqHour, limit, hot[0].dlqReason || ""]) : "");
			this._hot = hot[0];
			var rtl = this.isRtl(), pal = [c.brand, c.crit, c.neg];
			this.byId("stChart").setOption({
				animation: false, color: pal,
				grid: { left: rtl ? 12 : 52, right: rtl ? 52 : 12, top: 28, bottom: 22 },
				legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11, color: c.label } },
				tooltip: { trigger: "axis" },
				xAxis: { type: "category", inverse: rtl, data: ["-55", "-50", "-45", "-40", "-35", "-30", "-25", "-20", "-15", "-10", "-5", this.text("st.now")],
					axisTick: { show: false }, axisLabel: { fontSize: 10, color: c.label }, axisLine: { lineStyle: { color: c.grid } } },
				yAxis: { type: "value", position: rtl ? "right" : "left", splitLine: { lineStyle: { color: c.grid } }, axisLabel: { fontSize: 10, color: c.label } },
				series: rows.map(function (r) { return { name: r.title, type: "line", symbolSize: 4, data: r.lagHist }; })
			});
		},

		onSwitch: function (oEvent) { if (oEvent.getParameter("item").getKey() === "runs") { this.router().navTo("jobs"); } },
		onRefresh: function () { this._build(); MessageToast.show(this.text("st.refreshed")); },
		onOpenRuns: function (oEvent) {
			var job = oEvent.getSource().getBindingContext("view").getProperty("job"),
				run = this._d.runs.filter(function (r) { return r.job === job; }).sort(function (a, b) { return a.start < b.start ? 1 : -1; })[0];
			if (run) { this.router().navTo("jobRun", { runId: run.id }); }
		},
		onOpenDlq: function () { this.navKey("quarantine"); },
		onDlqAlert: function () { this.navKey("quarantine"); }
	});
});
