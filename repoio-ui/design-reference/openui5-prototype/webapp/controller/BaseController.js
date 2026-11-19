sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/UIComponent",
	"repoio/proto/util/formatter",
	"repoio/proto/control/PersonLink"
], function (Controller, UIComponent, formatter, PersonLink) {
	"use strict";

	return Controller.extend("repoio.proto.controller.BaseController", {
		fmt: formatter,

		router: function () { return UIComponent.getRouterFor(this); },
		text: function (sKey, aArgs) { return this.getOwnerComponent().bundle.getText(sKey, aArgs); },
		viewModel: function () { return this.getOwnerComponent().getModel("view"); },
		data: function () { return this.getOwnerComponent().getModel("data"); },
		isRtl: function () { return sap.ui.getCore().getConfiguration().getRTL(); },
		lang: function () { return sap.ui.getCore().getConfiguration().getLanguage().indexOf("ar") === 0 ? "ar" : "en"; },

		/* Navigate by a navigation-tree key: the one map from side-navigation keys to routes, used by the shell and by
		   pages that link by key (Home). Keys without a page yet open the placeholder. */
		NAV_ROUTES: {
			home: "home", domains: "domains", connections: "connections", ontologyExplorer: "ontology", newWorkflow: "workflow",
			dataJobs: "jobs", workflowsList: "workflows", reports: "reports", broadcasts: "broadcasts", dataSync: "dataSync",
			apiManagement: "apiManagement", users: "users", rolesAccess: "roles", systemConfiguration: "system", announcements: "announcements",
			auditLog: "audit", modelsRules: "models", goldenRecords: "goldenRecords", matchDetection: "matches", quarantine: "quarantine",
			testCases: "dqTests", alerts: "dqAlerts"
		},
		/* Open a person's business card from a control that is not a PersonLink (a feed sender, a card header). */
		openPerson: function (sName, oOpener) { PersonLink.openFor(sName, oOpener); },
		/* A person's display name in the current language (people are keyed by their Arabic name in the sample directory). */
		personLabel: function (sName) { return PersonLink.label(sName); },
		navKey: function (sKey, oArgs) {
			var r = this.NAV_ROUTES[sKey];
			if (r) { this.router().navTo(r, oArgs || {}); } else { this.router().navTo("page", { key: sKey }); }
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

		/* Shared ECharts palette (soft SAP semantic tints; they read on Morning Horizon). */
		colors: { brand: "#5899da", pos: "#5fae7c", crit: "#e3a256", neg: "#df7a7a", info: "#89b4e3", neutral: "#b4bac0", grid: "#eeeeee", text: "#32363a", label: "#6a6d70" }
	});
});
