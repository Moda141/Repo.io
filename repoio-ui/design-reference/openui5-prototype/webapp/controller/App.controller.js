sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/tnt/NavigationListItem",
	"sap/tnt/NavigationListGroup",
	"sap/m/ResponsivePopover",
	"sap/m/VBox",
	"sap/m/HBox",
	"sap/m/Avatar",
	"sap/m/Title",
	"sap/m/Text",
	"sap/m/Label",
	"sap/m/ObjectStatus",
	"sap/m/List",
	"sap/m/StandardListItem",
	"sap/m/MessageToast",
	"repoio/proto/util/tour"
], function (Controller, NavigationListItem, NavigationListGroup, ResponsivePopover, VBox, HBox, Avatar, Title, Text, Label, ObjectStatus, List,
	StandardListItem, MessageToast, Tour) {
	"use strict";

	return Controller.extend("repoio.proto.controller.App", {
		onInit: function () {
			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
			var sLang = this._lang();
			this.byId("langMenu").getItems().forEach(function (it) { it.setIcon(it.getKey() === sLang ? "sap-icon://accept" : ""); });
			// Collapse the side navigation on narrow screens (phones and small windows).
			var oToolPage = this.byId("toolPage"), bDone = false;
			oToolPage.addEventDelegate({ onAfterRendering: function () {
				if (!bDone && window.innerWidth < 1024) { bDone = true; setTimeout(function () { oToolPage.setSideExpanded(false); }, 0); }
			} });
			var oNav = this.getOwnerComponent().getModel("nav");
			Promise.all([oNav.dataLoaded(), this.getOwnerComponent().bundleReady]).then(function () {
				this._buildNavigation("");
				// First login: the guided tour opens once the shell is on screen (per-user "seen" flag; replay from the user menu)
				if (!Tour.seen()) { setTimeout(this.onTour.bind(this), 1500); }
			}.bind(this));
			this.getOwnerComponent().getRouter().attachRouteMatched(this._onRouteMatched, this);
			this._watchScrollAreas();
		},

		/* Side panels inside a page (models, users, settings, folders) stay in place while the page scrolls: CSS makes them
		   sticky, and needs the visible height of the page's scroll area, which this keeps in --repoioScrollH. */
		_watchScrollAreas: function () {
			if (!window.ResizeObserver || !window.MutationObserver) { return; }
			// The page title floats over the top of the scroll area, so a panel sticks just below it.
			var measure = function (w) {
					var t = w.parentElement && w.parentElement.querySelector(":scope > .sapFDynamicPageTitleWrapper"), top = t ? t.offsetHeight : 0;
					w.style.setProperty("--repoioScrollH", Math.max(0, w.clientHeight - top) + "px");
				},
				oSize = new ResizeObserver(function (entries) {
					entries.forEach(function (e) { measure(e.target._repoioWrapper || e.target); });
				}),
				bQueued = false,
				scan = function () {
					bQueued = false;
					document.querySelectorAll(".sapFDynamicPageContentWrapper:not([data-repoio-sh])").forEach(function (el) {
						el.setAttribute("data-repoio-sh", "");
						oSize.observe(el);
						var t = el.parentElement && el.parentElement.querySelector(":scope > .sapFDynamicPageTitleWrapper");
						if (t) { t._repoioWrapper = el; oSize.observe(t); }
					});
				};
			new MutationObserver(function () {
				if (!bQueued) { bQueued = true; window.requestAnimationFrame(scan); }
			}).observe(document.body, { childList: true, subtree: true });
			scan();
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
				that = this,
				fnItem = function (n) {
					var oItem = new NavigationListItem({
						key: n.key, text: fnText(n.key), icon: n.icon || "",
						expanded: !!q || (n.items || []).some(function (c) { return c.key === that._sSelectedKey; }),
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
			else if (sKey === "newWorkflow") { oRouter.navTo("workflow"); }
			else if (sKey === "dataJobs") { oRouter.navTo("jobs"); }
			else if (sKey === "workflowsList") { oRouter.navTo("workflows"); }
			else if (sKey === "reports") { oRouter.navTo("reports"); }
			else if (sKey === "broadcasts") { oRouter.navTo("broadcasts"); }
			else if (sKey === "dataSync") { oRouter.navTo("dataSync"); }
			else if (sKey === "apiManagement") { oRouter.navTo("apiManagement"); }
			else if (sKey === "users") { oRouter.navTo("users"); }
			else if (sKey === "rolesAccess") { oRouter.navTo("roles"); }
			else if (sKey === "systemConfiguration") { oRouter.navTo("system"); }
			else if (sKey === "announcements") { oRouter.navTo("announcements"); }
			else if (sKey === "auditLog") { oRouter.navTo("audit"); }
			else if (sKey === "modelsRules") { oRouter.navTo("models"); }
			else if (sKey === "goldenRecords") { oRouter.navTo("goldenRecords"); }
			else if (sKey === "matchDetection") { oRouter.navTo("matches"); }
			else if (sKey === "quarantine") { oRouter.navTo("quarantine"); }
			else { oRouter.navTo("page", { key: sKey }); }
			if (this.getOwnerComponent().getModel("device").getProperty("/system/phone")) {
				this.byId("toolPage").setSideExpanded(false);
			}
		},

		_onRouteMatched: function (oEvent) {
			this.getOwnerComponent().getModel("view").setProperty("/shell/lang", this._lang());
			var sRoute = oEvent.getParameter("name"),
				sKey = sRoute === "page" ? oEvent.getParameter("arguments").key :
					sRoute === "home" ? "home" : sRoute === "connections" ? "connections" :
					sRoute === "ontology" ? "ontologyExplorer" : sRoute === "workflow" ? "newWorkflow" :
					sRoute === "jobs" || sRoute === "jobRun" || sRoute === "streams" ? "dataJobs" : sRoute === "workflows" ? "workflowsList" :
					sRoute === "reports" || sRoute === "report" || sRoute === "studio" ? "reports" : sRoute === "broadcasts" ? "broadcasts" :
					sRoute === "dataSync" || sRoute === "dataSyncFlow" ? "dataSync" : sRoute === "apiManagement" || sRoute === "apiReference" ? "apiManagement" : sRoute === "users" ? "users" : sRoute === "roles" ? "rolesAccess" : sRoute === "system" ? "systemConfiguration" : sRoute === "announcements" ? "announcements" : sRoute === "audit" ? "auditLog" : sRoute === "models" ? "modelsRules" : /^golden/.test(sRoute) ? "goldenRecords" : sRoute === "matches" ? "matchDetection" : sRoute === "quarantine" ? "quarantine" : "domains";
			this._sSelectedKey = sKey;
			if (this.byId("navList").getItems().length) { this._expandTo(sKey); this.byId("sideNavigation").setSelectedKey(sKey); }
		},

		/* A child page (e.g. Data jobs) can only be selected when its parent item is expanded. */
		_expandTo: function (sKey) {
			var fnWalk = function (aItems) {
				aItems.forEach(function (it) {
					var aSub = it.getItems ? it.getItems() : [];
					// Fiori side navigation: only the group of the current page stays open, so the tree fits the screen.
					if (it.isA("sap.tnt.NavigationListItem") && aSub.length) {
						it.setExpanded(aSub.some(function (c) { return c.getKey && c.getKey() === sKey; }));
					}
					fnWalk(aSub);
				});
			};
			fnWalk(this.byId("navList").getItems());
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

		/* Notifications open Feeds: the awareness stream (README §2.7). */
		onNotifications: function () {
			this.getOwnerComponent().getRouter().navTo("page", { key: "feeds" });
		},

		_lang: function () { return sap.ui.getCore().getConfiguration().getLanguage().indexOf("ar") === 0 ? "ar" : "en"; },

		/* Language menu: English (LTR) or Arabic (RTL); the page reloads in the chosen direction. */
		onLanguage: function (oEvent) {
			var sNext = oEvent.getParameter("item").getKey();
			if (sNext === this._lang()) { return; }
			try { localStorage.setItem("repoio-lang", sNext); } catch (e) { /* storage blocked */ }
			window.location.reload();
		},

		/* User card: who is signed in, their team and roles (from the synced user directory, ADR-0009), shortcuts to their
		   own work, and sign-out through Entra ID. */
		onTour: function () {
			var oB = this.getOwnerComponent().bundle;
			if (this._userPop && this._userPop.isOpen()) { this._userPop.close(); }
			Tour.start(this, function (k, a) { return oB.getText(k, a); });
		},

		onUser: function (oEvent) {
			var that = this, oSrc = oEvent.getSource(), oU = this.getOwnerComponent().getModel("users"), oB = this.getOwnerComponent().bundle,
				T = function (k, a) { return oB.getText(k, a); }, ar = this._lang() === "ar",
				nav = function (key, args) { oPop.close(); if (key === "users") { that.getOwnerComponent().getRouter().navTo("users", args); } else { that.getOwnerComponent().getRouter().navTo("page", { key: key }); } };
			if (this._userPop) { this._userPop.openBy(oSrc); return; }
			var oPop = this._userPop = new ResponsivePopover({ showHeader: false, placement: "Bottom", contentWidth: "20rem", content: [] }).addStyleClass("repoioUserCard");
			this.getView().addDependent(oPop);
			oU.dataLoaded().then(function () {
				var d = oU.getData(), e = d.employees.filter(function (x) { return x.id === "E-1001"; })[0] || {}, u = d.users.filter(function (x) { return x.employee === e.id; })[0] || { direct: [] },
					team = null, dept = null,
					walk = function (n, parent) { (n.units || []).forEach(function (c) { if (c.id === e.team) { team = c; dept = parent; } walk(c, c); }); };
				walk(d.org, d.org);
				var t = function (o) { return o ? (ar ? o.ar || o.en : o.en || o.ar) : ""; },
					roles = u.direct.map(function (k) { var r = d.roles.filter(function (x) { return x.id === k; })[0]; return t(r) || k; });
				oPop.addContent(new VBox({ renderType: "Bare", items: [
					new HBox({ alignItems: "Center", renderType: "Bare", items: [
						new Avatar({ initials: "MM", displaySize: "M" }).addStyleClass("sapUiSmallMarginEnd"),
						new VBox({ renderType: "Bare", items: [new Title({ text: e.name, level: "H3" }), new Text({ text: ar ? e.title_ar : e.title_en })] })
					] }).addStyleClass("repoioUserHead"),
					new VBox({ renderType: "Bare", items: [
						new Label({ text: T("shell.uc.team") }), new Text({ text: [t(team), t(dept)].filter(Boolean).join(" · ") }),
						new Label({ text: T("shell.uc.email") }).addStyleClass("sapUiTinyMarginTop"), new Text({ text: e.email, textDirection: "LTR" }),
						new Label({ text: T("shell.uc.roles") }).addStyleClass("sapUiTinyMarginTop"),
						new HBox({ wrap: "Wrap", renderType: "Bare", items: roles.map(function (r) { return new ObjectStatus({ text: r, state: "Information", inverted: true }).addStyleClass("repoioUserRole"); }) }),
						new Text({ text: T("shell.uc.signIn", [(u.lastSignIn || "").replace("T", " ").slice(0, 16)]) }).addStyleClass("repoioUmMuted sapUiTinyMarginTop")
					] }).addStyleClass("repoioUserBody"),
					new List({ showSeparators: "Inner", items: [
						new StandardListItem({ title: T("nav.myRequests"), icon: "sap-icon://request", type: "Active", press: function () { nav("myRequests"); } }),
						new StandardListItem({ title: T("nav.awaitingApproval"), icon: "sap-icon://inbox", type: "Active", press: function () { nav("awaitingApproval"); } }),
						new StandardListItem({ title: T("shell.uc.profile"), icon: "sap-icon://person-placeholder", type: "Active", press: function () { nav("users", { user: e.id }); } }),
						new StandardListItem({ title: T("tour.replay"), icon: "sap-icon://travel-request", type: "Active", press: function () { oPop.close(); that.onTour(); } }),
						new StandardListItem({ title: T("shell.uc.signOut"), icon: "sap-icon://log", type: "Active", press: function () { oPop.close(); MessageToast.show(T("shell.uc.signOutT")); } })
					] }).addStyleClass("repoioUserList")
				] }));
				oPop.openBy(oSrc);
			});
		}
	});
});
