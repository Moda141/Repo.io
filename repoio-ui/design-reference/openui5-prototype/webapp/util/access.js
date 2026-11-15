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
			(oUser ? oUser.direct : []).forEach(function (r) { push(r, "direct", null); });
			if (pl.team) { (d.unitRoles[pl.team.id] || []).forEach(function (r) { push(r, "team", pl.team); }); }
			if (pl.department) { (d.unitRoles[pl.department.id] || []).forEach(function (r) { push(r, "department", pl.department); }); }
			return out;
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
				if (!e) { return; }
				var hit = A.effective(d, idx, u, e).filter(function (x) { return x.role === sRole; })[0];
				if (hit) { out.push({ user: u, emp: e, via: hit }); }
			});
			return out;
		},

		/* Pick one or more entries (SelectDialog, searchable). Items: { id, title, description, icon, info }. fnDone gets the chosen ids. */
		pick: function (c, aItems, sTitle, fnDone, sNoData) {
			var o = new SelectDialog({
				title: sTitle, multiSelect: true, rememberSelections: false, contentWidth: "30rem", noDataText: sNoData || c.text("ra.nothingLeft"),
				items: aItems.map(function (x) {
					return new StandardListItem({ title: x.title, description: x.description || "", icon: x.icon || "", info: x.info || "", infoState: "Warning" }).data("id", x.id);
				}),
				search: function (e) {
					var q = (e.getParameter("value") || "").toLowerCase();
					e.getSource().getItems().forEach(function (it) { it.setVisible(!q || (it.getTitle() + " " + it.getDescription()).toLowerCase().indexOf(q) > -1); });
				},
				confirm: function (e) {
					var ids = (e.getParameter("selectedItems") || []).map(function (it) { return it.data("id"); });
					setTimeout(function () { o.destroy(); }, 0);
					if (ids.length) { fnDone(ids); }
				},
				cancel: function () { setTimeout(function () { o.destroy(); }, 0); }
			});
			c.getView().addDependent(o);
			o.open();
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
