sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast"
], function (BaseController, MessageToast) {
	"use strict";

	/* Spaces-page pattern: the repositories of one domain as cards or a table (ADR-0001). */
	return BaseController.extend("repoio.proto.controller.Domain", {
		onInit: function () {
			this.viewModel().setProperty("/lang", this.lang());
			this.router().getRoute("domain").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var sId = oEvent.getParameter("arguments").domainId, that = this;
			this.data().dataLoaded().then(function () { that._load(sId); });
		},

		_load: function (sId, sQuery) {
			var oData = this.data(), d = oData.getProperty("/domains").filter(function (x) { return x.id === sId; })[0], that = this;
			if (!d) { this.router().getTargets().display("placeholder"); return; }
			var q = (sQuery || "").toLowerCase(),
				repos = d.repos.map(function (r) {
					var R = oData.getProperty("/repos/" + r);
					return Object.assign({}, R, {
						sourceNames: R.sourceIds.map(function (s) { return oData.getProperty("/sources/" + s + "/name"); }).join(" · "),
						ownerNames: R.owners.map(function (o) { return o.name; }).join(" · ")
					});
				}).filter(function (R) { return !q || (R.name + " " + R.code + " " + R.model).toLowerCase().indexOf(q) > -1; });
			this._domainId = sId;
			this.viewModel().setProperty("/domain", {
				id: sId, name: this.domainName(d), nameEn: d.nameEn, desc: d.desc, owner: d.owner, updated: d.updated,
				teamText: this.lang() === "ar" ? d.teamAr : d.team,
				repoCount: d.repoCount, golden: d.golden, sourceCount: d.sourceCount, quality: d.quality, qualityState: d.qualityState,
				repoText: this.text("domain.repoTitle", [repos.length]),
				mode: this.viewModel().getProperty("/domain/mode") || "cards",
				repos: repos
			});
			if (d.repoCount) {
				var c = this.colors, sc = d.statusCounts;
				this.byId("statusChart").setOption({
					tooltip: { trigger: "item" },
					grid: { left: 0, right: 0, top: 0, bottom: 0 },
					xAxis: { type: "value", show: false, inverse: this.isRtl(), max: d.repoCount },
					yAxis: { type: "category", show: false, data: ["s"] },
					series: ["deployed", "draft", "archived"].map(function (k) {
						return { name: that.text("status." + k), type: "bar", stack: "s", barWidth: 18, data: [sc[k]],
							itemStyle: { color: { deployed: c.pos, draft: c.info, archived: c.neutral }[k] },
							label: { show: sc[k] > 0, color: "#fff", formatter: "{c}" } };
					}),
					legend: { bottom: 0, textStyle: { fontSize: 11, color: c.label }, itemWidth: 10, itemHeight: 10 }
				});
			}
		},

		onSearch: function (oEvent) { this._load(this._domainId, oEvent.getParameter("newValue")); },

		onRepoPress: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject();
			this.router().navTo("repository", { domainId: this._domainId, repoId: o.id });
		},

		onToDomains: function () { this.router().navTo("domains"); },
		onAddRepo: function () { MessageToast.show(this.text("domain.addRepoToast")); }
	});
});
