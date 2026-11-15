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
		_audit: function (en, ar) {
			var n = new Date(this._d.now), p = function (x) { return (x < 10 ? "0" : "") + x; };
			this._d.history.unshift({ at: this._d.now.slice(0, 11) + p(n.getHours()) + ":" + p(n.getMinutes()) + ":00", by: ME, user: "", en: en, ar: ar });
		},

		_apply: function () {
			var that = this, vm = this.viewModel(), f = vm.getProperty("/ra"), q = (f.q || "").toLowerCase(), d = this._d;
			var rows = d.roles.filter(function (r) {
				if (f.dom && r.domains.indexOf("*") < 0 && r.domains.indexOf(f.dom) < 0) { return false; }
				if (f.kind === "sensitive" && !r.sensitive) { return false; }
				if (f.kind === "inherit" && r.sensitive) { return false; }
				return !q || [r.id, r.en, r.ar, r.desc_en, r.desc_ar].join(" ").toLowerCase().indexOf(q) > -1;
			}).map(function (r) {
				var h = A.holders(d, that._idx, r.id), a = that._assign(r), units = A.unitsWithRole(d, r.id).length;
				return { id: r.id, text: that._t(r), icon: r.icon, desc: that._ar() ? r.desc_ar : r.desc_en, domainsText: that._domainsText(r),
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
				this._pDlg = Fragment.load({ id: this.getView().getId(), name: "repoio.proto.fragment.RoleDetails", controller: this }).then(function (o) {
					that.getView().addDependent(o);
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
				domainsText: this._domainsText(r), assignText: a.text, assignIcon: a.icon, assignState: a.state, assignNote: a.note,
				usersText: this.text("ra.usersText", [h.length, h.filter(function (x) { return x.via.type === "direct"; }).length]),
				all: all, domCount: all ? this._doms.length : r.domains.length,
				domains: this._doms.map(function (x) { return { id: x.id, text: that.domainName(x), on: all || r.domains.indexOf(x.id) > -1 }; }),
				users: h.map(function (x) {
					return { id: x.emp.id, name: x.emp.name, nameText: that._pname(x.emp.name), type: x.via.type,
						unitText: that._idx[x.emp.team] ? that._idx[x.emp.team].path.slice(2).map(function (k) { return that._t(that._idx[k].unit); }).join(" › ") : "",
						viaText: x.via.type === "direct" ? that.text("um.via.direct") : that.text("um.via." + x.via.type, [that._t(x.via.unit)]),
						viaState: x.via.type === "direct" ? "Information" : "None", viaIcon: x.via.type === "direct" ? "sap-icon://person-placeholder" : A.TYPE_ICON[x.via.type] };
				}),
				units: A.unitsWithRole(d, r.id).map(function (k) {
					var u = that._idx[k].unit;
					return { id: k, text: that._t(u), path: that._unitPath(k), icon: A.TYPE_ICON[u.type], typeText: that.text("um.type." + u.type), people: A.underUnit(d, that._idx, k).length };
				})
			});
		},
		onClose: function () { this.byId("raDlg").close(); },

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
				ids.forEach(function (id) { A.user(d, id).direct.push(r.id); });
				that._audit("Role " + r.en + " assigned directly to " + ids.length + " user(s)", "إسناد الدور " + r.ar + " مباشرة إلى " + ids.length + " مستخدم");
				that._fill("users"); that._apply();
				MessageToast.show(that.text("ra.t.usersAdded", [ids.length]));
			});
		},
		onRemoveUser: function (oEvent) {
			var that = this, o = oEvent.getSource().getBindingContext("view").getObject(), r = A.role(this._d, this._role);
			MessageBox.confirm(this.text("ra.removeUserConfirm", [this._t(r), o.nameText]), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				var u = A.user(that._d, o.id); u.direct = u.direct.filter(function (x) { return x !== r.id; });
				that._audit("Direct role " + r.en + " removed from " + o.id, "إزالة الدور " + r.ar + " من " + o.id);
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
			MessageBox.confirm(this.text("um.unit.removeConfirm", [this._t(r), o.people]), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				that._d.unitRoles[o.id] = (that._d.unitRoles[o.id] || []).filter(function (x) { return x !== r.id; });
				that._audit("Role " + r.en + " removed from " + o.id, "إزالة الدور " + r.ar + " من " + o.id);
				that._fill("units"); that._apply();
			} });
		},
		onUnit: function (oEvent) {
			this.viewModel().setProperty("/umPending", oEvent.getSource().getBindingContext("view").getProperty("id"));
			this._noBack = true; this.byId("raDlg").close();
			this.router().navTo("users");
		}
	});
});
