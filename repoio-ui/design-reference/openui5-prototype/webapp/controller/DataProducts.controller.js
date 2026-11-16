sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"repoio/proto/util/repoConnect"
], function (BaseController, MessageToast, RepoConnect) {
	"use strict";

	var FAV_KEY = "repoio-proto-dp-favs",
		STATUS = { Deployed: "published", Draft: "draft", Archived: "retired" },
		STATUS_STATE = { published: "Success", draft: "Information", retired: "None" },
		STATUS_ICON = { published: "sap-icon://sys-enter-2", draft: "sap-icon://edit", retired: "sap-icon://locked" },
		DOMAIN_COLOR = { customers: "Accent6", products: "Accent8", vendors: "Accent5", authors: "Accent3", employees: "Accent9", stores: "Accent2" },
		CLASS_STATE = { public: "Success", internal: "Information", confidential: "Warning" },
		FACETS = ["domain", "status", "source", "classification"];

	/* Data products catalog (SAP Business Data Cloud cockpit pattern, Repo.io look): one card per repository's published
	   golden table. Read only; "Connect" opens the repository connection details (ADR-0006). */
	return BaseController.extend("repoio.proto.controller.DataProducts", Object.assign({}, RepoConnect, {
		onInit: function () {
			this.viewModel().setProperty("/dp", { q: "", mode: this.store("repoio-dp-mode") || "cards", sort: "name", showFilters: true,
				items: [], facets: [], active: 0, kpis: [] });
			this._sel = { domain: {}, status: {}, source: {}, classification: {} };
			this.router().getRoute("dataProducts").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			var that = this, oP = this.getOwnerComponent().getModel("products");
			Promise.all([this.data().dataLoaded(), oP.dataLoaded()]).then(function () { that._build(); that._apply(); });
		},

		/* One entry per repository; the products model adds what the catalog knows (version, classification, refresh). */
		_build: function () {
			var that = this, D = this.data(), repos = D.getProperty("/repos"), sources = D.getProperty("/sources"), domains = D.getProperty("/domains"),
				P = this.getOwnerComponent().getModel("products").getProperty("/products"), favs = this.store(FAV_KEY) || {}, n = this.fmt.num, ar = this.lang() === "ar";
			this._domains = domains;
			this._sources = sources;
			this._all = Object.keys(repos).filter(function (k) { return P[k]; }).map(function (k) {
				var r = repos[k], p = P[k], st = STATUS[r.status] || "draft", d = domains.filter(function (x) { return x.id === r.domainId; })[0],
					pub = st !== "draft", srcNames = r.sourceIds.map(function (s) { return sources[s] ? sources[s].name : s; });
				var chips = [{ text: that.text("dp.class." + p.classification), state: CLASS_STATE[p.classification], icon: "sap-icon://shield", inv: false }];
				if (p.pii.length) { chips.push({ text: that.text("dp.pii"), state: "Warning", icon: "sap-icon://private", inv: true }); }
				r.tags.filter(function (t) { return /^Tier/.test(t); }).forEach(function (t) { chips.push({ text: t, state: "None", icon: "", inv: true }); });
				return {
					id: k, title: r.name, icon: d ? d.icon : "sap-icon://product", color: DOMAIN_COLOR[r.domainId] || "Accent6",
					domain: r.domainId, domainText: that.domainName(d), typeLine: that.text("dp.typeLine", [that.domainName(d)]),
					versionText: that.text("dp.version", [p.version]), desc: ar ? p.purposeAr : p.purposeEn,
					golden: pub ? r.golden : 0, goldenText: pub ? n(r.golden) : "—",
					quality: pub ? r.quality : 0, qualityText: pub ? that.fmt.pct(r.quality) : "—", qualityState: pub ? r.qualityState : "None",
					sources: r.sourceIds, sourceText: srcNames.join(" · "),
					status: st, statusText: that.text("dp.status." + st), statusState: STATUS_STATE[st], statusIcon: STATUS_ICON[st], published: st === "published",
					classification: p.classification, chips: chips,
					updated: p.refreshed || "", updatedText: p.refreshed ? that.text("dp.refreshedOn", [p.refreshed.slice(0, 10)]) : that.text("dp.notRefreshed"),
					fav: !!favs[k],
					search: [k, r.name, r.code, that.domainName(d), p.purposeEn, p.purposeAr, r.model].concat(srcNames).concat(r.tags).join(" ").toLowerCase()
				};
			});
		},

		_val: function (o, key) { return key === "source" ? o.sources : [o[key]]; },

		_apply: function () {
			var that = this, V = this.viewModel(), q = (V.getProperty("/dp/q") || "").toLowerCase(), sel = this._sel, sort = V.getProperty("/dp/sort");
			var match = function (o, skip) {
				if (q && o.search.indexOf(q) < 0) { return false; }
				return FACETS.every(function (f) {
					var keys = Object.keys(sel[f]);
					return f === skip || !keys.length || that._val(o, f).some(function (v) { return sel[f][v]; });
				});
			};
			var items = this._all.filter(function (o) { return match(o); });
			items.sort(function (a, b) {
				if (sort === "records") { return b.golden - a.golden; }
				if (sort === "quality") { return b.quality - a.quality; }
				if (sort === "updated") { return a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0; }
				return a.title.localeCompare(b.title);
			});
			var facet = function (key, values) {
				return { key: key, title: that.text("dp.facet." + key), values: values.map(function (v) {
					return { key: v.key, text: v.text, icon: v.icon || "", selected: !!sel[key][v.key],
						count: that._all.filter(function (o) { return match(o, key) && that._val(o, key).indexOf(v.key) > -1; }).length };
				}).filter(function (v) { return v.count || v.selected; }) };
			};
			V.setProperty("/dp/items", items);
			V.setProperty("/dp/active", FACETS.reduce(function (s, f) { return s + Object.keys(sel[f]).length; }, 0));
			V.setProperty("/dp/resultText", this.text("dp.results", [items.length]));
			V.setProperty("/dp/facets", [
				facet("domain", this._domains.map(function (d) { return { key: d.id, text: that.domainName(d), icon: d.icon }; })),
				facet("status", ["published", "draft", "retired"].map(function (k) { return { key: k, text: that.text("dp.status." + k), icon: STATUS_ICON[k] }; })),
				facet("source", Object.keys(this._sources).map(function (k) { return { key: k, text: that._sources[k].name, icon: "sap-icon://connected" }; })),
				facet("classification", ["public", "internal", "confidential"].map(function (k) { return { key: k, text: that.text("dp.class." + k), icon: "sap-icon://shield" }; }))
			]);
			var pub = this._all.filter(function (o) { return o.published; });
			V.setProperty("/dp/kpis", [
				{ label: this.text("dp.kpi.published"), value: String(pub.length), unit: "/ " + this._all.length, state: "None" },
				{ label: this.text("dp.kpi.records"), value: this.fmt.num(pub.reduce(function (s, o) { return s + o.golden; }, 0)), unit: "", state: "None" },
				{ label: this.text("dp.kpi.quality"), value: pub.length ? (pub.reduce(function (s, o) { return s + o.quality; }, 0) / pub.length).toFixed(1) : "—", unit: "%",
					state: "Warning" },
				{ label: this.text("dp.kpi.consumers"), value: String(this._consumers()), unit: "", state: "None" }
			]);
		},
		_consumers: function () {
			var P = this.getOwnerComponent().getModel("products").getProperty("/products");
			return Object.keys(P).reduce(function (s, k) { return s + P[k].consumers.length; }, 0);
		},

		onSearch: function () { this._apply(); },
		onSort: function () { this._apply(); },
		onFacetChange: function (e) {
			var key = e.getSource().data("facet"), sel = this._sel[key];
			e.getParameter("listItems").forEach(function (li) {
				var v = li.getBindingContext("view").getProperty("key");
				if (li.getSelected()) { sel[v] = true; } else { delete sel[v]; }
			});
			this._apply();
		},
		onClearFacets: function () { this._sel = { domain: {}, status: {}, source: {}, classification: {} }; this._apply(); },

		_ctx: function (e) { return e.getSource().getBindingContext("view").getObject(); },
		onOpen: function (e) { this.router().navTo("dataProduct", { id: this._ctx(e).id }); },
		onConnect: function (e) { this._openRepoConnect(this._ctx(e).id); },
		onFav: function (e) {
			var o = this._ctx(e), favs = this.store(FAV_KEY) || {};
			o.fav = !o.fav;
			if (o.fav) { favs[o.id] = true; } else { delete favs[o.id]; }
			this.store(FAV_KEY, favs);
			MessageToast.show(this.text(o.fav ? "cat.favAdded" : "cat.favRemoved", [o.title]));
			this.viewModel().refresh(true);
		},
		onExit: function () { this.store("repoio-dp-mode", this.viewModel().getProperty("/dp/mode")); }
	}));
});
