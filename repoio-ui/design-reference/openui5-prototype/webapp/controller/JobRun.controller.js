sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/jobRuns",
	"sap/m/MessageToast",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Text"
], function (BaseController, R, MessageToast, Dialog, Button, Text) {
	"use strict";

	return BaseController.extend("repoio.proto.controller.JobRun", {
		onInit: function () {
			this.router().getRoute("jobRun").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var sId = oEvent.getParameter("arguments").runId, oRuns = this.getOwnerComponent().getModel("runs");
			oRuns.dataLoaded().then(function () {
				this._jobs = {};
				oRuns.getProperty("/jobs").forEach(function (j) { this._jobs[j.id] = j; }.bind(this));
				this._now = R.parse(oRuns.getProperty("/now"));
				var oRun = oRuns.getProperty("/runs").filter(function (r) { return r.id === sId; })[0];
				if (!oRun) { this.router().navTo("jobs", {}, true); return; }
				var vm = this.viewModel(), bNewJob = !this._job || this._job.id !== oRun.job;
				if (bNewJob) {
					vm.setProperty("/jd", { asc: false, runFilter: "", tab: "msg", mq: "", mcat: "", masc: true, full: !!(vm.getProperty("/jd") || {}).full });
				}
				this._job = this._jobs[oRun.job];
				this._run = oRun;
				this._fillJob();
				this._fillRun();
				this._fillRuns();
				this._applyFull();
			}.bind(this));
		},

		/* ---------- left: the job ---------- */
		_fillJob: function () {
			var j = this._job, lang = this.lang(), vm = this.viewModel(), that = this,
				all = this._jobRuns(), latest = all.filter(function (r) { return r.status !== "queued"; })[0] || all[0],
				lastDone = all.filter(function (r) { return r.status === "succeeded" || r.status === "succeededWithFailures"; })[0],
				lastOk = all.filter(function (r) { return r.status === "succeeded"; })[0],
				st = latest.status === "running" && latest.runType === "permanent" ? "active" : latest.status,
				next = "—";
			if (j.cron) {
				var hrs = { "c4c_customer_pull": 3, "erp_vendor_pull": 4 }[j.id] || 24, last = R.parse(all.filter(function (r) { return r.launched === "schedule"; })[0].start);
				var d = new Date(last.getTime() + hrs * 3600e3);
				while (d < this._now) { d = new Date(d.getTime() + hrs * 3600e3); }
				d.setSeconds(0);
				next = R.date(d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ":00", lang);
			}
			vm.setProperty("/jd/job", {
				id: j.id, kind: j.kind, title: lang === "ar" ? j.title_ar : j.title_en, cron: j.cron, airflow: j.orch === "airflow",
				statusText: that.text("jr.st." + st), statusState: R.state(st),
				delta: j.delta, source: j.source, conn: j.conn, srcObj: j.srcObj, target: j.target,
				orchText: this.text("jr.orch." + j.orch) + (j.dagId ? " · " + j.dagId : ""),
				owner: j.owner, ownerText: R.person(j.owner, lang),
				freq: lang === "ar" ? j.freq_ar : j.freq_en,
				lastOkId: lastOk ? lastOk.id : "", lastOkText: lastOk ? R.date(lastOk.start, lang) + (lastOk.id === this._run.id ? " ✓" : "") : this.text("jr.d.lastOkNone"),
				latest: j.kind === "stream" ? R.date(latest.messages[latest.messages.length - 1].ts, lang) : lastDone ? R.date(lastDone.end, lang) : "—", next: next
			});
		},

		_jobRuns: function () {
			var id = this._job.id;
			return this.getOwnerComponent().getModel("runs").getProperty("/runs").filter(function (r) { return r.job === id; });
		},

		_fillRuns: function () {
			var vm = this.viewModel(), lang = this.lang(), that = this, sel = this._run.id,
				f = vm.getProperty("/jd/runFilter"), asc = vm.getProperty("/jd/asc"),
				a = this._jobRuns().filter(function (r) {
					return !f || r.status === f || (f === "failed" && r.status === "timedOut") || (f === "succeeded" && r.status === "succeededWithFailures");
				}).map(function (r) {
					var st = r.status === "running" && r.runType === "permanent" ? "active" : r.status;
					return { id: r.id, startText: R.date(r.start, lang), statusText: that.text("jr.st." + st), statusState: R.state(st), sel: r.id === sel };
				});
			if (asc) { a.reverse(); }
			vm.setProperty("/jd/runs", a);
			this._bars();
		},

		/* Databricks-style duration bars for the job's recent runs; a bar opens that run. */
		_bars: function () {
			var a = this._jobRuns().slice(0, 16).reverse(), sel = this._run.id, rtl = this.isRtl(), lang = this.lang(), that = this;
			this._barIds = a.map(function (r) { return r.id; });
			this.byId("jdBars").setOption({
				animation: false,
				grid: { left: 4, right: 4, top: 4, bottom: 4 },
				tooltip: { trigger: "item", formatter: function (p) { var r = a[p.dataIndex]; return R.date(r.start, lang) + "<br/>" + R.dur(r.sec) + " · " + that.text("jr.st." + r.status); } },
				xAxis: { type: "category", inverse: rtl, show: false, data: this._barIds },
				yAxis: { type: "value", show: false },
				series: [{ type: "bar", barMaxWidth: 12, data: a.map(function (r) {
					return { value: Math.sqrt(Math.max(r.sec, 30)), itemStyle: { color: R.COLOR[r.status] || "#b4bac0", borderColor: r.id === sel ? "#32363a" : "transparent", borderWidth: r.id === sel ? 1.5 : 0, borderRadius: [2, 2, 0, 0] } };
				}) }]
			});
		},

		onBarSelect: function (oEvent) {
			var id = this._barIds && this._barIds[oEvent.getParameter("dataIndex")];
			if (id) { this.router().navTo("jobRun", { runId: id }, true); }
		},

		onRunSelect: function (oEvent) {
			var o = oEvent.getParameter("listItem").getBindingContext("view").getObject();
			this.router().navTo("jobRun", { runId: o.id }, true);
		},
		onSortRuns: function () { var vm = this.viewModel(); vm.setProperty("/jd/asc", !vm.getProperty("/jd/asc")); this._fillRuns(); },
		onFilterRuns: function (oEvent) { this.viewModel().setProperty("/jd/runFilter", oEvent.getParameter("item").getKey()); this._fillRuns(); },

		/* ---------- right: the run ---------- */
		_fillRun: function () {
			var r = this._run, j = this._job, lang = this.lang(), vm = this.viewModel(), that = this,
				st = r.status === "running" && r.runType === "permanent" ? "active" : r.status,
				lastErr = r.messages.filter(function (m) { return m.cat === "error"; }).pop();
			var tasks = r.tasks.map(function (t, i) {
				return { id: t.id, status: t.status, first: i === 0, icon: R.icon(t.status),
					tip: that.text("jr.st." + t.status) + (t.sec ? " · " + R.dur(t.sec) : "") + (t.start ? " · " + R.date(t.start, lang) : "") };
			});
			var objects = r.objects.map(function (o, i) {
				return Object.assign({}, o, { idx: i, sel: i === 0, loadText: that.text("jr.load." + o.load), statusText: that.text("jr.st." + o.status),
					statusState: R.state(o.status), statusIcon: R.icon(o.status), lastText: R.date(o.last, lang), recText: o.records ? that.fmt.num(o.records) : "—" });
			});
			vm.setProperty("/jd/run", {
				id: r.id, status: r.status, finished: R.finished(r.status), runType: r.runType,
				statusText: this.text("jr.st." + st), statusState: R.state(st), statusIcon: R.icon(st),
				durText: r.runType === "permanent" && r.status === "running" ? this.text("jr.d.endless") : r.status === "queued" ? "—" : R.dur(r.sec),
				startText: R.date(r.start, lang), endText: r.end ? R.date(r.end, lang) : "—",
				runAs: r.runAs, runAsText: R.person(r.runAs, lang), runTypeText: this.text("jr.rt." + r.runType),
				launchedText: this.text("jr.launched." + r.launched), dagRunId: r.dagRunId,
				errorText: lastErr ? R.msg(this, lastErr.key, lastErr.args, lang) : "",
				fixText: (R.fixFor(this, r.error, j) || {}).text || "",
				tasks: tasks, objects: objects, messages: r.messages, quarantined: r.quarantined, hasDq: r.dq.length > 0 || r.quarantined > 0,
				qText: this.text("jr.dq.quarantined", [r.quarantined]),
				dq: r.dq.map(function (d) { return Object.assign({}, d, { pctText: d.pct.toFixed(2) + "%", resText: that.text(d.ok ? "jr.dq.pass" : "jr.dq.fail") }); })
			});
			if (vm.getProperty("/jd/tab") === "dq" && !r.dq.length && !r.quarantined) { vm.setProperty("/jd/tab", "msg"); }
			this._msgs();
			this._metrics(0);
		},

		objectsTitle: function (a) { return this.text("jr.d.objects", [(a || []).length]); },
		messagesTitle: function (a) { return this.text("jr.d.messages", [(a || []).length]); },
		dqTitle: function (a) { return this.text("jr.d.dq", [(a || []).filter(function (d) { return !d.ok; }).length]); },

		_msgs: function () {
			var vm = this.viewModel(), lang = this.lang(), that = this, q = (vm.getProperty("/jd/mq") || "").toLowerCase(), cat = vm.getProperty("/jd/mcat"),
				a = this._run.messages.map(function (m) {
					return { tsText: R.date(m.ts, lang), cat: m.cat, catText: that.text("jr.cat." + m.cat),
						catState: m.cat === "error" ? "Error" : m.cat === "warning" ? "Warning" : "Information",
						catIcon: m.cat === "error" ? "sap-icon://error" : m.cat === "warning" ? "sap-icon://alert" : "sap-icon://message-information",
						text: R.msg(that, m.key, m.args, lang), detail: m.detail };
				}).filter(function (m) { return (!cat || m.cat === cat) && (!q || m.text.toLowerCase().indexOf(q) > -1); });
			if (!vm.getProperty("/jd/masc")) { a.reverse(); }
			this._mrows = a;
			vm.setProperty("/jd/mcount", a.length);
			vm.setProperty("/jd/mpage", 1);
			if (!vm.getProperty("/jd/msize")) { vm.setProperty("/jd/msize", 25); }
			this._mslice();
		},
		_mslice: function () {
			var vm = this.viewModel(), p = vm.getProperty("/jd/mpage"), n = vm.getProperty("/jd/msize");
			vm.setProperty("/jd/msgs", this._mrows.slice((p - 1) * n, p * n));
		},
		onMsgPage: function (oEvent) {
			var vm = this.viewModel();
			vm.setProperty("/jd/mpage", oEvent.getParameter("page"));
			vm.setProperty("/jd/msize", oEvent.getParameter("pageSize"));
			this._mslice();
		},
		onMsgFilter: function () { this._msgs(); },
		onMsgSort: function () { var vm = this.viewModel(); vm.setProperty("/jd/masc", !vm.getProperty("/jd/masc")); this._msgs(); },

		onMsgDetail: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(),
				oDlg = new Dialog({
					title: o.text, contentWidth: "40rem", resizable: true,
					content: [new Text({ text: o.detail, textDirection: "LTR", renderWhitespace: true }).addStyleClass("repoioMono repoioJdDetail")],
					endButton: new Button({ text: this.text("common.close"), press: function () { oDlg.close(); } }),
					afterClose: function () { oDlg.destroy(); }
				});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},

		onObjectSelect: function (oEvent) {
			var o = oEvent.getParameter("listItem").getBindingContext("view").getObject();
			this._metrics(o.idx);
		},

		/* Metrics of the selected object, like the Datasphere "Metrics" tab. */
		_metrics: function (i) {
			var r = this._run, o = r.objects[i] || {}, lang = this.lang(), fmt = this.fmt.num,
				stream = this._job.kind === "stream",
				find = function (key) { var m = r.messages.filter(function (x) { return x.key === key; }).pop(); return m ? m.args : null; },
				lag = find("jr.m.lag"), chk = find("jr.m.checkpoint"),
				initial = o.load === "initialDelta" || o.load === "full";
			this.viewModel().setProperty("/jd/m", {
				title: this.text("jr.m.replObj", [o.src || "—"]),
				durLabel: this.text(initial ? "jr.m.initDuration" : "jr.m.duration"),
				dur: r.status === "queued" ? "—" : R.dur(stream ? 69 : r.sec),
				start: R.date(r.start, lang),
				state: o.state === "transferDelta" ? this.text("jr.m.transferDelta") : this.text("jr.st." + (o.status || "pending")),
				initOps: fmt(o.initOps), deltaOps: fmt(o.deltaOps),
				end: r.end ? R.date(r.end, lang) : stream ? R.date(r.start.slice(0, 14) + "19:43", lang) : "—",
				threads: o.threads || 1, parts: o.parts || "—", partsDone: o.parts ? o.partsDone : "—", partsErr: o.parts ? o.partsErr : 0,
				isStream: stream, lag: lag ? fmt(Number(lag[1])) : "—", checkpoint: chk ? chk[0] : "—"
			});
		},

		onTask: function (oEvent) {
			var t = oEvent.getSource().getBindingContext("view").getObject();
			R.openAirflow(this, oEvent.getSource(), this._job, this._run, t.id);
		},

		/* ---------- actions ---------- */
		onBack: function () { this.router().navTo("jobs"); },
		onFix: function () { R.runFix(this, this._run.error, this._job, this._run, this.lang()); },
		onLastOk: function () {
			var id = this.viewModel().getProperty("/jd/job/lastOkId");
			if (id) { this.router().navTo("jobRun", { runId: id }, true); }
		},
		onAirflow: function (oEvent) { R.openAirflow(this, oEvent.getSource(), this._job, this._run); },
		onReplay: function () { R.requestReplay(this, this._job, this._run, this.lang()); },
		onStop: function () { MessageToast.show(this.text("jr.t.stopped", [this._run.id])); },
		onRunNow: function () { MessageToast.show(this.text("jr.t.runNow", [this.lang() === "ar" ? this._job.title_ar : this._job.title_en])); },
		onEditSchedule: function () { MessageToast.show(this.text("jr.t.schedule")); },
		onPauseSchedule: function () { MessageToast.show(this.text("jr.t.paused", [this.lang() === "ar" ? this._job.title_ar : this._job.title_en])); },
		onRefresh: function () { this._fillJob(); this._fillRun(); this._fillRuns(); MessageToast.show(this.text("jr.t.refreshed")); },
		onOpenConnection: function () { this.router().navTo("connections"); },
		onQuarantine: function () { this.navKey("quarantine"); },

		onToggleFull: function () {
			var vm = this.viewModel();
			vm.setProperty("/jd/full", !vm.getProperty("/jd/full"));
			this._applyFull();
		},
		_applyFull: function () {
			var bFull = !!this.viewModel().getProperty("/jd/full"), oLeft = this.byId("jdLeft");
			oLeft.setVisible(!bFull);
			oLeft.getLayoutData().setSize(bFull ? "0px" : "22rem");
		},

		/* The run log as plain text (messages in order), saved in the browser. */
		onDownload: function () {
			var r = this._run, lang = this.lang(), that = this,
				s = r.messages.map(function (m) { return m.ts + "\t" + m.cat.toUpperCase() + "\t" + R.msg(that, m.key, m.args, lang) + (m.detail ? "\n\t" + m.detail.replace(/\n/g, "\n\t") : ""); }).join("\n");
			var a = document.createElement("a");
			a.href = URL.createObjectURL(new Blob(["﻿" + s], { type: "text/plain;charset=utf-8" }));
			a.download = r.job + "_" + r.id + ".log";
			document.body.appendChild(a); a.click(); a.remove();
			setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
		}
	});
});
