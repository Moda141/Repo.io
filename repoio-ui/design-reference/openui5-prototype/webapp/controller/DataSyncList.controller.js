sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/sync",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, S, MessageToast, MessageBox) {
	"use strict";

	var ME = "محمد",
		COLL = [["all", "sap-icon://world"], ["mine", "sap-icon://employee"], ["attention", "sap-icon://alert"]];

	/* Data sync list (J9b): replication flows from a connection into a repository's raw layer. */
	return BaseController.extend("repoio.proto.controller.DataSyncList", {
		onInit: function () {
			this.viewModel().setProperty("/ds", { q: "", coll: "all", showFilters: true, rows: [], facets: [], active: 0, selected: 0, page: 1, size: 25 });
			this._sel = { conn: {}, domain: {}, status: {} };
			this.router().getRoute("dataSync").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			var that = this, oM = this.getOwnerComponent().getModel("sync");
			Promise.all([oM.dataLoaded(), this.data().dataLoaded()]).then(function () {
				that._all = oM.getProperty("/flows");
				that._apply(true);
			});
		},

		_attention: function (f) { return f.lastState === "failed" || f.lastState === "succeededWithFailures" || f.status === "changed"; },
		_apply: function (bResetPage) {
			var that = this, vm = this.viewModel(), ar = this.lang() === "ar", c = vm.getProperty("/ds/coll"),
				q = (vm.getProperty("/ds/q") || "").trim().toLowerCase(), sel = this._sel;
			var val = function (f, k) { return k === "domain" ? S.repo(that, f.repo).domainId : f[k]; };
			var match = function (f, skip) {
				if (!(c === "all" || (c === "mine" && f.owner === ME) || (c === "attention" && that._attention(f)))) { return false; }
				if (q && [f.id, f.en, f.ar, f.conn, f.repo].join(" ").toLowerCase().indexOf(q) < 0) { return false; }
				return Object.keys(sel).every(function (k) { return k === skip || !Object.keys(sel[k]).length || sel[k][val(f, k)]; });
			};
			var rows = this._all.filter(function (f) { return match(f); }).sort(function (a, b) { return a.changed < b.changed ? 1 : -1; }).map(function (f) {
				var conn = S.conn(that, f.conn), repo = S.repo(that, f.repo), d = S.dom(that, repo.domainId), st = S.STATUS[f.status], la = S.LAST[f.lastState];
				return Object.assign({}, f, {
					title: ar ? f.ar : f.en, connText: S.connText(that, conn), connIcon: S.icon(conn),
					repoText: repo.name, domIcon: d ? d.icon : "sap-icon://database", objCount: f.objects.length,
					loadText: S.load(that, f), intervalText: S.interval(that, f),
					statusText: that.text("ds.st." + f.status), statusState: st[0], statusIcon: st[1],
					lastText: la ? that.text("jr.st." + f.lastState) : that.text("ds.never"), lastState: la ? la[0] : "None", lastIcon: la ? la[1] : "",
					changedText: f.changed
				});
			});
			var facet = function (key, values) {
				return { key: key, title: that.text("ds.facet." + key), values: values.map(function (v) {
					return { key: v[0], text: v[1], icon: v[2], selected: !!sel[key][v[0]], count: that._all.filter(function (f) { return match(f, key) && val(f, key) === v[0]; }).length };
				}) };
			};
			this._rows = rows;
			vm.setProperty("/ds/count", rows.length);
			if (bResetPage) { vm.setProperty("/ds/page", 1); }
			this._slice();
			vm.setProperty("/ds/collections", COLL.map(function (x) { return { key: x[0], icon: x[1], text: that.text("ds.coll." + x[0]), selected: x[0] === c }; }));
			vm.setProperty("/ds/collIcon", COLL.filter(function (x) { return x[0] === c; })[0][1]);
			vm.setProperty("/ds/scopeText", this.text("ds.coll." + c) + " (" + rows.length + ")");
			vm.setProperty("/ds/searchPh", this.text("wl.searchPh", [this.text("ds.coll." + c)]));
			vm.setProperty("/ds/active", Object.keys(sel).reduce(function (n, k) { return n + Object.keys(sel[k]).length; }, 0));
			var conns = (this.data().getProperty("/connections") || []).map(function (x) { return [x.id, S.connText(that, x), S.icon(x)]; }),
				doms = (this.data().getProperty("/domains") || []).map(function (d) { return [d.id, that.domainName(d), d.icon]; });
			vm.setProperty("/ds/facets", [
				facet("conn", conns), facet("domain", doms),
				facet("status", Object.keys(S.STATUS).map(function (k) { return [k, that.text("ds.st." + k), S.STATUS[k][1]]; }))
			]);
			this.byId("dsTable").removeSelections(true);
			this.onSelect();
		},
		_slice: function () {
			var vm = this.viewModel(), p = vm.getProperty("/ds/page"), n = vm.getProperty("/ds/size");
			vm.setProperty("/ds/rows", (this._rows || []).slice((p - 1) * n, p * n));
		},
		onPage: function (oEvent) {
			var vm = this.viewModel();
			vm.setProperty("/ds/page", oEvent.getParameter("page"));
			vm.setProperty("/ds/size", oEvent.getParameter("pageSize"));
			this._slice();
		},
		onSearch: function () { this._apply(true); },
		onCollection: function (oEvent) {
			this.viewModel().setProperty("/ds/coll", oEvent.getParameter("listItem").getBindingContext("view").getProperty("key"));
			this._apply(true);
		},
		onFacetChange: function (oEvent) {
			var sel = this._sel[oEvent.getSource().data("facet")];
			oEvent.getParameter("listItems").forEach(function (li) {
				var v = li.getBindingContext("view").getProperty("key");
				if (li.getSelected()) { sel[v] = true; } else { delete sel[v]; }
			});
			this._apply(true);
		},
		onClearFacets: function () { this._sel = { conn: {}, domain: {}, status: {} }; this._apply(true); },

		_selected: function () {
			var all = this._all;
			return this.byId("dsTable").getSelectedItems().map(function (i) { var id = i.getBindingContext("view").getProperty("id"); return all.filter(function (f) { return f.id === id; })[0]; });
		},
		onSelect: function () {
			var s = this._selected(), vm = this.viewModel();
			vm.setProperty("/ds/selected", s.length);
			vm.setProperty("/ds/canDeploy", s.length > 0 && s.every(function (f) { return f.status === "draft" || f.status === "changed"; }));
			vm.setProperty("/ds/canRun", s.length > 0 && s.every(function (f) { return f.status === "deployed" || f.status === "changed"; }));
			vm.setProperty("/ds/canDelete", s.length > 0 && s.every(function (f) { return f.status === "draft"; }));
		},

		onOpen: function (oEvent) { this.router().navTo("dataSyncFlow", { id: oEvent.getSource().getBindingContext("view").getProperty("id") }); },
		onEdit: function () { this.router().navTo("dataSyncFlow", { id: this._selected()[0].id }); },
		onNew: function () { this.router().navTo("dataSyncFlow", { id: "new" }); },
		onConn: function (oEvent) { this.router().navTo("connections", { conn: oEvent.getSource().getBindingContext("view").getProperty("conn") }); },
		onDeploy: function () {
			var that = this, s = this._selected(), sync = this.getOwnerComponent().getModel("sync").getData(),
				bad = s.filter(function (f) { return S.validate(that, f, sync).some(function (m) { return m.type === "Error"; }); });
			if (bad.length) { MessageBox.error(this.text("ds.t.deployBlocked", [bad.map(function (f) { return f.id; }).join(", ")])); return; }
			s.forEach(function (f) { f.status = "deployed"; });
			MessageToast.show(this.text("ds.t.deployed", [s.length]));
			this._apply(false);
		},
		onRun: function () {
			var s = this._selected();
			s.forEach(function (f) { f.lastState = "running"; f.lastRun = "2026-11-11 13:50"; });
			MessageToast.show(this.text("ds.t.runStarted", [s.length]));
			this._apply(false);
		},
		onDelete: function () {
			var that = this, s = this._selected();
			MessageBox.warning(this.text("ds.deleteConfirm", [s.length]), {
				actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL], emphasizedAction: MessageBox.Action.DELETE,
				onClose: function (a) {
					if (a !== MessageBox.Action.DELETE) { return; }
					s.forEach(function (f) { that._all.splice(that._all.indexOf(f), 1); });
					MessageToast.show(that.text("ds.t.deleted", [s.length]));
					that._apply(false);
				}
			});
		}
	});
});
