sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/ResponsivePopover",
	"sap/m/VBox",
	"sap/m/Text",
	"sap/m/ObjectAttribute",
	"sap/m/ObjectStatus",
	"sap/m/Label",
	"sap/m/HBox",
	"repoio/proto/control/PersonLink"
], function (BaseController, MessageToast, ResponsivePopover, VBox, Text, ObjectAttribute, ObjectStatus, Label, HBox, PersonLink) {
	"use strict";

	var FAV_KEY = "repoio-proto-catalog-favs",
		TYPES = ["domain", "repository", "source", "table"],
		HEALTH = { Success: "healthy", Warning: "attention", Error: "attention", Information: "draft", None: "draft" };

	/* SAP Datasphere "Catalog" layout for master-data domains and their assets. */
	return BaseController.extend("repoio.proto.controller.Domains", {
		onInit: function () {
			this.viewModel().setProperty("/lang", this.lang());
			this.viewModel().setProperty("/cat", { tab: "all", q: "", mode: "cards", showFilters: false, items: [], facets: [], counts: {}, active: 0 });
			this._sel = { domain: {}, status: {} };
			this.router().getRoute("domains").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var sItem = oEvent.getParameter("arguments").item, that = this;
			this.data().dataLoaded().then(function () {
				that._build();
				if (sItem) { that.viewModel().setProperty("/cat/tab", "all"); that.viewModel().setProperty("/cat/q", sItem); }
				that._apply();
			});
		},

		/* One flat list of catalog assets: domains, repositories, data sources, source tables. */
		_build: function () {
			var that = this, D = this.data(), repos = D.getProperty("/repos"), sources = D.getProperty("/sources"),
				domains = D.getProperty("/domains"), favs = this.store(FAV_KEY) || {}, ar = this.lang() === "ar", n = this.fmt.num, all = [];
			var domName = function (id) { return that.domainName(domains.filter(function (d) { return d.id === id; })[0]); };
			var item = function (o) {
				o.people = o.people || []; o.owner = o.people[0] || ""; o.moreOwners = o.people.length > 1 ? "+" + (o.people.length - 1) : "";
				o.fav = !!favs[o.id]; o.typeText = that.text("cat.type." + o.type);
				o.statusText = that.text(o.statusKey === "empty" ? "domains.noRepo" : "health." + o.statusKey);
				o.search = [o.id, o.title, o.context, o.desc].concat(o.people).join(" ").toLowerCase();
				all.push(o);
			};
			domains.forEach(function (d) {
				var attention = d.repos.some(function (r) { return ["Warning", "Error"].indexOf(repos[r].healthState) > -1; });
				item({ id: "domain:" + d.id, type: "domain", icon: d.icon, title: that.domainName(d), context: ar ? d.teamAr : d.team,
					desc: ar ? d.desc : d.descEn, domains: [d.id], updated: d.updated,
					statusKey: !d.repoCount ? "empty" : attention ? "attention" : "healthy", state: !d.repoCount ? "None" : attention ? "Warning" : "Success",
					facts: [["home.filter.domain", d.nameEn], ["domains.col.repos", d.repoCount], ["domains.col.golden", n(d.golden)],
						["domains.col.quality", d.quality === null ? "—" : that.fmt.pct(d.quality)], ["domains.col.team", ar ? d.teamAr : d.team]], people: [d.owner] });
			});
			Object.keys(repos).forEach(function (k) {
				var r = repos[k];
				item({ id: "repository:" + k, type: "repository", icon: "sap-icon://badge", title: r.name, context: domName(r.domainId),
					desc: that.text("cat.repoDesc", [r.model, n(r.golden), r.sourceIds.length]), domains: [r.domainId], updated: r.deployed,
					statusKey: r.healthKey === "archived" ? "archived" : r.healthKey, state: r.healthState,
					facts: [["dsp.technicalName", r.code], ["repo.model", r.model], ["repo.golden", n(r.golden)], ["domains.col.quality", that.fmt.pct(r.quality)],
						["cat.tags", r.tags.join(" · ")]], people: r.owners.map(function (o) { return o.name; }) });
			});
			Object.keys(sources).forEach(function (k) {
				var s = sources[k], used = Object.keys(repos).filter(function (r) { return repos[r].sourceIds.indexOf(k) > -1; }),
					doms = used.map(function (r) { return repos[r].domainId; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
				item({ id: "source:" + k, type: "source", icon: "sap-icon://connected", title: s.name, context: s.type,
					desc: that.text("cat.sourceDesc", [used.length, s.tables.length, s.sync]), domains: doms, updated: s.sync,
					statusKey: HEALTH[s.state] === "draft" ? "healthy" : HEALTH[s.state], state: s.state === "None" ? "Success" : s.state,
					facts: [["repo.connector", s.type], ["src.host", s.host], ["src.auth", s.auth], ["src.schedule", s.schedule], ["repo.lastSync", s.sync],
						["src.reposUsing", used.map(function (r) { return repos[r].name; }).join("، ")]], people: [s.owner] });
				s.tables.forEach(function (t) {
					var tdoms = t.usedIn.map(function (u) { return repos[u.id] && repos[u.id].domainId; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
					item({ id: "table:" + k + "." + t.schema + "." + t.id, type: "table", icon: "sap-icon://table-view", title: t.name, context: s.name,
						desc: that.text("cat.tableDesc", [n(t.rows), t.cols, that.fmt.pct(t.quality)]), domains: tdoms, updated: t.profiled,
						statusKey: t.usedIn.length ? HEALTH[t.qualityState] : "draft", state: t.usedIn.length ? t.qualityState : "None",
						facts: [["src.schemaName", t.schema], ["repo.rows", n(t.rows)], ["src.columns", t.cols], ["domains.col.quality", that.fmt.pct(t.quality)],
							["src.profiled", t.profiled], ["src.usedIn", t.usedIn.length ? t.usedIn.map(function (u) { return u.name; }).join("، ") : that.text("src.notUsed")]], people: [s.owner] });
				});
			});
			this._all = all;
			this._domains = domains;
		},

		_apply: function () {
			var that = this, V = this.viewModel(), tab = V.getProperty("/cat/tab"), q = (V.getProperty("/cat/q") || "").toLowerCase(), sel = this._sel;
			var match = function (o, skip) {
				if (q && o.search.indexOf(q) < 0) { return false; }
				if (skip !== "domain" && Object.keys(sel.domain).length && !o.domains.some(function (d) { return sel.domain[d]; })) { return false; }
				if (skip !== "status" && Object.keys(sel.status).length && !sel.status[o.statusKey]) { return false; }
				return true;
			};
			var base = this._all.filter(function (o) { return match(o); });
			var counts = { all: base.length, fav: base.filter(function (o) { return o.fav; }).length };
			TYPES.forEach(function (t) { counts[t] = base.filter(function (o) { return o.type === t; }).length; });
			var items = tab === "all" ? base : tab === "fav" ? base.filter(function (o) { return o.fav; }) :
				tab === "recent" ? base.slice().sort(function (a, b) { return a.updated < b.updated ? 1 : -1; }).slice(0, 8) :
					base.filter(function (o) { return o.type === tab; });
			var inTab = function (o) { return tab === "all" || tab === "recent" || (tab === "fav" ? o.fav : o.type === tab); };
			var facet = function (key, values) {
				return { key: key, title: that.text(key === "domain" ? "home.filter.domain" : "domains.col.status"),
					values: values.map(function (v) {
						return { key: v.key, text: v.text, icon: v.icon, selected: !!sel[key][v.key],
							count: (that._all.filter(function (o) { return inTab(o) && match(o, key) && (key === "domain" ? o.domains.indexOf(v.key) > -1 : o.statusKey === v.key); }).length) };
					}) };
			};
			V.setProperty("/cat/items", items);
			V.setProperty("/cat/counts", counts);
			V.setProperty("/cat/active", Object.keys(sel.domain).length + Object.keys(sel.status).length);
			V.setProperty("/cat/resultText", this.text("cat.results", [items.length]));
			V.setProperty("/cat/facets", [
				facet("domain", this._domains.map(function (d) { return { key: d.id, text: that.domainName(d), icon: d.icon }; })),
				facet("status", ["healthy", "attention", "draft", "archived", "empty"].map(function (k) {
					return { key: k, text: that.text(k === "empty" ? "domains.noRepo" : "health." + k),
						icon: { healthy: "sap-icon://sys-enter-2", attention: "sap-icon://alert", draft: "sap-icon://edit", archived: "sap-icon://locked", empty: "sap-icon://less" }[k] }; }))
			]);
		},

		onTab: function () { this._apply(); },
		onScope: function () { this._apply(); },
		onSearch: function () { this._apply(); },
		onFacetChange: function (e) {
			var key = e.getSource().data("facet"), sel = this._sel[key];
			e.getParameter("listItems").forEach(function (li) {
				var v = li.getBindingContext("view").getProperty("key");
				if (li.getSelected()) { sel[v] = true; } else { delete sel[v]; }
			});
			this._apply();
		},
		onClearFacets: function () { this._sel = { domain: {}, status: {} }; this._apply(); },
		onRefresh: function () { this._build(); this._apply(); MessageToast.show(this.text("cat.refreshed")); },

		_ctx: function (e) { return e.getSource().getBindingContext("view").getObject(); },

		onFav: function (e) {
			var o = this._ctx(e), favs = this.store(FAV_KEY) || {};
			o.fav = !o.fav;
			if (o.fav) { favs[o.id] = true; } else { delete favs[o.id]; }
			this.store(FAV_KEY, favs);
			MessageToast.show(this.text(o.fav ? "cat.favAdded" : "cat.favRemoved", [o.title]));
			this._apply();
		},

		onCopyLink: function (e) {
			var o = this._ctx(e), that = this,
				url = window.location.href.split("#")[0] + "#/domains/" + encodeURIComponent(o.id);
			var done = function () { MessageToast.show(that.text("cat.linkCopied")); };
			try { navigator.clipboard.writeText(url).then(done, done); } catch (err) { done(); }
		},

		/* Quick view of an asset (no detail pages in this prototype scope). */
		onOpen: function (e) {
			var o = this._ctx(e), that = this, oBox = new VBox().addStyleClass("sapUiSmallMargin");
			oBox.addItem(new ObjectStatus({ text: o.typeText + " · " + o.statusText, state: o.state }).addStyleClass("sapUiTinyMarginBottom"));
			oBox.addItem(new Text({ text: o.desc }).addStyleClass("sapUiSmallMarginBottom"));
			o.facts.forEach(function (f) { oBox.addItem(new ObjectAttribute({ title: that.text(f[0]), text: String(f[1]) })); });
			if (o.people.length) {
				oBox.addItem(new Label({ text: that.text(o.people.length > 1 ? "repo.owners" : "domain.owner") }).addStyleClass("sapUiSmallMarginTop sapUiTinyMarginBottom"));
				oBox.addItem(new HBox({ items: o.people.map(function (n) { return new PersonLink({ name: n }).addStyleClass("sapUiTinyMarginEnd"); }) }));
			}
			var oPop = new ResponsivePopover({ title: o.title, contentWidth: "22rem", placement: "Auto", content: [oBox],
				afterClose: function () { oPop.destroy(); } });
			this.getView().addDependent(oPop);
			oPop.openBy(e.getSource());
		}
	});
});
