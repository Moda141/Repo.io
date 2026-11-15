sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/people",
	"repoio/proto/util/access",
	"sap/ui/core/Fragment",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, People, A, Fragment, MessageToast, MessageBox) {
	"use strict";

	var ME = "محمد",
		SRC = { entra: ["Entra ID", "Information", "sap-icon://cloud"], sf: ["SuccessFactors", "Information", "sap-icon://employee"], manual: ["", "Warning", "sap-icon://edit"] },
		LINK = { linked: ["Success", "sap-icon://chain-link"], notFound: ["Warning", "sap-icon://disconnected"], disabled: ["Error", "sap-icon://locked"] },
		CSV_COLS = ["employee_id", "name_ar", "name_en", "email", "job_title_en", "job_title_ar", "team_id", "manager_email"],
		EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	var pad = function (n) { return (n < 10 ? "0" : "") + n; };
	var isoDate = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };

	/* User management (J17, ADR-0009). Lists come from the directory and RBAC APIs in the product;
	   the console never creates identities and never decides access — it shows what the API returns. */
	return BaseController.extend("repoio.proto.controller.UserManagement", {
		onInit: function () {
			this.viewModel().setProperty("/um", { tab: "employees", unit: "", q: "", src: "all", uq: "", link: "all", roleF: "",
				u: { roles: [] }, emps: [], users: [], tree: [], sync: {}, c: { vs: {} }, imp: { rows: [] }, bu: { items: [] }, ud: { roles: [], history: [] }, selNoUser: 0 });
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
		_domainsText: function (r) {
			var that = this, doms = this.data().getProperty("/domains") || [];
			if (r.domains.indexOf("*") > -1) { return this.text("ra.allDomains"); }
			return r.domains.map(function (id) { return that.domainName(doms.filter(function (x) { return x.id === id; })[0]); }).join(" · ");
		},
		_audit: function (sUser, en, ar) {
			this._d.history.unshift({ at: isoDate(this._now) + "T" + pad(this._now.getHours()) + ":" + pad(this._now.getMinutes()) + ":00", by: ME, user: sUser || "", en: en, ar: ar });
		},

		_refresh: function () { this._syncHeader(); this._tree(); this._unit(); this._apply(); },

		/* ---------- header: sync status ---------- */
		_syncHeader: function () {
			var s = this._d.sync, vm = this.viewModel(), name = s.source === "sf" ? "SuccessFactors" : "Entra ID", r = s.lastResult,
				flagged = this._d.employees.filter(function (e) { return e.flagged; }).length;
			vm.setProperty("/um/syncText", this.text("um.syncStatus", [name, this._ago(s.lastSync)]));
			vm.setProperty("/um/syncState", "Success");
			vm.setProperty("/um/syncTip", this.text("um.syncTip", [r.added, r.updated, r.moved, r.flagged]));
			vm.setProperty("/um/flagged", flagged);
			vm.setProperty("/um/flagText", this.text("um.flag.text", [flagged, name]));
		},

		/* ---------- org tree ---------- */
		_tree: function () {
			var that = this, sel = this.viewModel().getProperty("/um/unit"), d = this._d;
			var node = function (u) {
				var n = A.underUnit(d, that._idx, u.type === "org" ? "" : u.id).length;
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
			// Teams, roles and people lists for the dialogs
			var teams = [];
			Object.keys(this._idx).forEach(function (k) { if (that._idx[k].unit.type === "team") { teams.push({ key: k, text: that._unitPath(k) }); } });
			this.viewModel().setProperty("/um/teams", teams.sort(function (a, b) { return a.text < b.text ? -1 : 1; }));
			this.viewModel().setProperty("/um/peopleList", d.employees.map(function (e) { return { key: e.name, text: that._pname(e.name), email: e.email }; }));
			this.viewModel().setProperty("/um/roleFilter", [{ key: "", text: this.text("um.role.all") }].concat(d.roles.map(function (r) { return { key: r.id, text: that._t(r) }; })));
		},

		onUnit: function (oEvent) {
			this.viewModel().setProperty("/um/unit", oEvent.getParameter("listItem").getBindingContext("view").getProperty("key"));
			this._unit(); this._apply();
		},

		/* Selected unit header: department and team roles are editable; a team also shows what it inherits. */
		_unit: function () {
			var that = this, vm = this.viewModel(), k = vm.getProperty("/um/unit"), d = this._d,
				u = k ? this._idx[k].unit : d.org, n = A.underUnit(d, this._idx, k).length,
				assignable = u.type === "department" || u.type === "team", roles = [];
			var chip = function (r, own, oFrom) {
				var o = A.role(d, r);
				return { id: r, text: that._t(o), icon: o.icon, own: own, tip: that._domainsText(o), fromText: oFrom ? that.text("um.unit.from", [that._t(oFrom)]) : "" };
			};
			(d.unitRoles[k] || []).forEach(function (r) { roles.push(chip(r, true)); });
			if (u.type === "team") {
				var dep = this._idx[this._idx[k].path[2]].unit;
				(d.unitRoles[dep.id] || []).forEach(function (r) { if (!roles.some(function (x) { return x.id === r; })) { roles.push(chip(r, false, dep)); } });
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
				if (um.src === "flagged" && !e.flagged) { return false; }
				if (um.src === "noUser" && hasUser) { return false; }
				if (["entra", "sf", "manual"].indexOf(um.src) > -1 && e.source !== um.src) { return false; }
				return !q || [e.id, e.name, that._pname(e.name), e.email, e.title_en, e.title_ar].join(" ").toLowerCase().indexOf(q) > -1;
			}).map(function (e) {
				var s = SRC[e.source], hasUser = !!A.user(d, e.id);
				return { id: e.id, name: e.name, nameText: that._pname(e.name), email: e.email, title: that._ar() ? e.title_ar : e.title_en,
					unitText: that._unitPath(e.team), unitTip: that._unitPath(e.team, true), hasUser: hasUser,
					sourceText: e.source === "manual" ? that.text(e.flagged ? "um.src.flaggedShort" : "um.src.manual") : s[0],
					sourceState: e.flagged ? "Error" : s[1], sourceIcon: e.flagged ? "sap-icon://alert" : s[2],
					sourceTip: e.flagged ? that.text("um.flag.rowTip") : "" };
			});
			var users = d.users.filter(function (u) {
				var e = that._emp(u.employee);
				if (!e || ids.indexOf(e.id) < 0) { return false; }
				if (um.link !== "all" && u.link !== um.link) { return false; }
				if (um.roleF && !A.effective(d, that._idx, u, e).some(function (x) { return x.role === um.roleF; })) { return false; }
				return !uq || [e.id, e.name, that._pname(e.name), u.upn].join(" ").toLowerCase().indexOf(uq) > -1;
			}).map(function (u) {
				var e = that._emp(u.employee), eff = A.effective(d, that._idx, u, e), l = LINK[u.link],
					expired = u.validTo && u.validTo < isoDate(that._now);
				return { id: e.id, name: e.name, nameText: that._pname(e.name), upn: u.upn,
					linkText: that.text("um.link." + u.link), linkState: l[0], linkIcon: l[1],
					unitText: that._unitPath(e.team), unitTip: that._unitPath(e.team, true),
					rolesText: that.text("um.rolesCount", [eff.length, u.direct.length]),
					rolesTip: eff.map(function (x) { return that._roleText(x.role); }).join(", "),
					validText: u.validTo ? that.text("um.validTo", [u.validTo]) : that.text("um.noEnd"), validState: expired ? "Error" : "None",
					lastText: u.lastSignIn ? that._ago(u.lastSignIn) : that.text("um.never") };
			});
			vm.setProperty("/um/emps", emps);
			vm.setProperty("/um/users", users);
			vm.setProperty("/um/nEmp", under.length);
			vm.setProperty("/um/nUsers", d.users.filter(function (u) { return ids.indexOf(u.employee) > -1; }).length);
			vm.setProperty("/um/empTitle", this.text("um.empTitle", [emps.length]));
			vm.setProperty("/um/userTitle", this.text("um.userTitle", [users.length]));
			this.byId("empTable").removeSelections(true);
			vm.setProperty("/um/selNoUser", 0);
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

		/* Sync */
		onSyncNow: function () {
			var that = this, vm = this.viewModel(), s = this._d.sync;
			vm.setProperty("/um/syncing", true);
			setTimeout(function () {
				s.lastSync = that._d.now; s.lastResult = { added: 0, updated: 0, moved: 0, flagged: that._d.employees.filter(function (e) { return e.flagged; }).length };
				that._d.history.unshift({ at: that._d.now, by: "sync", user: "", en: "Directory sync: no changes", ar: "مزامنة الدليل: لا تغييرات" });
				vm.setProperty("/um/syncing", false);
				that._syncHeader();
				MessageToast.show(that.text("um.t.synced", [s.source === "sf" ? "SuccessFactors" : "Entra ID"]));
			}, 900);
		},
		onSyncSettings: function () {
			var that = this, s = this._d.sync;
			this.viewModel().setProperty("/um/sync", { source: s.source, schedule: s.schedule, secretRef: s.secretRef });
			this._syncRows();
			this._dlg("umSyncDlg").then(function (o) { o.open(); });
		},
		_syncRows: function () {
			var that = this, vm = this.viewModel(), src = vm.getProperty("/um/sync/source"), s = this._d.sync;
			vm.setProperty("/um/sync/endpointText", s.endpoint[src]);
			vm.setProperty("/um/sync/sourceNote", this.text("um.sync.note." + src));
			vm.setProperty("/um/sync/attrTitle", this.text("um.sync.attr", [src === "sf" ? "SuccessFactors" : "Entra ID"]));
			vm.setProperty("/um/sync/rows", s.mapping.map(function (m) { return { field: m.field, fieldText: that.text("um.sync.f." + m.field), attr: m[src] }; }));
		},
		onSyncSource: function () { this._syncRows(); },
		onSyncSave: function (oEvent) {
			var vm = this.viewModel(), s = this._d.sync, o = vm.getProperty("/um/sync"), changed = o.source !== s.source;
			o.rows.forEach(function (r) { s.mapping.filter(function (m) { return m.field === r.field; })[0][o.source] = r.attr; });
			s.source = o.source; s.schedule = o.schedule;
			this._audit("", "Directory sync settings changed (source " + o.source + ", every " + o.schedule + ")", "تغيير إعدادات مزامنة الدليل");
			this.onCloseDlg(oEvent);
			this._syncHeader();
			MessageToast.show(this.text(changed ? "um.t.sourceChanged" : "um.t.saved"));
		},

		/* Manual fallback */
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
			this.viewModel().setProperty("/um/c", { nameAr: "", nameEn: "", id: this._nextManualId(), email: "", titleEn: "", titleAr: "", team: team, manager: "", makeUser: true, vs: {}, emailMsg: "" });
			this._dlg("umCreateDlg").then(function (o) { o.open(); });
		},
		_validEmp: function (o) {
			var d = this._d, err = [];
			if (!o.nameAr || !o.nameEn) { err.push(this.text("um.v.name")); }
			if (!EMAIL.test(o.email || "")) { err.push(this.text("um.v.email")); } else if (d.employees.some(function (e) { return e.email.toLowerCase() === o.email.toLowerCase(); })) { err.push(this.text("um.v.emailDup")); }
			if (!this._idx[o.team] || this._idx[o.team].unit.type !== "team") { err.push(this.text("um.v.team")); }
			if (d.employees.some(function (e) { return e.id === o.id; })) { err.push(this.text("um.v.idDup")); }
			return err;
		},
		_addEmp: function (o, bUser) {
			var initials = o.nameEn.split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase();
			People.add(o.nameAr, { initials: initials, en: o.nameEn, role_ar: o.titleAr || o.titleEn, role_en: o.titleEn || o.titleAr, team_ar: this._t(this._idx[o.team].unit), team_en: this._idx[o.team].unit.en, email: o.email, phone: "—" });
			this._d.employees.push({ id: o.id, name: o.nameAr, email: o.email, title_en: o.titleEn, title_ar: o.titleAr, team: o.team, source: "manual", manager: o.manager || "" });
			if (bUser) { this._d.users.push({ employee: o.id, upn: o.email, link: "notFound", validFrom: isoDate(this._now), validTo: "", lastSignIn: "", direct: [] }); }
		},
		onCreateSave: function (oEvent) {
			var vm = this.viewModel(), o = vm.getProperty("/um/c"), err = this._validEmp(o);
			vm.setProperty("/um/c/vs", { nameAr: o.nameAr ? "None" : "Error", nameEn: o.nameEn ? "None" : "Error", email: EMAIL.test(o.email || "") ? "None" : "Error", team: o.team ? "None" : "Error" });
			if (err.length) { MessageBox.error(err.join("\n")); return; }
			this._addEmp(o, o.makeUser);
			this._audit(o.id, "Created manually" + (o.makeUser ? " and made a business user" : ""), "أُنشئ يدويًا" + (o.makeUser ? " وتحوّل لمستخدم" : ""));
			this.onCloseDlg(oEvent);
			this._refresh();
			MessageToast.show(this.text("um.t.created", [o.nameEn]));
		},

		/* CSV template and import: real parsing and per-row validation in the browser; nothing is created until Import. */
		onTemplate: function () {
			var csv = CSV_COLS.join(",") + "\nM-0100,اسم الموظف,Employee Name,employee.name@example.com,Job title,المسمى الوظيفي,t-mdm,mohamed@example.com\n";
			try {
				var a = document.createElement("a"), url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
				a.href = url; a.download = "repoio-employees-template.csv"; document.body.appendChild(a); a.click(); a.remove();
				setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
				MessageToast.show(this.text("um.t.template"));
			} catch (e) { MessageToast.show(this.text("um.t.downloadFail")); }
		},
		_import: function () {
			this.viewModel().setProperty("/um/imp", { rows: [], fileName: this.text("um.imp.noFile"), valid: 0, btnText: this.text("um.imp.btn", [0]) });
			this._dlg("umImportDlg").then(function (o) { o.open(); });
		},
		onImportChoose: function () {
			var that = this, inp = document.createElement("input");
			inp.type = "file"; inp.accept = ".csv,text/csv";
			inp.onchange = function () {
				var f = inp.files && inp.files[0]; if (!f) { return; }
				var r = new FileReader();
				r.onload = function () { that._parseCsv(f.name, String(r.result || "")); };
				r.readAsText(f, "utf-8");
			};
			inp.click();
		},
		_parseCsv: function (sName, sText) {
			var that = this, vm = this.viewModel(), d = this._d,
				lines = sText.replace(/^﻿/, "").split(/\r?\n/).filter(function (l) { return l.trim(); }),
				split = function (l) { var out = [], cur = "", q = false; for (var i = 0; i < l.length; i++) { var c = l[i]; if (c === "\"") { q = !q; } else if (c === "," && !q) { out.push(cur.trim()); cur = ""; } else { cur += c; } } out.push(cur.trim()); return out; },
				head = lines.length ? split(lines[0]).map(function (h) { return h.toLowerCase(); }) : [], rows = [], seenIds = {}, seenMail = {};
			var missing = CSV_COLS.filter(function (c) { return c !== "manager_email" && head.indexOf(c) < 0; });
			if (missing.length) {
				vm.setProperty("/um/imp", { rows: [], fileName: sName, valid: 0, btnText: this.text("um.imp.btn", [0]) });
				MessageBox.error(this.text("um.imp.badHeader", [missing.join(", ")]));
				return;
			}
			lines.slice(1).forEach(function (l, i) {
				var v = split(l), g = function (c) { return v[head.indexOf(c)] || ""; },
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

		/* Step 2: employee → business user, linked to Entra ID by email / UPN */
		onMaintainUser: function () {
			var that = this, d = this._d, items = this.byId("empTable").getSelectedItems().map(function (it) { return it.getBindingContext("view").getObject(); })
				.filter(function (r) { return !A.user(d, r.id); }).map(function (r) {
					var e = that._emp(r.id), l = e.source === "manual" ? "notFound" : "linked";
					return { id: e.id, name: e.name, nameText: that._pname(e.name), email: e.email, link: l, linkText: that.text("um.link." + l), linkState: LINK[l][0], linkIcon: LINK[l][1] };
				});
			this.viewModel().setProperty("/um/bu", { items: items, from: isoDate(this._now), to: "", intro: this.text("um.bu.intro", [items.length]), btnText: this.text("um.bu.btn", [items.length]) });
			this._dlg("umBuDlg").then(function (o) { o.open(); });
		},
		onMaintainUserSave: function (oEvent) {
			var that = this, b = this.viewModel().getProperty("/um/bu");
			if (b.to && b.to < b.from) { MessageBox.error(this.text("um.v.dates")); return; }
			b.items.forEach(function (it) {
				that._d.users.push({ employee: it.id, upn: it.email, link: it.link, validFrom: b.from, validTo: b.to || "", lastSignIn: "", direct: [] });
				that._audit(it.id, "Business user created (valid from " + b.from + ")", "إنشاء مستخدم (صالح من " + b.from + ")");
			});
			this.onCloseDlg(oEvent);
			this._refresh();
			MessageToast.show(this.text("um.t.usersCreated", [b.items.length]));
		},

		/* Business user details */
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
			var that = this, d = this._d, e = this._emp(this._ud), u = A.user(d, this._ud), p = People.get(e.name) || {}, l = LINK[u.link], s = SRC[e.source],
				eff = A.effective(d, this._idx, u, e);
			var roles = eff.map(function (x) {
				var r = A.role(d, x.role), via = x.type === "direct" ? that.text("um.via.direct") : that.text("um.via." + x.type, [that._t(x.unit)]);
				return { id: r.id, text: that._t(r), icon: r.icon, sensitive: r.sensitive, domainsText: that._domainsText(r), type: x.type,
					viaText: via, viaState: x.type === "direct" ? "Information" : "None", viaIcon: x.type === "direct" ? "sap-icon://person-placeholder" : A.TYPE_ICON[x.type],
					viaTip: x.also.length ? that.text("um.via.also", [x.also.map(function (a) { return a.type === "direct" ? that.text("um.via.direct") : that._t(a.unit); }).join(", ")]) : "" };
			});
			var hist = d.history.filter(function (h) { return h.user === that._ud; }).map(function (h) {
				return { text: that._ar() ? h.ar : h.en, meta: h.at.replace("T", " ").slice(0, 16) + " · " + (h.by === "sync" ? that.text("um.bySync") : that._pname(h.by)), icon: h.by === "sync" ? "sap-icon://synchronize" : "sap-icon://edit" };
			});
			this.viewModel().setProperty("/um/ud", {
				tab: sTab || this.viewModel().getProperty("/um/ud/tab") || "general",
				initials: p.initials || "?", nameText: this._pname(e.name), sub: (this._ar() ? e.title_ar : e.title_en) + " · " + this._unitPath(e.team),
				id: e.id, email: e.email, title: this._ar() ? e.title_ar : e.title_en, path: this._unitPath(e.team, true), manager: e.manager,
				sourceText: e.source === "manual" ? this.text("um.src.manual") : s[0], sourceState: s[1], sourceIcon: s[2],
				upn: u.upn, linkText: this.text("um.link." + u.link), linkState: l[0], linkIcon: l[1], linkNote: this.text("um.linkNote." + u.link),
				validFrom: u.validFrom, validTo: u.validTo, lastText: u.lastSignIn ? u.lastSignIn.replace("T", " ").slice(0, 16) : this.text("um.never"),
				roles: roles, history: hist
			});
		},
		onValidity: function () {
			var u = A.user(this._d, this._ud), ud = this.viewModel().getProperty("/um/ud");
			if (ud.validTo && ud.validTo < ud.validFrom) { MessageBox.error(this.text("um.v.dates")); this._fillUser(); return; }
			u.validFrom = ud.validFrom; u.validTo = ud.validTo || "";
			this._audit(this._ud, "Validity changed: " + u.validFrom + " → " + (u.validTo || "no end"), "تغيير الصلاحية: " + u.validFrom + " ← " + (u.validTo || "بلا نهاية"));
			this._fillUser(); this._apply();
			MessageToast.show(this.text("um.t.saved"));
		},
		onUserAddRole: function () {
			var that = this, u = A.user(this._d, this._ud), have = A.effective(this._d, this._idx, u, this._emp(this._ud)).filter(function (x) { return x.type === "direct"; }).map(function (x) { return x.role; });
			A.pickRoles(this, this._d.roles.filter(function (r) { return have.indexOf(r.id) < 0; }), this.text("um.ud.addRole"), function (aIds) {
				aIds.forEach(function (id) { u.direct.push(id); that._audit(that._ud, "Direct role added: " + A.role(that._d, id).en, "إضافة دور مباشر: " + A.role(that._d, id).ar); });
				that._fillUser("roles"); that._apply();
				MessageToast.show(that.text("um.t.rolesAdded", [aIds.length]));
			});
		},
		onUserRemoveRole: function (oEvent) {
			var that = this, r = oEvent.getSource().getBindingContext("view").getObject(), u = A.user(this._d, this._ud);
			MessageBox.confirm(this.text("um.ud.removeConfirm", [r.text]), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				u.direct = u.direct.filter(function (x) { return x !== r.id; });
				that._audit(that._ud, "Direct role removed: " + A.role(that._d, r.id).en, "إزالة دور مباشر: " + A.role(that._d, r.id).ar);
				that._fillUser("roles"); that._apply();
			} });
		},

		/* Org unit default roles (departments and teams; sensitive roles are user-only) */
		onUnitAddRole: function () {
			var that = this, k = this.viewModel().getProperty("/um/unit"), have = this._d.unitRoles[k] || [];
			A.pickRoles(this, this._d.roles.filter(function (r) { return !r.sensitive && have.indexOf(r.id) < 0; }), this.text("um.unit.addRoleTo", [this._t(this._idx[k].unit)]), function (aIds) {
				that._d.unitRoles[k] = have.concat(aIds);
				aIds.forEach(function (id) { that._audit("", "Role " + A.role(that._d, id).en + " assigned to " + that._idx[k].unit.en, "إسناد دور " + A.role(that._d, id).ar + " إلى " + that._idx[k].unit.ar); });
				that._unit(); that._apply();
				MessageToast.show(that.text("um.t.unitRoles", [A.underUnit(that._d, that._idx, k).length]));
			});
		},
		onUnitRemoveRole: function (oEvent) {
			var that = this, r = oEvent.getSource().getBindingContext("view").getObject(), k = this.viewModel().getProperty("/um/unit"),
				n = A.underUnit(this._d, this._idx, k).length;
			MessageBox.confirm(this.text("um.unit.removeConfirm", [r.text, n]), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				that._d.unitRoles[k] = (that._d.unitRoles[k] || []).filter(function (x) { return x !== r.id; });
				that._audit("", "Role " + A.role(that._d, r.id).en + " removed from " + that._idx[k].unit.en, "إزالة دور " + A.role(that._d, r.id).ar + " من " + that._idx[k].unit.ar);
				that._unit(); that._apply();
			} });
		},

		onRoleLink: function (oEvent) {
			var id = oEvent.getSource().getBindingContext("view").getProperty("id"), o = this.byId("umUserDlg");
			if (o && o.isOpen()) { this._noBack = true; o.close(); }
			this.router().navTo("roles", { role: id });
		}
	});
});
