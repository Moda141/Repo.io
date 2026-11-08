sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast"
], function (BaseController, Filter, FilterOperator, MessageToast) {
	"use strict";

	/* Object Page: assigned model, golden records the repository holds, contributing data sources. */
	return BaseController.extend("repoio.proto.controller.Repository", {
		onInit: function () {
			this.router().getRoute("repository").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var a = oEvent.getParameter("arguments"), that = this;
			this._args = a;
			this.data().dataLoaded().then(function () { that._load(); });
		},

		_load: function () {
			var oData = this.data(), R = oData.getProperty("/repos/" + this._args.repoId);
			if (!R) { this.router().getTargets().display("placeholder"); return; }
			var d = oData.getProperty("/domains").filter(function (x) { return x.id === R.domainId; })[0];
			var oRepo = Object.assign({}, R, {
				domainName: this.domainName(d),
				goldenEmpty: R.status === "Draft" ? this.text("repo.goldenEmptyDraft") : this.text("repo.goldenEmpty"),
				tagsText: R.tags.join(", "),
				capPct: Math.min(100, R.golden / R.cap * 100), capText: this.text("space.ofCap", [this.fmt.num(R.golden), this.fmt.num(R.cap)]),
				members: R.owners.map(function (o, i) {
					return { name: o.name, initials: o.initials, role: this.text(i === 0 ? "dsp.roleOwner" : "dsp.roleSteward"), scope: this.text("dsp.scopeRepo") };
				}, this)
			});
			this.viewModel().setProperty("/repo", oRepo);
			var M = Object.assign({}, oData.getProperty("/models/" + R.model));
			M.priorityText = M.priority.map(function (x) { return x.rank + ". " + x.name; }).join("  ›  ");
			this.viewModel().setProperty("/model", M);
			this._gFilter = "all"; this._gQuery = "";
			this.byId("page").setSelectedSection(this.byId("secOverview"));
			this._applyGolden();
		},

		onGoldenFilter: function (oEvent) { this._gFilter = oEvent.getParameter("item").getKey(); this._applyGolden(); },
		onGoldenSearch: function (oEvent) { this._gQuery = oEvent.getParameter("newValue"); this._applyGolden(); },
		_applyGolden: function () {
			var a = [];
			if (this._gFilter && this._gFilter !== "all") { a.push(new Filter("stateKey", FilterOperator.EQ, this._gFilter)); }
			if (this._gQuery) {
				a.push(new Filter({ filters: [new Filter("name", FilterOperator.Contains, this._gQuery), new Filter("id", FilterOperator.Contains, this._gQuery)], and: false }));
			}
			var oBinding = this.byId("goldenTable").getBinding("items");
			if (oBinding) { oBinding.filter(a); }
		},
		onGoldenUpdated: function (oEvent) {
			var R = this.viewModel().getProperty("/repo");
			if (R) { this.viewModel().setProperty("/repo/goldenFooter", this.text("repo.goldenFooter", [oEvent.getParameter("total"), this.fmt.num(R.golden)])); }
		},

		onSourcePress: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject();
			this.router().navTo("sources", { domainId: this._args.domainId, repoId: this._args.repoId, sourceId: o.id });
		},
		onGoldenPress: function (e) { this.router().navTo("record", { recordId: e.getSource().getBindingContext("view").getProperty("id") }); },
		onExplore: function () { this.navKey("explore"); },
		onToModel: function () { this.navKey("modelsRules"); },
		onRequestChange: function () { MessageToast.show(this.text("repo.requestChangeToast")); },
		onMonitor: function () { this.navKey("dataJobs"); },
		onToDomains: function () { this.router().navTo("domains"); },
		onToDomain: function () { this.router().navTo("domain", { domainId: this._args.domainId }); }
	});
});
