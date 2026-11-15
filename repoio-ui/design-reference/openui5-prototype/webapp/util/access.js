/*
 * Access helpers for User management and Roles & access (ADR-0009).
 * In the product these answers come from the RBAC API; the console only displays them.
 *  - Org hierarchy: Org › Business unit › Department › Team.
 *  - Roles are assigned on a Department, a Team or a User; Department and Team roles are inherited downward.
 *  - Effective roles = direct ∪ team ∪ department. Sensitive roles are user-only.
 */
sap.ui.define(["sap/m/SelectDialog", "sap/m/StandardListItem"], function (SelectDialog, StandardListItem) {
	"use strict";

	var TYPE_ICON = { org: "sap-icon://building", bu: "sap-icon://org-chart", department: "sap-icon://group", team: "sap-icon://people-connected" };

	var A = {
		TYPE_ICON: TYPE_ICON,

		/* Flat index of units: id → { unit, parent ids, path }. */
		index: function (oOrg) {
			var idx = {};
			var walk = function (u, aParents) {
				idx[u.id] = { unit: u, parents: aParents.slice(), path: aParents.concat([u.id]) };
				(u.units || []).forEach(function (c) { walk(c, aParents.concat([u.id])); });
			};
			walk(oOrg, []);
			return idx;
		},

		unitText: function (u, bAr) { return u ? (bAr ? u.ar : u.en) : ""; },

		/* Department and team of an employee (team id is stored; its parent is the department). */
		placement: function (idx, sTeam) {
			var t = idx[sTeam];
			if (!t) { return { team: null, department: null, bu: null }; }
			var p = t.path;
			return { team: t.unit, department: idx[p[2]] && idx[p[2]].unit, bu: idx[p[1]] && idx[p[1]].unit };
		},

		/* Every role a user has, with where it comes from. Direct wins over inherited for display. */
		effective: function (d, idx, oUser, oEmp) {
			var out = [], seen = {}, pl = A.placement(idx, oEmp.team);
			var push = function (sRole, sType, oUnit) {
				if (seen[sRole]) { seen[sRole].also.push({ type: sType, unit: oUnit }); return; }
				var r = { role: sRole, type: sType, unit: oUnit, also: [] };
				seen[sRole] = r; out.push(r);
			};
			var today = (d.now || "").slice(0, 10), until = (oUser && oUser.until) || {};
			(oUser ? oUser.direct : []).forEach(function (r) {
				if (until[r] && until[r] < today) { return; } // time-bound role has ended
				push(r, "direct", null);
				seen[r].until = until[r] || "";
			});
			if (pl.team) { (d.unitRoles[pl.team.id] || []).forEach(function (r) { push(r, "team", pl.team); }); }
			if (pl.department) { (d.unitRoles[pl.department.id] || []).forEach(function (r) { push(r, "department", pl.department); }); }
			return out;
		},

		/* Sign-in status, strongest first: left › locked › expired › disabled › not found › active. */
		status: function (d, oUser, oEmp) {
			var today = (d.now || "").slice(0, 10);
			if (oEmp && oEmp.left) { return "left"; }
			if (oUser.locked) { return "locked"; }
			if (oUser.validTo && oUser.validTo < today) { return "expired"; }
			if (oUser.validFrom && oUser.validFrom > today) { return "notYet"; }
			if (oUser.link === "disabled") { return "disabled"; }
			if (oUser.link === "notFound") { return "notFound"; }
			return "active";
		},

		/* What a user can actually do: each permission with the domains it covers and the roles that grant it. */
		access: function (d, idx, oUser, oEmp) {
			var out = {};
			A.effective(d, idx, oUser, oEmp).forEach(function (x) {
				var r = A.role(d, x.role); if (!r) { return; }
				(r.perms || []).forEach(function (pid) {
					var o = out[pid] || (out[pid] = { perm: pid, domains: {}, roles: [] });
					r.domains.forEach(function (dm) { o.domains[dm] = true; });
					if (o.roles.indexOf(r.id) < 0) { o.roles.push(r.id); }
				});
			});
			return Object.keys(out).map(function (k) { return out[k]; });
		},

		/* Separation-of-duties conflicts for a user (warnings; the workflow still blocks self-approval). */
		conflicts: function (d, idx, oUser, oEmp) {
			var acc = {}, out = [];
			A.access(d, idx, oUser, oEmp).forEach(function (a) { acc[a.perm] = a; });
			(d.sod || []).forEach(function (rule) {
				var a = acc[rule.a], b = acc[rule.b];
				if (!a || !b) { return; }
				if (rule.sameDomain) {
					var all = function (x) { return !!x.domains["*"]; };
					var doms = Object.keys(a.domains).filter(function (k) { return k !== "*" && (b.domains[k] || all(b)); })
						.concat(all(a) ? Object.keys(b.domains).filter(function (k) { return k !== "*"; }) : []);
					if (all(a) && all(b)) { doms = ["*"]; }
					doms = doms.filter(function (x, i) { return doms.indexOf(x) === i; });
					if (doms.length) { out.push({ rule: rule, domains: doms, roles: a.roles.concat(b.roles) }); }
				} else {
					out.push({ rule: rule, domains: [], roles: a.roles.concat(b.roles) });
				}
			});
			return out;
		},

		/* Active users who can administer users and roles. Never let this reach zero. */
		admins: function (d, idx) {
			return d.users.filter(function (u) {
				var e = d.employees.filter(function (x) { return x.id === u.employee; })[0];
				if (!e || A.status(d, u, e) !== "active") { return false; }
				return A.access(d, idx, u, e).some(function (a) { return a.perm === "users.admin"; });
			}).length;
		},
		/* Try a change on a copy first; false when it would leave no active administrator. */
		keepsAdmin: function (d, idx, fnChange) {
			var copy = JSON.parse(JSON.stringify(d));
			fnChange(copy);
			return A.admins(copy, idx) > 0;
		},

		/* Employees placed under a unit (any depth). */
		underUnit: function (d, idx, sUnit) {
			return d.employees.filter(function (e) { var t = idx[e.team]; return !sUnit || (t && t.path.indexOf(sUnit) > -1); });
		},

		user: function (d, sEmp) { return d.users.filter(function (u) { return u.employee === sEmp; })[0]; },
		role: function (d, sRole) { return d.roles.filter(function (r) { return r.id === sRole; })[0]; },

		/* Users who hold a role, with the source of each assignment. */
		holders: function (d, idx, sRole) {
			var out = [];
			d.users.forEach(function (u) {
				var e = d.employees.filter(function (x) { return x.id === u.employee; })[0];
				if (!e || e.left) { return; }
				var hit = A.effective(d, idx, u, e).filter(function (x) { return x.role === sRole; })[0];
				if (hit) { out.push({ user: u, emp: e, via: hit }); }
			});
			return out;
		},

		/* Pick one or more entries (SelectDialog, searchable). Items: { id, title, description, icon, info }. fnDone gets the chosen ids. */
		pick: function (c, aItems, sTitle, fnDone, sNoData) {
			// The previous picker is destroyed only now: destroying it on close races with its growing list.
			if (c._oPick) { c._oPick.destroy(); }
			var o = c._oPick = new SelectDialog({
				title: sTitle, multiSelect: true, growing: false, rememberSelections: false, contentWidth: "30rem", noDataText: sNoData || c.text("ra.nothingLeft"),
				items: aItems.map(function (x) {
					return new StandardListItem({ title: x.title, description: x.description || "", icon: x.icon || "", info: x.info || "", infoState: "Warning" }).data("id", x.id);
				}),
				search: function (e) {
					var q = (e.getParameter("value") || "").toLowerCase();
					e.getSource().getItems().forEach(function (it) { it.setVisible(!q || (it.getTitle() + " " + it.getDescription()).toLowerCase().indexOf(q) > -1); });
				},
				confirm: function (e) {
					var ids = (e.getParameter("selectedItems") || []).map(function (it) { return it.data("id"); });
					if (ids.length) { fnDone(ids); }
				}
			});
			c.getView().addDependent(o);
			o.open();
		},

		/* Optional end date for a direct assignment (time-bound access). fnDone gets "" or yyyy-MM-dd. */
		askUntil: function (c, sTitle, sToday, fnDone) {
			sap.ui.require(["sap/m/Dialog", "sap/m/Button", "sap/m/Label", "sap/m/DatePicker", "sap/m/Text", "sap/m/VBox"], function (Dialog, Button, Label, DatePicker, Text, VBox) {
				var oDp = new DatePicker({ valueFormat: "yyyy-MM-dd", displayFormat: "yyyy-MM-dd", placeholder: c.text("um.f.noEnd"), width: "100%" });
				var oDlg = new Dialog({ title: sTitle, contentWidth: "24rem",
					content: [new VBox({ items: [new Label({ text: c.text("um.until.label"), labelFor: oDp }), oDp, new Text({ text: c.text("um.until.hint") }).addStyleClass("repoioUmMuted sapUiTinyMarginTop")] }).addStyleClass("sapUiSmallMargin")],
					beginButton: new Button({ text: c.text("um.until.assign"), type: "Emphasized", press: function () {
						var v = oDp.getValue();
						if (v && v <= sToday) { oDp.setValueState("Error"); return; }
						oDlg.close(); fnDone(v || "");
					} }),
					endButton: new Button({ text: c.text("common.cancel"), press: function () { oDlg.close(); } }),
					afterClose: function () { oDlg.destroy(); } });
				c.getView().addDependent(oDlg);
				oDlg.open();
			});
		},

		pickRoles: function (c, aRoles, sTitle, fnDone) {
			var ar = c.lang() === "ar";
			A.pick(c, aRoles.map(function (r) {
				return { id: r.id, title: ar ? r.ar : r.en, description: ar ? r.desc_ar : r.desc_en, icon: r.icon, info: r.sensitive ? c.text("ra.userOnly") : "" };
			}), sTitle, fnDone, c.text("ra.noMoreRoles"));
		},

		/* Org units that carry a role by default. */
		unitsWithRole: function (d, sRole) {
			return Object.keys(d.unitRoles).filter(function (k) { return d.unitRoles[k].indexOf(sRole) > -1; });
		}
	};
	return A;
});
