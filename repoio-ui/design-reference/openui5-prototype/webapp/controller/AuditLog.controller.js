sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/people",
	"sap/m/MessageToast"
], function (BaseController, People, MessageToast) {
	"use strict";

	var AREA = { analytics: "sap-icon://business-objects-experience", users: "sap-icon://employee", data: "sap-icon://database", workflow: "sap-icon://workflow-tasks", integration: "sap-icon://chain-link", system: "sap-icon://action-settings", auth: "sap-icon://shield" },
		BAD = ["denied", "delete", "retire", "lock"], GOOD = ["approve", "publish", "create", "issue"],
		SYS = { system: "sap-icon://it-system", sync: "sap-icon://synchronize", anonymous: "sap-icon://question-mark" };

	var csvCell = function (v) { v = String(v === undefined || v === null ? "" : v); return /[",\n]/.test(v) ? "\"" + v.replace(/"/g, "\"\"") + "\"" : v; };
	var pad = function (n) { return (n < 10 ? "0" : "") + n; };
	var iso = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };

	/* Audit log: one read-only, append-only trail across the platform. In the product it is served by the audit API from the
	   control plane, filtered by the viewer's grants; this page never edits or deletes an entry. */
	return BaseController.extend("repoio.proto.controller.AuditLog", {
		onInit: function () {
			this.viewModel().setProperty("/au", { q: "", area: "all", actor: "", from: null, to: null, rows: [], actors: [], d: { diff: [] } });
			this.router().getRoute("audit").attachPatternMatched(this._onMatched, this);
		},
		_onMatched: function (oEvent) {
			var that = this, oA = this.getOwnerComponent().getModel("admin"), oU = this.getOwnerComponent().getModel("users"), q = oEvent.getParameter("arguments")["?query"] || {};
			Promise.all([oA.dataLoaded(), oU.dataLoaded()]).then(function () {
				that._a = oA.getData(); that._u = oU.getData();
				if (q.object) { that.viewModel().setProperty("/au/q", q.object); }
				that._apply();
			});
		},
		_ar: function () { return this.lang() === "ar"; },
		_pname: function (n) { var p = People.get(n); return p && !this._ar() ? p.en : n; },

		/* The admin trail plus the user-management history, merged and newest first. */
		_all: function () {
			var that = this, u = this._u;
			var fromUsers = (u.history || []).map(function (h) {
				var emp = h.user ? u.employees.filter(function (e) { return e.id === h.user; })[0] : null;
				return { ref: h.user && emp ? { route: "users", args: { user: emp.id } } : h.role ? { route: "roles", args: { role: h.role } } : null,
					at: h.at, actor: h.by, area: "users", action: h.by === "sync" ? "sync" : (h.role ? "assign" : "update"), type: h.role ? "role" : h.user ? "user" : "directory",
					object: [emp ? (People.get(emp.name) ? People.get(emp.name).en : emp.name) + " (" + emp.id + ")" : "", h.role || ""].filter(Boolean).join(" · ") || (h.by === "sync" ? "Directory" : "—"), en: h.en, ar: h.ar };
			});
			return this._a.audit.concat(fromUsers).sort(function (x, y) { return x.at < y.at ? 1 : -1; }).map(function (e, i) { e._i = i; return e; });
		},
		_row: function (e) {
			var person = !SYS[e.actor], act = e.action || "update";
			return { i: e._i, at: e.at, atText: e.at.replace("T", " ").slice(0, 16), actor: e.actor, person: person,
				actorText: person ? this._pname(e.actor) : this.text("au.actor." + e.actor), actorIcon: SYS[e.actor] || "",
				area: e.area, areaText: this.text("au.area." + e.area), areaIcon: AREA[e.area],
				action: act, actionText: this.text("au.act." + act), actionState: BAD.indexOf(act) > -1 ? "Error" : GOOD.indexOf(act) > -1 ? "Success" : "None",
				highlight: act === "denied" ? "Error" : "None",
				text: this._ar() ? e.ar : e.en, objectText: e.object || "", type: e.type, typeText: this.text("au.type." + (e.type || "other")),
				versionText: e.version ? "v" + e.version : "—", ip: e.ip || "",
				ref: e.ref || (e.type === "announcement" ? { route: "announcements", args: { id: e.object } } : null) };
		},
		_apply: function () {
			var that = this, vm = this.viewModel(), f = vm.getProperty("/au"), q = (f.q || "").toLowerCase(),
				from = f.from ? iso(f.from) : "", to = f.to ? iso(f.to) : "", all = this._all();
			this._rows = all.filter(function (e) {
				if (f.area !== "all" && e.area !== f.area) { return false; }
				if (f.actor && e.actor !== f.actor) { return false; }
				if (from && e.at.slice(0, 10) < from) { return false; }
				if (to && e.at.slice(0, 10) > to) { return false; }
				return !q || [e.en, e.ar, e.object, e.type, e.action, that._pname(e.actor)].join(" ").toLowerCase().indexOf(q) > -1;
			});
			var seen = {}, actors = [];
			all.forEach(function (e) { if (!seen[e.actor]) { seen[e.actor] = 1; actors.push({ key: e.actor, text: SYS[e.actor] ? that.text("au.actor." + e.actor) : that._pname(e.actor) }); } });
			vm.setProperty("/au/actors", actors);
			vm.setProperty("/au/rows", this._rows.map(this._row.bind(this)));
			vm.setProperty("/au/title", this.text("au.title", [this._rows.length]));
			vm.setProperty("/au/retText", this.text("au.retention", [this._a.system.retention.auditYears]));
		},
		onFilter: function () { this._apply(); },
		onClear: function () {
			var vm = this.viewModel();
			["q", "actor"].forEach(function (k) { vm.setProperty("/au/" + k, ""); });
			vm.setProperty("/au/area", "all"); vm.setProperty("/au/from", null); vm.setProperty("/au/to", null);
			this._apply();
		},
		onOpen: function (oEvent) {
			var r = oEvent.getSource().getBindingContext("view").getObject(), e = this._all().filter(function (x) { return x._i === r.i; })[0] || {},
				b = e.before || {}, a = e.after || {}, keys = Object.keys(b).concat(Object.keys(a)).filter(function (k, i, l) { return l.indexOf(k) === i; });
			var show = function (v) { return v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v); };
			this.viewModel().setProperty("/au/d", Object.assign({}, r, { title: r.actionText + " · " + r.typeText,
				diff: keys.map(function (k) { return { field: k, before: show(b[k]), after: show(a[k]) }; }) }));
			this.byId("auDlg").open();
		},
		onCloseDlg: function () { this.byId("auDlg").close(); },
		/* Open the object the entry is about (when it still has a page in the console). */
		onGoTo: function () {
			var r = this.viewModel().getProperty("/au/d/ref");
			this.byId("auDlg").close();
			if (r) { this.router().navTo(r.route, r.args || {}); }
		},
		onExport: function () {
			var that = this, lines = [["time", "actor", "area", "action", "type", "object", "version", "summary", "before", "after"].join(",")];
			this._rows.forEach(function (e) {
				lines.push([e.at, SYS[e.actor] ? e.actor : that._pname(e.actor), e.area, e.action, e.type, e.object, e.version || "", e.en,
					e.before ? JSON.stringify(e.before) : "", e.after ? JSON.stringify(e.after) : ""].map(csvCell).join(","));
			});
			try {
				var a = document.createElement("a"), url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" }));
				a.href = url; a.download = "repoio-audit-" + this._a.now.slice(0, 10) + ".csv"; document.body.appendChild(a); a.click(); a.remove();
				setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
				MessageToast.show(this.text("au.t.exported", [this._rows.length]));
			} catch (err) { MessageToast.show(this.text("um.t.downloadFail")); }
		}
	});
});
