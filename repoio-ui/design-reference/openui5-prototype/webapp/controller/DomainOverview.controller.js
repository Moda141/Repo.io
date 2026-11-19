sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/semantic",
	"sap/m/MessageToast",
	"repoio/proto/util/createFlows"
], function (BaseController, Sem, MessageToast, Flows) {
	"use strict";

	/* Domain overview (SAP Fiori Overview Page). Reads the domain, its repositories and the stewardship queues, and
	   shows them as cards. Every figure here is a read model the API would return per domain and filter; the page
	   only aggregates the sample rows it is given and never changes data. */
	var HEALTH_ICON = { healthy: "sap-icon://sys-enter-2", attention: "sap-icon://alert", failed: "sap-icon://error",
		draft: "sap-icon://edit", archived: "sap-icon://locked" };
	var SEM_COLOR = { Success: "#5fae7c", Warning: "#e3a256", Error: "#df7a7a", None: "#5899da" };

	return BaseController.extend("repoio.proto.controller.DomainOverview", {
		onInit: function () {
			this.viewModel().setProperty("/do", { f: { repos: [], sources: [] }, c: {
				golden: { by: "repo" }, quality: { by: "repo" }, match: { by: "repo" }, qa: { by: "rule" }, src: {} } });
			this.router().getRoute("domain").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (e) {
			var that = this, id = e.getParameter("arguments").domain, st = this.getOwnerComponent().getModel("stewardship");
			Promise.all([this.data().dataLoaded(), st.dataLoaded()]).then(function () {
				var d = (that.data().getProperty("/domains") || []).filter(function (x) { return x.id === id; })[0];
				if (!d) { that.router().navTo("domains", {}, true); return; }
				if (that._id !== id) {
					that._id = id;
					that.viewModel().setProperty("/do/f", { repos: [], sources: [] });
				}
				that._d = d;
				that._st = st.getData();
				that._apply();
			});
		},

		_repos: function () {
			var all = this.data().getProperty("/repos") || {};
			return (this._d.repos || []).map(function (k) { return all[k]; }).filter(Boolean);
		},
		_srcName: function (k) { var s = this.data().getProperty("/sources/" + k); return s ? s.name : k; },

		_apply: function () {
			var that = this, T = this.text.bind(this), m = this.viewModel(), f = m.getProperty("/do/f"), d = this._d,
				all = this._repos(),
				repos = all.filter(function (r) {
					return (!f.repos.length || f.repos.indexOf(r.id) > -1) &&
						(!f.sources.length || r.sourceIds.some(function (s) { return f.sources.indexOf(s) > -1; }));
				}),
				repoIds = repos.map(function (r) { return r.id; }),
				srcIds = [];
			all.forEach(function (r) { r.sourceIds.forEach(function (s) { if (srcIds.indexOf(s) < 0) { srcIds.push(s); } }); });

			m.setProperty("/do/name", this.domainName(d));
			m.setProperty("/do/icon", d.icon);
			m.setProperty("/do/hasRepos", all.length > 0);
			m.setProperty("/do/summary", T("do.summary", [all.length, srcIds.length, this.fmt.num(d.golden)]));
			m.setProperty("/do/owner", d.owner);
			m.setProperty("/do/repoOpts", all.map(function (r) { return { key: r.id, text: r.name }; }));
			m.setProperty("/do/srcOpts", srcIds.map(function (s) { return { key: s, text: that._srcName(s) }; }));
			var nF = f.repos.length + f.sources.length;
			m.setProperty("/do/hasFilter", nF > 0);
			m.setProperty("/do/filterText", nF ? T("do.filtered", [repos.length, all.length]) : T("do.noFilter"));

			// Repositories list card: the name is a link to the repository page
			m.setProperty("/do/reposSub", T("do.reposSub", [repos.length]));
			m.setProperty("/do/repos", repos.map(function (r) {
				return { id: r.id, name: r.name, healthText: T("health." + r.healthKey),
					healthState: r.healthKey === "healthy" ? "Success" : r.healthState, healthIcon: HEALTH_ICON[r.healthKey] || "",
					meta: T("do.repoMeta", [that.fmt.num(r.golden), r.quality === null ? "—" : r.quality.toFixed(1) + "%", r.sourceIds.length]) };
			}));
			m.setProperty("/do/links", this._links(repos[0] || all[0]));

			this._golden(repos);
			this._quality(repos);
			this._match(repoIds);
			this._quarantine(repoIds, f.sources);
			this._sources(repos, f.sources);
		},

		/* K / M scale for a header number, like the Overview Page cards */
		_scaled: function (v) {
			if (v >= 1e6) { return { num: (v / 1e6).toFixed(v >= 1e7 ? 0 : 1), scale: "M" }; }
			if (v >= 1e3) { return { num: (v / 1e3).toFixed(v >= 1e4 ? 0 : 1), scale: "K" }; }
			return { num: String(v), scale: "" };
		},

		_golden: function (repos) {
			var that = this, T = this.text.bind(this), m = this.viewModel(), by = m.getProperty("/do/c/golden/by"),
				total = repos.reduce(function (a, r) { return a + r.golden; }, 0), rows;
			if (by === "source") {
				rows = this._sumBy(repos, function (r) { return (r.sourceRows || []).map(function (s) { return [s.id, s.rows]; }); })
					.map(function (x) { return { name: that._srcName(x[0]), v: x[1] }; });
			} else {
				rows = repos.map(function (r) { return { name: r.name, v: r.golden }; });
			}
			var s = this._scaled(total);
			m.setProperty("/do/c/golden", Object.assign(m.getProperty("/do/c/golden"), { num: s.num, scale: s.scale,
				sub: T("do.sortDesc"), chartTitle: by === "source" ? T("do.chart.sourceRows") : T("do.chart.golden"),
				option: this._bar(rows, null) }));
		},

		_quality: function (repos) {
			var that = this, T = this.text.bind(this), m = this.viewModel(), by = m.getProperty("/do/c/quality/by"),
				target = this.data().getProperty("/target") || 95, rows;
			// Weighted by golden records: a large repository counts more than an empty draft one
			var qr = repos.filter(function (r) { return r.quality !== null; }),
				w = qr.reduce(function (a, r) { return a + Math.max(r.golden, 1); }, 0),
				avg = qr.length ? qr.reduce(function (a, r) { return a + r.quality * Math.max(r.golden, 1); }, 0) / w : 0;
			if (by === "source") {
				var acc = {};
				qr.forEach(function (r) { (r.sourceRows || []).filter(function (s) { return s.quality !== null; }).forEach(function (s) {
					acc[s.id] = acc[s.id] || { q: 0, n: 0 }; acc[s.id].q += s.quality * s.rows; acc[s.id].n += s.rows; }); });
				rows = Object.keys(acc).map(function (k) { return { name: that._srcName(k), v: +(acc[k].q / Math.max(acc[k].n, 1)).toFixed(1) }; });
			} else {
				rows = qr.map(function (r) { return { name: r.name, v: r.quality }; });
			}
			var st = Sem.quality(avg);
			m.setProperty("/do/c/quality", Object.assign(m.getProperty("/do/c/quality"), {
				num: qr.length ? avg.toFixed(1) : "—", state: { Success: "Good", Warning: "Critical", Error: "Error" }[st] || "Neutral",
				trend: "None", target: String(target), gap: qr.length ? (avg - target).toFixed(1) : "—",
				sub: T("do.sortAsc"), details: T("do.c.qualityDetails"),
				chartTitle: by === "source" ? T("do.chart.qualitySource") : T("do.chart.qualityRepo"),
				option: this._bar(rows.sort(function (a, b) { return a.v - b.v; }), target, true) }));
		},

		_match: function (repoIds) {
			var T = this.text.bind(this), m = this.viewModel(), by = m.getProperty("/do/c/match/by"), s = this._st,
				items = [].concat(
					s.pairs.map(function (x) { return { repo: x.repo, kind: "pairs", age: x.age }; }),
					s.requests.map(function (x) { return { repo: x.repo, kind: "requests", age: x.age }; }),
					s.second.map(function (x) { return { repo: x.repo, kind: "second", age: x.age }; })
				).filter(function (x) { return repoIds.indexOf(x.repo) > -1; }),
				sla = s.slaDays || 3, over = items.filter(function (x) { return x.age > sla; }).length, rows, all = this.data().getProperty("/repos");
			if (by === "kind") {
				rows = ["pairs", "requests", "second"].map(function (k) {
					return { name: T("md.tab." + k), v: items.filter(function (x) { return x.kind === k; }).length }; });
			} else {
				rows = repoIds.map(function (r) { return { name: all[r].name, v: items.filter(function (x) { return x.repo === r; }).length }; });
			}
			m.setProperty("/do/c/match", Object.assign(m.getProperty("/do/c/match"), { num: String(items.length),
				state: over ? "Error" : items.length ? "Critical" : "Good",
				details: over ? T("do.c.matchOver", [over, sla]) : T("do.c.matchDetails"), sub: T("do.sortDesc"),
				chartTitle: by === "kind" ? T("do.chart.matchKind") : T("do.chart.matchRepo"), option: this._bar(rows, null) }));
		},

		_quarantine: function (repoIds, srcFilter) {
			var that = this, T = this.text.bind(this), m = this.viewModel(), by = m.getProperty("/do/c/qa/by"),
				items = this._st.quarantine.filter(function (x) {
					return repoIds.indexOf(x.repo) > -1 && (!srcFilter.length || srcFilter.indexOf(x.sourceKey) > -1); }),
				held = items.filter(function (x) { return x.status === "held"; }).length, acc = {};
			items.forEach(function (x) { var k = by === "source" ? x.sourceKey : x.rule; acc[k] = (acc[k] || 0) + 1; });
			var rows = Object.keys(acc).map(function (k) { return { name: by === "source" ? that._srcName(k) : T("go.dq." + k), v: acc[k] }; });
			m.setProperty("/do/c/qa", Object.assign(m.getProperty("/do/c/qa"), { num: String(items.length),
				state: held ? "Critical" : "Good", details: T("do.c.qaDetails", [held, items.length - held]), sub: T("do.sortDesc"),
				chartTitle: by === "source" ? T("do.chart.qaSource") : T("do.chart.qaRule"), option: this._bar(rows, null) }));
		},

		_sources: function (repos, srcFilter) {
			var that = this, m = this.viewModel(),
				rows = this._sumBy(repos, function (r) { return (r.sourceRows || []).map(function (s) { return [s.id, s.rows]; }); })
					.filter(function (x) { return !srcFilter.length || srcFilter.indexOf(x[0]) > -1; }),
				total = rows.reduce(function (a, x) { return a + x[1]; }, 0), s = this._scaled(total), c = this.colors;
			m.setProperty("/do/c/src", { num: s.num, scale: s.scale, option: {
				color: ["#5899da", "#e8743b", "#19a979", "#945ecf", "#13a4b4"],
				tooltip: { trigger: "item", formatter: function (p) { return p.name + ": " + that.fmt.num(p.value) + " (" + p.percent + "%)"; } },
				legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: c.label, fontSize: 11 } },
				series: [{ type: "pie", radius: ["42%", "68%"], center: ["50%", "44%"], avoidLabelOverlap: true,
					label: { formatter: "{d}%", color: c.text, fontSize: 11 },
					data: rows.map(function (x) { return { name: that._srcName(x[0]), value: x[1] }; }) }] } });
		},

		_sumBy: function (repos, pairs) {
			var acc = {}, order = [];
			repos.forEach(function (r) { pairs(r).forEach(function (p) { if (!(p[0] in acc)) { acc[p[0]] = 0; order.push(p[0]); } acc[p[0]] += p[1]; }); });
			return order.map(function (k) { return [k, acc[k]]; });
		},

		/* Vertical bar chart in the Overview Page card style. Quality bars take the semantic colour of their value,
		   with the target as a dashed line; count bars use one neutral colour. */
		_bar: function (rows, target, semantic) {
			var c = this.colors, rtl = this.isRtl(), that = this;
			if (!semantic) { rows = rows.slice().sort(function (a, b) { return b.v - a.v; }); }
			return {
				grid: { left: rtl ? 8 : 44, right: rtl ? 44 : 8, top: 12, bottom: 44 },
				tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
				xAxis: { type: "category", inverse: rtl, data: rows.map(function (r) { return r.name; }),
					axisLabel: { color: c.label, fontSize: 10, interval: 0, rotate: rows.length > 3 ? 30 : 0, width: 80, overflow: "truncate" },
					axisLine: { lineStyle: { color: c.grid } }, axisTick: { show: false } },
				yAxis: { type: "value", position: rtl ? "right" : "left", min: semantic ? 50 : 0, max: semantic ? 100 : undefined,
					axisLabel: { color: c.label, fontSize: 10, formatter: function (v) { return semantic ? v : that._scaled(v).num + that._scaled(v).scale; } },
					splitLine: { lineStyle: { color: c.grid } } },
				series: [{ type: "bar", barMaxWidth: 28,
					data: rows.map(function (r) { return { value: r.v, itemStyle: { color: semantic ? SEM_COLOR[Sem.quality(r.v)] : "#5899da" } }; }),
					markLine: target ? { symbol: "none", silent: true, lineStyle: { type: "dashed", color: c.text },
						label: { formatter: this.text("do.target") + " " + target + "%", color: c.text, fontSize: 10, position: "insideStartTop" },
						data: [{ yAxis: target }] } : undefined }]
			};
		},

		_links: function (r) {
			var T = this.text.bind(this), k = this._d.id;
			return [
				{ key: "golden", icon: "sap-icon://badge", text: T("do.l.golden"), sub: T("do.l.goldenSub") },
				{ key: "templates", icon: "sap-icon://form", text: T("nav.templatesCatalog"), sub: T("do.l.templatesSub") },
				{ key: "models", icon: "sap-icon://customize", text: T("nav.modelsRules"), sub: T("do.l.modelsSub") },
				{ key: "matches", icon: "sap-icon://compare", text: T("nav.matchDetection"), sub: T("do.l.matchesSub") },
				{ key: "quarantine", icon: "sap-icon://quality-issue", text: T("nav.quarantine"), sub: T("do.l.quarantineSub") },
				{ key: "ontology", icon: "sap-icon://tree", text: T("nav.ontologyExplorer"), sub: T("do.l.ontologySub") }
			].map(function (l) { l.repo = r ? r.id : ""; l.domain = k; return l; });
		},

		onCreateRepo: function () {
			var that = this;
			Flows.createRepository(this, this._d.id, function (id) { that.router().navTo("repository", { repo: id }); });
		},
		onFilter: function () { this._apply(); },
		onClear: function () { this.viewModel().setProperty("/do/f", { repos: [], sources: [] }); this._apply(); },
		onBy: function () { this._apply(); },
		onToCatalog: function () { this.router().navTo("domains"); },
		onRepo: function (e) { this.router().navTo("repository", { repo: e.getSource().getBindingContext("view").getProperty("id") }); },
		onCardGolden: function () {
			var r = this.viewModel().getProperty("/do/repos/0");
			if (r) { this.router().navTo("goldenRecords", { repo: r.id }); }
		},
		onCardMatch: function () { this.router().navTo("matches"); },
		onCardQuarantine: function () { this.router().navTo("quarantine"); },
		onLink: function (e) {
			var l = e.getSource().getBindingContext("view").getObject(), R = this.router();
			if (l.key === "golden") { R.navTo("goldenRecords", { repo: l.repo || undefined }); }
			else if (l.key === "templates") { R.navTo("page", { key: "templatesCatalog" }); }
			else if (l.key === "models") { R.navTo("models"); }
			else if (l.key === "matches") { R.navTo("matches"); }
			else if (l.key === "quarantine") { R.navTo("quarantine"); }
			else { R.navTo("ontology"); }
		},
		onShare: function () {
			var that = this, done = function () { MessageToast.show(that.text("cat.linkCopied")); };
			try { navigator.clipboard.writeText(window.location.href).then(done, done); } catch (err) { done(); }
		}
	});
});
