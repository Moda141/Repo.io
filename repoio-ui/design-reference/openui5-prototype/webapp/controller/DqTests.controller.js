sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"repoio/proto/util/dq",
	"repoio/proto/util/visualFilter"
], function (BaseController, MessageToast, MessageBox, DQ, VF) {
	"use strict";

	var EMPTY = function () { return { q: "", where: [], dims: [], results: [], sevs: [], authors: [], status: [] }; };
	var RESULTS = ["fail", "warn", "pass", "notRun"], SEVS = ["quarantine", "flag", "warn"], AUTHORS = ["builder", "python"],
		STATUS = ["active", "inReview", "draft", "disabled"];

	/* J10: Test cases, the list of data quality tests (analytical list layout). */
	return BaseController.extend("repoio.proto.controller.DqTests", {
		onInit: function () {
			this.viewModel().setProperty("/dq", { tab: "all", f: EMPTY(), filterMode: "visual", page: 1, size: 25, rows: [], active: 0 });
			this.router().getRoute("dqTests").attachPatternMatched(this._onMatched, this);
		},
		_onMatched: function (oEvent) {
			var that = this, q = (oEvent.getParameter("arguments") || {})["?query"] || {};
			DQ.load(this).then(function (m) {
				that._m = m;
				that._all = m.getProperty("/tests"); // shared with the detail page and the editor (new and changed tests show at once)
				// Links from other pages: ?where=customer-master, ?result=fail
				if (q.where || q.result) {
					var f = EMPTY();
					if (q.where) { f.where = [q.where]; }
					if (q.result) { f.results = [q.result]; }
					that.viewModel().setProperty("/dq/f", f);
					that.viewModel().setProperty("/dq/tab", "all");
				}
				that._refresh(true);
			});
		},

		_whereKey: function (t) { return t.level === "repository" ? t.repo : t.source; },
		_whereName: function (k) { var r = this.data().getProperty("/repos/" + k); return r ? r.name : DQ.SRC[k] || k; },
		/* A test passes the filters (skip = the facet being counted, so a visual filter shows what it would add) */
		_match: function (t, skip) {
			var f = this.viewModel().getProperty("/dq/f"), tab = this.viewModel().getProperty("/dq/tab"), q = (f.q || "").trim().toLowerCase();
			if (tab !== "all" && t.level !== tab) { return false; }
			if (q && [t.id, DQ.name(this, t), t.column, t.table, t.repo, t.source].join(" ").toLowerCase().indexOf(q) < 0) { return false; }
			var has = function (a, v) { return !a.length || a.indexOf(v) > -1; };
			return (skip === "where" || has(f.where, this._whereKey(t))) && (skip === "dims" || has(f.dims, t.dim)) &&
				(skip === "results" || has(f.results, DQ.result(t))) && (skip === "sevs" || has(f.sevs, t.severity)) &&
				(skip === "authors" || has(f.authors, t.author)) && (skip === "status" || has(f.status, t.status));
		},

		_refresh: function (bResetPage) {
			var that = this, T = this.text.bind(this), vm = this.viewModel(), f = vm.getProperty("/dq/f"), m = this._m;
			// Failing first, then the lowest pass rate: management by exception
			var order = { fail: 0, warn: 1, notRun: 3, pass: 2 };
			var rows = this._all.filter(function (t) { return that._match(t); }).map(function (t) { return DQ.row(that, m, t); })
				.sort(function (a, b) {
					var la = DQ.last(a), lb = DQ.last(b);
					return order[a.result] - order[b.result] || (la ? la.pass : 101) - (lb ? lb.pass : 101) || (a.id < b.id ? -1 : 1);
				});
			this._rows = rows;
			vm.setProperty("/dq/count", rows.length);
			if (bResetPage) { vm.setProperty("/dq/page", 1); }
			this._slice();

			var all = this._all, cnt = function (lvl) { return all.filter(function (t) { return lvl === "all" || t.level === lvl; }).length; },
				failing = all.filter(function (t) { return DQ.result(t) === "fail"; }).length;
			vm.setProperty("/dq/tabs", { all: T("dq.tab.all", [cnt("all")]), repository: T("dq.tab.repository", [cnt("repository")]), source: T("dq.tab.source", [cnt("source")]) });
			vm.setProperty("/dq/tabHint", T("dq.tabHint." + vm.getProperty("/dq/tab")));
			vm.setProperty("/dq/summary", T("dq.summary", [all.length, failing, m.getProperty("/now")]));
			vm.setProperty("/dq/listTitle", T("dq.listTitle", [rows.length]));
			var n = Object.keys(f).filter(function (k) { return k !== "q"; }).reduce(function (s, k) { return s + f[k].length; }, 0);
			vm.setProperty("/dq/active", n);
			vm.setProperty("/dq/clearText", T("md.clear", [n]));

			var wheres = {};
			all.forEach(function (t) { wheres[that._whereKey(t)] = t.level; });
			vm.setProperty("/dq/whereOpts", Object.keys(wheres).map(function (k) { return { key: k, text: that._whereName(k) }; }));
			vm.setProperty("/dq/dimOpts", m.getProperty("/dims").map(function (k) { return { key: k, text: T("dq.dim." + k) }; }));
			vm.setProperty("/dq/resOpts", RESULTS.map(function (k) { return { key: k, text: T("dq.res." + k) }; }));
			vm.setProperty("/dq/sevOpts", SEVS.map(function (k) { return { key: k, text: T("dq.sev." + k) }; }));
			vm.setProperty("/dq/authorOpts", AUTHORS.map(function (k) { return { key: k, text: T("dq.author." + k) }; }));
			vm.setProperty("/dq/statusOpts", STATUS.map(function (k) { return { key: k, text: T("dq.st." + k) }; }));
			this._charts();
			this.byId("dqTable").removeSelections(true);
			this.onSelect();
		},
		_slice: function () {
			var vm = this.viewModel(), p = vm.getProperty("/dq/page"), n = vm.getProperty("/dq/size");
			vm.setProperty("/dq/rows", (this._rows || []).slice((p - 1) * n, p * n));
		},
		onPage: function (oEvent) {
			var vm = this.viewModel();
			vm.setProperty("/dq/page", oEvent.getParameter("page"));
			vm.setProperty("/dq/size", oEvent.getParameter("pageSize"));
			this._slice();
		},

		/* Visual filters: result, dimension, where, authoring. Each counts the tests the other filters leave. */
		_charts: function () {
			var that = this, T = this.text.bind(this), C = this.colors, f = this.viewModel().getProperty("/dq/f"),
				cnt = function (dim, keyOf) { var o = {}; that._all.filter(function (t) { return that._match(t, dim); }).forEach(function (t) { var k = keyOf(t); o[k] = (o[k] || 0) + 1; }); return o; },
				res = cnt("results", function (t) { return DQ.result(t); }), dims = cnt("dims", function (t) { return t.dim; }),
				wh = cnt("where", function (t) { return that._whereKey(t); }), au = cnt("authors", function (t) { return t.author; });
			var resCol = { pass: C.pos, fail: C.neg, warn: C.crit, notRun: C.neutral };
			this.byId("vfDqRes").setOption(VF.donut(this, RESULTS.map(function (k) { return { key: k, name: T("dq.res." + k), value: res[k] || 0, color: resCol[k] }; })
				.filter(function (x) { return x.value || f.results.indexOf(x.key) > -1; }), f.results), true);
			this.byId("vfDqDim").setOption(VF.hbar(this, this._m.getProperty("/dims").map(function (k) { return { key: k, name: T("dq.dim." + k), value: dims[k] || 0, color: C.brand }; })
				.filter(function (x) { return x.value || f.dims.indexOf(x.key) > -1; }).sort(function (a, b) { return b.value - a.value; }), f.dims, { labelWidth: 96, empty: T("dq.none") }), true);
			this.byId("vfDqWhere").setOption(VF.hbar(this, Object.keys(wh).map(function (k) { return { key: k, name: that._whereName(k), value: wh[k], color: C.brand }; })
				.sort(function (a, b) { return b.value - a.value; }).slice(0, 6), f.where, { labelWidth: 120, empty: T("dq.none") }), true);
			this.byId("vfDqAuthor").setOption(VF.donut(this, AUTHORS.map(function (k) { return { key: k, name: T("dq.author." + k), value: au[k] || 0, color: k === "python" ? C.info : C.brand }; })
				.filter(function (x) { return x.value || f.authors.indexOf(x.key) > -1; }), f.authors), true);
		},
		onVfSelect: function (oEvent) {
			var d = oEvent.getParameter("data"), dim = oEvent.getSource().data("dim"), vm = this.viewModel();
			if (!d || !d.key) { return; }
			vm.setProperty("/dq/f/" + dim, VF.toggle(vm.getProperty("/dq/f/" + dim), d.key));
			this._refresh(true);
		},
		onFilter: function () { this._refresh(true); },
		onTab: function () { this._refresh(true); },
		onClear: function () { var q = this.viewModel().getProperty("/dq/f/q"), f = EMPTY(); f.q = q; this.viewModel().setProperty("/dq/f", f); this._refresh(true); },

		_selected: function () { return this.byId("dqTable").getSelectedItems().map(function (i) { return i.getBindingContext("view").getObject(); }); },
		onSelect: function () {
			var s = this._selected(), vm = this.viewModel(), T = this.text.bind(this),
				live = s.filter(function (t) { return t.status === "active" || t.status === "disabled"; });
			vm.setProperty("/dq/canRun", s.length > 0 && s.every(function (t) { return t.status === "active"; }));
			vm.setProperty("/dq/canToggle", s.length > 0 && live.length === s.length && (s.every(function (t) { return t.status === "active"; }) || s.every(function (t) { return t.status === "disabled"; })));
			vm.setProperty("/dq/toggleText", s.length && s[0].status === "disabled" ? T("dq.a.enable") : T("dq.a.disable"));
			vm.setProperty("/dq/canDelete", s.length > 0 && s.every(function (t) { return t.status === "draft"; }));
		},
		/* Running now queues a DQ run (the nightly DAG for source tables, a worker job for repository tests); the result
		   arrives with the run, not here. */
		onRun: function () { MessageToast.show(this.text("dq.t.run", [this._selected().length])); },
		onToggle: function () {
			var that = this, s = this._selected(), on = s[0].status === "disabled";
			s.forEach(function (x) { that._all.filter(function (t) { return t.id === x.id; })[0].status = on ? "active" : "disabled"; });
			MessageToast.show(this.text(on ? "dq.t.enabled" : "dq.t.disabled", [s.length]));
			this._refresh(false);
		},
		onDelete: function () {
			var that = this, s = this._selected();
			MessageBox.warning(this.text("dq.deleteConfirm", [s.length]), {
				actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL], emphasizedAction: MessageBox.Action.DELETE,
				onClose: function (a) {
					if (a !== MessageBox.Action.DELETE) { return; }
					var ids = s.map(function (t) { return t.id; });
					that._all = that._all.filter(function (t) { return ids.indexOf(t.id) < 0; });
					that._m.setProperty("/tests", that._all);
					MessageToast.show(that.text("dq.t.deleted", [ids.length]));
					that._refresh(false);
				}
			});
		},
		onOpen: function (oEvent) { this.router().navTo("dqTest", { id: oEvent.getSource().getBindingContext("view").getProperty("id") }); },
		onNewBuilder: function () { this.router().navTo("dqEdit", { id: "new", query: { mode: "builder" } }); },
		onNewPython: function () { this.router().navTo("dqEdit", { id: "new", query: { mode: "python" } }); },
		onAlerts: function () { this.router().navTo("dqAlerts"); }
	});
});
