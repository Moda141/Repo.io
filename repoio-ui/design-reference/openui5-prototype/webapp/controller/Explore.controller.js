sap.ui.define([
	"repoio/proto/controller/BaseController"
], function (BaseController) {
	"use strict";

	var ICON = { customers: "sap-icon://customer", products: "sap-icon://course-book", vendors: "sap-icon://supplier", authors: "sap-icon://edit", employees: "sap-icon://employee", stores: "sap-icon://retail-store" };
	var COLOR = { customers: "Accent6", products: "Accent4", vendors: "Accent8", authors: "Accent2", employees: "Accent5", stores: "Accent3" };

	/* J2 — search and browse golden records across granted domains (catalog-style facets). */
	return BaseController.extend("repoio.proto.controller.Explore", {
		onInit: function () {
			this.viewModel().setProperty("/lang", this.lang());
			this.viewModel().setProperty("/explore", { q: "", sort: "relevance", items: [], facets: [], active: 0 });
			this._sel = { domain: {}, repo: {}, source: {}, state: {}, quality: {} };
			this.router().getRoute("explore").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			var that = this;
			this.data().dataLoaded().then(function () { that._apply(); });
		},

		_records: function () {
			var that = this, domains = this.data().getProperty("/domains");
			return this.data().getProperty("/goldenIndex").map(function (r) {
				var d = domains.filter(function (x) { return x.id === r.domainId; })[0];
				return Object.assign({}, r, {
					domainName: that.domainName(d), icon: ICON[r.domainId], iconColor: COLOR[r.domainId],
					sourceNames: r.sources.map(function (s) { return s.name; }).join(" · "),
					qBand: r.quality >= 90 ? "high" : r.quality >= 75 ? "mid" : "low"
				});
			});
		},

		_apply: function () {
			var that = this, q = (this.viewModel().getProperty("/explore/q") || "").toLowerCase(), sel = this._sel, all = this._records();
			var keyOf = { domain: function (r) { return [r.domainId]; }, repo: function (r) { return [r.repoId]; }, source: function (r) { return r.sourceIds; },
				state: function (r) { return [r.stateKey]; }, quality: function (r) { return [r.qBand]; } };
			var matchQ = function (r) { return !q || [r.name, r.id, r.sub, r.repoName, r.city].join(" ").toLowerCase().indexOf(q) > -1; };
			var pass = function (r, except) {
				return Object.keys(sel).every(function (k) {
					if (k === except) { return true; }
					var on = Object.keys(sel[k]).filter(function (v) { return sel[k][v]; });
					return !on.length || keyOf[k](r).some(function (v) { return on.indexOf(v) > -1; });
				});
			};
			var items = all.filter(function (r) { return matchQ(r) && pass(r); });
			var sort = this.viewModel().getProperty("/explore/sort");
			items.sort(function (a, b) {
				return sort === "quality" ? b.quality - a.quality : sort === "merge" ? (b.lastMerge > a.lastMerge ? 1 : -1) :
					sort === "name" ? a.name.localeCompare(b.name) : (b.prob - a.prob) || (b.quality - a.quality);
			});
			// Facet counts reflect the other facets and the search (standard faceted search)
			var facet = function (key, title, values) {
				return { key: key, title: title, values: values.map(function (v) {
					var n = all.filter(function (r) { return matchQ(r) && pass(r, key) && keyOf[key](r).indexOf(v.key) > -1; }).length;
					return { key: v.key, text: v.text, count: n, selected: !!sel[key][v.key] };
				}).filter(function (v) { return v.count > 0 || v.selected; }) };
			};
			var domains = this.data().getProperty("/domains"), repos = this.data().getProperty("/repos"), sources = this.data().getProperty("/sources");
			var facets = [
				facet("domain", this.text("home.filter.domain"), domains.map(function (d) { return { key: d.id, text: that.domainName(d) }; })),
				facet("repo", this.text("repo.repository"), Object.keys(repos).map(function (r) { return { key: r, text: repos[r].name }; })),
				facet("source", this.text("exp.facet.source"), Object.keys(sources).map(function (s) { return { key: s, text: sources[s].name }; })),
				facet("state", this.text("domains.col.status"), ["pos", "crit", "neg", "neutral"].map(function (k) { return { key: k, text: that.text("golden." + k) }; })),
				facet("quality", this.text("domains.col.quality"), [{ key: "high", text: "≥ 90%" }, { key: "mid", text: "75–90%" }, { key: "low", text: "< 75%" }])
			];
			var active = Object.keys(sel).reduce(function (n, k) { return n + Object.keys(sel[k]).filter(function (v) { return sel[k][v]; }).length; }, 0);
			this.viewModel().setProperty("/explore/items", items);
			this.viewModel().setProperty("/explore/facets", facets);
			this.viewModel().setProperty("/explore/active", active);
			this.viewModel().setProperty("/explore/resultText", this.text("exp.results", [items.length]));
		},

		onSearch: function () { this._apply(); },
		onTry: function (e) { this.viewModel().setProperty("/explore/q", e.getSource().getText()); this._apply(); },
		onSort: function () { this._apply(); },
		onFacetChange: function (e) {
			var oList = e.getSource(), key = oList.getBindingContext("view").getProperty("key"), that = this;
			e.getParameter("listItems").forEach(function (li) {
				that._sel[key][li.getBindingContext("view").getProperty("key")] = li.getSelected();
			});
			this._apply();
		},
		onClearFacets: function () { this._sel = { domain: {}, repo: {}, source: {}, state: {}, quality: {} }; this._apply(); },
		onOpen: function (e) {
			this.router().navTo("record", { recordId: e.getSource().getBindingContext("view").getProperty("id") });
		}
	});
});
