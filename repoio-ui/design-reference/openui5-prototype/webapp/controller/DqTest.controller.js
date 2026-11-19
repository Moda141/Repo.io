sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"repoio/proto/util/dq",
	"repoio/proto/util/semantic"
], function (BaseController, MessageToast, DQ, Sem) {
	"use strict";

	/* J10: one data quality test (object page). */
	return BaseController.extend("repoio.proto.controller.DqTest", {
		onInit: function () {
			this.viewModel().setProperty("/dqt", {});
			this.router().getRoute("dqTest").attachPatternMatched(this._onMatched, this);
		},
		_onMatched: function (oEvent) {
			var that = this, id = oEvent.getParameter("arguments").id, C = this.getOwnerComponent();
			Promise.all([DQ.load(this), C.getModel("stewardship").dataLoaded(), C.getModel("tables").dataLoaded()]).then(function (a) {
				var m = a[0], t = (m.getProperty("/tests") || []).filter(function (x) { return x.id === id; })[0];
				if (!t) { MessageToast.show(that.text("md.t.gone", [id])); that.router().navTo("dqTests", {}, true); return; }
				that._m = m;
				that._t = t;
				that._show(t);
				var op = that.byId("op");
				op.setSelectedSection(op.getSections()[0]);
				op.scrollToSection(op.getSections()[0].getId(), 0);
			});
		},

		/* Readable rule details from the check parameters */
		_params: function (t) {
			var T = this.text.bind(this), p = t.params || {}, m = this._m, ar = this.lang() === "ar";
			switch (t.check) {
				case "inList":
					var l = (m.getProperty("/refLists") || []).filter(function (x) { return x.key === p.list; })[0];
					return l ? T("dq.p.list", [ar ? l.ar : l.en, l.count]) : p.list;
				case "pattern": return (p.preset && p.preset !== "custom" ? T("dq.preset." + p.preset) + " · " : "") + p.regex;
				case "length": return p.min === p.max ? T("dq.p.lenEq", [p.min]) : T("dq.p.lenBetween", [p.min, p.max]);
				case "range": return T("dq.p.range", [this.fmt.num(p.min), this.fmt.num(p.max)]);
				case "requiredWhen": return T("dq.p.when", [p.whenCol, p.whenVal]);
				case "fresh": return T("dq.p.fresh", [p.hours]);
				case "python": return p.expectation;
				default: return T("dq.p.none");
			}
		},

		_show: function (t) {
			var that = this, T = this.text.bind(this), m = this._m, row = DQ.row(this, m, t), ck = DQ.check(m, t.check), w = DQ.where(this, t),
				l = DQ.last(t), runs = t.runs || [], passed = runs.filter(function (r) { return r.pass >= t.threshold; }).length,
				f = function (label, value, opt) { return Object.assign({ label: T(label), value: value, dir: "Inherit" }, opt || {}); };
			var fields = [
				f("dq.d.where", w.text + " · " + w.sub, { icon: w.icon }),
				f("dq.d.check", row.checkText, { icon: ck.icon }),
				f("dq.d.rule", this._params(t), { mono: t.check === "pattern" || t.check === "python", dir: t.check === "pattern" || t.check === "python" ? "LTR" : "Inherit" }),
				f("dq.d.ge", ck.ge, { mono: true, dir: "LTR" }),
				f("dq.d.threshold", T("dq.d.thresholdText", [t.threshold])),
				f("dq.d.sev", row.sevText + " — " + T("dq.sevHint." + t.severity), { icon: row.sevIcon }),
				f("dq.d.dim", row.dimText),
				f("dq.d.schedule", T("dq.sched." + t.schedule)),
				f("dq.d.author", row.authorText + (t.reviewer ? " · " + T("dq.d.reviewer", [t.reviewer]) : ""))
			];
			var held = t.level === "repository" ? this._held(t) : [];
			this.viewModel().setProperty("/dqt", Object.assign({}, row, {
				subtitle: t.id + " · " + w.text + " · " + w.sub,
				passNum: l && t.status !== "draft" ? DQ.pct(l.pass).replace("%", "") : "—",
				thText: row.thText, failedNum: l ? this.fmt.num(l.failed) : "—", checkedText: l && l.checked ? T("dq.ofChecked", [this.fmt.num(l.checked)]) : T("dq.k.lastRun", [l ? l.d : "—"]),
				held: held.length, heldText: held.length ? T("dq.k.heldN", [held.length]) : T("dq.k.heldNone"), heldSub: T("dq.k.heldSub"),
				passedRuns: runs.length ? String(passed) : "—", runsUnit: runs.length ? T("dq.k.ofRuns", [runs.length]) : "",
				versionText: T("dq.k.version", [t.version, t.changed]),
				fields: fields, pkgText: T("dq.pkgs", [(m.getProperty("/allowedPackages") || []).join(" · ")]),
				hasRuns: runs.length > 0,
				runs: runs.slice().reverse().map(function (r) {
					var res = r.pass >= t.threshold ? "pass" : t.severity === "warn" ? "warn" : "fail", s = Sem.of("dq", res);
					return { d: r.d, checkedText: r.checked ? that.fmt.num(r.checked) : "—", failedText: that.fmt.num(r.failed), passText: DQ.pct(r.pass),
						resText: T("dq.res." + res), resState: s[0], resIcon: s[1],
						runId: r.run || "", runText: r.run ? r.run + " · dq_nightly_suite" : "—" };
				}),
				colLabel: t.column || T("dq.f.value"),
				failTitle: t.level === "repository" ? T("dq.s.failsRepo", [held.length]) : T("dq.s.failsSrc"),
				failHint: t.level === "repository" ? T("dq.failHint." + t.severity) : T("dq.failHint.source"),
				fails: t.level === "repository" ? held : this._sourceFails(t),
				history: this._history(t)
			}));
			if (t.author === "python") { this.byId("dqtCode").setValue((t.params || {}).code || ""); }
			if (runs.length) { this._chart(t); }
		},

		/* Repository tests: the records the test holds or flags now (the Quarantine queue for this rule). */
		_held: function (t) {
			var that = this, T = this.text.bind(this), q = this.getOwnerComponent().getModel("stewardship").getProperty("/quarantine") || [];
			return q.filter(function (x) { return x.repo === t.repo && (x.rule === t.key || (x.also || []).indexOf(t.key) > -1); }).map(function (x) {
				var s = Sem.of("quarantine", x.status);
				return { qid: x.id, name: x.record.name || "—", key: x.sourceKey, value: x.record[t.column] || T("qa.empty"), since: x.held,
					stText: T("qa.st." + (x.status === "pendingDiscard" ? "pending" : x.status)), stState: s[0], stIcon: s[1] };
			});
		},
		/* Source tests: sample failing rows from the last nightly profile (they are not held). */
		_sourceFails: function (t) {
			var T = this.text.bind(this), X = this.getOwnerComponent().getModel("tables").getProperty("/tables/" + t.source + "." + t.schema + "." + t.table) || {},
				l = DQ.last(t), keyCol = ((X.columns || []).filter(function (c) { return c.key; })[0] || {}).name;
			return (X.errors || []).filter(function (e) { return e.column === t.column; }).map(function (e) {
				var nameCol = Object.keys(e.row).filter(function (k) { return /name/i.test(k); })[0];
				return { qid: "", name: nameCol ? e.row[nameCol] : "—", key: keyCol ? e.row[keyCol] : "", value: e.row[t.column] === null || e.row[t.column] === "" ? T("qa.empty") : String(e.row[t.column]),
					since: l ? l.d : "—", stText: T("dq.res.warn"), stState: "Warning", stIcon: "sap-icon://alert" };
			});
		},
		_history: function (t) {
			var T = this.text.bind(this), h = [];
			if (t.status === "inReview") { h.push({ icon: "sap-icon://pending", text: T("dq.h.waiting", [t.reviewer]), meta: t.changed }); }
			if (t.status === "disabled") { h.push({ icon: "sap-icon://media-pause", text: T("dq.h.paused"), meta: t.owner + " · " + t.changed }); }
			if (t.version > 1) {
				h.push({ icon: "sap-icon://edit", text: T("dq.h.edited", [t.version]), meta: t.owner + " · " + t.changed });
				if (t.author === "python") { h.push({ icon: "sap-icon://employee-approvals", text: T("dq.h.approved", [t.reviewer]), meta: t.changed }); }
			}
			h.push({ icon: "sap-icon://add", text: T("dq.h.created", [T("dq.author." + t.author)]), meta: t.owner + " · " + (t.level === "source" ? "2026-09-01" : "2026-06-15") });
			return h;
		},
		_chart: function (t) {
			var C = this.colors, rtl = this.isRtl(), T = this.text.bind(this), runs = t.runs,
				col = t.severity === "warn" ? C.crit : C.neg;
			this.byId("dqtChart").setOption({
				animation: false, legend: { top: 0, textStyle: { color: C.label, fontSize: 11 } }, tooltip: { trigger: "axis" },
				grid: { left: 44, right: 44, top: 30, bottom: 24 },
				xAxis: { type: "category", inverse: rtl, data: runs.map(function (r) { return r.d.slice(5); }), axisLabel: { color: C.label, fontSize: 11 }, axisLine: { lineStyle: { color: C.grid } } },
				yAxis: [
					{ type: "value", name: "%", position: rtl ? "right" : "left", min: function (v) { return Math.floor(Math.min(v.min, t.threshold) - 1); }, max: 100,
						axisLabel: { color: C.label, fontSize: 11 }, splitLine: { lineStyle: { color: C.grid } } },
					{ type: "value", position: rtl ? "left" : "right", axisLabel: { color: C.label, fontSize: 11 }, splitLine: { show: false } }
				],
				series: [
					{ name: T("dq.c.failed"), type: "bar", yAxisIndex: 1, barWidth: "45%", data: runs.map(function (r) { return r.failed; }),
						itemStyle: { color: col, opacity: 0.35 } },
					{ name: T("dq.r.pass"), type: "line", data: runs.map(function (r) { return r.pass; }), symbolSize: 5, lineStyle: { color: C.brand, width: 2 }, itemStyle: { color: C.brand },
						markLine: { silent: true, symbol: "none", lineStyle: { color: col, type: "dashed" },
							label: { formatter: T("dq.threshold", [t.threshold]), color: col, fontSize: 11, position: "insideEndTop" }, data: [{ yAxis: t.threshold }] } }
				]
			});
		},

		onBack: function () { this.router().navTo("dqTests"); },
		onEdit: function () { this.router().navTo("dqEdit", { id: this._t.id, query: { mode: this._t.author } }); },
		onCopy: function () { this.router().navTo("dqEdit", { id: "new", query: { mode: this._t.author, from: this._t.id } }); },
		onRun: function () { MessageToast.show(this.text("dq.t.run", [1])); },
		onToggle: function () {
			var t = this._t, on = t.status === "disabled";
			t.status = on ? "active" : "disabled";
			MessageToast.show(this.text(on ? "dq.t.enabled" : "dq.t.disabled", [1]));
			this._show(t);
		},
		onQuarantine: function () {
			var h = this.viewModel().getProperty("/dqt/fails")[0];
			this.router().navTo("quarantine", h && h.qid ? { id: h.qid } : {});
		},
		onFail: function (oEvent) {
			var id = oEvent.getSource().getBindingContext("view").getProperty("qid");
			if (id) { this.router().navTo("quarantine", { id: id }); }
		},
		/* Each result comes from that night's dq_nightly_suite run: open the run itself (tasks, objects, messages) */
		onRunLink: function (oEvent) {
			var id = oEvent.getSource().getBindingContext("view").getProperty("runId");
			if (id) { this.router().navTo("jobRun", { runId: id }); }
		}
	});
});
