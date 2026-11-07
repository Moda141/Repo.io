sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast"
], function (BaseController, MessageToast) {
	"use strict";

	/* Analytical List Page: visual filters → main chart → responsive table (SAP reference patterns). */
	return BaseController.extend("repoio.proto.controller.Domains", {
		onInit: function () {
			this.viewModel().setProperty("/lang", this.lang());
			this.viewModel().setProperty("/domains", { tokens: [], items: [], title: "", filterText: "", selected: 0 });
			this._f = {};
			this.router().getRoute("domains").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			var that = this;
			this.data().dataLoaded().then(function () { that._apply(); });
		},

		_all: function () {
			var that = this;
			return this.data().getProperty("/domains").map(function (d) {
				var sc = d.statusCounts, parts = [];
				["deployed", "draft", "archived"].forEach(function (k) { if (sc[k]) { parts.push(sc[k] + " " + that.text("status." + k)); } });
				return Object.assign({}, d, {
					title: that.domainName(d), teamText: that.lang() === "ar" ? d.teamAr : d.team,
					statusText: d.repoCount ? parts.join(" · ") : that.text("domains.noRepo"),
					statusState: !d.repoCount ? "None" : sc.deployed ? "Success" : "Information"
				});
			});
		},

		_apply: function () {
			var f = this._f, q = (this._q || "").toLowerCase(), tokens = [], that = this, all = this._all();
			var items = all.filter(function (d) {
				if (f.domain && d.id !== f.domain) { return false; }
				if (f.status && !d.statusCounts[f.status]) { return false; }
				if (f.repo && d.repos.indexOf(f.repo) < 0) { return false; }
				return !q || [d.name, d.nameEn, d.desc, d.owner, d.team, d.teamAr].join(" ").toLowerCase().indexOf(q) > -1;
			});
			if (f.domain) { tokens.push({ key: "domain", text: this.text("home.filter.domain") + ": " + all.filter(function (d) { return d.id === f.domain; })[0].title }); }
			if (f.status) { tokens.push({ key: "status", text: this.text("domains.col.status") + ": " + this.text("status." + f.status) }); }
			if (f.repo) { tokens.push({ key: "repo", text: this.text("repo.repository") + ": " + this.data().getProperty("/repos/" + f.repo + "/name") }); }
			this.viewModel().setProperty("/domains/items", items);
			this.viewModel().setProperty("/domains/tokens", tokens);
			this.viewModel().setProperty("/domains/title", this.text("domains.tableTitle", [items.length]));
			this.viewModel().setProperty("/domains/filterText", tokens.map(function (t) { return t.text; }).join(" · ") || this.text("home.noFilters"));
			this._draw(all);
		},

		_draw: function (all) {
			var c = this.colors, rtl = this.isRtl(), that = this, f = this._f, grey = "#d9d9d9";
			var withRepos = all.filter(function (d) { return d.repoCount; });
			this._vfDomains = withRepos;
			// 1. Golden records by domain (horizontal bars)
			this.byId("vfGolden").setOption({
				grid: { left: rtl ? 56 : 92, right: rtl ? 92 : 56, top: 2, bottom: 2 },
				tooltip: { trigger: "item" },
				xAxis: { type: "log", min: 100, show: false, inverse: rtl },
				yAxis: { type: "category", inverse: true, position: rtl ? "right" : "left", data: withRepos.map(function (d) { return d.title; }),
					axisLabel: { color: c.text, fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
				series: [{ type: "bar", barWidth: 12, cursor: "pointer",
					data: withRepos.map(function (d) { return { value: Math.max(d.golden, 101), itemStyle: { color: !f.domain || f.domain === d.id ? c.brand : grey } }; }),
					label: { show: true, position: rtl ? "left" : "right", fontSize: 11, color: c.text, formatter: function (p) { return that.fmt.num(withRepos[p.dataIndex].golden); } } }]
			});
			// 2. Quality trend (line)
			var trend = this.data().getProperty("/trend"), target = this.data().getProperty("/target");
			this.byId("vfTrend").setOption({
				grid: { left: rtl ? 8 : 34, right: rtl ? 34 : 8, top: 10, bottom: 20 },
				tooltip: { trigger: "axis" },
				xAxis: { type: "category", inverse: rtl, data: trend.map(function (t) { return t.d; }), axisLabel: { fontSize: 10, color: c.label }, axisTick: { show: false }, axisLine: { lineStyle: { color: c.grid } } },
				yAxis: { type: "value", min: 80, max: 100, position: rtl ? "right" : "left", splitNumber: 2, axisLabel: { fontSize: 10, color: c.label }, splitLine: { lineStyle: { color: c.grid } } },
				series: [{ type: "line", symbolSize: 5, data: trend.map(function (t) { return t.v; }), itemStyle: { color: c.brand },
					label: { show: true, fontSize: 10, color: c.text, formatter: function (p) { return p.dataIndex === trend.length - 1 ? p.value + "%" : ""; } },
					markLine: { symbol: "none", silent: true, label: { show: false }, lineStyle: { color: c.neg, type: "dashed" }, data: [{ yAxis: target }] } }]
			});
			// 3. Repositories by status (donut)
			var st = { deployed: 0, draft: 0, archived: 0 }, col = { deployed: c.pos, draft: c.info, archived: c.neutral };
			all.forEach(function (d) { Object.keys(st).forEach(function (k) { st[k] += d.statusCounts[k]; }); });
			this.byId("vfStatus").setOption({
				tooltip: { trigger: "item" },
				legend: { orient: "vertical", top: "middle", [rtl ? "left" : "right"]: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11, color: c.text },
					formatter: function (n) { var k = Object.keys(st).filter(function (x) { return that.text("status." + x) === n; })[0]; return n + "  " + st[k]; } },
				series: [{ type: "pie", radius: ["50%", "80%"], center: [rtl ? "70%" : "30%", "50%"], cursor: "pointer", label: { show: false },
					data: Object.keys(st).map(function (k) { return { name: that.text("status." + k), key: k, value: st[k], itemStyle: { color: !f.status || f.status === k ? col[k] : grey } }; }) }]
			});
			// Main chart: golden records by repository (column), filtered by the visual filters
			var repos = this.data().getProperty("/repos"), ids = Object.keys(repos).filter(function (r) {
				var R = repos[r];
				return (!f.domain || R.domainId === f.domain) && (!f.status || R.statusKey === f.status);
			});
			this._mainRepos = ids;
			this.byId("mainChart").setOption({
				grid: { left: rtl ? 12 : 56, right: rtl ? 56 : 12, top: 16, bottom: 40 },
				tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
				xAxis: { type: "category", inverse: rtl, data: ids.map(function (r) { return repos[r].name; }),
					axisLabel: { color: c.text, fontSize: 11, interval: 0 }, axisTick: { show: false }, axisLine: { lineStyle: { color: c.grid } } },
				yAxis: { type: "log", min: 100, position: rtl ? "right" : "left", axisLabel: { color: c.label, fontSize: 10, formatter: function (v) { return v >= 1e6 ? v / 1e6 + "M" : v >= 1e3 ? v / 1e3 + "K" : v; } }, splitLine: { lineStyle: { color: c.grid } } },
				series: [{ type: "bar", barMaxWidth: 64, cursor: "pointer",
					data: ids.map(function (r) { return { value: Math.max(repos[r].golden, 101), real: repos[r].golden, itemStyle: { color: !f.repo || f.repo === r ? c.brand : grey } }; }),
					label: { show: true, position: "top", fontSize: 11, color: c.text, formatter: function (p) { return that.fmt.num(p.data.real); } } }]
			});
		},

		onVfGolden: function (e) { this._toggle("domain", this._vfDomains[e.getParameter("dataIndex")].id); },
		onVfStatus: function (e) { this._toggle("status", e.getParameter("data").key); },
		onMainChart: function (e) { this._toggle("repo", this._mainRepos[e.getParameter("dataIndex")]); },
		_toggle: function (k, v) { this._f[k] = this._f[k] === v ? null : v; this._apply(); },
		onTokenDelete: function (e) { e.getParameter("tokens").forEach(function (t) { this._f[t.getKey()] = null; }, this); this._apply(); },
		onSearch: function (e) { this._q = e.getParameter("newValue"); this._apply(); },
		onSelectionChange: function () { this.viewModel().setProperty("/domains/selected", this.byId("domainsTable").getSelectedItems().length); },

		onDomainPress: function (e) {
			this.router().navTo("domain", { domainId: e.getSource().getBindingContext("view").getProperty("id") });
		},
		onCreate: function () { MessageToast.show(this.text("alp.createToast")); },
		onEdit: function () { MessageToast.show(this.text("alp.editToast")); },
		onDelete: function () { MessageToast.show(this.text("alp.deleteToast")); },
		onDeleteRow: function () { MessageToast.show(this.text("alp.deleteToast")); }
	});
});
