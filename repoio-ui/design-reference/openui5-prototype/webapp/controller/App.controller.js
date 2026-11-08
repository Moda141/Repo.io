sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/tnt/NavigationListItem",
	"sap/tnt/NavigationListGroup"
], function (Controller, NavigationListItem, NavigationListGroup) {
	"use strict";

	return Controller.extend("repoio.proto.controller.App", {
		onInit: function () {
			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
			// Collapse the side navigation on narrow screens (phones and small windows).
			var oToolPage = this.byId("toolPage"), bDone = false;
			oToolPage.addEventDelegate({ onAfterRendering: function () {
				if (!bDone && window.innerWidth < 1024) { bDone = true; setTimeout(function () { oToolPage.setSideExpanded(false); }, 0); }
			} });
			var oNav = this.getOwnerComponent().getModel("nav");
			Promise.all([oNav.dataLoaded(), this.getOwnerComponent().bundleReady]).then(this._buildNavigation.bind(this, ""));
			this.getOwnerComponent().getRouter().attachRouteMatched(this._onRouteMatched, this);
		},

		/* Navigation tree (docs/ui-pages.md) with a live filter from the header search field.
		   sap.tnt.SideNavigation has no built-in search in OpenUI5 1.136, so the search
		   lives in the ToolHeader and filters the tree. */
		_buildNavigation: function (sQuery) {
			var oBundle = this.getOwnerComponent().bundle,
				oList = this.byId("navList"),
				aItems = this.getOwnerComponent().getModel("nav").getProperty("/items"),
				q = (sQuery || "").trim().toLowerCase(),
				fnText = function (k) { return oBundle.getText("nav." + k); },
				fnMatch = function (n) {
					return !q || fnText(n.key).toLowerCase().indexOf(q) > -1 ||
						(n.items || []).some(fnMatch);
				},
				fnItem = function (n) {
					var oItem = new NavigationListItem({
						key: n.key, text: fnText(n.key), icon: n.icon || "",
						expanded: !!q || n.key === "favorites",
						selectable: !n.items
					});
					(n.items || []).filter(fnMatch).forEach(function (c) {
						oItem.addItem(new NavigationListItem({ key: c.key, text: fnText(c.key) }));
					});
					return oItem;
				};
			oList.destroyItems();
			aItems.filter(fnMatch).forEach(function (n) {
				if (n.group) {
					var oGroup = new NavigationListGroup({ text: fnText(n.key), expanded: true });
					n.items.filter(fnMatch).forEach(function (c) { oGroup.addItem(fnItem(c)); });
					oList.addItem(oGroup);
				} else {
					oList.addItem(fnItem(n));
				}
			});
			if (this._sSelectedKey) {
				this.byId("sideNavigation").setSelectedKey(this._sSelectedKey);
			}
		},

		onNavSearch: function (oEvent) {
			this._buildNavigation(oEvent.getParameter("newValue") !== undefined ?
				oEvent.getParameter("newValue") : oEvent.getParameter("query"));
		},

		onNavSelect: function (oEvent) {
			var sKey = oEvent.getParameter("item").getKey(),
				oRouter = this.getOwnerComponent().getRouter();
			if (sKey === "home") { oRouter.navTo("home"); }
			else if (sKey === "domains" || sKey === "connections") { oRouter.navTo(sKey); }
			else if (sKey === "ontologyExplorer") { oRouter.navTo("ontology"); }
			else { oRouter.navTo("page", { key: sKey }); }
			if (this.getOwnerComponent().getModel("device").getProperty("/system/phone")) {
				this.byId("toolPage").setSideExpanded(false);
			}
		},

		_onRouteMatched: function (oEvent) {
			var sRoute = oEvent.getParameter("name"),
				sKey = sRoute === "page" ? oEvent.getParameter("arguments").key :
					sRoute === "home" ? "home" : sRoute === "connections" ? "connections" :
					sRoute === "ontology" ? "ontologyExplorer" : "domains";
			this._sSelectedKey = sKey;
			if (this.byId("navList").getItems().length) { this.byId("sideNavigation").setSelectedKey(sKey); }
		},

		onToggleSide: function () {
			var oToolPage = this.byId("toolPage");
			oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
		},

		onHome: function () {
			this.getOwnerComponent().getRouter().navTo("home");
		},

		onInbox: function () {
			this.getOwnerComponent().getRouter().navTo("page", { key: "awaitingApproval" });
		},

		onSwitchLanguage: function () {
			var sNext = sap.ui.getCore().getConfiguration().getLanguage().indexOf("ar") === 0 ? "en" : "ar";
			try { localStorage.setItem("repoio-lang", sNext); } catch (e) { /* storage blocked */ }
			window.location.reload();
		}
	});
});
