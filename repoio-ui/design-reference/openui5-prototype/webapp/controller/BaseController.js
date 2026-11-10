sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/UIComponent",
	"repoio/proto/util/formatter"
], function (Controller, UIComponent, formatter) {
	"use strict";

	return Controller.extend("repoio.proto.controller.BaseController", {
		fmt: formatter,

		router: function () { return UIComponent.getRouterFor(this); },
		text: function (sKey, aArgs) { return this.getOwnerComponent().bundle.getText(sKey, aArgs); },
		viewModel: function () { return this.getOwnerComponent().getModel("view"); },
		data: function () { return this.getOwnerComponent().getModel("data"); },
		isRtl: function () { return sap.ui.getCore().getConfiguration().getRTL(); },
		lang: function () { return sap.ui.getCore().getConfiguration().getLanguage().indexOf("ar") === 0 ? "ar" : "en"; },

		/* Navigate by a navigation-tree key (Home, Domains, or a planned page). */
		navKey: function (sKey) {
			if (sKey === "home" || sKey === "domains" || sKey === "connections") { this.router().navTo(sKey); }
			else if (sKey === "ontologyExplorer") { this.router().navTo("ontology"); }
			else if (sKey === "newWorkflow") { this.router().navTo("workflow"); }
			else if (sKey === "dataJobs") { this.router().navTo("jobs"); }
			else if (sKey === "workflowsList") { this.router().navTo("workflows"); }
			else { this.router().navTo("page", { key: sKey }); }
		},
		onNavKey: function (oEvent) {
			var oSrc = oEvent.getSource(), sKey = oSrc.data("key");
			this.navKey(sKey);
		},
		navText: function (sKey) { return sKey ? this.text("nav." + sKey) : ""; },
		resultText: function (k) { return k ? this.text("result." + k) : ""; },
		statusText: function (k) { return k ? this.text("status." + k) : ""; },
		healthText: function (k) { return k ? this.text("health." + k) : ""; },
		goldenStateText: function (k) { return k ? this.text("golden." + k) : ""; },
		domainName: function (oDomain) { return oDomain ? (this.lang() === "ar" ? oDomain.name : oDomain.nameEn) : ""; },

		/* Store small per-browser conveniences; never required for the page to work. */
		store: function (sKey, vValue) {
			try {
				if (vValue === undefined) { return JSON.parse(localStorage.getItem(sKey) || "null"); }
				localStorage.setItem(sKey, JSON.stringify(vValue));
			} catch (e) { return null; }
			return null;
		},

		/* Shared ECharts palette from Quartz Light semantic colors. */
		colors: { brand: "#5899da", pos: "#5fae7c", crit: "#e3a256", neg: "#df7a7a", info: "#89b4e3", neutral: "#b4bac0", grid: "#eeeeee", text: "#32363a", label: "#6a6d70" }
	});
});
