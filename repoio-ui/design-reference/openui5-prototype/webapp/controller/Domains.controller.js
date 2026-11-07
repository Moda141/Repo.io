sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (BaseController, Filter, FilterOperator) {
	"use strict";

	/* Analytical List Page pattern built from OpenUI5 controls: visual filters (ECharts
	   wrapper) narrow the responsive table; active filters show as tokens. */
	return BaseController.extend("repoio.proto.controller.Domains", {
		onInit: function () {
			this.viewModel().setProperty("/lang", this.lang());
			this.viewModel().setProperty("/domains", { tokens: [], title: "", filterText: "" });
			this._vf = {};
			this.router().getRoute("domains").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			this.data().dataLoaded().then(this._drawFilters.bind(this));
		},

		_domains: function () { return this.data().getProperty("/domains"); },

		_drawFilters: function () {
			var c = this.colors, rtl = this.isRtl(), that = this, a = this._domains(),
				names = a.map(function (d) { return that.domainName(d); }),
				sel = this._vf;
			var bar = function (vals, color, fmt) {
				return {
					grid: { left: rtl ? 50 : 96, right: rtl ? 96 : 50, top: 4, bottom: 4 },
					xAxis: { type: "value", show: false, inverse: rtl },
					yAxis: { type: "category", data: names, inverse: true, position: rtl ? "right" : "left",
						axisLabel: { color: c.label, fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
					tooltip: { trigger: "item" },
					series: [{ type: "bar", barWidth: 12, data: vals.map(function (v, i) {
						var active = !sel.domain || sel.domain === a[i].id;
						return { value: v, itemStyle: { color: active ? color : "#c5c5c5" } };
					}), label: { show: true, position: rtl ? "left" : "right", color: c.text, fontSize: 11, formatter: function (p) { return fmt(p.value); } } }]
				};
			};
			this.byId("vfGolden").setOption(bar(a.map(function (d) { return d.golden; }), c.brand, this.fmt.num));
			this.byId("vfQuality").setOption(bar(a.map(function (d) { return d.quality || 0; }), c.pos, function (v) { return v ? v.toFixed(1) + "%" : "—"; }));
			var st = { deployed: 0, draft: 0, archived: 0 };
			a.forEach(function (d) { Object.keys(st).forEach(function (k) { st[k] += d.statusCounts[k]; }); });
			var colorsSt = { deployed: c.pos, draft: c.info, archived: c.neutral };
			this.byId("vfStatus").setOption({
				tooltip: { trigger: "item" },
				legend: { orient: "vertical", [rtl ? "left" : "right"]: 0, top: "middle", textStyle: { color: c.label, fontSize: 11 } },
				series: [{ type: "pie", radius: ["45%", "75%"], center: [rtl ? "65%" : "35%", "50%"], label: { show: false },
					data: Object.keys(st).map(function (k) {
						return { name: that.text("status." + k), key: k, value: st[k],
							itemStyle: { color: !sel.status || sel.status === k ? colorsSt[k] : "#c5c5c5" } };
					}) }]
			});
		},

		onVfGolden: function (oEvent) { this._toggle("domain", this._domains()[oEvent.getParameter("dataIndex")].id); },
		onVfQuality: function (oEvent) { this._toggle("domain", this._domains()[oEvent.getParameter("dataIndex")].id); },
		onVfStatus: function (oEvent) { this._toggle("status", oEvent.getParameter("data").key); },

		_toggle: function (sKey, sValue) {
			this._vf[sKey] = this._vf[sKey] === sValue ? null : sValue;
			this._apply();
		},

		onTokenDelete: function (oEvent) {
			oEvent.getParameter("tokens").forEach(function (t) { this._vf[t.getKey()] = null; }, this);
			this._apply();
		},

		onSearch: function (oEvent) { this._q = oEvent.getParameter("newValue"); this._apply(); },

		_apply: function () {
			var a = [], tokens = [], that = this;
			if (this._vf.domain) {
				a.push(new Filter("id", FilterOperator.EQ, this._vf.domain));
				var d = this._domains().filter(function (x) { return x.id === that._vf.domain; })[0];
				tokens.push({ key: "domain", text: this.text("home.filter.domain") + ": " + this.domainName(d) });
			}
			if (this._vf.status) {
				var s = this._vf.status;
				a.push(new Filter({ path: "statusCounts", test: function (v) { return v[s] > 0; } }));
				tokens.push({ key: "status", text: this.text("domains.col.status") + ": " + this.text("status." + s) });
			}
			if (this._q) {
				var q = this._q.toLowerCase();
				a.push(new Filter({ path: "", test: function (d) {
					return [d.name, d.nameEn, d.desc, d.owner, d.team].join(" ").toLowerCase().indexOf(q) > -1; } }));
			}
			this.byId("domainsTable").getBinding("items").filter(a);
			this.viewModel().setProperty("/domains/tokens", tokens);
			this.viewModel().setProperty("/domains/filterText", tokens.map(function (t) { return t.text; }).join(" · ") || this.text("home.noFilters"));
			this._drawFilters();
		},

		onTableUpdated: function (oEvent) {
			this.viewModel().setProperty("/domains/title", this.text("domains.tableTitle", [oEvent.getParameter("total")]));
		},

		onDomainPress: function (oEvent) {
			this.router().navTo("domain", { domainId: oEvent.getSource().getBindingContext("data").getProperty("id") });
		}
	});
});
