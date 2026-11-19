sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Label",
	"sap/m/Text",
	"sap/m/Input",
	"sap/m/StepInput",
	"sap/m/Select",
	"sap/m/MultiComboBox",
	"sap/m/CheckBox",
	"sap/m/SegmentedButton",
	"sap/m/SegmentedButtonItem",
	"sap/m/MessageStrip",
	"sap/m/Title",
	"sap/m/VBox",
	"sap/m/HBox",
	"sap/m/TextArea",
	"sap/ui/core/Item",
	"repoio/proto/util/semantic"
], function (BaseController, MessageToast, Dialog, Button, Label, Text, Input, StepInput, Select, MultiComboBox, CheckBox, SegmentedButton,
	SegmentedButtonItem, MessageStrip, Title, VBox, HBox, TextArea, Item, Sem) {
	"use strict";

	var ME = "محمد",
		EVENTS = ["testFailed", "scoreBelow", "quarantineGrowth", "runFailed", "streamLag", "approvalOverdue", "pythonError", "sourceStale"],
		/* the condition fields each event takes */
		COND = { testFailed: [], scoreBelow: ["value"], quarantineGrowth: ["value", "hours"], runFailed: ["attempts"], streamLag: ["minutes"],
			approvalOverdue: ["days"], pythonError: [], sourceStale: ["hours"] },
		SEV = { high: ["Error", "sap-icon://high-priority"], medium: ["Warning", "sap-icon://alert"], low: ["Information", "sap-icon://message-information"] },
		CH = { inapp: "sap-icon://bell", email: "sap-icon://email", teams: "sap-icon://discussion" };

	/* J10: Alerts. */
	return BaseController.extend("repoio.proto.controller.DqAlerts", {
		onInit: function () {
			this.viewModel().setProperty("/al", { tab: "fired", st: "active" });
			this.router().getRoute("dqAlerts").attachPatternMatched(this._onMatched, this);
		},
		_onMatched: function (oEvent) {
			var that = this, C = this.getOwnerComponent(), tab = (oEvent.getParameter("arguments") || {}).tab;
			Promise.all([C.getModel("dq").dataLoaded(), C.getModel("users").dataLoaded(), this.data().dataLoaded(), C.getModel("runs").dataLoaded()]).then(function () {
				that._m = C.getModel("dq");
				if (tab === "rules" || tab === "fired") { that.viewModel().setProperty("/al/tab", tab); }
				that._refresh();
			});
		},

		_team: function (id) {
			var found = null, walk = function (u) { (u.units || []).forEach(function (x) { if (x.id === id) { found = x; } walk(x); }); };
			walk(this.getOwnerComponent().getModel("users").getProperty("/org"));
			return found ? (this.lang() === "ar" ? found.ar : found.en) : id;
		},
		_to: function (r) { var that = this; return r.to.map(function (x) { return x.kind === "team" ? that._team(x.id) : that.text("al.role." + x.id); }).join("، "); },
		_scope: function (s) {
			if (s.kind === "repo") { var r = this.data().getProperty("/repos/" + s.id); return r ? r.name : s.id; }
			if (s.kind === "jobKind") { return this.text("al.scope.jobKind." + s.id); }
			if (s.kind === "source") { return { c4c: "SAP C4C", s4: "SAP S/4HANA", csv: "Excel / CSV" }[s.id] || s.id; }
			return this.text("al.scope.all");
		},
		_cond: function (r) {
			var c = r.cond || {};
			return this.text("al.cond." + r.event, [c.value, c.hours, c.attempts, c.minutes, c.days, c.severity ? this.text("al.anySev." + c.severity) : ""]);
		},
		_channels: function (a) { var that = this; return a.map(function (k) { return { icon: CH[k], text: that.text("al.ch." + k) }; }); },

		_refresh: function () {
			var that = this, T = this.text.bind(this), vm = this.viewModel(), m = this._m, rules = m.getProperty("/alertRules"), alerts = m.getProperty("/alerts"),
				st = vm.getProperty("/al/st"), rule = function (id) { return rules.filter(function (r) { return r.id === id; })[0]; };
			var open = alerts.filter(function (a) { return a.status === "open"; }).length, ack = alerts.filter(function (a) { return a.status === "ack"; }).length;
			vm.setProperty("/al/fired", alerts.filter(function (a) { return st === "all" || (st === "active" ? a.status !== "resolved" : a.status === "resolved"); }).map(function (a) {
				var r = rule(a.rule), s = Sem.of("alert", a.status), sv = SEV[r.sev], x = a.ctx || {}, link = that._link(r, x);
				return { id: a.id, status: a.status, stText: T("al.st." + a.status), stState: s[0], stIcon: s[1],
					title: T("al.ev." + r.event), msg: T("al.msg." + r.event, [x.repo ? that._scope({ kind: "repo", id: x.repo }) : "", x.value, x.count, x.job, x.run, x.minutes, x.test]),
					linkText: link ? link.text : "", link: link,
					sevText: T("al.sev." + r.sev), sevState: sv[0], sevIcon: sv[1], to: that._to(r), channels: that._channels(r.channels),
					at: a.at, byText: a.by ? T("al.by." + a.status, [a.by]) : "—" };
			}));
			vm.setProperty("/al/rules", rules.map(function (r) {
				var sv = SEV[r.sev];
				return { id: r.id, title: T("al.ev." + r.event), cond: that._cond(r), scopeText: that._scope(r.scope), sevText: T("al.sev." + r.sev), sevState: sv[0], sevIcon: sv[1],
					to: that._to(r), channels: that._channels(r.channels), quietText: r.quiet ? T("al.quietText", [r.quiet]) : "", repeatText: T("al.repeat." + r.repeat),
					fired7: String(r.fired7), lastText: r.last ? T("al.last", [r.last]) : T("al.never"), on: r.on };
			}));
			vm.setProperty("/al/firedTab", T("al.tab.fired", [open + ack]));
			vm.setProperty("/al/rulesTab", T("al.tab.rules", [rules.length]));
			vm.setProperty("/al/stText", { active: T("al.f.active", [open + ack]), resolved: T("al.f.resolved", [alerts.length - open - ack]), all: T("al.f.all", [alerts.length]) });
			vm.setProperty("/al/summary", T("al.summary", [open, ack, rules.filter(function (r) { return r.on; }).length]));
			this.byId("alFired").removeSelections(true);
			this.onSelFired();
		},
		/* Where an alert leads: the failing test, the run, the repository's tests, the requests */
		_link: function (r, x) {
			var T = this.text.bind(this);
			if (x.test) { return { text: T("al.go.test", [x.test]), route: "dqTest", args: { id: x.test } }; }
			if (x.run) { return { text: T("al.go.run", [x.run]), route: "jobRun", args: { runId: x.run } }; }
			if (r.event === "scoreBelow" && x.repo) { return { text: T("al.go.tests"), route: "dqTests", args: { query: { where: x.repo, result: "fail" } } }; }
			if (r.event === "quarantineGrowth") { return { text: T("al.go.quarantine"), route: "quarantine", args: {} }; }
			if (r.event === "streamLag") { return { text: T("al.go.streams"), route: "streams", args: {} }; }
			if (r.event === "approvalOverdue") { return { text: T("al.go.requests"), route: "page", args: { key: "openChangeRequests" } }; }
			return null;
		},
		onTarget: function (oEvent) { var l = oEvent.getSource().getBindingContext("view").getProperty("link"); if (l) { this.router().navTo(l.route, l.args); } },
		onTab: function () { this._refresh(); },
		onStatusFilter: function () { this._refresh(); },
		onTests: function () { this.router().navTo("dqTests"); },

		_selFired: function () { return this.byId("alFired").getSelectedItems().map(function (i) { return i.getBindingContext("view").getObject(); }); },
		onSelFired: function () {
			var s = this._selFired(), vm = this.viewModel();
			vm.setProperty("/al/canAck", s.some(function (a) { return a.status === "open"; })); // acknowledges the open ones in the selection
			vm.setProperty("/al/canResolve", s.length > 0 && s.every(function (a) { return a.status !== "resolved"; }));
		},
		_set: function (ids, status) {
			this._m.getProperty("/alerts").forEach(function (a) { if (ids.indexOf(a.id) > -1) { a.status = status; a.by = ME; } });
		},
		onAck: function () {
			var ids = this._selFired().filter(function (a) { return a.status === "open"; }).map(function (a) { return a.id; });
			this._set(ids, "ack");
			MessageToast.show(this.text("al.t.ack", [ids.length]));
			this._refresh();
		},
		/* Resolving asks what was done: the note stays on the alert for the next person */
		onResolve: function () {
			var that = this, T = this.text.bind(this), ids = this._selFired().map(function (a) { return a.id; }),
				oNote = new TextArea({ width: "100%", rows: 3, placeholder: T("al.notePh"), liveChange: function () { oOk.setEnabled(!!oNote.getValue().trim()); } }),
				oOk = new Button({ text: T("al.a.resolve"), type: "Emphasized", enabled: false, press: function () {
					that._set(ids, "resolved"); oDlg.close(); MessageToast.show(T("al.t.resolved", [ids.length])); that._refresh();
				} }),
				oDlg = new Dialog({ title: T("al.resolveTitle", [ids.length]), contentWidth: "28rem",
					content: [new VBox({ items: [new Label({ text: T("al.note"), labelFor: oNote, required: true }), oNote] }).addStyleClass("sapUiSmallMargin")],
					beginButton: oOk, endButton: new Button({ text: T("common.cancel"), press: function () { oDlg.close(); } }),
					afterClose: function () { oDlg.destroy(); } });
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		onSwitch: function (oEvent) {
			var id = oEvent.getSource().getBindingContext("view").getProperty("id"), on = oEvent.getParameter("state"),
				r = this._m.getProperty("/alertRules").filter(function (x) { return x.id === id; })[0];
			r.on = on;
			MessageToast.show(this.text(on ? "al.t.on" : "al.t.off", [this.text("al.ev." + r.event)]));
			this._refresh();
		},

		/* ---------- rule editor (dialog): when · where · who · how ---------- */
		onNewRule: function () { this._ruleDialog(null); },
		onEditRule: function (oEvent) {
			var id = oEvent.getSource().getBindingContext("view").getProperty("id");
			this._ruleDialog(this._m.getProperty("/alertRules").filter(function (r) { return r.id === id; })[0]);
		},
		_ruleDialog: function (rule) {
			var that = this, T = this.text.bind(this), repos = this.data().getProperty("/repos"),
				r = rule ? JSON.parse(JSON.stringify(rule)) : { event: "testFailed", scope: { kind: "all" }, cond: { severity: "quarantine" }, sev: "medium",
					channels: ["inapp"], to: [], quiet: "", repeat: "once", on: true, owner: ME, fired7: 0, last: "" };
			var sec = function (t) { return new Title({ text: T(t), level: "H3", titleStyle: "H6" }).addStyleClass("repoioAlSec"); };
			var oEvent = new Select({ width: "100%", selectedKey: r.event, items: EVENTS.map(function (k) { return new Item({ key: k, text: T("al.ev." + k) }); }),
				change: function () { r.event = oEvent.getSelectedKey(); r.cond = {}; syncCond(); } });
			var fields = {
				value: new StepInput({ min: 1, max: 1000, width: "8rem" }), hours: new StepInput({ min: 1, max: 168, width: "8rem" }),
				attempts: new StepInput({ min: 1, max: 10, width: "8rem" }), minutes: new StepInput({ min: 1, max: 240, width: "8rem" }), days: new StepInput({ min: 1, max: 30, width: "8rem" })
			};
			var oSevCond = new Select({ width: "100%", items: ["quarantine", "flag", "warn"].map(function (k) { return new Item({ key: k, text: T("al.anySev." + k) }); }) });
			var condBox = new VBox();
			var syncCond = function () {
				condBox.removeAllItems();
				var want = COND[r.event];
				if (r.event === "testFailed") {
					oSevCond.setSelectedKey((r.cond || {}).severity || "quarantine");
					condBox.addItem(new Label({ text: T("al.f.sevCond"), labelFor: oSevCond })); condBox.addItem(oSevCond);
				}
				want.forEach(function (k) {
					fields[k].setValue((r.cond || {})[k] || { value: 85, hours: 24, attempts: 2, minutes: 10, days: 3 }[k]);
					condBox.addItem(new Label({ text: T("al.f." + k + "." + r.event), labelFor: fields[k], wrapping: true }));
					condBox.addItem(fields[k]);
				});
				oHint.setText(T("al.hint." + r.event));
			};
			var oHint = new Text().addStyleClass("repoioUmMuted");
			var oScopeKind = new SegmentedButton({ selectedKey: r.scope.kind === "jobKind" || r.scope.kind === "source" ? "all" : r.scope.kind, items: [
				new SegmentedButtonItem({ key: "all", text: T("al.scope.all") }), new SegmentedButtonItem({ key: "repo", text: T("al.scope.repo") })],
				selectionChange: function () { oRepo.setVisible(oScopeKind.getSelectedKey() === "repo"); } });
			var oRepo = new Select({ width: "100%", visible: r.scope.kind === "repo", selectedKey: r.scope.kind === "repo" ? r.scope.id : "customer-master",
				items: Object.keys(repos).map(function (k) { return new Item({ key: k, text: repos[k].name }); }) });
			var teams = [["t-mdm"], ["t-eng"], ["t-bi"], ["t-hrops"]], roles = ["DATA_OWNER", "approvers", "STEWARD_CUSTOMER", "ADMIN"];
			var oTo = new MultiComboBox({ width: "100%", selectedKeys: r.to.map(function (x) { return x.kind + ":" + x.id; }),
				items: teams.map(function (t) { return new Item({ key: "team:" + t[0], text: that._team(t[0]) }); })
					.concat(roles.map(function (k) { return new Item({ key: "role:" + k, text: T("al.role." + k) }); })) });
			var chk = {};
			Object.keys(CH).forEach(function (k) { chk[k] = new CheckBox({ text: T("al.ch." + k), selected: r.channels.indexOf(k) > -1 }); });
			var oSev = new SegmentedButton({ selectedKey: r.sev, items: ["high", "medium", "low"].map(function (k) { return new SegmentedButtonItem({ key: k, text: T("al.sev." + k) }); }) });
			var oRepeat = new Select({ width: "100%", selectedKey: r.repeat, items: ["once", "every", "hourly", "daily"].map(function (k) { return new Item({ key: k, text: T("al.repeat." + k) }); }) });
			var oQuiet = new Input({ value: r.quiet, placeholder: "22:00-07:00", width: "10rem", textDirection: "LTR" });
			var oErr = new MessageStrip({ type: "Error", showIcon: true, visible: false });
			var oSave = new Button({ text: T("common.save"), type: "Emphasized", press: function () {
				var to = oTo.getSelectedKeys(), ch = Object.keys(chk).filter(function (k) { return chk[k].getSelected(); }),
					quietOk = !oQuiet.getValue() || /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(oQuiet.getValue());
				var err = !to.length ? T("al.err.to") : !ch.length ? T("al.err.ch") : !quietOk ? T("al.err.quiet") : "";
				oErr.setText(err); oErr.setVisible(!!err);
				if (err) { return; }
				r.cond = {};
				COND[r.event].forEach(function (k) { r.cond[k] = fields[k].getValue(); });
				if (r.event === "testFailed") { r.cond.severity = oSevCond.getSelectedKey(); }
				r.scope = oScopeKind.getSelectedKey() === "repo" ? { kind: "repo", id: oRepo.getSelectedKey() } : (rule && (rule.scope.kind === "jobKind" || rule.scope.kind === "source") ? rule.scope : { kind: "all" });
				r.to = to.map(function (k) { var p = k.split(":"); return { kind: p[0], id: p[1] }; });
				r.channels = ch; r.sev = oSev.getSelectedKey(); r.repeat = oRepeat.getSelectedKey(); r.quiet = oQuiet.getValue();
				var list = that._m.getProperty("/alertRules");
				if (rule) { Object.assign(rule, r); } else { r.id = "AL-" + String(list.length + 1).padStart(2, "0"); list.push(r); }
				that._m.setProperty("/alertRules", list.slice());
				oDlg.close();
				MessageToast.show(T(rule ? "al.t.saved" : "al.t.created", [T("al.ev." + r.event)]));
				that.viewModel().setProperty("/al/tab", "rules");
				that._refresh();
			} });
			var row = function (a) { return new HBox({ wrap: "Wrap", alignItems: "Center", items: a }).addStyleClass("repoioAlRow"); };
			var oDlg = new Dialog({ title: rule ? T("al.editRule") : T("al.newRule"), contentWidth: "34rem", resizable: true, draggable: true,
				content: [new VBox({ items: [
					oErr,
					sec("al.sec.when"), new Label({ text: T("al.f.event"), labelFor: oEvent, required: true }), oEvent, condBox, oHint,
					sec("al.sec.where"), oScopeKind, oRepo,
					sec("al.sec.who"), new Label({ text: T("al.f.to"), labelFor: oTo, required: true }), oTo,
					sec("al.sec.how"), new Label({ text: T("al.f.channels"), required: true }), row([chk.inapp, chk.email, chk.teams]),
					new MessageStrip({ text: T("al.chNote"), type: "Information", showIcon: true }),
					new Label({ text: T("al.f.sev") }), oSev,
					new Label({ text: T("al.f.repeat"), labelFor: oRepeat }), oRepeat,
					new Label({ text: T("al.f.quiet"), labelFor: oQuiet }), oQuiet, new Text({ text: T("al.quietHint") }).addStyleClass("repoioUmMuted")
				] }).addStyleClass("repoioAlForm")],
				beginButton: oSave, endButton: new Button({ text: T("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); } });
			syncCond();
			this.getView().addDependent(oDlg);
			oDlg.open();
		}
	});
});
