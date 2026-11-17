sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/people",
	"repoio/proto/util/access",
	"sap/ui/core/Fragment",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"repoio/proto/util/semantic"
], function (BaseController, People, A, Fragment, MessageToast, MessageBox, Sem) {
	"use strict";

	var ME = "محمد",
		TYPE = { info: ["sap-icon://message-information", "#0a6ed1", "Information"], maintenance: ["sap-icon://wrench", "#e9730c", "Warning"], release: ["sap-icon://notification-2", "#107e3e", "Success"] },
		STATE = Sem.GROUPS.lifecycle;

	/* Announcements (J13). In the product the announcements API stores them in the control plane, filters them by audience
	   server-side and audits every transition; Feeds and the Home strip only read. */
	return BaseController.extend("repoio.proto.controller.Announcements", {
		onInit: function () {
			this.viewModel().setProperty("/an", { q: "", st: "all", rows: [], e: { vs: {}, history: [], audItems: [] } });
			this.router().getRoute("announcements").attachPatternMatched(this._onMatched, this);
		},
		_onMatched: function (oEvent) {
			var that = this, oM = this.getOwnerComponent().getModel("admin"), oU = this.getOwnerComponent().getModel("users"), sId = oEvent.getParameter("arguments").id;
			Promise.all([oM.dataLoaded(), oU.dataLoaded(), this.data().dataLoaded()]).then(function () {
				that._d = oM.getData(); that._u = oU.getData(); that._idx = A.index(that._u.org);
				that._apply();
				if (sId === "new") { that.onCreate(); } else if (sId) { that._open(sId); }
			});
		},

		_ar: function () { return this.lang() === "ar"; },
		_now: function () { return this._d.now.slice(0, 16); },
		_status: function (a) {
			if (a.status === "draft" || a.status === "retired") { return a.status; }
			var now = this._now();
			if (a.from && a.from > now) { return "scheduled"; }
			if (a.until && a.until <= now) { return "expired"; }
			return "live";
		},
		_fmt: function (s) { return s ? s.replace("T", " ") : ""; },
		_window: function (a) { return a.from ? this._fmt(a.from) + " → " + (a.until ? this._fmt(a.until) : this.text("an.f.noEnd")) : "—"; },
		_domName: function (id) { return this.domainName((this.data().getProperty("/domains") || []).filter(function (x) { return x.id === id; })[0]) || id; },
		_audText: function (aud) {
			if (aud.kind === "role") { var r = A.role(this._u, aud.value); return this.text("an.aud.roleX", [r ? (this._ar() ? r.ar : r.en) : aud.value]); }
			if (aud.kind === "domain") { return this.text("an.aud.domainX", [this._domName(aud.value)]); }
			return this.text("an.aud.all");
		},
		/* How many active users the audience reaches (the server resolves this per request; shown here as a hint). */
		_reach: function (aud) {
			var that = this, u = this._u;
			return u.users.filter(function (x) {
				var e = u.employees.filter(function (y) { return y.id === x.employee; })[0];
				if (!e || A.status(u, x, e) !== "active") { return false; }
				if (aud.kind === "all") { return true; }
				var eff = A.effective(u, that._idx, x, e);
				if (aud.kind === "role") { return eff.some(function (r) { return r.role === aud.value; }); }
				return eff.some(function (r) { var o = A.role(u, r.role); return o && (o.domains.indexOf("*") > -1 || o.domains.indexOf(aud.value) > -1); });
			}).length;
		},
		_audit: function (a, action, en, ar, before, after) {
			this._d.audit.unshift({ at: this._now() + ":00", actor: ME, area: "system", action: action, type: "announcement", object: a.id, en: en, ar: ar, before: before, after: after });
		},

		_apply: function () {
			var that = this, vm = this.viewModel(), f = vm.getProperty("/an"), q = (f.q || "").toLowerCase(), ar = this._ar();
			var rows = this._d.announcements.map(function (a) { return { a: a, st: that._status(a) }; }).filter(function (x) {
				if (f.st === "ended" && ["expired", "retired"].indexOf(x.st) < 0) { return false; }
				if (["live", "scheduled", "draft"].indexOf(f.st) > -1 && x.st !== f.st) { return false; }
				return !q || [x.a.id, x.a.en, x.a.ar, x.a.body_en, x.a.body_ar].join(" ").toLowerCase().indexOf(q) > -1;
			}).sort(function (x, y) {
				var o = ["live", "scheduled", "draft", "expired", "retired"];
				return o.indexOf(x.st) - o.indexOf(y.st) || (x.a.updated < y.a.updated ? 1 : -1);
			}).map(function (x) {
				var a = x.a, t = TYPE[a.type] || TYPE.info, s = STATE[x.st];
				return { id: a.id, titleText: ar ? a.ar : a.en, bodyText: (ar ? a.body_ar : a.body_en) || "—", icon: t[0], iconColor: t[1],
					audienceText: that._audText(a.audience), windowText: that._window(a), statusText: that.text("an.st." + x.st), statusState: s[0], statusIcon: s[1],
					pinned: a.pinned && x.st !== "retired" && x.st !== "expired", author: a.author, updatedText: that._fmt(a.updated).slice(0, 16) };
			});
			var live = this._d.announcements.filter(function (a) { return that._status(a) === "live"; }), pin = live.filter(function (a) { return a.pinned; })[0];
			vm.setProperty("/an/rows", rows);
			vm.setProperty("/an/title", this.text("an.title", [rows.length]));
			vm.setProperty("/an/liveText", live.length ? this.text(pin ? "an.liveText" : "an.liveTextNoPin", [live.length, pin ? (ar ? pin.ar : pin.en) : ""]) : "");
		},
		onFilter: function () { this._apply(); },

		/* ---------- editor ---------- */
		_dlg: function () {
			var that = this;
			if (!this._p) {
				this._p = Fragment.load({ id: this.getView().getId(), name: "repoio.proto.fragment.AnnouncementEditor", controller: this }).then(function (o) {
					that.getView().addDependent(o);
					o.attachAfterClose(function () { if (/^admin\/announcements\/./.test(that.router().getHashChanger().getHash())) { that.router().navTo("announcements", {}, true); } });
					return o;
				});
			}
			return this._p;
		},
		onCreate: function () {
			this._edit({ id: "", type: "info", en: "", ar: "", body_en: "", body_ar: "", audience: { kind: "all", value: "" }, from: "", until: "", pinned: false, status: "draft" }, true);
		},
		onOpen: function (oEvent) { this.router().navTo("announcements", { id: oEvent.getSource().getBindingContext("view").getProperty("id") }, true); },
		_open: function (sId) { var a = this._d.announcements.filter(function (x) { return x.id === sId; })[0]; if (a) { this._edit(a, false); } },
		_edit: function (a, bNew) {
			var that = this, st = bNew ? "draft" : this._status(a), editable = ["draft", "scheduled", "live"].indexOf(st) > -1;
			this._cur = bNew ? null : a;
			this.viewModel().setProperty("/an/e", {
				isNew: bNew, tab: "edit", status: st, editable: editable, canRetire: st === "live" || st === "scheduled",
				dlgTitle: bNew ? this.text("an.create") : a.id + " · " + this.text("an.st." + st),
				lockText: this.text(st === "retired" ? "an.lock.retired" : "an.lock.expired"),
				publishText: this.text(st === "draft" ? "an.publish" : "an.update"),
				type: a.type, en: a.en, ar: a.ar, body_en: a.body_en, body_ar: a.body_ar, aud: a.audience.kind, audValue: a.audience.value,
				from: a.from, until: a.until, pinned: a.pinned, vs: {},
				history: bNew ? [] : this._d.audit.filter(function (h) { return h.type === "announcement" && h.object === a.id; }).map(function (h) {
					return { text: that._ar() ? h.ar : h.en, meta: h.at.replace("T", " ").slice(0, 16) + " · " + ((People.get(h.actor) && !that._ar()) ? People.get(h.actor).en : h.actor), icon: "sap-icon://edit" };
				})
			});
			this._audItems(); this.onPreview();
			this._dlg().then(function (o) { if (!o.isOpen()) { o.open(); } });
		},
		_audItems: function () {
			var that = this, vm = this.viewModel(), k = vm.getProperty("/an/e/aud"), items = [];
			if (k === "role") { items = this._u.roles.map(function (r) { return { key: r.id, text: that._ar() ? r.ar : r.en }; }); }
			if (k === "domain") { items = (this.data().getProperty("/domains") || []).map(function (x) { return { key: x.id, text: that.domainName(x) }; }); }
			vm.setProperty("/an/e/audItems", items);
			if (k !== "all" && !items.some(function (i) { return i.key === vm.getProperty("/an/e/audValue"); })) { vm.setProperty("/an/e/audValue", items.length ? items[0].key : ""); }
			if (k === "all") { vm.setProperty("/an/e/audValue", ""); }
		},
		onAudKind: function () { this._audItems(); this.onPreview(); },
		onPreview: function () {
			var vm = this.viewModel(), e = vm.getProperty("/an/e"), ar = this._ar(), t = TYPE[e.type] || TYPE.info,
				title = (ar ? e.ar : e.en) || this.text("an.preview.empty"), body = ar ? e.body_ar : e.body_en;
			vm.setProperty("/an/e/previewText", title + (body ? " — " + body : ""));
			vm.setProperty("/an/e/previewType", t[2]);
			vm.setProperty("/an/e/reachText", this.text("an.reach", [this._reach({ kind: e.aud, value: e.audValue })]));
		},
		_validate: function (bPublish) {
			var vm = this.viewModel(), e = vm.getProperty("/an/e"), now = this._now(), err = [], vs = {};
			if (!e.en || !e.ar) { err.push(this.text("an.v.title")); vs.en = e.en ? "None" : "Error"; vs.ar = e.ar ? "None" : "Error"; }
			if (e.aud !== "all" && !e.audValue) { err.push(this.text("an.v.aud")); vs.aud = "Error"; }
			if (bPublish && !e.from) { err.push(this.text("an.v.from")); vs.from = "Error"; }
			if (e.from && e.until && e.until <= e.from) { err.push(this.text("an.v.order")); vs.until = "Error"; }
			if (bPublish && e.until && e.until <= now) { err.push(this.text("an.v.past")); vs.until = "Error"; }
			vm.setProperty("/an/e/vs", vs);
			if (err.length) { MessageBox.error(err.join("\n")); return false; }
			return true;
		},
		_write: function (sStatus) {
			var e = this.viewModel().getProperty("/an/e"), a = this._cur, isNew = !a, before = a ? { status: this._status(a), from: a.from, until: a.until, pinned: a.pinned } : null;
			if (isNew) {
				var n = this._d.announcements.reduce(function (m, x) { return Math.max(m, parseInt(x.id.split("-")[1], 10) || 0); }, 0) + 1;
				a = { id: "AN-" + n, author: ME }; this._d.announcements.unshift(a);
			}
			Object.assign(a, { type: e.type, en: e.en, ar: e.ar, body_en: e.body_en, body_ar: e.body_ar, audience: { kind: e.aud, value: e.aud === "all" ? "" : e.audValue },
				from: e.from, until: e.until, pinned: e.pinned, status: sStatus, updated: this._now() + ":00" });
			this._cur = a;
			return { a: a, isNew: isNew, before: before };
		},
		onSaveDraft: function () {
			if (!this._validate(false)) { return; }
			var r = this._write("draft");
			this._audit(r.a, r.isNew ? "create" : "update", r.isNew ? "Draft created" : "Draft saved", r.isNew ? "إنشاء مسودة" : "حفظ المسودة");
			this.byId("anDlg").close(); this._apply();
			MessageToast.show(this.text("an.t.draft"));
		},
		onPublish: function () {
			if (!this._validate(true)) { return; }
			var wasDraft = !this._cur || this._cur.status === "draft", r = this._write("published"), st = this._status(r.a);
			this._audit(r.a, wasDraft ? "publish" : "update", (wasDraft ? (st === "scheduled" ? "Scheduled" : "Published") : "Updated while " + st) + " · audience " + r.a.audience.kind + (r.a.audience.value ? ": " + r.a.audience.value : ""),
				wasDraft ? (st === "scheduled" ? "جدولة الإعلان" : "نشر الإعلان") : "تعديل الإعلان", r.before, { status: st, from: r.a.from, until: r.a.until, pinned: r.a.pinned });
			this.byId("anDlg").close(); this._apply();
			MessageToast.show(this.text(st === "scheduled" ? "an.t.scheduled" : wasDraft ? "an.t.published" : "an.t.updated"));
		},
		onRetire: function () {
			var that = this, a = this._cur;
			MessageBox.confirm(this.text("an.retireConfirm", [this._ar() ? a.ar : a.en]), { onClose: function (x) {
				if (x !== MessageBox.Action.OK) { return; }
				var before = { status: that._status(a) };
				a.status = "retired"; a.pinned = false; a.updated = that._now() + ":00";
				that._audit(a, "retire", "Retired — removed from Feeds and Home", "إلغاء — اتشال من الأخبار والصفحة الرئيسية", before, { status: "retired" });
				that.byId("anDlg").close(); that._apply();
				MessageToast.show(that.text("an.t.retired"));
			} });
		},
		onDuplicate: function () {
			var a = JSON.parse(JSON.stringify(this._cur)), sFrom = this._cur.id;
			Object.assign(a, { id: "", from: "", until: "", pinned: false, status: "draft" });
			this._edit(a, true);
			this.viewModel().setProperty("/an/e/dlgTitle", this.text("an.duplicateOf", [sFrom]));
		},
		onDelete: function () {
			var that = this, a = this._cur;
			MessageBox.confirm(this.text("an.deleteConfirm"), { onClose: function (x) {
				if (x !== MessageBox.Action.OK) { return; }
				that._d.announcements = that._d.announcements.filter(function (y) { return y !== a; });
				that._audit(a, "delete", "Draft deleted", "حذف المسودة");
				that.byId("anDlg").close(); that._apply();
			} });
		},
		onClose: function () { this.byId("anDlg").close(); }
	});
});
