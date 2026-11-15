sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/people",
	"repoio/proto/util/access",
	"sap/ui/core/Fragment",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, People, A, Fragment, MessageToast, MessageBox) {
	"use strict";

	var ME = "محمد";

	/* Roles & access (J17, ADR-0009): SAP IBP's Maintain Business Roles. Same records as User management —
	   a role assigned here shows up on the user's Assigned roles tab, and the reverse. */
	return BaseController.extend("repoio.proto.controller.RolesAccess", {
		onInit: function () {
			this.viewModel().setProperty("/ra", { q: "", dom: "", kind: "all", rows: [], d: { users: [], units: [], domains: [] } });
			this.router().getRoute("roles").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this, oM = this.getOwnerComponent().getModel("users"), sRole = oEvent.getParameter("arguments").role;
			Promise.all([oM.dataLoaded(), this.data().dataLoaded()]).then(function () {
				that._d = oM.getData(); that._idx = A.index(that._d.org);
				that._doms = that.data().getProperty("/domains") || [];
				that.viewModel().setProperty("/ra/domFilter", [{ key: "", text: that.text("ra.dom.any") }].concat(that._doms.map(function (x) { return { key: x.id, text: that.domainName(x) }; })));
				that._apply();
				if (sRole) { that._open(sRole); }
			});
		},

		_ar: function () { return this.lang() === "ar"; },
		_t: function (o) { return o ? (this._ar() ? o.ar : o.en) : ""; },
		_pname: function (n) { var p = People.get(n); return p && !this._ar() ? p.en : n; },
		_domainsText: function (r) {
			var that = this;
			if (r.domains.indexOf("*") > -1) { return this.text("ra.allDomains"); }
			return r.domains.map(function (id) { return that.domainName(that._doms.filter(function (x) { return x.id === id; })[0]); }).join(" · ");
		},
		_assign: function (r) {
			return r.sensitive ? { text: this.text("ra.userOnly"), icon: "sap-icon://locked", state: "Warning", note: this.text("ra.assign.userOnlyNote") }
				: { text: this.text("ra.assign.units"), icon: "sap-icon://org-chart", state: "None", note: this.text("ra.assign.unitsNote") };
		},
		_unitPath: function (k) { var that = this; return this._idx[k].path.slice(1).map(function (x) { return that._t(that._idx[x].unit); }).join(" › "); },
		_audit: function (en, ar, sUser) {
			var n = new Date(this._d.now), p = function (x) { return (x < 10 ? "0" : "") + x; };
			this._d.history.unshift({ at: this._d.now.slice(0, 11) + p(n.getHours()) + ":" + p(n.getMinutes()) + ":00", by: ME, user: sUser || "", role: this._role || "", en: en, ar: ar });
		},
		_today: function () { return (this._d.now || "").slice(0, 10); },
		_noAdminLeft: function () { MessageBox.error(this.text("um.v.lastAdmin")); },

		_apply: function () {
			var that = this, vm = this.viewModel(), f = vm.getProperty("/ra"), q = (f.q || "").toLowerCase(), d = this._d;
			var rows = d.roles.filter(function (r) {
				if (f.dom && r.domains.indexOf("*") < 0 && r.domains.indexOf(f.dom) < 0) { return false; }
				if (f.kind === "sensitive" && !r.sensitive) { return false; }
				if (f.kind === "inherit" && r.sensitive) { return false; }
				if (f.kind === "custom" && r.delivered) { return false; }
				return !q || [r.id, r.en, r.ar, r.desc_en, r.desc_ar].join(" ").toLowerCase().indexOf(q) > -1;
			}).map(function (r) {
				var h = A.holders(d, that._idx, r.id), a = that._assign(r), units = A.unitsWithRole(d, r.id).length;
				return { id: r.id, text: that._t(r), icon: r.icon, desc: that._ar() ? r.desc_ar : r.desc_en, domainsText: that._domainsText(r),
					typeText: that.text(r.delivered ? "ra.type.delivered" : "ra.type.custom"), typeState: r.delivered ? "None" : "Information",
					assignText: a.text, assignIcon: a.icon, assignState: a.state, users: h.length, units: r.sensitive ? "—" : units };
			});
			vm.setProperty("/ra/rows", rows);
			vm.setProperty("/ra/title", this.text("ra.title", [rows.length]));
		},
		onFilter: function () { this._apply(); },
		onUsers: function () { this.router().navTo("users"); },

		onOpen: function (oEvent) { this.router().navTo("roles", { role: oEvent.getSource().getBindingContext("view").getProperty("id") }, true); },
		_dlg: function () {
			var that = this;
			if (!this._pDlg) {
				this._pDlg = Fragment.load({ id: this.getView().getId(), name: "repoio.proto.fragment.RoleDetails", controller: this }).then(function (a) {
					a.forEach(function (x) { that.getView().addDependent(x); });
					var o = that.byId("raDlg");
					o.attachAfterClose(function () { if (!that._noBack && /^admin\/roles\/./.test(that.router().getHashChanger().getHash())) { that.router().navTo("roles", {}, true); } that._noBack = false; });
					return o;
				});
			}
			return this._pDlg;
		},
		_open: function (sRole) {
			if (!A.role(this._d, sRole)) { return; }
			this._role = sRole; this._fill("general");
			this._dlg().then(function (o) { if (!o.isOpen()) { o.open(); } });
		},
		_fill: function (sTab) {
			var that = this, d = this._d, r = A.role(d, this._role), a = this._assign(r), all = r.domains.indexOf("*") > -1,
				h = A.holders(d, this._idx, r.id);
			this.viewModel().setProperty("/ra/d", {
				tab: sTab || this.viewModel().getProperty("/ra/d/tab") || "general",
				id: r.id, text: this._t(r), icon: r.icon, desc: this._ar() ? r.desc_ar : r.desc_en, sensitive: r.sensitive,
				delivered: !!r.delivered, typeText: this.text(r.delivered ? "ra.type.delivered" : "ra.type.custom"), typeState: r.delivered ? "None" : "Information",
				permCount: (r.perms || []).length, pgroups: this._pgroups(r.perms || []),
				deleteTip: h.length ? this.text("ra.del.blocked", [h.length]) : this.text("ra.del.tip"),
				domainsText: this._domainsText(r), assignText: a.text, assignIcon: a.icon, assignState: a.state, assignNote: a.note,
				usersText: this.text("ra.usersText", [h.length, h.filter(function (x) { return x.via.type === "direct"; }).length]),
				all: all, domCount: all ? this._doms.length : r.domains.length,
				domains: this._doms.map(function (x) { return { id: x.id, text: that.domainName(x), on: all || r.domains.indexOf(x.id) > -1 }; }),
				users: h.map(function (x) {
					return { id: x.emp.id, name: x.emp.name, nameText: that._pname(x.emp.name), type: x.via.type,
						unitText: that._idx[x.emp.team] ? that._idx[x.emp.team].path.slice(2).map(function (k) { return that._t(that._idx[k].unit); }).join(" › ") : "",
						viaText: (x.via.type === "direct" ? that.text("um.via.direct") : that.text("um.via." + x.via.type, [that._t(x.via.unit)])) + (x.via.until ? " · " + that.text("um.until.short", [x.via.until]) : ""),
						viaState: x.via.until ? "Warning" : x.via.type === "direct" ? "Information" : "None",
						viaIcon: x.via.until ? "sap-icon://fob-watch" : x.via.type === "direct" ? "sap-icon://person-placeholder" : A.TYPE_ICON[x.via.type],
						statusText: that.text("um.st." + A.status(d, x.user, x.emp)), statusState: A.status(d, x.user, x.emp) === "active" ? "None" : "Error",
						blocked: A.status(d, x.user, x.emp) !== "active" };
				}),
				history: d.history.filter(function (hh) { return hh.role === r.id; }).map(function (hh) {
					return { text: that._ar() ? hh.ar : hh.en, meta: hh.at.replace("T", " ").slice(0, 16) + " · " + (hh.by === "sync" ? that.text("um.bySync") : that._pname(hh.by)), icon: hh.by === "sync" ? "sap-icon://synchronize" : "sap-icon://edit" };
				}),
				units: A.unitsWithRole(d, r.id).map(function (k) {
					var u = that._idx[k].unit;
					return { id: k, text: that._t(u), path: that._unitPath(k), icon: A.TYPE_ICON[u.type], typeText: that.text("um.type." + u.type), people: A.underUnit(d, that._idx, k).length };
				})
			});
		},
		onClose: function () { this.byId("raDlg").close(); },
		onPreviewRole: function () {
			var r = A.role(this._d, this._role);
			A.preview(this, this.text("ra.pv.titleRole", [this._t(r)]), r.perms || [], this._domainsText(r));
		},
		onRoleAudit: function () {
			this._noBack = true; this.byId("raDlg").close();
			this.router().navTo("audit", { query: { object: this._role } });
		},

		/* Domain grants */
		_saveDomains: function (a) {
			var r = A.role(this._d, this._role);
			r.domains = a;
			this._audit("Domain grants of " + r.en + " set to " + (a.join(", ") || "none"), "تعديل دومينات الدور " + r.ar);
			this._fill("domains"); this._apply();
			MessageToast.show(this.text("ra.t.domains"));
		},
		onDomainsAll: function (oEvent) {
			var on = oEvent.getParameter("selected"), cur = this.viewModel().getProperty("/ra/d/domains").filter(function (x) { return x.on; }).map(function (x) { return x.id; });
			this._saveDomains(on ? ["*"] : cur);
		},
		onDomain: function () {
			var a = this.viewModel().getProperty("/ra/d/domains").filter(function (x) { return x.on; }).map(function (x) { return x.id; });
			if (!a.length) { MessageBox.warning(this.text("ra.dom.none")); this._fill("domains"); return; }
			this._saveDomains(a);
		},

		/* Assigned users (direct) */
		onAddUsers: function () {
			var that = this, d = this._d, r = A.role(d, this._role);
			var cand = d.users.filter(function (u) { return u.direct.indexOf(r.id) < 0; }).map(function (u) {
				var e = d.employees.filter(function (x) { return x.id === u.employee; })[0];
				return { id: u.employee, title: that._pname(e.name), description: e.email, icon: "sap-icon://person-placeholder", info: u.link !== "linked" ? that.text("um.link." + u.link) : "" };
			});
			A.pick(this, cand, this.text("ra.addUsersTo", [this._t(r)]), function (ids) {
				A.askUntil(that, that.text("um.until.title"), that._today(), function (sUntil) {
					var conf = function () { return ids.filter(function (id) { var u = A.user(d, id), e = d.employees.filter(function (x) { return x.id === id; })[0]; return A.conflicts(d, that._idx, u, e).length; }); },
						before = conf();
					ids.forEach(function (id) {
						var u = A.user(d, id); u.direct.push(r.id); u.until = u.until || {}; if (sUntil) { u.until[r.id] = sUntil; }
						that._audit("Direct role " + r.en + " assigned" + (sUntil ? " until " + sUntil : ""), "إسناد الدور " + r.ar + " مباشرة" + (sUntil ? " حتى " + sUntil : ""), id);
					});
					that._fill("users"); that._apply();
					MessageToast.show(that.text("ra.t.usersAdded", [ids.length]));
					var hit = conf().filter(function (id) { return before.indexOf(id) < 0; });
					if (hit.length) { MessageBox.warning(that.text("um.sod.warn", [hit.map(function (id) { return that._pname(d.employees.filter(function (x) { return x.id === id; })[0].name); }).join(", ")])); }
				});
			});
		},
		onRemoveUser: function (oEvent) {
			var that = this, o = oEvent.getSource().getBindingContext("view").getObject(), r = A.role(this._d, this._role);
			if (!A.keepsAdmin(this._d, this._idx, function (c) { c.users.forEach(function (x) { if (x.employee === o.id) { x.direct = x.direct.filter(function (y) { return y !== r.id; }); } }); })) { this._noAdminLeft(); return; }
			MessageBox.confirm(this.text("ra.removeUserConfirm", [this._t(r), o.nameText]), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				var u = A.user(that._d, o.id); u.direct = u.direct.filter(function (x) { return x !== r.id; }); if (u.until) { delete u.until[r.id]; }
				that._audit("Direct role " + r.en + " removed", "إزالة الدور " + r.ar, o.id);
				that._fill("users"); that._apply();
			} });
		},
		onUser: function (oEvent) {
			this._noBack = true; this.byId("raDlg").close();
			this.router().navTo("users", { user: oEvent.getSource().getBindingContext("view").getProperty("id") });
		},

		/* Assigned org units (departments and teams; never for sensitive roles) */
		onAddUnits: function () {
			var that = this, d = this._d, r = A.role(d, this._role), have = A.unitsWithRole(d, r.id);
			if (r.sensitive) { return; }
			var cand = Object.keys(this._idx).filter(function (k) { var t = that._idx[k].unit.type; return (t === "department" || t === "team") && have.indexOf(k) < 0; })
				.map(function (k) { var u = that._idx[k].unit; return { id: k, title: that._t(u), description: that._unitPath(k), icon: A.TYPE_ICON[u.type], info: that.text("um.type." + u.type) }; });
			A.pick(this, cand, this.text("ra.addUnitsTo", [this._t(r)]), function (ids) {
				ids.forEach(function (k) { (d.unitRoles[k] = d.unitRoles[k] || []).push(r.id); });
				that._audit("Role " + r.en + " assigned to " + ids.length + " org unit(s)", "إسناد الدور " + r.ar + " إلى " + ids.length + " وحدة");
				that._fill("units"); that._apply();
				MessageToast.show(that.text("ra.t.unitsAdded", [ids.length]));
			});
		},
		onRemoveUnit: function (oEvent) {
			var that = this, o = oEvent.getSource().getBindingContext("view").getObject(), r = A.role(this._d, this._role);
			if (!A.keepsAdmin(this._d, this._idx, function (c) { c.unitRoles[o.id] = (c.unitRoles[o.id] || []).filter(function (x) { return x !== r.id; }); })) { this._noAdminLeft(); return; }
			MessageBox.confirm(this.text("um.unit.removeConfirm", [this._t(r), o.people]), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				that._d.unitRoles[o.id] = (that._d.unitRoles[o.id] || []).filter(function (x) { return x !== r.id; });
				that._audit("Role " + r.en + " removed from " + o.id, "إزالة الدور " + r.ar + " من " + o.id);
				that._fill("units"); that._apply();
			} });
		},
		/* ---------- permissions (fixed catalog from the server; sensitivity is derived, never chosen) ---------- */
		_sens: function (aPerms) { var d = this._d; return aPerms.some(function (id) { var p = d.permissions.filter(function (x) { return x.id === id; })[0]; return p && p.sensitive; }); },
		_pgroups: function (aOn) {
			var that = this, groups = [];
			this._d.permissions.forEach(function (p) {
				var g = groups.filter(function (x) { return x.key === p.group; })[0];
				if (!g) { g = { key: p.group, title: that.text("ra.pg." + p.group), perms: [] }; groups.push(g); }
				g.perms.push({ id: p.id, text: that._t(p), sensitive: !!p.sensitive, on: aOn.indexOf(p.id) > -1 });
			});
			return groups;
		},
		_picked: function (aGroups) { var out = []; aGroups.forEach(function (g) { g.perms.forEach(function (p) { if (p.on) { out.push(p.id); } }); }); return out; },
		onPerm: function () {
			var r = A.role(this._d, this._role), perms = this._picked(this.viewModel().getProperty("/ra/d/pgroups")), sens = this._sens(perms),
				units = A.unitsWithRole(this._d, r.id);
			if (!perms.length) { MessageBox.warning(this.text("ra.perm.none")); this._fill("perms"); return; }
			if (sens && units.length) { MessageBox.error(this.text("ra.perm.blockedUnits", [units.length])); this._fill("perms"); return; }
			if (!A.keepsAdmin(this._d, this._idx, function (c) { c.roles.forEach(function (x) { if (x.id === r.id) { x.perms = perms; } }); })) { this._noAdminLeft(); this._fill("perms"); return; }
			r.perms = perms; r.sensitive = sens;
			this._audit("Permissions of " + r.en + " set to " + perms.join(", "), "تعديل صلاحيات الدور " + r.ar);
			this._fill("perms"); this._apply();
			MessageToast.show(this.text(sens ? "ra.t.permsSensitive" : "ra.t.perms"));
		},

		/* ---------- create / copy / delete ---------- */
		onCreateRole: function () { this._newRole(""); },
		onCopyRole: function () { this._newRole(this._role); },
		_newRole: function (sFrom) {
			var that = this, vm = this.viewModel();
			vm.setProperty("/ra/n", { title: this.text("ra.create"), mode: sFrom ? "copy" : "blank", from: sFrom || this._d.roles[0].id, idTouched: false, vs: {},
				roles: this._d.roles.map(function (r) { return { key: r.id, text: that._t(r) }; }) });
			this._seed(sFrom);
			var go = function () { that._dlg().then(function () { that.byId("raNewDlg").open(); }); };
			var o = this.byId("raDlg");
			if (o && o.isOpen()) { this._noBack = true; o.close(); this.router().navTo("roles", {}, true); setTimeout(go, 300); } else { go(); }
		},
		_seed: function (sFrom) {
			var that = this, vm = this.viewModel(), r = sFrom ? A.role(this._d, sFrom) : null, all = r ? r.domains.indexOf("*") > -1 : false;
			vm.setProperty("/ra/n/en", r ? this.text("ra.n.copyName", [r.en]) : "");
			vm.setProperty("/ra/n/ar", r ? "نسخة من " + r.ar : "");
			vm.setProperty("/ra/n/desc_en", r ? r.desc_en : "");
			vm.setProperty("/ra/n/desc_ar", r ? r.desc_ar : "");
			vm.setProperty("/ra/n/all", all);
			vm.setProperty("/ra/n/domains", this._doms.map(function (x) { return { id: x.id, text: that.domainName(x), on: !!r && (all || r.domains.indexOf(x.id) > -1) }; }));
			vm.setProperty("/ra/n/pgroups", this._pgroups(r ? r.perms || [] : ["gr.read"]));
			vm.setProperty("/ra/n/sensitive", r ? this._sens(r.perms || []) : false);
			vm.setProperty("/ra/n/idTouched", false);
			this.onNewName();
		},
		onNewMode: function () { var vm = this.viewModel(); this._seed(vm.getProperty("/ra/n/mode") === "copy" ? vm.getProperty("/ra/n/from") : ""); },
		onNewFrom: function () { this._seed(this.viewModel().getProperty("/ra/n/from")); },
		onNewName: function () {
			var vm = this.viewModel();
			if (vm.getProperty("/ra/n/idTouched")) { return; }
			var id = String(vm.getProperty("/ra/n/en") || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
			vm.setProperty("/ra/n/id", id);
		},
		onNewId: function (oEvent) {
			var vm = this.viewModel(), v = String(oEvent.getParameter("value") || "").toUpperCase().replace(/[^A-Z0-9_]/g, "");
			vm.setProperty("/ra/n/id", v); vm.setProperty("/ra/n/idTouched", true);
		},
		onNewPerm: function () { this.viewModel().setProperty("/ra/n/sensitive", this._sens(this._picked(this.viewModel().getProperty("/ra/n/pgroups")))); },
		onNewCancel: function () { this.byId("raNewDlg").close(); },
		onNewSave: function () {
			var vm = this.viewModel(), n = vm.getProperty("/ra/n"), d = this._d, err = [], perms = this._picked(n.pgroups),
				doms = n.all ? ["*"] : n.domains.filter(function (x) { return x.on; }).map(function (x) { return x.id; }),
				idOk = /^[A-Z][A-Z0-9_]{2,39}$/.test(n.id || ""), idFree = !A.role(d, n.id);
			if (!n.en || !n.ar) { err.push(this.text("ra.v.name")); }
			if (!idOk) { err.push(this.text("ra.v.id")); } else if (!idFree) { err.push(this.text("ra.v.idDup")); }
			if (!doms.length) { err.push(this.text("ra.dom.none")); }
			if (!perms.length) { err.push(this.text("ra.perm.none")); }
			vm.setProperty("/ra/n/vs", { en: n.en ? "None" : "Error", ar: n.ar ? "None" : "Error", id: idOk && idFree ? "None" : "Error" });
			vm.setProperty("/ra/n/idMsg", !idOk ? this.text("ra.v.id") : !idFree ? this.text("ra.v.idDup") : "");
			if (err.length) { MessageBox.error(err.join("\n")); return; }
			var sens = this._sens(perms), src = n.mode === "copy" ? A.role(d, n.from) : null;
			d.roles.push({ id: n.id, en: n.en, ar: n.ar, desc_en: n.desc_en || "", desc_ar: n.desc_ar || "", domains: doms, perms: perms, sensitive: sens,
				icon: src ? src.icon : "sap-icon://role", delivered: false });
			this._audit("Role created: " + n.en + " (" + n.id + ")" + (src ? " as a copy of " + src.en : ""), "إنشاء دور: " + n.ar + (src ? " (نسخة من " + src.ar + ")" : ""));
			this.byId("raNewDlg").close();
			this._apply();
			MessageToast.show(this.text("ra.t.created", [n.en]));
			this.router().navTo("roles", { role: n.id }, true);
		},
		onDeleteRole: function () {
			var that = this, d = this._d, r = A.role(d, this._role);
			if (r.delivered || A.holders(d, this._idx, r.id).length) { return; }
			MessageBox.confirm(this.text("ra.del.confirm", [this._t(r)]), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				d.roles = d.roles.filter(function (x) { return x.id !== r.id; });
				Object.keys(d.unitRoles).forEach(function (k) { d.unitRoles[k] = d.unitRoles[k].filter(function (x) { return x !== r.id; }); });
				that._audit("Role deleted: " + r.en, "حذف الدور: " + r.ar);
				that.byId("raDlg").close();
				that._apply();
				MessageToast.show(that.text("ra.t.deleted", [that._t(r)]));
			} });
		},

		onUnit: function (oEvent) {
			this.viewModel().setProperty("/umPending", oEvent.getSource().getBindingContext("view").getProperty("id"));
			this._noBack = true; this.byId("raDlg").close();
			this.router().navTo("users");
		}
	});
});
