sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast"
], function (BaseController, MessageToast) {
	"use strict";

	var NEW_TILES = [
		{ key: "repository", icon: "sap-icon://badge", color: "#0a6ed1" },
		{ key: "model", icon: "sap-icon://database", color: "#5d36ff" },
		{ key: "connection", icon: "sap-icon://connected", color: "#0f828f" },
		{ key: "rule", icon: "sap-icon://quality-issue", color: "#c35500" },
		{ key: "matching", icon: "sap-icon://compare", color: "#8e44ad" },
		{ key: "import", icon: "sap-icon://upload", color: "#107e3e" }
	];

	/* SAP Datasphere "Data Builder" layout: the repositories (ADR-0001) of the selected domain. */
	return BaseController.extend("repoio.proto.controller.Domain", {
		onInit: function () {
			this.viewModel().setProperty("/lang", this.lang());
			this.router().getRoute("domain").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var sId = oEvent.getParameter("arguments").domainId, that = this;
			this._q = ""; this._status = "all";
			this.data().dataLoaded().then(function () { that._load(sId); });
		},

		_load: function (sId) {
			var oData = this.data(), that = this, domains = oData.getProperty("/domains"),
				d = domains.filter(function (x) { return x.id === sId; })[0];
			if (!d) { this.router().getTargets().display("placeholder"); return; }
			var q = (this._q || "").toLowerCase(), st = this._status;
			var repos = d.repos.map(function (r) {
				var R = oData.getProperty("/repos/" + r);
				return Object.assign({}, R, {
					deployText: that.text("status." + R.statusKey),
					deployState: R.status === "Deployed" ? "Success" : R.status === "Draft" ? "Information" : "None",
					deployIcon: R.status === "Deployed" ? "sap-icon://sys-enter-2" : R.status === "Draft" ? "sap-icon://edit" : "sap-icon://locked",
					changedOn: R.deployed === "—" ? "—" : R.deployed, changedBy: R.owners[0].name
				});
			}).filter(function (R) {
				return (st === "all" || R.statusKey === st) && (!q || (R.name + " " + R.code + " " + R.model).toLowerCase().indexOf(q) > -1);
			});
			this._domainId = sId;
			this.viewModel().setProperty("/domain", {
				id: sId, name: this.domainName(d), repoCount: d.repoCount, status: st, selected: 0,
				options: domains.map(function (x) { return { key: x.id, text: that.domainName(x) }; }),
				newTiles: NEW_TILES.map(function (t) { return { key: t.key, icon: t.icon, color: t.color, text: that.text("dsp.new." + t.key) }; }),
				summary: this.text("domain.summary", [d.repoCount, this.fmt.num(d.golden)]),
				repoText: this.text("dsp.allRepos", [repos.length]),
				repos: repos
			});
		},

		onDomainChange: function (e) { this.router().navTo("domain", { domainId: e.getParameter("selectedItem").getKey() }); },
		onSearch: function (e) { this._q = e.getParameter("newValue"); this._load(this._domainId); },
		onStatus: function (e) { this._status = e.getParameter("selectedItem").getKey(); this._load(this._domainId); },
		onTableSelect: function () { this.viewModel().setProperty("/domain/selected", this.byId("repoTable").getSelectedItems().length); },
		onEditSelected: function () {
			var o = this.byId("repoTable").getSelectedItem().getBindingContext("view").getObject();
			this.router().navTo("repository", { domainId: this._domainId, repoId: o.id });
		},
		onRepoPress: function (e) {
			var o = e.getSource().getBindingContext("view").getObject();
			this.router().navTo("repository", { domainId: this._domainId, repoId: o.id });
		},
		onNewTile: function (e) {
			var k = e.getSource().getBindingContext("view").getProperty("key");
			if (k === "rule") { this.navKey("testCases"); } else if (k === "matching") { this.navKey("modelsRules"); } else if (k === "connection") { this.navKey("connections"); }
			else { MessageToast.show(this.text("domain.addRepoToast")); }
		},
		onToDomains: function () { this.router().navTo("domains"); },
		onAddRepo: function () { MessageToast.show(this.text("domain.addRepoToast")); }
	});
});
