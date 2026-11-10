sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, MessageToast, MessageBox) {
	"use strict";

	var FAV_KEY = "repoio-proto-wf-favs",
		ME = "محمد",
		STATUS = { published: ["Success", "sap-icon://sys-enter-2"], draft: ["None", "sap-icon://edit"], inReview: ["Information", "sap-icon://pending"], retired: ["None", "sap-icon://locked"] },
		COLL = [["all", "sap-icon://world"], ["recent", "sap-icon://history"], ["mine", "sap-icon://employee"], ["shared", "sap-icon://share-2"], ["fav", "sap-icon://favorite"]];

	/* Workflows list (J7), laid out like the SAP Datasphere Repository Explorer. */
	return BaseController.extend("repoio.proto.controller.WorkflowsList", {
		onInit: function () {
			this.viewModel().setProperty("/wl", { q: "", coll: "all", showFilters: true, rows: [], facets: [], active: 0, selected: 0, page: 1, size: 25 });
			this._sel = { domain: {}, status: {}, writeback: {} };
			this.router().getRoute("workflows").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			var that = this, oM = this.getOwnerComponent().getModel("workflows");
			Promise.all([oM.dataLoaded(), this.data().dataLoaded()]).then(function () {
				var favs = that.store(FAV_KEY) || {};
				that._doms = that.data().getProperty("/domains");
				that._all = oM.getProperty("/workflows").map(function (w) { return Object.assign({}, w, { fav: !!favs[w.id] }); });
				that._apply(true);
			});
		},

		_dom: function (id) { return this._doms.filter(function (d) { return d.id === id; })[0]; },

		_inColl: function (w, c) {
			return c === "all" || (c === "recent" && w.changed >= "2026-11-03") || (c === "mine" && w.owner === ME) ||
				(c === "shared" && w.shared) || (c === "fav" && w.fav);
		},

		_apply: function (bResetPage) {
			var that = this, vm = this.viewModel(), ar = this.lang() === "ar", c = vm.getProperty("/wl/coll"),
				q = (vm.getProperty("/wl/q") || "").trim().toLowerCase(), sel = this._sel;
			var val = function (w, k) { return k === "writeback" ? (w.writeback || "none") : w[k]; };
			var match = function (w, skip) {
				if (!that._inColl(w, c)) { return false; }
				if (q && [w.id, w.en, w.ar, w.tpl_en, w.tpl_ar, w.template].join(" ").toLowerCase().indexOf(q) < 0) { return false; }
				return Object.keys(sel).every(function (k) { return k === skip || !Object.keys(sel[k]).length || sel[k][val(w, k)]; });
			};
			var rows = this._all.filter(function (w) { return match(w); })
				.sort(function (a, b) { return a.changed < b.changed ? 1 : -1; })
				.map(function (w) {
					var d = that._dom(w.domain), st = STATUS[w.status];
					return Object.assign({}, w, {
						title: ar ? w.ar : w.en, domIcon: d.icon, domText: that.domainName(d), tplText: ar ? w.tpl_ar : w.tpl_en,
						statusText: that.text("wl.st." + w.status), statusState: st[0], statusIcon: st[1],
						wbText: w.writeback ? that.text("wl.wb." + w.writeback) : "—", runs: w.status === "published" || w.status === "retired" ? that.fmt.num(w.runs30) : "—"
					});
				});
			var facet = function (key, values) {
				return { key: key, title: that.text("wl.facet." + key), values: values.map(function (v) {
					return { key: v.key, text: v.text, icon: v.icon, selected: !!sel[key][v.key],
						count: that._all.filter(function (w) { return match(w, key) && val(w, key) === v.key; }).length };
				}) };
			};
			this._rows = rows;
			vm.setProperty("/wl/count", rows.length);
			if (bResetPage) { vm.setProperty("/wl/page", 1); }
			this._slice();
			vm.setProperty("/wl/collections", COLL.map(function (x) { return { key: x[0], icon: x[1], text: that.text("wl.coll." + x[0]), selected: x[0] === c }; }));
			var cur = COLL.filter(function (x) { return x[0] === c; })[0];
			vm.setProperty("/wl/collIcon", cur[1]);
			vm.setProperty("/wl/scopeText", this.text("wl.coll." + c) + " (" + rows.length + ")");
			vm.setProperty("/wl/searchPh", this.text("wl.searchPh", [this.text("wl.coll." + c)]));
			vm.setProperty("/wl/active", Object.keys(sel).reduce(function (n, k) { return n + Object.keys(sel[k]).length; }, 0));
			vm.setProperty("/wl/facets", [
				facet("domain", this._doms.map(function (d) { return { key: d.id, text: that.domainName(d), icon: d.icon }; })),
				facet("status", Object.keys(STATUS).map(function (k) { return { key: k, text: that.text("wl.st." + k), icon: STATUS[k][1] }; })),
				facet("writeback", [["c4c", "sap-icon://upload-to-cloud"], ["erp", "sap-icon://upload-to-cloud"], ["none", "sap-icon://less"]].map(function (x) {
					return { key: x[0], text: that.text("wl.wb." + x[0]), icon: x[1] }; }))
			]);
			this.byId("wlTable").removeSelections(true);
			this.onSelect();
		},

		_slice: function () {
			var vm = this.viewModel(), p = vm.getProperty("/wl/page"), n = vm.getProperty("/wl/size");
			vm.setProperty("/wl/rows", (this._rows || []).slice((p - 1) * n, p * n));
		},
		onPage: function (oEvent) {
			var vm = this.viewModel();
			vm.setProperty("/wl/page", oEvent.getParameter("page"));
			vm.setProperty("/wl/size", oEvent.getParameter("pageSize"));
			this._slice();
		},

		onSearch: function () { this._apply(true); },
		onCollection: function (oEvent) {
			this.viewModel().setProperty("/wl/coll", oEvent.getParameter("listItem").getBindingContext("view").getProperty("key"));
			this._apply(true);
		},
		onFacetChange: function (oEvent) {
			var key = oEvent.getSource().data("facet"), sel = this._sel[key];
			oEvent.getParameter("listItems").forEach(function (li) {
				var v = li.getBindingContext("view").getProperty("key");
				if (li.getSelected()) { sel[v] = true; } else { delete sel[v]; }
			});
			this._apply(true);
		},
		onClearFacets: function () { this._sel = { domain: {}, status: {}, writeback: {} }; this._apply(true); },

		_selected: function () { return this.byId("wlTable").getSelectedItems().map(function (i) { return i.getBindingContext("view").getObject(); }); },
		onSelect: function () {
			var s = this._selected(), vm = this.viewModel();
			vm.setProperty("/wl/selected", s.length);
			vm.setProperty("/wl/canDelete", s.length > 0 && s.every(function (w) { return w.status === "draft"; }));
			vm.setProperty("/wl/canRetire", s.length > 0 && s.every(function (w) { return w.status === "published"; }));
		},

		onOpen: function () { this.router().navTo("workflow"); },
		onNewBlank: function () { this.router().navTo("workflow"); },
		onNewCopy: function () {
			MessageToast.show(this.text("wl.t.copy", [this._selected()[0].title]));
			this.router().navTo("workflow");
		},
		onEdit: function () {
			var w = this._selected()[0];
			if (w.status === "published") { MessageToast.show(this.text("wl.t.newVersion", [w.title])); }
			this.router().navTo("workflow");
		},
		onExport: function () { MessageToast.show(this.text("wl.t.export", [this._selected()[0].id])); },

		/* Drafts can be deleted; published workflows are retired (running instances finish on their version). */
		onDelete: function () {
			var that = this, s = this._selected();
			MessageBox.warning(this.text("wl.deleteConfirm", [s.length]), {
				actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL], emphasizedAction: MessageBox.Action.DELETE,
				onClose: function (a) {
					if (a !== MessageBox.Action.DELETE) { return; }
					var ids = s.map(function (w) { return w.id; });
					that._all = that._all.filter(function (w) { return ids.indexOf(w.id) < 0; });
					MessageToast.show(that.text("wl.t.deleted", [ids.length]));
					that._apply(false);
				}
			});
		},
		onRetire: function () {
			var that = this, s = this._selected();
			MessageBox.confirm(this.text("wl.retireConfirm", [s.length]), {
				onClose: function (a) {
					if (a !== MessageBox.Action.OK) { return; }
					s.forEach(function (x) { that._all.filter(function (w) { return w.id === x.id; })[0].status = "retired"; });
					MessageToast.show(that.text("wl.t.retired", [s.length]));
					that._apply(false);
				}
			});
		},

		onFav: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(), favs = this.store(FAV_KEY) || {},
				w = this._all.filter(function (x) { return x.id === o.id; })[0];
			w.fav = !w.fav;
			if (w.fav) { favs[w.id] = true; } else { delete favs[w.id]; }
			this.store(FAV_KEY, favs);
			MessageToast.show(this.text(w.fav ? "cat.favAdded" : "cat.favRemoved", [o.title]));
			this._apply(false);
		}
	});
});
