sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/audit",
	"repoio/proto/util/visualFilter",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Label",
	"sap/m/Input",
	"sap/m/TextArea",
	"sap/m/CheckBox",
	"sap/m/Text",
	"sap/ui/layout/form/SimpleForm",
	"repoio/proto/util/semantic"
], function (BaseController, Audit, VF, MessageToast, MessageBox, Dialog, Button, Label, Input, TextArea, CheckBox, Text, SimpleForm, Sem) {
	"use strict";

	var LTR = ["mobile_1", "mobile_2", "whatsapp", "email", "account_type", "state_id", "main_territory_id", "territory_1_id", "national_id", "tax_number", "changed"],
		/* Client-side preview of the check while a steward types a correction; the server runs the Great Expectations
		   suite again on reprocess and decides. */
		PREVIEW = {
			phone_format: function (v) { return /^01[0125][0-9]{8}$/.test(v); },
			governorate_ref: function (v) { return /^(0[1-9]|1[0-9]|2[0-7])$/.test(v); },
			name_present: function (v) { return !!v.trim(); },
			email_format: function (v) { return /^[^@ ]+@[^@ ]+\.[^@ ]+$/.test(v); },
			national_id_check: function (v) { return /^[23][0-9]{13}$/.test(v); },
			tax_number_format: function (v) { return /^[0-9]{9}$/.test(v); },
			territory_ref: function (v, rec) { return !!v && v.slice(0, 3) === ({ "01": "CAI", "02": "GIZ", "03": "ALX", "12": "DAK", "13": "SHR" }[rec.state_id] || "?"); }
		};

	/* J10: Quarantine — records the DQ step held. Reprocessing re-runs standardise → DQ → match for the record (idempotent);
	   the console never edits a golden record. */
	return BaseController.extend("repoio.proto.controller.Quarantine", {
		onInit: function () {
			this.viewModel().setProperty("/qa", { layout: "OneColumn", f: { q: "", repo: "", src: [], status: [], severity: "", rules: [] }, filterMode: "visual", it: {}, selCount: 0 });
			this.router().getRoute("quarantine").attachPatternMatched(this._onMatched, this);
		},
		_onMatched: function (oEvent) {
			var that = this, a = oEvent.getParameter("arguments") || {}, oS = this.getOwnerComponent().getModel("stewardship"), oR = this.getOwnerComponent().getModel("rules");
			Promise.all([oS.dataLoaded(), oR.dataLoaded(), this.data().dataLoaded ? this.data().dataLoaded() : null]).then(function () {
				if (!that._q) {
					var d = JSON.parse(JSON.stringify(oS.getData()));
					that._cfg = d; that._q = d.quarantine; that._done = 0;
				}
				that._refresh();
				if (a.id) { that._open(a.id); } else { that._openId = null; that.viewModel().setProperty("/qa/layout", "OneColumn"); that._refresh(); }
			});
		},
		_ar: function () { return this.lang() === "ar"; },
		_t: function (o) { return o ? (this._ar() ? o.ar || o.en : o.en || o.ar) : ""; },
		_me: function () { return this._cfg.me; },
		_rule: function (k) { return this._cfg.rules.filter(function (r) { return r.key === k; })[0]; },
		_srcName: function (id) { var s = (this.data().getProperty("/sources") || {})[id]; return s ? s.name : id; },
		_repoName: function (id) { var r = (this.data().getProperty("/repos") || {})[id]; return r ? r.name : id; },
		_col: function (repo, k) {
			var c = (this.getOwnerComponent().getModel("rules").getProperty("/repoColumns/" + repo) || []).filter(function (x) { return x.col === k; })[0];
			return c ? this._t(c) : k;
		},
		_status: function (q) {
			return Sem.of("quarantine", q.status);
		},
		_pending: function (q) { return q.status === "pendingWaive" || q.status === "pendingDiscard"; },

		_refresh: function () {
			var that = this, f = this.viewModel().getProperty("/qa/f"), T = this.text.bind(this), checked = this._checked || {};
			var rows = this._q.filter(function (x) { return that._match(x); }).map(function (x) {
				var r = that._rule(x.rule), st = that._status(x);
				return { id: x.id, name: x.record.name || T("qa.noName"), src: that._srcName(x.source) + " · " + x.sourceKey + " · " + that._repoName(x.repo),
					ruleText: T("go.dq." + x.rule), more: x.also.length ? T("qa.more", [x.also.length]) : "", col: r.col, value: x.record[r.col] || T("qa.empty"),
					run: x.run, statusText: T("qa.st." + x.status), statusState: st[0], statusIcon: st[1], held: T("qa.heldAt", [x.held]),
					highlight: r.severity === "error" ? "Error" : "Warning", checked: !!checked[x.id], navigated: x.id === that._openId,
					short: T("go.dq." + x.rule) + " · " + (x.record[r.col] || T("qa.empty")), statusShort: T("qa.stShort." + that._statusKey(x)) };
			});
			this._header(rows, f, T);
		},
		_statusKey: function (x) { return this._pending(x) ? "pending" : x.status; },
		/* skip: the dimension a visual filter card counts, so each card shows the other filters applied (ALP behaviour). */
		_match: function (x, skip) {
			var f = this.viewModel().getProperty("/qa/f"), q = (f.q || "").trim().toLowerCase(), r = this._rule(x.rule);
			if (q && [x.id, x.record.name, x.sourceKey, x.record[r.col] || ""].join(" ").toLowerCase().indexOf(q) < 0) { return false; }
			if (f.repo && x.repo !== f.repo) { return false; }
			if (skip !== "src" && f.src.length && f.src.indexOf(x.source) < 0) { return false; }
			if (skip !== "status" && f.status.length && f.status.indexOf(this._statusKey(x)) < 0) { return false; }
			if (f.severity && r.severity !== f.severity) { return false; }
			if (skip !== "rules" && f.rules.length && f.rules.indexOf(x.rule) < 0) { return false; }
			return true;
		},
		/* The list title, value lists, summary and visual filter cards. */
		_header: function (rows, f, T) {
			var that = this, vm = this.viewModel();
			vm.setProperty("/qa/rows", rows);
			vm.setProperty("/qa/listTitle", T("qa.list", [rows.length]));
			var repos = {}, srcs = {};
			this._q.forEach(function (x) { repos[x.repo] = 1; srcs[x.source] = 1; });
			vm.setProperty("/qa/repos", [{ key: "", text: T("gr.st.all") }].concat(Object.keys(repos).map(function (k) { return { key: k, text: that._repoName(k) }; })));
			vm.setProperty("/qa/srcs", Object.keys(srcs).map(function (k) { return { key: k, text: that._srcName(k) }; }));
			var oldest = this._q.map(function (x) { return x.held; }).sort()[0] || "";
			vm.setProperty("/qa/summary", T("qa.summary", [this._q.filter(function (x) { return x.status === "held"; }).length, this._q.filter(function (x) { return x.status === "ready"; }).length,
				this._q.filter(this._pending).length, oldest.slice(0, 10), this._done]));
			var n = f.src.length + f.status.length + f.rules.length + (f.repo ? 1 : 0) + (f.severity ? 1 : 0);
			vm.setProperty("/qa/active", n);
			vm.setProperty("/qa/clearText", T("md.clear", [n]));
			vm.setProperty("/qa/ruleList", this._cfg.rules.map(function (r) { return { key: r.key, text: T("go.dq." + r.key) }; }));
			this._charts();
			var one = f.rules.length === 1 ? f.rules[0] : "";
			vm.setProperty("/qa/byRuleText", one ? T("qa.a.byRule", [T("go.dq." + one), this._q.filter(function (x) { return x.rule === one && !that._pending(x); }).length]) : "");
			this._selState();
		},
		_selState: function () {
			var that = this, n = Object.keys(this._checked || {}).filter(function (k) { return that._checked[k]; }).length;
			this.viewModel().setProperty("/qa/selCount", n);
			this.viewModel().setProperty("/qa/batchText", this.text("qa.a.reprocessN", [n]));
		},
		onFilter: function () { this._refresh(); },
		/* Visual filter cards: held by rule, by status, by source system. */
		_charts: function () {
			var that = this, f = this.viewModel().getProperty("/qa/f"), C = this.colors, T = this.text.bind(this),
				cnt = function (dim, keyOf) { var m = {}; that._q.filter(function (x) { return that._match(x, dim); }).forEach(function (x) { var k = keyOf(x); m[k] = (m[k] || 0) + 1; }); return m; },
				rules = cnt("rules", function (x) { return x.rule; }), st = cnt("status", function (x) { return that._statusKey(x); }), src = cnt("src", function (x) { return x.source; });
			this.byId("vfQaRule").setOption(VF.hbar(this, this._cfg.rules.map(function (r) {
				return { key: r.key, name: T("go.dq." + r.key), value: rules[r.key] || 0, color: r.severity === "error" ? C.neg : C.crit };
			}).filter(function (x) { return x.value || f.rules.indexOf(x.key) > -1; }).sort(function (a, b) { return b.value - a.value; }).slice(0, 5), f.rules, { labelWidth: 150, empty: T("qa.none") }), true);
			this.byId("vfQaStatus").setOption(VF.donut(this, [["held", C.neg], ["ready", C.info], ["pending", C.crit]].map(function (s2) {
				return { key: s2[0], name: T("qa.st." + s2[0]), value: st[s2[0]] || 0, color: s2[1] };
			}).filter(function (x) { return x.value || f.status.indexOf(x.key) > -1; }), f.status));
			this.byId("vfQaSrc").setOption(VF.hbar(this, Object.keys(src).sort(function (a, b) { return src[b] - src[a]; }).map(function (k) {
				return { key: k, name: that._srcName(k), value: src[k], color: C.brand };
			}), f.src, { labelWidth: 110, empty: T("qa.none") }), true);
		},
		onVfSelect: function (oEvent) {
			var d = oEvent.getParameter("data"), dim = oEvent.getSource().data("dim"), vm = this.viewModel();
			if (!d || !d.key) { return; }
			vm.setProperty("/qa/f/" + dim, VF.toggle(vm.getProperty("/qa/f/" + dim), d.key));
			this._refresh();
		},
		onClear: function () {
			var vm = this.viewModel();
			vm.setProperty("/qa/f", { q: vm.getProperty("/qa/f/q"), repo: "", src: [], status: [], severity: "", rules: [] });
			this._refresh();
		},
		onSelectRows: function (oEvent) {
			var that = this;
			this._checked = this._checked || {};
			(oEvent.getParameter("listItems") || []).forEach(function (li) { that._checked[li.getBindingContext("view").getProperty("id")] = li.getSelected(); });
			this._selState();
		},

		/* ---------- one record ---------- */
		onOpen: function (oEvent) { this.router().navTo("quarantine", { id: oEvent.getSource().getBindingContext("view").getProperty("id") }); },
		_find: function (id) { return this._q.filter(function (x) { return x.id === id; })[0]; },
		_open: function (id) {
			var x = this._find(id), vm = this.viewModel();
			if (!x) { MessageToast.show(this.text("md.t.gone", [id])); this.router().navTo("quarantine", {}, true); return; }
			this._openId = id;
			if (vm.getProperty("/qa/layout") === "OneColumn") { vm.setProperty("/qa/layout", "TwoColumnsMidExpanded"); }
			this.byId("qaQueue").setHeaderExpanded(false); // the queue column is narrow while a record is open
			this._show(x);
			this._refresh();
		},
		_show: function (x) {
			var that = this, T = this.text.bind(this), me = this._me(), rules = [x.rule].concat(x.also), bad = rules.map(function (k) { return that._rule(k).col; }),
				st = this._status(x), pending = this._pending(x), canSecond = pending && x.first.by !== me;
			var history = [{ icon: "sap-icon://locked", text: T("qa.h.held", [T("go.dq." + x.rule), x.run]), at: x.held }];
			if (x.attempts > 1) { history.push({ icon: "sap-icon://synchronize", text: T("qa.h.attempts", [x.attempts - 1]), at: "" }); }
			if (x.status === "ready") { history.push({ icon: "sap-icon://accept", text: T("qa.h.ready", [this._srcName(x.source)]), at: "" }); }
			if (pending) { history.push({ icon: "sap-icon://group", text: T("qa.h.first." + x.status, [x.first.by, x.first.note]), at: x.first.at }); }
			this.viewModel().setProperty("/qa/it", {
				id: x.id, name: x.record.name || T("qa.noName"), subtitle: x.id + " · " + this._repoName(x.repo), run: T("qa.openRun", [x.run]),
				facts: [{ label: T("gr.f.src"), value: this._srcName(x.source) }, { label: T("go.c.key"), value: x.sourceKey, dir: "LTR" },
					{ label: T("qa.c.held"), value: x.held, dir: "LTR" }, { label: T("qa.c.attempts"), value: String(x.attempts) }],
				statusText: T("qa.st." + x.status), statusState: st[0], statusIcon: st[1],
				strip: pending ? T(x.first.by === me ? "qa.strip.own" : "qa.strip.second", [x.first.by, T("qa.st." + x.status)]) : x.status === "ready" ? T("qa.strip.ready") : T("qa.strip.held"),
				stripType: pending ? "Warning" : x.status === "ready" ? "Success" : "Information",
				checks: rules.map(function (k) {
					var r = that._rule(k);
					return { text: T("go.dq." + k), ge: r.ge, col: r.col, value: x.record[r.col] || T("qa.empty"), expect: r.expect, severity: r.severity, sevText: T("qa.sev." + r.severity) };
				}),
				fields: Object.keys(x.record).filter(function (k) { return ["source", "id"].indexOf(k) < 0 && (x.record[k] || bad.indexOf(k) > -1); }).map(function (k) {
					return { col: k, label: k === "changed" ? T("md.changedInSource") : that._col(x.repo, k), value: x.record[k] || T("qa.empty"), bad: bad.indexOf(k) > -1,
						dir: LTR.indexOf(k) > -1 ? "LTR" : "Inherit" };
				}),
				history: history,
				actions: pending ? "pending" : "held",
				approveText: T(x.status === "pendingWaive" ? "qa.a.approveWaive" : "qa.a.approveDiscard"),
				canSecond: canSecond, secondWhy: pending && !canSecond ? T("md.sod.second") : "",
				footNote: pending ? T("md.foot.second") : T("qa.foot")
			});
		},

		/* ---------- actions ---------- */
		_gone: function (x, how) {
			this._q.splice(this._q.indexOf(x), 1);
			this._done++;
			Audit.log(this, { area: "data", action: "update", type: "record", object: x.id + " · " + (x.record.name || ""),
				en: "Quarantined record: " + how, ar: "سجل في الحجر: " + this.text("qa.how." + how), ref: { route: "quarantine", args: {} } });
		},
		_next: function (id) {
			var rows = this.viewModel().getProperty("/qa/rows"), i = rows.findIndex(function (r) { return r.id === id; }), nxt = rows[i + 1] || rows[i - 1];
			this._refresh();
			if (nxt && this._find(nxt.id)) { this.router().navTo("quarantine", { id: nxt.id }, true); } else { this.onClose(); }
		},
		/* Reprocess: the record runs standardise → DQ → match again. It passes when the source was fixed (status "ready"). */
		_reprocess: function (x) {
			if (x.status === "ready") { this._gone(x, "reprocessed"); return true; }
			x.attempts++;
			return false;
		},
		onReprocess: function () {
			var x = this._find(this._openId), ok = this._reprocess(x);
			MessageToast.show(this.text(ok ? "qa.t.passed" : "qa.t.stillFails", [x.id, this.text("go.dq." + x.rule)]));
			if (ok) { this._next(x.id); } else { this._show(x); this._refresh(); }
		},
		_batch: function (list) {
			var that = this, ok = 0, fail = 0;
			list.filter(function (x) { return !that._pending(x); }).forEach(function (x) { if (that._reprocess(x)) { ok++; } else { fail++; } });
			this._checked = {};
			MessageToast.show(this.text("qa.t.batch", [ok, fail]));
			if (this._openId && !this._find(this._openId)) { this.onClose(); } else { this._refresh(); if (this._openId) { this._show(this._find(this._openId)); } }
		},
		onReprocessSelected: function () {
			var that = this;
			this._batch(Object.keys(this._checked || {}).filter(function (k) { return that._checked[k]; }).map(function (k) { return that._find(k); }).filter(Boolean));
		},
		/* After a rule or a reference list was fixed, reprocess everything that rule held. */
		onReprocessRule: function () {
			var that = this, k = this.viewModel().getProperty("/qa/f/rules")[0], list = this._q.filter(function (x) { return x.rule === k; });
			MessageBox.confirm(this.text("qa.ruleConfirm", [list.length, this.text("go.dq." + k)]), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				list.forEach(function (x) { if (!that._pending(x)) { x.status = "ready"; } });
				that._batch(list);
			} });
		},
		/* Correct and reprocess: the steward's value is recorded as a manual correction with a reason (audited); it can also
		   start the write-back workflow so the source system gets the same fix, or the next sync brings the bad value back. */
		onCorrect: function () {
			var that = this, x = this._find(this._openId), rules = [x.rule].concat(x.also), cols = rules.map(function (k) { return that._rule(k).col; }), inputs = {},
				content = [], canWrite = x.source !== "csv";
			cols.forEach(function (c, i) {
				var inp = new Input({ value: x.record[c] || "", textDirection: LTR.indexOf(c) > -1 ? "LTR" : "Inherit", liveChange: function () { check(); } });
				inputs[c] = { inp: inp, rule: rules[i] };
				content.push(new Label({ text: that._col(x.repo, c) + " · " + c, required: true }), inp);
			});
			var oWb = new CheckBox({ text: this.text("qa.writeBack", [this._srcName(x.source)]), selected: canWrite, enabled: canWrite }),
				oNote = new TextArea({ rows: 2, width: "100%", placeholder: this.text("md.noteRequired") }),
				check = function () {
					var ok = true;
					Object.keys(inputs).forEach(function (c) {
						var p = PREVIEW[inputs[c].rule], v = inputs[c].inp.getValue(), rec = Object.assign({}, x.record, { state_id: inputs.state_id ? inputs.state_id.inp.getValue() : x.record.state_id }),
							good = !p || p(v, rec);
						inputs[c].inp.setValueState(good ? "Success" : "Error").setValueStateText(good ? that.text("qa.previewOk") : that.text("qa.previewBad", [that._rule(inputs[c].rule).expect]));
						ok = ok && good;
					});
					return ok;
				};
			content.push(new Label({ text: this.text("md.c.note"), required: true }), oNote, new Label({ text: "" }), oWb);
			if (!canWrite) { content.push(new Text({ text: this.text("qa.noWriteBack") }).addStyleClass("repoioUmMuted")); }
			var oDlg = new Dialog({ title: this.text("qa.a.correct"), contentWidth: "30rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1, content: content })],
				beginButton: new Button({ text: this.text("qa.a.correctBtn"), type: "Emphasized", press: function () {
					if (!oNote.getValue().trim()) { oNote.setValueState("Error").setValueStateText(that.text("mr.v.required")); return; }
					if (!check()) { return; }
					oDlg.close();
					that._gone(x, "corrected");
					MessageToast.show(that.text(oWb.getSelected() ? "qa.t.correctedWb" : "qa.t.corrected", [x.id, that._srcName(x.source)]));
					that._next(x.id);
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); } });
			this.getView().addDependent(oDlg);
			oDlg.open();
			check();
		},
		_ask: function (title, fnOk) {
			var that = this, oNote = new TextArea({ rows: 3, width: "100%", placeholder: this.text("md.noteRequired") }),
				oDlg = new Dialog({ title: title, contentWidth: "28rem",
					content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1,
						content: [new Text({ text: this.text("qa.secondNote") }), new Label({ text: this.text("md.c.note"), required: true }), oNote] })],
					beginButton: new Button({ text: this.text("gr.ok"), type: "Emphasized", press: function () {
						if (!oNote.getValue().trim()) { oNote.setValueState("Error").setValueStateText(that.text("mr.v.required")); return; }
						oDlg.close(); fnOk(oNote.getValue().trim());
					} }),
					endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
					afterClose: function () { oDlg.destroy(); } });
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		_toSecond: function (status) {
			var that = this, x = this._find(this._openId);
			this._ask(this.text(status === "pendingWaive" ? "qa.a.waive" : "qa.a.discard"), function (note) {
				x.status = status;
				x.first = { by: that._me(), at: "2026-11-16 " + new Date().toTimeString().slice(0, 5), note: note };
				MessageToast.show(that.text("md.t.sentSecond", [x.id]));
				that._show(x); that._refresh();
			});
		},
		onWaive: function () { this._toSecond("pendingWaive"); },
		onDiscard: function () { this._toSecond("pendingDiscard"); },
		onApprove: function () {
			var x = this._find(this._openId);
			if (x.first.by === this._me()) { MessageBox.error(this.text("md.sod.second")); return; }
			this._gone(x, x.status === "pendingWaive" ? "waived" : "discarded");
			MessageToast.show(this.text(x.status === "pendingWaive" ? "qa.t.waived" : "qa.t.discarded", [x.id]));
			this._next(x.id);
		},
		onSendBack: function () {
			var x = this._find(this._openId);
			x.status = "held"; delete x.first;
			MessageToast.show(this.text("md.t.sentBack", [x.id]));
			this._show(x); this._refresh();
		},

		/* ---------- navigation ---------- */
		onRun: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view"), id = o && o.getProperty("run") && o.getPath().indexOf("/qa/rows") === 0 ? o.getProperty("run") : (this._find(this._openId) || {}).run;
			this.router().navTo("jobRun", { runId: id });
		},
		onRuns: function () { this.router().navTo("jobs"); },
		onRule: function () { this.router().navTo("page", { key: "testCases" }); },
		onClose: function () {
			this._openId = null;
			this.viewModel().setProperty("/qa/layout", "OneColumn");
			this.byId("qaQueue").setHeaderExpanded(true);
			this.router().navTo("quarantine", {}, true);
		},
		onFull: function () {
			var vm = this.viewModel();
			vm.setProperty("/qa/layout", vm.getProperty("/qa/layout") === "MidColumnFullScreen" ? "TwoColumnsMidExpanded" : "MidColumnFullScreen");
		},
		_step: function (d) {
			var rows = this.viewModel().getProperty("/qa/rows"), i = rows.findIndex(function (r) { return r.id === this._openId; }.bind(this)), n = rows[i + d];
			if (n) { this.router().navTo("quarantine", { id: n.id }, true); }
		},
		onPrev: function () { this._step(-1); },
		onNext: function () { this._step(1); }
	});
});
