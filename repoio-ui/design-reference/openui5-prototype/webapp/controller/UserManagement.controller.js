sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/people",
	"repoio/proto/util/access",
	"sap/ui/core/Fragment",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Label",
	"sap/m/DatePicker",
	"sap/m/TextArea",
	"sap/m/Text",
	"sap/m/VBox"
], function (BaseController, People, A, Fragment, MessageToast, MessageBox, Dialog, Button, Label, DatePicker, TextArea, Text, VBox) {
	"use strict";

	var ME = "محمد",
		SRC = { entra: ["Entra ID", "Information", "sap-icon://cloud"], sf: ["SuccessFactors", "Information", "sap-icon://employee"], manual: ["", "Warning", "sap-icon://edit"] },
		STATUS = {
			active: ["Success", "sap-icon://chain-link"], notFound: ["Warning", "sap-icon://disconnected"], disabled: ["Error", "sap-icon://locked"],
			expired: ["Error", "sap-icon://past"], locked: ["Error", "sap-icon://locked"], left: ["None", "sap-icon://leave-request"], notYet: ["Information", "sap-icon://pending"]
		},
		CSV_COLS = ["employee_id", "name_ar", "name_en", "email", "job_title_en", "job_title_ar", "team_id", "manager_email"],
		ASG_COLS = ["user_email", "role_id", "valid_until"],
		EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, DATE = /^\d{4}-\d{2}-\d{2}$/;

	var pad = function (n) { return (n < 10 ? "0" : "") + n; };
	var isoDate = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
	var csvCell = function (v) { v = String(v === undefined || v === null ? "" : v); return /[",\n]/.test(v) ? "\"" + v.replace(/"/g, "\"\"") + "\"" : v; };
	var splitCsv = function (l) { var out = [], cur = "", q = false; for (var i = 0; i < l.length; i++) { var c = l[i]; if (c === "\"") { q = !q; } else if (c === "," && !q) { out.push(cur.trim()); cur = ""; } else { cur += c; } } out.push(cur.trim()); return out; };

	/* User management (J17, ADR-0009). Lists come from the directory and RBAC APIs in the product;
	   the console never creates identities and never decides access — it shows what the API returns.
	   Guards shown here (last administrator, sensitive roles, separation of duties) are enforced by the API too. */
	return BaseController.extend("repoio.proto.controller.UserManagement", {
		onInit: function () {
			this.viewModel().setProperty("/um", { tab: "employees", unit: "", q: "", src: "all", uq: "", st: "all", roleF: "",
				u: { roles: [] }, emps: [], users: [], reviews: [], tree: [], sync: {}, c: { vs: {} }, imp: { rows: [] }, asg: { rows: [] }, bu: { items: [] },
				ud: { roles: [], access: [], history: [], conflicts: [] }, pv: { items: [] }, rv: { items: [] }, rs: {}, selNoUser: 0, selUsers: 0 });
			this.router().getRoute("users").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this, oM = this.getOwnerComponent().getModel("users"), sUser = oEvent.getParameter("arguments").user;
			Promise.all([oM.dataLoaded(), this.data().dataLoaded()]).then(function () {
				that._d = oM.getData();
				that._idx = A.index(that._d.org);
				that._now = new Date(that._d.now);
				var pend = that.viewModel().getProperty("/umPending");
				if (pend) { that.viewModel().setProperty("/um/unit", pend); that.viewModel().setProperty("/um/tab", "users"); that.viewModel().setProperty("/umPending", null); }
				that._refresh();
				if (sUser) { that._openUser(sUser); }
			});
		},

		/* ---------- helpers ---------- */
		_ar: function () { return this.lang() === "ar"; },
		_t: function (o) { return o ? (this._ar() ? o.ar : o.en) : ""; },
		_pname: function (n) { var p = People.get(n); return p && !this._ar() ? p.en : n; },
		_emp: function (id) { return this._d.employees.filter(function (e) { return e.id === id; })[0]; },
		_today: function () { return isoDate(this._now); },
		_ago: function (iso) {
			if (!iso) { return this.text("um.never"); }
			var m = Math.round((this._now - new Date(iso)) / 6e4);
			if (m < 60) { return this.text("um.ago.min", [Math.max(m, 1)]); }
			if (m < 1440) { return this.text("um.ago.h", [Math.round(m / 60)]); }
			return this.text("um.ago.d", [Math.round(m / 1440)]);
		},
		_unitPath: function (sTeam, bFull) {
			var that = this, t = this._idx[sTeam]; if (!t) { return ""; }
			return t.path.slice(bFull ? 1 : 2).map(function (k) { return that._t(that._idx[k].unit); }).join(" › ");
		},
		_roleText: function (sRole) { return this._t(A.role(this._d, sRole)); },
		_domText: function (aIds) {
			var that = this, doms = this.data().getProperty("/domains") || [];
			if (aIds.indexOf("*") > -1) { return this.text("ra.allDomains"); }
			return aIds.map(function (id) { return that.domainName(doms.filter(function (x) { return x.id === id; })[0]); }).join(" · ");
		},
		_domainsText: function (r) { return this._domText(r.domains); },
		_audit: function (sUser, en, ar, sRole) {
			this._d.history.unshift({ at: this._today() + "T" + pad(this._now.getHours()) + ":" + pad(this._now.getMinutes()) + ":00", by: ME, user: sUser || "", role: sRole || "", en: en, ar: ar });
		},
		_statusOf: function (u) { return A.status(this._d, u, this._emp(u.employee)); },
		_noAdminLeft: function () { MessageBox.error(this.text("um.v.lastAdmin")); },
		_download: function (sName, sCsv) {
			try {
				var a = document.createElement("a"), url = URL.createObjectURL(new Blob(["﻿" + sCsv], { type: "text/csv;charset=utf-8" }));
				a.href = url; a.download = sName; document.body.appendChild(a); a.click(); a.remove();
				setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
				return true;
			} catch (e) { MessageToast.show(this.text("um.t.downloadFail")); return false; }
		},
		_chooseCsv: function (fnText) {
			var inp = document.createElement("input");
			inp.type = "file"; inp.accept = ".csv,text/csv";
			inp.onchange = function () {
				var f = inp.files && inp.files[0]; if (!f) { return; }
				var r = new FileReader();
				r.onload = function () { fnText(f.name, String(r.result || "")); };
				r.readAsText(f, "utf-8");
			};
			inp.click();
		},

		_refresh: function () { this._syncHeader(); this._tree(); this._unit(); this._apply(); this._reviews(); },

		/* ---------- header: sync status ---------- */
		_syncHeader: function () {
			var s = this._d.sync, vm = this.viewModel(), name = s.source === "sf" ? "SuccessFactors" : "Entra ID", r = s.lastResult,
				flagged = this._d.employees.filter(function (e) { return e.flagged; }).length;
			vm.setProperty("/um/syncText", this.text("um.syncStatus", [name, this._ago(s.lastSync)]));
			vm.setProperty("/um/syncState", "Success");
			vm.setProperty("/um/syncTip", this.text("um.syncTip", [r.added, r.updated, r.moved, r.flagged]));
			vm.setProperty("/um/pending", (s.pending || []).length);
			vm.setProperty("/um/flagged", flagged);
			vm.setProperty("/um/flagText", this.text("um.flag.text", [flagged, name]));
		},

		/* ---------- org tree ---------- */
		_tree: function () {
			var that = this, sel = this.viewModel().getProperty("/um/unit"), d = this._d;
			var node = function (u) {
				var n = A.underUnit(d, that._idx, u.type === "org" ? "" : u.id).filter(function (e) { return !e.left; }).length;
				return { key: u.type === "org" ? "" : u.id, text: that._t(u), icon: A.TYPE_ICON[u.type], count: n, tip: that.text("um.type." + u.type),
					selected: (u.type === "org" ? "" : u.id) === sel, nodes: (u.units || []).map(node) };
			};
			this.viewModel().setProperty("/um/tree", [node(d.org)]);
			var oTree = this.byId("umTree");
			oTree.expandToLevel(2);
			if (sel && this._idx[sel]) {
				this._idx[sel].path.slice(1, -1).forEach(function (k) {
					var i = oTree.getItems().map(function (it) { return it.getBindingContext("view").getProperty("key"); }).indexOf(k);
					if (i > -1 && !oTree.getItems()[i].getExpanded()) { oTree.expand(i); }
				});
			}
			var teams = [];
			Object.keys(this._idx).forEach(function (k) { if (that._idx[k].unit.type === "team") { teams.push({ key: k, text: that._unitPath(k) }); } });
			this.viewModel().setProperty("/um/teams", teams.sort(function (a, b) { return a.text < b.text ? -1 : 1; }));
			this.viewModel().setProperty("/um/peopleList", d.employees.filter(function (e) { return !e.left; }).map(function (e) { return { key: e.name, text: that._pname(e.name), email: e.email }; }));
			this.viewModel().setProperty("/um/roleFilter", [{ key: "", text: this.text("um.role.all") }].concat(d.roles.map(function (r) { return { key: r.id, text: that._t(r) }; })));
		},

		onUnit: function (oEvent) {
			this.viewModel().setProperty("/um/unit", oEvent.getParameter("listItem").getBindingContext("view").getProperty("key"));
			this._unit(); this._apply();
		},

		/* Selected unit header: department and team roles are editable; a team also shows what it inherits. */
		_unit: function () {
			var that = this, vm = this.viewModel(), k = vm.getProperty("/um/unit"), d = this._d,
				u = k ? this._idx[k].unit : d.org, n = A.underUnit(d, this._idx, k).filter(function (e) { return !e.left; }).length,
				assignable = u.type === "department" || u.type === "team", roles = [];
			var chip = function (r, own, oFrom) {
				var o = A.role(d, r);
				return { id: r, text: that._t(o), icon: o.icon, own: own, tip: that._domainsText(o), fromText: oFrom ? that.text("um.unit.from", [that._t(oFrom)]) : "" };
			};
			(d.unitRoles[k] || []).forEach(function (r) { if (A.role(d, r)) { roles.push(chip(r, true)); } });
			if (u.type === "team") {
				var dep = this._idx[this._idx[k].path[2]].unit;
				(d.unitRoles[dep.id] || []).forEach(function (r) { if (A.role(d, r) && !roles.some(function (x) { return x.id === r; })) { roles.push(chip(r, false, dep)); } });
			}
			vm.setProperty("/um/u", {
				icon: A.TYPE_ICON[u.type], title: this._t(u), assignable: assignable, roles: roles,
				sub: [this.text("um.type." + u.type)].concat(k ? [this._idx[k].path.slice(1, -1).map(function (x) { return that._t(that._idx[x].unit); }).join(" › ")] : []).filter(Boolean).concat([this.text("um.unit.people", [n])]).join(" · "),
				rolesTitle: this.text(u.type === "team" ? "um.unit.rolesTeam" : "um.unit.rolesDept", [n])
			});
		},

		/* ---------- tables ---------- */
		_apply: function () {
			var that = this, vm = this.viewModel(), d = this._d, um = vm.getProperty("/um"), q = (um.q || "").toLowerCase(), uq = (um.uq || "").toLowerCase();
			var under = A.underUnit(d, this._idx, um.unit), ids = under.map(function (e) { return e.id; });
			var emps = under.filter(function (e) {
				var hasUser = !!A.user(d, e.id);
				var match = !q || [e.id, e.name, that._pname(e.name), e.email, e.title_en, e.title_ar].join(" ").toLowerCase().indexOf(q) > -1;
				if (um.src === "left") { return !!e.left && match; }
				if (e.left) { return false; }
				if (um.src === "flagged" && !e.flagged) { return false; }
				if (um.src === "noUser" && hasUser) { return false; }
				if (["entra", "sf", "manual"].indexOf(um.src) > -1 && e.source !== um.src) { return false; }
				return !q || [e.id, e.name, that._pname(e.name), e.email, e.title_en, e.title_ar].join(" ").toLowerCase().indexOf(q) > -1;
			}).map(function (e) {
				var s = SRC[e.source], hasUser = !!A.user(d, e.id);
				return { id: e.id, name: e.name, nameText: that._pname(e.name), email: e.email, title: that._ar() ? e.title_ar : e.title_en,
					unitText: that._unitPath(e.team), unitTip: that._unitPath(e.team, true), hasUser: hasUser, manual: e.source === "manual" && !e.left, flagged: !!e.flagged,
					sourceText: e.left ? that.text("um.st.left") : e.source === "manual" ? that.text(e.flagged ? "um.src.flaggedShort" : "um.src.manual") : s[0],
					sourceState: e.left ? "None" : e.flagged ? "Error" : s[1], sourceIcon: e.left ? STATUS.left[1] : e.flagged ? "sap-icon://alert" : s[2],
					sourceTip: e.left ? that.text("um.leftOn", [e.left]) : e.flagged ? that.text("um.flag.rowTip") : "" };
			});
			var users = d.users.filter(function (u) {
				var e = that._emp(u.employee);
				if (!e || ids.indexOf(e.id) < 0) { return false; }
				var st = A.status(d, u, e);
				if (um.st === "conflict") { if (!A.conflicts(d, that._idx, u, e).length) { return false; } } else if (um.st !== "all" && st !== um.st) { return false; }
				if (um.roleF && !A.effective(d, that._idx, u, e).some(function (x) { return x.role === um.roleF; })) { return false; }
				return !uq || [e.id, e.name, that._pname(e.name), u.upn].join(" ").toLowerCase().indexOf(uq) > -1;
			}).map(function (u) {
				var e = that._emp(u.employee), eff = A.effective(d, that._idx, u, e), st = A.status(d, u, e), sv = STATUS[st],
					cf = A.conflicts(d, that._idx, u, e);
				return { id: e.id, name: e.name, nameText: that._pname(e.name), upn: u.upn,
					statusText: that.text("um.st." + st), statusState: sv[0], statusIcon: sv[1], statusTip: u.locked ? that.text("um.lockedBy", [u.lockReason || "—"]) : "",
					unitText: that._unitPath(e.team), unitTip: that._unitPath(e.team, true),
					rolesText: that.text("um.rolesCount", [eff.length, eff.filter(function (x) { return x.type === "direct"; }).length]),
					rolesTip: eff.map(function (x) { return that._roleText(x.role); }).join(", "),
					conflict: cf.length > 0, conflictTip: cf.map(function (c) { return that._t(c.rule); }).join("\n"),
					validText: u.validTo ? that.text("um.validTo", [u.validTo]) : that.text("um.noEnd"), validState: u.validTo && u.validTo < that._today() ? "Error" : "None",
					lastText: u.lastSignIn ? that._ago(u.lastSignIn) : that.text("um.never") };
			});
			vm.setProperty("/um/emps", emps);
			vm.setProperty("/um/users", users);
			vm.setProperty("/um/nEmp", under.filter(function (e) { return !e.left; }).length);
			vm.setProperty("/um/nUsers", d.users.filter(function (u) { return ids.indexOf(u.employee) > -1; }).length);
			vm.setProperty("/um/empTitle", this.text("um.empTitle", [emps.length]));
			vm.setProperty("/um/userTitle", this.text("um.userTitle", [users.length]));
			this.byId("empTable").removeSelections(true);
			this.byId("userTable").removeSelections(true);
			vm.setProperty("/um/selNoUser", 0);
			vm.setProperty("/um/selUsers", 0);
		},

		onFilter: function () { this._apply(); },
		onTab: function () { /* selectedKey is two-way bound */ },
		onShowFlagged: function () {
			var vm = this.viewModel(); vm.setProperty("/um/tab", "employees"); vm.setProperty("/um/src", "flagged"); vm.setProperty("/um/unit", "");
			this._tree(); this._unit(); this._apply();
		},
		onEmpSelect: function () {
			var d = this._d, sel = this.byId("empTable").getSelectedItems().map(function (it) { return it.getBindingContext("view").getObject(); });
			this.viewModel().setProperty("/um/selNoUser", sel.filter(function (r) { return !A.user(d, r.id); }).length);
		},
		onUserSelect: function () { this.viewModel().setProperty("/um/selUsers", this.byId("userTable").getSelectedItems().length); },

		/* ---------- dialogs ---------- */
		_dlg: function (sId) {
			var that = this;
			if (!this._pFrag) {
				this._pFrag = Fragment.load({ id: this.getView().getId(), name: "repoio.proto.fragment.UserMgmt", controller: this }).then(function (a) {
					a.forEach(function (o) { that.getView().addDependent(o); });
				});
			}
			return this._pFrag.then(function () { return that.byId(sId); });
		},
		onCloseDlg: function (oEvent) { var o = oEvent.getSource(); while (o && !o.isA("sap.m.Dialog")) { o = o.getParent(); } if (o) { o.close(); } },

		/* Optional end date for directly assigned roles (time-bound access). */
		_askUntil: function (sTitle, fnDone) {
			var that = this, oDp = new DatePicker({ valueFormat: "yyyy-MM-dd", displayFormat: "yyyy-MM-dd", placeholder: this.text("um.f.noEnd"), minDate: this._now, width: "100%" });
			var oDlg = new Dialog({ title: sTitle, contentWidth: "24rem",
				content: [new VBox({ items: [new Label({ text: this.text("um.until.label"), labelFor: oDp }), oDp, new Text({ text: this.text("um.until.hint") }).addStyleClass("repoioUmMuted sapUiTinyMarginTop")] }).addStyleClass("sapUiSmallMargin")],
				beginButton: new Button({ text: this.text("um.until.assign"), type: "Emphasized", press: function () {
					var v = oDp.getValue();
					if (v && v <= that._today()) { oDp.setValueState("Error"); return; }
					oDlg.close(); fnDone(v || "");
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); } });
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		/* Warn (not block) when a change creates a separation-of-duties conflict. */
		_sodWarn: function (aEmpIds, before) {
			var that = this, d = this._d, hits = [];
			aEmpIds.forEach(function (id) {
				var u = A.user(d, id), e = that._emp(id); if (!u || !e) { return; }
				var now = A.conflicts(d, that._idx, u, e).map(function (c) { return c.rule.id; });
				if (now.some(function (r) { return (before[id] || []).indexOf(r) < 0; })) { hits.push(that._pname(e.name)); }
			});
			if (hits.length) { MessageBox.warning(this.text("um.sod.warn", [hits.join(", ")])); }
		},
		_sodBefore: function (aEmpIds) {
			var that = this, d = this._d, out = {};
			aEmpIds.forEach(function (id) { var u = A.user(d, id), e = that._emp(id); out[id] = u && e ? A.conflicts(d, that._idx, u, e).map(function (c) { return c.rule.id; }) : []; });
			return out;
		},

		/* ---------- sync: settings, preview, apply ---------- */
		onSyncNow: function () {
			var that = this, s = this._d.sync, items = (s.pending || []).map(function (p, i) {
				return { i: i, kind: p.kind, text: that._ar() ? p.ar : p.en, icon: { add: "sap-icon://add-employee", move: "sap-icon://journey-change", left: "sap-icon://leave-request" }[p.kind],
					state: p.kind === "left" ? "Warning" : "None", kindText: that.text("um.pv." + p.kind), on: true };
			});
			if (!items.length) {
				this.viewModel().setProperty("/um/syncing", true);
				setTimeout(function () {
					s.lastSync = that._d.now; s.lastResult = { added: 0, updated: 0, moved: 0, flagged: that._d.employees.filter(function (e) { return e.flagged; }).length };
					that.viewModel().setProperty("/um/syncing", false); that._syncHeader();
					MessageToast.show(that.text("um.t.synced", [s.source === "sf" ? "SuccessFactors" : "Entra ID"]));
				}, 700);
				return;
			}
			this.viewModel().setProperty("/um/pv", { items: items, intro: this.text("um.pv.intro", [items.length, s.source === "sf" ? "SuccessFactors" : "Entra ID"]) });
			this._dlg("umPreviewDlg").then(function (o) { o.open(); });
		},
		onPreviewApply: function (oEvent) {
			var that = this, d = this._d, s = d.sync, pick = this.viewModel().getProperty("/um/pv/items").filter(function (x) { return x.on; }).map(function (x) { return x.i; }),
				res = { added: 0, updated: 0, moved: 0, flagged: 0 }, held = [];
			s.pending.forEach(function (p, i) {
				if (pick.indexOf(i) < 0) { return; }
				if (p.kind === "add") {
					var e = p.employee, t = that._idx[e.team].unit;
					People.add(e.name, { initials: (e.name_en || e.name).split(" ").map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase(), en: e.name_en || e.name, role_ar: e.title_ar, role_en: e.title_en, team_ar: t.ar, team_en: t.en, email: e.email, phone: "—" });
					d.employees.push(e); res.added++;
					that._audit(e.id, "Added by directory sync", "أضافته مزامنة الدليل");
				} else if (p.kind === "move") {
					var m = that._emp(p.id); if (m) { m.team = p.to; res.moved++; that._audit(p.id, p.en, p.ar); }
				} else if (p.kind === "left") {
					var ok = A.keepsAdmin(d, that._idx, function (c) { c.employees.forEach(function (x) { if (x.id === p.id) { x.left = p.date; } }); });
					if (!ok) { held.push(p); return; }
					var l = that._emp(p.id), u = A.user(d, p.id);
					l.left = p.date;
					if (u) { var gone = u.direct.slice(); u.direct = []; u.until = {}; that._audit(p.id, "Left the organization on " + p.date + " — sign-in blocked; direct roles removed: " + (gone.join(", ") || "none"), "غادر المؤسسة في " + p.date + " — الدخول ممنوع؛ إزالة الأدوار المباشرة"); }
					res.updated++;
				}
			});
			s.pending = s.pending.filter(function (p, i) { return pick.indexOf(i) < 0 || held.indexOf(p) > -1; });
			s.lastSync = d.now; res.flagged = d.employees.filter(function (e) { return e.flagged; }).length; s.lastResult = res;
			d.history.unshift({ at: d.now, by: "sync", user: "", role: "", en: "Directory sync applied: " + res.added + " added, " + res.moved + " moved, " + res.updated + " left", ar: "تطبيق مزامنة الدليل" });
			this.onCloseDlg(oEvent);
			this._refresh();
			if (held.length) { MessageBox.warning(this.text("um.pv.held")); } else { MessageToast.show(this.text("um.t.applied", [pick.length])); }
		},

		onSyncSettings: function () {
			var that = this, s = this._d.sync;
			this.viewModel().setProperty("/um/sync", { source: s.source, schedule: s.schedule, secretRef: s.secretRef, teamFrom: s.teamFrom || "attribute",
				groups: (s.groups || []).map(function (g) { return { group: g.group, team: g.team }; }) });
			this._syncRows();
			this._dlg("umSyncDlg").then(function (o) { o.open(); });
		},
		_syncRows: function () {
			var that = this, vm = this.viewModel(), src = vm.getProperty("/um/sync/source"), s = this._d.sync, groups = src === "entra" && vm.getProperty("/um/sync/teamFrom") === "groups";
			vm.setProperty("/um/sync/endpointText", s.endpoint[src]);
			vm.setProperty("/um/sync/sourceNote", this.text("um.sync.note." + src));
			vm.setProperty("/um/sync/isEntra", src === "entra");
			vm.setProperty("/um/sync/useGroups", groups);
			vm.setProperty("/um/sync/attrTitle", this.text("um.sync.attr", [src === "sf" ? "SuccessFactors" : "Entra ID"]));
			vm.setProperty("/um/sync/rows", s.mapping.filter(function (m) { return !(groups && m.field === "team"); }).map(function (m) { return { field: m.field, fieldText: that.text("um.sync.f." + m.field), attr: m[src] }; }));
		},
		onSyncSource: function () { this._syncRows(); },
		onAddGroup: function () { var vm = this.viewModel(); vm.setProperty("/um/sync/groups", vm.getProperty("/um/sync/groups").concat([{ group: "", team: "" }])); },
		onRemoveGroup: function (oEvent) {
			var vm = this.viewModel(), o = oEvent.getSource().getBindingContext("view").getObject();
			vm.setProperty("/um/sync/groups", vm.getProperty("/um/sync/groups").filter(function (g) { return g !== o; }));
		},
		onSyncSave: function (oEvent) {
			var vm = this.viewModel(), s = this._d.sync, o = vm.getProperty("/um/sync"), changed = o.source !== s.source,
				groups = o.groups.filter(function (g) { return g.group && g.team; });
			if (o.source === "entra" && o.teamFrom === "groups" && !groups.length) { MessageBox.error(this.text("um.sync.noGroups")); return; }
			o.rows.forEach(function (r) { s.mapping.filter(function (m) { return m.field === r.field; })[0][o.source] = r.attr; });
			s.source = o.source; s.schedule = o.schedule; s.teamFrom = o.teamFrom; s.groups = groups;
			this._audit("", "Directory sync settings changed (source " + o.source + ", teams from " + (o.source === "entra" ? o.teamFrom : "attribute") + ", every " + o.schedule + ")", "تغيير إعدادات مزامنة الدليل");
			this.onCloseDlg(oEvent);
			this._syncHeader();
			MessageToast.show(this.text(changed ? "um.t.sourceChanged" : "um.t.saved"));
		},

		/* ---------- manual fallback: create, edit, import ---------- */
		onManual: function (oEvent) {
			var k = oEvent.getParameter("item").getKey();
			if (k === "create") { this._create(); } else if (k === "import") { this._import(); } else { this.onTemplate(); }
		},
		_nextManualId: function () {
			var n = this._d.employees.filter(function (e) { return /^M-/.test(e.id); }).length + 1;
			return "M-" + ("000" + n).slice(-4);
		},
		_create: function () {
			var k = this.viewModel().getProperty("/um/unit"), team = k && this._idx[k].unit.type === "team" ? k : "";
			this.viewModel().setProperty("/um/c", { mode: "create", title: this.text("um.create"), btn: this.text("um.create.btn"), nameAr: "", nameEn: "", id: this._nextManualId(), email: "", titleEn: "", titleAr: "", team: team, manager: "", makeUser: true, vs: {}, emailMsg: "" });
			this._dlg("umCreateDlg").then(function (o) { o.open(); });
		},
		onEditEmp: function (oEvent) {
			var e = this._emp(oEvent.getSource().getBindingContext("view").getProperty("id")), p = People.get(e.name) || {};
			this.viewModel().setProperty("/um/c", { mode: "edit", title: this.text("um.edit.title", [this._pname(e.name)]), btn: this.text("common.save"), orig: e.id, origName: e.name,
				nameAr: e.name, nameEn: p.en || "", id: e.id, email: e.email, titleEn: e.title_en, titleAr: e.title_ar, team: e.team, manager: e.manager, makeUser: false, vs: {}, emailMsg: "" });
			this._dlg("umCreateDlg").then(function (o) { o.open(); });
		},
		_validEmp: function (o, sSkipId) {
			var d = this._d, err = [];
			if (!o.nameAr || !o.nameEn) { err.push(this.text("um.v.name")); }
			if (!EMAIL.test(o.email || "")) { err.push(this.text("um.v.email")); } else if (d.employees.some(function (e) { return e.id !== sSkipId && !e.left && e.email.toLowerCase() === o.email.toLowerCase(); })) { err.push(this.text("um.v.emailDup")); }
			if (!this._idx[o.team] || this._idx[o.team].unit.type !== "team") { err.push(this.text("um.v.team")); }
			if (!sSkipId && d.employees.some(function (e) { return e.id === o.id; })) { err.push(this.text("um.v.idDup")); }
			return err;
		},
		_person: function (o) {
			var initials = o.nameEn.split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase();
			return { initials: initials, en: o.nameEn, role_ar: o.titleAr || o.titleEn, role_en: o.titleEn || o.titleAr, team_ar: this._idx[o.team].unit.ar, team_en: this._idx[o.team].unit.en, email: o.email, phone: "—" };
		},
		_addEmp: function (o, bUser) {
			People.add(o.nameAr, this._person(o));
			this._d.employees.push({ id: o.id, name: o.nameAr, email: o.email, title_en: o.titleEn, title_ar: o.titleAr, team: o.team, source: "manual", manager: o.manager || "" });
			if (bUser) { this._d.users.push({ employee: o.id, upn: o.email, link: "notFound", validFrom: this._today(), validTo: "", lastSignIn: "", direct: [], until: {} }); }
		},
		onCreateSave: function (oEvent) {
			var vm = this.viewModel(), o = vm.getProperty("/um/c"), edit = o.mode === "edit", err = this._validEmp(o, edit ? o.orig : "");
			vm.setProperty("/um/c/vs", { nameAr: o.nameAr ? "None" : "Error", nameEn: o.nameEn ? "None" : "Error", email: EMAIL.test(o.email || "") ? "None" : "Error", team: o.team ? "None" : "Error" });
			if (err.length) { MessageBox.error(err.join("\n")); return; }
			if (edit) {
				var e = this._emp(o.orig), u = A.user(this._d, o.orig), moved = e.team !== o.team;
				People.put(o.nameAr, this._person(o), o.origName);
				Object.assign(e, { name: o.nameAr, email: o.email, title_en: o.titleEn, title_ar: o.titleAr, team: o.team, manager: o.manager || "" });
				if (u) { u.upn = o.email; }
				this._audit(o.orig, "Manual record edited" + (moved ? " — moved to " + this._idx[o.team].unit.en : ""), "تعديل السجل اليدوي" + (moved ? " — نقل إلى " + this._idx[o.team].unit.ar : ""));
			} else {
				this._addEmp(o, o.makeUser);
				this._audit(o.id, "Created manually" + (o.makeUser ? " and made a business user" : ""), "أُنشئ يدويًا" + (o.makeUser ? " وتحوّل لمستخدم" : ""));
			}
			this.onCloseDlg(oEvent);
			this._refresh();
			MessageToast.show(this.text(edit ? "um.t.saved" : "um.t.created", [o.nameEn]));
		},

		onTemplate: function () {
			var csv = CSV_COLS.join(",") + "\nM-0100,اسم الموظف,Employee Name,employee.name@example.com,Job title,المسمى الوظيفي,t-mdm,mohamed@example.com\n";
			if (this._download("repoio-employees-template.csv", csv)) { MessageToast.show(this.text("um.t.template")); }
		},
		_import: function () {
			this.viewModel().setProperty("/um/imp", { rows: [], fileName: this.text("um.imp.noFile"), valid: 0, btnText: this.text("um.imp.btn", [0]) });
			this._dlg("umImportDlg").then(function (o) { o.open(); });
		},
		onImportChoose: function () { this._chooseCsv(this._parseCsv.bind(this)); },
		_parseCsv: function (sName, sText) {
			var that = this, vm = this.viewModel(), d = this._d,
				lines = sText.replace(/^﻿/, "").split(/\r?\n/).filter(function (l) { return l.trim(); }),
				head = lines.length ? splitCsv(lines[0]).map(function (h) { return h.toLowerCase(); }) : [], rows = [], seenIds = {}, seenMail = {};
			var missing = CSV_COLS.filter(function (c) { return c !== "manager_email" && head.indexOf(c) < 0; });
			if (missing.length) {
				vm.setProperty("/um/imp", { rows: [], fileName: sName, valid: 0, btnText: this.text("um.imp.btn", [0]) });
				MessageBox.error(this.text("um.imp.badHeader", [missing.join(", ")]));
				return;
			}
			lines.slice(1).forEach(function (l, i) {
				var v = splitCsv(l), g = function (c) { return v[head.indexOf(c)] || ""; },
					o = { id: g("employee_id"), nameAr: g("name_ar"), nameEn: g("name_en"), email: g("email"), titleEn: g("job_title_en"), titleAr: g("job_title_ar"), team: g("team_id"), managerEmail: g("manager_email") },
					err = that._validEmp(o);
				if (!o.id) { err.unshift(that.text("um.v.id")); }
				if (seenIds[o.id]) { err.push(that.text("um.v.idDupFile")); }
				if (seenMail[(o.email || "").toLowerCase()]) { err.push(that.text("um.v.emailDupFile")); }
				var mgr = o.managerEmail ? d.employees.filter(function (e) { return e.email.toLowerCase() === o.managerEmail.toLowerCase(); })[0] : null;
				if (o.managerEmail && !mgr) { err.push(that.text("um.v.manager")); }
				o.manager = mgr ? mgr.name : "";
				seenIds[o.id] = 1; seenMail[(o.email || "").toLowerCase()] = 1;
				rows.push({ line: i + 2, id: o.id, name: that._ar() ? o.nameAr : o.nameEn, email: o.email, ok: !err.length, msg: err.length ? err[0] : that.text("um.imp.ok"), data: o });
			});
			var valid = rows.filter(function (r) { return r.ok; }).length;
			vm.setProperty("/um/imp", { rows: rows, fileName: sName, valid: valid, btnText: this.text("um.imp.btn", [valid]),
				summary: this.text("um.imp.summary", [rows.length, valid, rows.length - valid]), state: valid === rows.length ? "Success" : "Warning" });
		},
		onImportSave: function (oEvent) {
			var that = this, rows = this.viewModel().getProperty("/um/imp/rows").filter(function (r) { return r.ok; });
			rows.forEach(function (r) { that._addEmp(r.data, false); });
			this._audit("", "Imported " + rows.length + " employees from CSV (manual)", "استيراد " + rows.length + " موظف من CSV (يدوي)");
			this.onCloseDlg(oEvent);
			this._refresh();
			MessageToast.show(this.text("um.t.imported", [rows.length]));
		},

		/* ---------- duplicate: manual record vs directory record ---------- */
		onResolve: function (oEvent) {
			var that = this, m = this._emp(oEvent.getSource().getBindingContext("view").getProperty("id")), s = this._emp(m.match), u = A.user(this._d, m.id), su = s ? A.user(this._d, s.id) : null;
			var card = function (e, bUser) {
				return { id: e.id, nameText: that._pname(e.name), email: e.email, unit: that._unitPath(e.team, true), source: e.source === "manual" ? that.text("um.src.manual") : SRC[e.source][0],
					userText: bUser ? that.text("um.rs.hasUser", [(bUser.direct || []).length]) : that.text("um.rs.noUser") };
			};
			this.viewModel().setProperty("/um/rs", { manual: card(m, u), dir: s ? card(s, su) : null, note: this.text(u ? "um.rs.noteUser" : "um.rs.note") });
			this._rs = m.id;
			this._dlg("umResolveDlg").then(function (o) { o.open(); });
		},
		onResolveKeep: function (oEvent) {
			var d = this._d, m = this._emp(this._rs), s = this._emp(m.match), u = A.user(d, m.id), su = A.user(d, s.id);
			if (u && !su) { u.employee = s.id; u.upn = s.email; u.link = "linked"; }
			else if (u && su) { u.direct.forEach(function (r) { if (su.direct.indexOf(r) < 0) { su.direct.push(r); } }); d.users = d.users.filter(function (x) { return x !== u; }); }
			d.employees = d.employees.filter(function (e) { return e.id !== m.id; });
			this._audit(s.id, "Duplicate resolved: manual record " + m.id + " retired; user and direct roles moved to " + s.id, "حل التكرار: إلغاء السجل اليدوي " + m.id + " ونقل المستخدم والأدوار إلى " + s.id);
			this.onCloseDlg(oEvent);
			this._refresh();
			MessageToast.show(this.text("um.t.resolved"));
		},

		/* ---------- step 2: employee → business user ---------- */
		onMaintainUser: function () {
			var that = this, d = this._d, items = this.byId("empTable").getSelectedItems().map(function (it) { return it.getBindingContext("view").getObject(); })
				.filter(function (r) { return !A.user(d, r.id); }).map(function (r) {
					var e = that._emp(r.id), l = e.source === "manual" ? "notFound" : "active";
					return { id: e.id, name: e.name, nameText: that._pname(e.name), email: e.email, link: l === "active" ? "linked" : l, linkText: that.text("um.st." + l), linkState: STATUS[l][0], linkIcon: STATUS[l][1] };
				});
			this.viewModel().setProperty("/um/bu", { items: items, from: this._today(), to: "", intro: this.text("um.bu.intro", [items.length]), btnText: this.text("um.bu.btn", [items.length]) });
			this._dlg("umBuDlg").then(function (o) { o.open(); });
		},
		onMaintainUserSave: function (oEvent) {
			var that = this, b = this.viewModel().getProperty("/um/bu");
			if (b.to && b.to < b.from) { MessageBox.error(this.text("um.v.dates")); return; }
			b.items.forEach(function (it) {
				that._d.users.push({ employee: it.id, upn: it.email, link: it.link, validFrom: b.from, validTo: b.to || "", lastSignIn: "", direct: [], until: {} });
				that._audit(it.id, "Business user created (valid from " + b.from + ")", "إنشاء مستخدم (صالح من " + b.from + ")");
			});
			this.onCloseDlg(oEvent);
			this._refresh();
			MessageToast.show(this.text("um.t.usersCreated", [b.items.length]));
		},

		/* ---------- users: bulk assign, upload assignments, export ---------- */
		_selUserIds: function () { return this.byId("userTable").getSelectedItems().map(function (it) { return it.getBindingContext("view").getProperty("id"); }); },
		onBulkAssign: function () {
			var that = this, d = this._d, ids = this._selUserIds();
			A.pickRoles(this, d.roles, this.text("um.bulk.title", [ids.length]), function (aRoles) {
				that._askUntil(that.text("um.until.title"), function (sUntil) {
					var before = that._sodBefore(ids), n = 0;
					ids.forEach(function (id) {
						var u = A.user(d, id);
						aRoles.forEach(function (r) {
							if (u.direct.indexOf(r) > -1) { return; }
							u.direct.push(r); u.until = u.until || {}; if (sUntil) { u.until[r] = sUntil; } n++;
							that._audit(id, "Direct role added: " + A.role(d, r).en + (sUntil ? " until " + sUntil : ""), "إضافة دور مباشر: " + A.role(d, r).ar + (sUntil ? " حتى " + sUntil : ""), r);
						});
					});
					that._apply();
					MessageToast.show(that.text("um.t.bulk", [n, ids.length]));
					that._sodWarn(ids, before);
				});
			});
		},
		onUploadAsg: function () {
			this.viewModel().setProperty("/um/asg", { rows: [], fileName: this.text("um.imp.noFile"), valid: 0, btnText: this.text("um.asg.btn", [0]) });
			this._dlg("umAsgDlg").then(function (o) { o.open(); });
		},
		onAsgTemplate: function () {
			if (this._download("repoio-role-assignments-template.csv", ASG_COLS.join(",") + "\nsara.adel@example.com,REQUESTER,2026-12-31\n")) { MessageToast.show(this.text("um.t.template")); }
		},
		onAsgChoose: function () {
			var that = this, d = this._d;
			this._chooseCsv(function (sName, sText) {
				var lines = sText.replace(/^﻿/, "").split(/\r?\n/).filter(function (l) { return l.trim(); }),
					head = lines.length ? splitCsv(lines[0]).map(function (h) { return h.toLowerCase(); }) : [], rows = [], seen = {};
				var missing = ASG_COLS.filter(function (c) { return c !== "valid_until" && head.indexOf(c) < 0; });
				if (missing.length) { MessageBox.error(that.text("um.imp.badHeader", [missing.join(", ")])); return; }
				lines.slice(1).forEach(function (l, i) {
					var v = splitCsv(l), g = function (c) { return v[head.indexOf(c)] || ""; }, mail = g("user_email").toLowerCase(), rid = g("role_id").toUpperCase(), until = g("valid_until"),
						u = d.users.filter(function (x) { return x.upn.toLowerCase() === mail; })[0], e = u ? that._emp(u.employee) : null, r = A.role(d, rid), err = "";
					if (!u) { err = that.text("um.asg.noUser"); } else if (A.status(d, u, e) === "left") { err = that.text("um.asg.left"); }
					else if (!r) { err = that.text("um.asg.noRole"); } else if (u.direct.indexOf(rid) > -1) { err = that.text("um.asg.has"); }
					else if (until && (!DATE.test(until) || until <= that._today())) { err = that.text("um.asg.date"); }
					else if (seen[mail + rid]) { err = that.text("um.asg.dupFile"); }
					seen[mail + rid] = 1;
					rows.push({ line: i + 2, user: e ? that._pname(e.name) : mail, role: r ? that._t(r) : rid, until: until || "—", ok: !err, msg: err || that.text("um.imp.ok"), data: { id: u && u.employee, role: rid, until: until } });
				});
				var valid = rows.filter(function (x) { return x.ok; }).length;
				that.viewModel().setProperty("/um/asg", { rows: rows, fileName: sName, valid: valid, btnText: that.text("um.asg.btn", [valid]),
					summary: that.text("um.imp.summary", [rows.length, valid, rows.length - valid]), state: valid === rows.length ? "Success" : "Warning" });
			});
		},
		onAsgSave: function (oEvent) {
			var that = this, d = this._d, rows = this.viewModel().getProperty("/um/asg/rows").filter(function (r) { return r.ok; }), ids = rows.map(function (r) { return r.data.id; }), before = this._sodBefore(ids);
			rows.forEach(function (r) {
				var u = A.user(d, r.data.id); u.direct.push(r.data.role); u.until = u.until || {}; if (r.data.until) { u.until[r.data.role] = r.data.until; }
				that._audit(r.data.id, "Direct role added by upload: " + A.role(d, r.data.role).en, "إضافة دور مباشر بالرفع: " + A.role(d, r.data.role).ar, r.data.role);
			});
			this.onCloseDlg(oEvent);
			this._apply();
			MessageToast.show(this.text("um.t.asgDone", [rows.length]));
			this._sodWarn(ids.filter(function (x, i) { return ids.indexOf(x) === i; }), before);
		},
		onExport: function () {
			var that = this, d = this._d, ids = this.viewModel().getProperty("/um/users").map(function (r) { return r.id; }),
				lines = [["employee_id", "name_en", "user_name", "status", "department", "team", "role_id", "role_name", "assigned_through", "until"].join(",")];
			ids.forEach(function (id) {
				var u = A.user(d, id), e = that._emp(id), p = People.get(e.name) || {}, pl = A.placement(that._idx, e.team), st = A.status(d, u, e), eff = A.effective(d, that._idx, u, e);
				(eff.length ? eff : [null]).forEach(function (x) {
					var r = x ? A.role(d, x.role) : null;
					lines.push([e.id, p.en || e.name, u.upn, st, pl.department ? pl.department.en : "", pl.team ? pl.team.en : "",
						r ? r.id : "", r ? r.en : "", x ? (x.type === "direct" ? "direct" : x.type + ": " + x.unit.en) : "", x && x.until ? x.until : ""].map(csvCell).join(","));
				});
			});
			if (this._download("repoio-users-and-roles-" + this._today() + ".csv", lines.join("\n") + "\n")) {
				this._audit("", "Exported users and role assignments (" + ids.length + " users)", "تصدير المستخدمين والأدوار (" + ids.length + " مستخدم)");
				MessageToast.show(this.text("um.t.exported", [ids.length]));
			}
		},

		/* ---------- business user details ---------- */
		onOpenUser: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject();
			this.router().navTo("users", { user: o.id }, true);
		},
		onOpenEmpUser: function (oEvent) { this.onOpenUser(oEvent); },
		_openUser: function (sEmp) {
			var that = this, e = this._emp(sEmp), u = A.user(this._d, sEmp);
			if (!e || !u) { return; }
			this._ud = sEmp;
			this._fillUser("general");
			this._dlg("umUserDlg").then(function (o) {
				if (!o.isOpen()) { o.attachEventOnce("afterClose", function () { if (!that._noBack && /^admin\/users\/./.test(that.router().getHashChanger().getHash())) { that.router().navTo("users", {}, true); } that._noBack = false; }); o.open(); }
			});
		},
		_fillUser: function (sTab) {
			var that = this, d = this._d, e = this._emp(this._ud), u = A.user(d, this._ud), p = People.get(e.name) || {}, s = SRC[e.source],
				st = A.status(d, u, e), sv = STATUS[st], eff = A.effective(d, this._idx, u, e), cf = A.conflicts(d, this._idx, u, e);
			var roles = eff.map(function (x) {
				var r = A.role(d, x.role), via = x.type === "direct" ? that.text("um.via.direct") : that.text("um.via." + x.type, [that._t(x.unit)]);
				return { id: r.id, text: that._t(r), icon: r.icon, sensitive: r.sensitive, domainsText: that._domainsText(r), type: x.type,
					viaText: via + (x.until ? " · " + that.text("um.until.short", [x.until]) : ""), viaState: x.until ? "Warning" : x.type === "direct" ? "Information" : "None",
					viaIcon: x.until ? "sap-icon://fob-watch" : x.type === "direct" ? "sap-icon://person-placeholder" : A.TYPE_ICON[x.type],
					viaTip: x.also.length ? that.text("um.via.also", [x.also.map(function (a) { return a.type === "direct" ? that.text("um.via.direct") : that._t(a.unit); }).join(", ")]) : "" };
			});
			var order = d.permissions.map(function (x) { return x.id; });
			var access = A.access(d, this._idx, u, e).sort(function (a, b) { return order.indexOf(a.perm) - order.indexOf(b.perm); }).map(function (a) {
				var pm = d.permissions.filter(function (x) { return x.id === a.perm; })[0];
				return { text: that._t(pm), sensitive: !!pm.sensitive, group: that.text("ra.pg." + pm.group), domainsText: that._domText(Object.keys(a.domains)),
					viaText: a.roles.map(function (r) { return that._roleText(r); }).join(", ") };
			});
			var hist = d.history.filter(function (h) { return h.user === that._ud; }).map(function (h) {
				return { text: that._ar() ? h.ar : h.en, meta: h.at.replace("T", " ").slice(0, 16) + " · " + (h.by === "sync" ? that.text("um.bySync") : that._pname(h.by)), icon: h.by === "sync" ? "sap-icon://synchronize" : "sap-icon://edit" };
			});
			this.viewModel().setProperty("/um/ud", {
				tab: sTab || this.viewModel().getProperty("/um/ud/tab") || "general",
				initials: p.initials || "?", nameText: this._pname(e.name), sub: (this._ar() ? e.title_ar : e.title_en) + " · " + this._unitPath(e.team),
				id: e.id, email: e.email, title: this._ar() ? e.title_ar : e.title_en, path: this._unitPath(e.team, true), manager: e.manager,
				sourceText: e.source === "manual" ? this.text("um.src.manual") : s[0], sourceState: s[1], sourceIcon: s[2],
				upn: u.upn, statusText: this.text("um.st." + st), statusState: sv[0], statusIcon: sv[1], statusNote: this.text("um.stNote." + st, [e.left || u.validTo || u.validFrom || "", u.lockReason || "—"]),
				locked: !!u.locked, left: !!e.left, canLock: !e.left,
				validFrom: u.validFrom, validTo: u.validTo, lastText: u.lastSignIn ? u.lastSignIn.replace("T", " ").slice(0, 16) : this.text("um.never"),
				roles: roles, access: access, history: hist,
				conflicts: cf.map(function (c) { return { text: that._t(c.rule) + (c.domains.length ? " — " + that._domText(c.domains) : ""), roles: c.roles.map(function (r) { return that._roleText(r); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(" + ") }; }),
				conflictText: cf.length ? this.text("um.sod.user", [cf.map(function (c) { return that._t(c.rule) + (c.domains.length ? " (" + that._domText(c.domains) + ")" : ""); }).join("; ")]) : ""
			});
		},
		onValidity: function () {
			var that = this, u = A.user(this._d, this._ud), ud = this.viewModel().getProperty("/um/ud");
			if (ud.validTo && ud.validTo < ud.validFrom) { MessageBox.error(this.text("um.v.dates")); this._fillUser(); return; }
			if (!A.keepsAdmin(this._d, this._idx, function (c) { c.users.forEach(function (x) { if (x.employee === that._ud) { x.validFrom = ud.validFrom; x.validTo = ud.validTo || ""; } }); })) { this._noAdminLeft(); this._fillUser(); return; }
			u.validFrom = ud.validFrom; u.validTo = ud.validTo || "";
			this._audit(this._ud, "Validity changed: " + u.validFrom + " → " + (u.validTo || "no end"), "تغيير الصلاحية: " + u.validFrom + " ← " + (u.validTo || "بلا نهاية"));
			this._fillUser(); this._apply();
			MessageToast.show(this.text("um.t.saved"));
		},
		onLockUser: function () {
			var that = this, u = A.user(this._d, this._ud);
			if (u.locked) {
				u.locked = false; u.lockReason = "";
				this._audit(this._ud, "Unlocked", "فك القفل");
				this._fillUser(); this._apply();
				MessageToast.show(this.text("um.t.unlocked"));
				return;
			}
			if (!A.keepsAdmin(this._d, this._idx, function (c) { c.users.forEach(function (x) { if (x.employee === that._ud) { x.locked = true; } }); })) { this._noAdminLeft(); return; }
			var oTa = new TextArea({ width: "100%", rows: 3, placeholder: this.text("um.lock.ph"), liveChange: function () { oTa.setValueState("None"); } });
			var oDlg = new Dialog({ title: this.text("um.lock.title", [this.viewModel().getProperty("/um/ud/nameText")]), contentWidth: "28rem", type: "Message", state: "Warning",
				content: [new VBox({ items: [new Text({ text: this.text("um.lock.note") }).addStyleClass("sapUiSmallMarginBottom"), new Label({ text: this.text("um.lock.reason"), required: true, labelFor: oTa }), oTa] })],
				beginButton: new Button({ text: this.text("um.lock.btn"), type: "Reject", press: function () {
					var r = oTa.getValue().trim(); if (!r) { oTa.setValueState("Error"); return; }
					u.locked = true; u.lockReason = r;
					that._audit(that._ud, "Locked in Repo.io: " + r, "قفل في Repo.io: " + r);
					oDlg.close(); that._fillUser(); that._apply();
					MessageToast.show(that.text("um.t.locked"));
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); } });
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		onUserAddRole: function () {
			var that = this, d = this._d, u = A.user(d, this._ud), have = u.direct.slice();
			A.pickRoles(this, d.roles.filter(function (r) { return have.indexOf(r.id) < 0; }), this.text("um.ud.addRole"), function (aIds) {
				that._askUntil(that.text("um.until.title"), function (sUntil) {
					var before = that._sodBefore([that._ud]);
					aIds.forEach(function (id) {
						u.direct.push(id); u.until = u.until || {}; if (sUntil) { u.until[id] = sUntil; }
						that._audit(that._ud, "Direct role added: " + A.role(d, id).en + (sUntil ? " until " + sUntil : ""), "إضافة دور مباشر: " + A.role(d, id).ar + (sUntil ? " حتى " + sUntil : ""), id);
					});
					that._fillUser("roles"); that._apply();
					MessageToast.show(that.text("um.t.rolesAdded", [aIds.length]));
					that._sodWarn([that._ud], before);
				});
			});
		},
		onUserRemoveRole: function (oEvent) {
			var that = this, r = oEvent.getSource().getBindingContext("view").getObject(), u = A.user(this._d, this._ud);
			if (!A.keepsAdmin(this._d, this._idx, function (c) { c.users.forEach(function (x) { if (x.employee === that._ud) { x.direct = x.direct.filter(function (y) { return y !== r.id; }); } }); })) { this._noAdminLeft(); return; }
			MessageBox.confirm(this.text("um.ud.removeConfirm", [r.text]), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				u.direct = u.direct.filter(function (x) { return x !== r.id; }); if (u.until) { delete u.until[r.id]; }
				that._audit(that._ud, "Direct role removed: " + A.role(that._d, r.id).en, "إزالة دور مباشر: " + A.role(that._d, r.id).ar, r.id);
				that._fillUser("roles"); that._apply();
			} });
		},

		/* ---------- org unit default roles (departments and teams; sensitive roles are user-only) ---------- */
		onUnitAddRole: function () {
			var that = this, k = this.viewModel().getProperty("/um/unit"), have = this._d.unitRoles[k] || [];
			A.pickRoles(this, this._d.roles.filter(function (r) { return !r.sensitive && have.indexOf(r.id) < 0; }), this.text("um.unit.addRoleTo", [this._t(this._idx[k].unit)]), function (aIds) {
				var ids = A.underUnit(that._d, that._idx, k).map(function (e) { return e.id; }), before = that._sodBefore(ids);
				that._d.unitRoles[k] = have.concat(aIds);
				aIds.forEach(function (id) { that._audit("", "Role " + A.role(that._d, id).en + " assigned to " + that._idx[k].unit.en, "إسناد دور " + A.role(that._d, id).ar + " إلى " + that._idx[k].unit.ar, id); });
				that._unit(); that._apply();
				MessageToast.show(that.text("um.t.unitRoles", [ids.length]));
				that._sodWarn(ids, before);
			});
		},
		onUnitRemoveRole: function (oEvent) {
			var that = this, r = oEvent.getSource().getBindingContext("view").getObject(), k = this.viewModel().getProperty("/um/unit"),
				n = A.underUnit(this._d, this._idx, k).length;
			if (!A.keepsAdmin(this._d, this._idx, function (c) { c.unitRoles[k] = (c.unitRoles[k] || []).filter(function (x) { return x !== r.id; }); })) { this._noAdminLeft(); return; }
			MessageBox.confirm(this.text("um.unit.removeConfirm", [r.text, n]), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				that._d.unitRoles[k] = (that._d.unitRoles[k] || []).filter(function (x) { return x !== r.id; });
				that._audit("", "Role " + A.role(that._d, r.id).en + " removed from " + that._idx[k].unit.en, "إزالة دور " + A.role(that._d, r.id).ar + " من " + that._idx[k].unit.ar, r.id);
				that._unit(); that._apply();
			} });
		},

		/* ---------- access reviews (periodic certification of direct roles by each person's manager) ---------- */
		_reviews: function () {
			var that = this, today = this._today();
			this.viewModel().setProperty("/um/reviews", (this._d.reviews || []).map(function (r) {
				var items = r.items.filter(function (i) { return i.role; }), done = items.filter(function (i) { return i.decision; }).length,
					overdue = r.status === "open" && r.due < today;
				return { id: r.id, text: that._t(r), period: r.start + " – " + r.due, total: items.length, done: done, pct: items.length ? Math.round(done * 100 / items.length) : 100,
					progress: that.text("um.rv.progress", [done, items.length]), statusText: that.text(overdue ? "um.rv.overdue" : "um.rv." + r.status),
					statusState: overdue ? "Error" : r.status === "open" ? "Information" : "Success",
					removed: items.filter(function (i) { return i.decision === "remove"; }).length };
			}));
			var open = (this._d.reviews || []).filter(function (r) { return r.status === "open"; }).length;
			this.viewModel().setProperty("/um/nReviews", open);
		},
		onStartReview: function () {
			var that = this, d = this._d;
			if (d.reviews.some(function (r) { return r.status === "open"; })) { MessageBox.information(this.text("um.rv.oneOpen")); return; }
			var due = new Date(this._now.getTime() + 14 * 864e5), items = [];
			d.users.forEach(function (u) {
				var e = that._emp(u.employee); if (!e || A.status(d, u, e) === "left") { return; }
				u.direct.forEach(function (r) { items.push({ user: e.id, role: r, reviewer: e.manager && e.manager !== e.name ? e.manager : ME, decision: "", at: "" }); });
			});
			var n = d.reviews.length + 1, id = "AR-" + this._today().slice(0, 4) + "-" + n;
			d.reviews.unshift({ id: id, en: "Access review " + this._today(), ar: "مراجعة الصلاحيات " + this._today(), start: this._today(), due: isoDate(due), status: "open", items: items });
			this._audit("", "Access review started: " + items.length + " direct role assignments", "بدء مراجعة الصلاحيات: " + items.length + " إسناد مباشر");
			this._reviews();
			this._openReview(id);
		},
		onOpenReview: function (oEvent) { this._openReview(oEvent.getSource().getBindingContext("view").getProperty("id")); },
		_openReview: function (sId) {
			this._rvId = sId; this._fillReview();
			this._dlg("umReviewDlg").then(function (o) { if (!o.isOpen()) { o.open(); } });
		},
		_fillReview: function () {
			var that = this, d = this._d, r = d.reviews.filter(function (x) { return x.id === that._rvId; })[0], items = r.items.filter(function (i) { return i.role && A.role(d, i.role); });
			this.viewModel().setProperty("/um/rv", { title: this._t(r), open: r.status === "open", period: r.start + " – " + r.due,
				progress: this.text("um.rv.progress", [items.filter(function (i) { return i.decision; }).length, items.length]),
				canClose: r.status === "open" && items.every(function (i) { return i.decision; }),
				items: items.map(function (i) {
					var e = that._emp(i.user);
					return { key: i.user + "|" + i.role, name: e ? e.name : i.user, nameText: e ? that._pname(e.name) : i.user, role: that._roleText(i.role), reviewer: i.reviewer,
						decision: i.decision, decisionText: i.decision ? that.text("um.rv.d." + i.decision) + (i.at ? " · " + i.at : "") : "",
						decisionState: i.decision === "remove" ? "Error" : "Success", pending: !i.decision && r.status === "open" };
				}) });
		},
		_rvItem: function (oEvent) {
			var k = oEvent.getSource().getBindingContext("view").getProperty("key").split("|"), that = this,
				r = this._d.reviews.filter(function (x) { return x.id === that._rvId; })[0];
			return r.items.filter(function (i) { return i.user === k[0] && i.role === k[1]; })[0];
		},
		onReviewKeep: function (oEvent) {
			var i = this._rvItem(oEvent); i.decision = "keep"; i.at = this._today();
			this._audit(i.user, "Access review: kept " + A.role(this._d, i.role).en, "مراجعة الصلاحيات: إبقاء " + A.role(this._d, i.role).ar, i.role);
			this._fillReview(); this._reviews();
		},
		onReviewRemove: function (oEvent) {
			var that = this, i = this._rvItem(oEvent), d = this._d;
			if (!A.keepsAdmin(d, this._idx, function (c) { c.users.forEach(function (x) { if (x.employee === i.user) { x.direct = x.direct.filter(function (y) { return y !== i.role; }); } }); })) { this._noAdminLeft(); return; }
			var u = A.user(d, i.user); if (u) { u.direct = u.direct.filter(function (y) { return y !== i.role; }); if (u.until) { delete u.until[i.role]; } }
			i.decision = "remove"; i.at = this._today();
			this._audit(i.user, "Access review: removed " + A.role(d, i.role).en, "مراجعة الصلاحيات: إزالة " + A.role(d, i.role).ar, i.role);
			this._fillReview(); this._reviews(); this._apply();
			MessageToast.show(that.text("um.t.rvRemoved"));
		},
		onCloseReview: function () {
			var that = this, r = this._d.reviews.filter(function (x) { return x.id === that._rvId; })[0];
			r.status = "closed";
			this._audit("", "Access review closed: " + r.id, "إغلاق مراجعة الصلاحيات: " + r.id);
			this._fillReview(); this._reviews();
			MessageToast.show(this.text("um.t.rvClosed"));
		},

		onRoleLink: function (oEvent) {
			var id = oEvent.getSource().getBindingContext("view").getProperty("id"), o = this.byId("umUserDlg");
			if (o && o.isOpen()) { this._noBack = true; o.close(); }
			this.router().navTo("roles", { role: id });
		}
	});
});
