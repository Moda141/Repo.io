sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/ui/table/Column",
	"sap/m/Label",
	"sap/m/Text",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast"
], function (BaseController, Column, Label, Text, Filter, FilterOperator, MessageToast) {
	"use strict";

	/* Object Page with an icon tab bar: sample data (grid table), data quality review,
	   description, lineage. Sample content is shared across tables in the prototype. */
	return BaseController.extend("repoio.proto.controller.Table", {
		onInit: function () {
			this.router().getRoute("table").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this;
			this._args = oEvent.getParameter("arguments");
			this.data().dataLoaded().then(function () { that._load(); });
		},

		_load: function () {
			var a = this._args, oData = this.data(), that = this,
				S = oData.getProperty("/sources/" + a.sourceId), R = oData.getProperty("/repos/" + a.repoId),
				T = S && S.tables.filter(function (t) { return t.schema === a.schema && t.id === a.tableId; })[0];
			if (!T || !R) { this.router().getTargets().display("placeholder"); return; }
			var d = oData.getProperty("/domains").filter(function (x) { return x.id === R.domainId; })[0],
				I = oData.getProperty("/table"), isCustomer = a.sourceId === "c4c" && a.tableId === "customer",
				trend = oData.getProperty("/trend"), target = oData.getProperty("/target");
			this.viewModel().setProperty("/table", {
				name: T.name, techName: T.name.split(" ")[0].toUpperCase(), schema: T.schema, rows: T.rows, cols: T.cols, quality: T.quality, qualityState: T.qualityState, profiled: T.profiled,
				usedInText: T.usedIn.length ? this.fmt.joinNames(T.usedIn) : this.text("src.notUsed"),
				domainName: this.domainName(d), repoName: R.name, sourceName: S.name
			});
			var aFailed = I.tests.filter(function (t) { return t.stateKey === "neg"; });
			this.viewModel().setProperty("/info", Object.assign({}, I, {
				target: target, scoreState: this.fmt.qualityState(I.score),
				deviation: (I.score - target).toFixed(1), delta: "+" + (I.score - trend[trend.length - 2].v).toFixed(1),
				failed: aFailed.length,
				lineageTypes: { db: this.text("lin.db"), pipe: this.text("lin.pipe"), table: this.text("lin.table"), gold: this.text("lin.gold"), chart: this.text("lin.chart") },
				termsText: I.terms.join(" · "), tagsText: I.tags.join(" · "),
				tests: I.tests.map(function (t) { return Object.assign({}, t, { failedPct: t.failed ? (t.failed / T.rows * 100).toFixed(1) + "%" : "—" }); }),
				columns: I.columns.map(function (c) {
					var use = isCustomer ? c.usage : [];
					return Object.assign({}, c, {
						dataType: { string: "String(100)", code: "String(10)", date: "Date" }[c.type] || c.type,
						reposText: isCustomer ? (use.map(function (u) { return u.repo; }).join(" · ") || that.text("src.notUsed")) : that.fmt.joinNames(T.usedIn),
						attrsText: use.length ? use.map(function (u) { return u.model + " › " + u.attr; }).join("\n") : "—"
					});
				})
			}));
			this.byId("page").setSelectedSection(this.byId("secDesc"));
			this._drawTrend(trend, target);
		},

		columnFactory: function (sId, oContext) {
			var c = oContext.getObject();
			return new Column(sId, {
				label: new Label({ text: c.name }), width: "11rem", sortProperty: c.name, filterProperty: c.name,
				template: new Text({ text: "{view>" + c.name + "}", wrapping: false, emptyIndicatorMode: "On" })
			});
		},

		onTestFilter: function (oEvent) {
			var k = oEvent.getParameter("item").getKey();
			this.byId("testsTable").getBinding("items").filter(k === "all" ? [] : [new Filter("stateKey", FilterOperator.EQ, k)]);
		},

		_drawTrend: function (trend, target) {
			var c = this.colors, rtl = this.isRtl();
			this.byId("trendChart").setOption({
				grid: { left: rtl ? 8 : 40, right: rtl ? 40 : 8, top: 16, bottom: 24 },
				tooltip: { trigger: "axis" },
				xAxis: { type: "category", inverse: rtl, data: trend.map(function (t) { return t.d; }), axisLabel: { color: c.label }, axisLine: { lineStyle: { color: c.grid } } },
				yAxis: { type: "value", min: 75, max: 100, position: rtl ? "right" : "left", axisLabel: { color: c.label, formatter: "{value}%" }, splitLine: { lineStyle: { color: c.grid } } },
				series: [{ type: "line", data: trend.map(function (t) { return t.v; }), smooth: false, symbolSize: 6, itemStyle: { color: c.brand }, areaStyle: { color: "rgba(10,110,209,0.08)" },
					markLine: { symbol: "none", label: { formatter: this.text("home.target") + " {c}%", color: c.neg }, lineStyle: { color: c.neg, type: "dashed" }, data: [{ yAxis: target }] } }]
			});
		},

		onLineageNode: function (e) {
			var c = e.getParameter("column");
			if (c === 0) { this.onToSource(); } else if (c === 4) { this.onToRepo(); }
		},

		onGoSection: function (e) { this.byId("page").setSelectedSection(this.byId(e.getSource().data("sec"))); },
		onEditDesc: function () { this.byId("page").setSelectedSection(this.byId("secDesc")); },
		onRequestChange: function () { MessageToast.show(this.text("tbl.requestToast")); },
		onToDomains: function () { this.router().navTo("domains"); },
		onToDomain: function () { this.router().navTo("domain", { domainId: this._args.domainId }); },
		onToRepo: function () { this.router().navTo("repository", { domainId: this._args.domainId, repoId: this._args.repoId }); },
		onToSource: function () { this.router().navTo("sources", { domainId: this._args.domainId, repoId: this._args.repoId, sourceId: this._args.sourceId }); }
	});
});
