sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, MessageToast, MessageBox) {
	"use strict";

	var FAV_KEY = "repoio-proto-rpt-favs",
		ME = "محمد",
		STATUS = { published: ["Success", "sap-icon://sys-enter-2"], draft: ["None", "sap-icon://edit"], inReview: ["Information", "sap-icon://pending"], retired: ["None", "sap-icon://locked"] },
		TYPE = { story: "sap-icon://business-objects-experience", alp: "sap-icon://table-chart" },
		COLL = [["all", "sap-icon://world"], ["recent", "sap-icon://history"], ["mine", "sap-icon://employee"], ["shared", "sap-icon://share-2"], ["fav", "sap-icon://favorite"]];

	/* Reports list (J14): analytical list reports and stories over governed data, Repository Explorer layout. */
	return BaseController.extend("repoio.proto.controller.ReportsList", {
		onInit: function () {
			this.viewModel().setProperty("/rl", { q: "", coll: "all", showFilters: true, rows: [], facets: [], active: 0, selected: 0, page: 1, size: 25 });
			this._sel = { type: {}, domain: {}, status: {} };
			this.router().getRoute("reports").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			var that = this, oM = this.getOwnerComponent().getModel("analytics");
			Promise.all([oM.dataLoaded(), this.data().dataLoaded()]).then(function () {
				var favs = that.store(FAV_KEY) || {};
				that._doms = that.data().getProperty("/domains");
				if (!that._all) {
					that._all = oM.getProperty("/reports").map(function (r) { return Object.assign({}, r, { fav: !!favs[r.id] }); });
				}
				that._apply(true);
			});
		},

		_coll: function (k) { return this.text(k === "mine" ? "rl.coll.mine" : "wl.coll." + k); },
		_dom: function (id) { return this._doms.filter(function (d) { return d.id === id; })[0]; },
		_inColl: function (r, c) {
			return c === "all" || (c === "recent" && r.changed >= "2026-11-03") || (c === "mine" && r.owner === ME) ||
				(c === "shared" && r.shared) || (c === "fav" && r.fav);
		},

		_apply: function (bResetPage) {
			var that = this, vm = this.viewModel(), ar = this.lang() === "ar", c = vm.getProperty("/rl/coll"),
				q = (vm.getProperty("/rl/q") || "").trim().toLowerCase(), sel = this._sel;
			var match = function (r, skip) {
				if (!that._inColl(r, c)) { return false; }
				if (q && [r.id, r.en, r.ar, r.source].join(" ").toLowerCase().indexOf(q) < 0) { return false; }
				return Object.keys(sel).every(function (k) { return k === skip || !Object.keys(sel[k]).length || sel[k][r[k]]; });
			};
			var rows = this._all.filter(function (r) { return match(r); })
				.sort(function (a, b) { return a.changed < b.changed ? 1 : -1; })
				.map(function (r) {
					var d = that._dom(r.domain), st = STATUS[r.status];
					return Object.assign({}, r, {
						title: ar ? r.ar : r.en, typeIcon: TYPE[r.type], typeText: that.text("rl.type." + r.type),
						domIcon: d.icon, domText: that.domainName(d),
						statusText: that.text("wl.st." + r.status), statusState: st[0], statusIcon: st[1],
						views: r.status === "published" ? that.fmt.num(r.views30) : "—", bc: r.broadcasts || "—"
					});
				});
			var facet = function (key, values) {
				return { key: key, title: that.text("rl.facet." + key), values: values.map(function (v) {
					return { key: v.key, text: v.text, icon: v.icon, selected: !!sel[key][v.key],
						count: that._all.filter(function (r) { return match(r, key) && r[key] === v.key; }).length };
				}) };
			};
			this._rows = rows;
			vm.setProperty("/rl/count", rows.length);
			if (bResetPage) { vm.setProperty("/rl/page", 1); }
			this._slice();
			vm.setProperty("/rl/collections", COLL.map(function (x) { return { key: x[0], icon: x[1], text: that._coll(x[0]), selected: x[0] === c }; }));
			vm.setProperty("/rl/collIcon", COLL.filter(function (x) { return x[0] === c; })[0][1]);
			vm.setProperty("/rl/scopeText", this._coll(c) + " (" + rows.length + ")");
			vm.setProperty("/rl/searchPh", this.text("wl.searchPh", [this._coll(c)]));
			vm.setProperty("/rl/active", Object.keys(sel).reduce(function (n, k) { return n + Object.keys(sel[k]).length; }, 0));
			vm.setProperty("/rl/facets", [
				facet("type", Object.keys(TYPE).map(function (k) { return { key: k, text: that.text("rl.type." + k), icon: TYPE[k] }; })),
				facet("domain", this._doms.map(function (d) { return { key: d.id, text: that.domainName(d), icon: d.icon }; })),
				facet("status", Object.keys(STATUS).map(function (k) { return { key: k, text: that.text("wl.st." + k), icon: STATUS[k][1] }; }))
			]);
			this.byId("rlTable").removeSelections(true);
			this.onSelect();
		},

		_slice: function () {
			var vm = this.viewModel(), p = vm.getProperty("/rl/page"), n = vm.getProperty("/rl/size");
			vm.setProperty("/rl/rows", (this._rows || []).slice((p - 1) * n, p * n));
		},
		onPage: function (oEvent) {
			var vm = this.viewModel();
			vm.setProperty("/rl/page", oEvent.getParameter("page"));
			vm.setProperty("/rl/size", oEvent.getParameter("pageSize"));
			this._slice();
		},
		onSearch: function () { this._apply(true); },
		onCollection: function (oEvent) {
			this.viewModel().setProperty("/rl/coll", oEvent.getParameter("listItem").getBindingContext("view").getProperty("key"));
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
		onClearFacets: function () { this._sel = { type: {}, domain: {}, status: {} }; this._apply(true); },

		_selected: function () { return this.byId("rlTable").getSelectedItems().map(function (i) { return i.getBindingContext("view").getObject(); }); },
		onSelect: function () {
			var s = this._selected(), vm = this.viewModel();
			vm.setProperty("/rl/selected", s.length);
			vm.setProperty("/rl/canDelete", s.length > 0 && s.every(function (r) { return r.status === "draft"; }));
			vm.setProperty("/rl/canRetire", s.length > 0 && s.every(function (r) { return r.status === "published"; }));
			vm.setProperty("/rl/canBroadcast", s.length === 1 && s[0].status === "published");
		},

		/* Stories open in the studio (view mode); analytical list reports open the ALP page. */
		_open: function (r, bEdit) {
			if (r.type === "story") { this.router().navTo("studio", { id: r.id, mode: bEdit ? "edit" : "view" }); }
			else if (bEdit) { this.router().navTo("studio", { id: r.id, mode: "edit" }); }
			else { this.router().navTo("report", { id: r.id }); }
		},
		onOpen: function (oEvent) { this._open(oEvent.getSource().getBindingContext("view").getObject(), false); },
		onEdit: function () { this._open(this._selected()[0], true); },
		onNewStory: function () { this.router().navTo("studio", { id: "new", mode: "edit" }); },
		onNewAlp: function () { MessageToast.show(this.text("rl.t.newAlp")); this.router().navTo("studio", { id: "new", mode: "edit" }); },
		onNewCopy: function () {
			var r = this._selected()[0];
			MessageToast.show(this.text("wl.t.copy", [r.title]));
			this._open(r, true);
		},
		onBroadcast: function () { this.router().navTo("broadcasts", { query: { report: this._selected()[0].id } }); },
		onExport: function () { MessageToast.show(this.text("rl.t.export", [this._selected()[0].id])); },
		onDelete: function () {
			var that = this, s = this._selected();
			MessageBox.warning(this.text("rl.deleteConfirm", [s.length]), {
				actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL], emphasizedAction: MessageBox.Action.DELETE,
				onClose: function (a) {
					if (a !== MessageBox.Action.DELETE) { return; }
					var ids = s.map(function (r) { return r.id; });
					that._all = that._all.filter(function (r) { return ids.indexOf(r.id) < 0; });
					MessageToast.show(that.text("rl.t.deleted", [ids.length]));
					that._apply(false);
				}
			});
		},
		/* Retiring a report also pauses its broadcasts (they would otherwise send a retired report). */
		onRetire: function () {
			var that = this, s = this._selected();
			MessageBox.confirm(this.text("rl.retireConfirm", [s.length]), {
				onClose: function (a) {
					if (a !== MessageBox.Action.OK) { return; }
					s.forEach(function (x) { that._all.filter(function (r) { return r.id === x.id; })[0].status = "retired"; });
					MessageToast.show(that.text("wl.t.retired", [s.length]));
					that._apply(false);
				}
			});
		},
		onFav: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(), favs = this.store(FAV_KEY) || {},
				r = this._all.filter(function (x) { return x.id === o.id; })[0];
			r.fav = !r.fav;
			if (r.fav) { favs[r.id] = true; } else { delete favs[r.id]; }
			this.store(FAV_KEY, favs);
			MessageToast.show(this.text(r.fav ? "cat.favAdded" : "cat.favRemoved", [o.title]));
			this._apply(false);
		}
	});
});
