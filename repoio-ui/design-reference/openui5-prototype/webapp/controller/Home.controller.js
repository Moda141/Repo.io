sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/TextArea",
	"sap/m/Label",
	"sap/m/List",
	"sap/m/StandardListItem",
	"sap/ui/unified/DateTypeRange",
	"sap/ui/core/library"
], function (BaseController, Filter, FilterOperator, MessageToast, Dialog, Button, TextArea, Label, List, StandardListItem, DateTypeRange, coreLibrary) {
	"use strict";

	var LAYOUT_KEY = "repoio-proto-home-cards",
		TODAY = new Date("2026-11-03T00:00:00");

	return BaseController.extend("repoio.proto.controller.Home", {
		onInit: function () {
			this.viewModel().setProperty("/lang", this.lang());
			this.viewModel().setProperty("/home", { f: { domain: "", source: "", status: "", period: "" }, filterText: "" });
			var oHome = this.getOwnerComponent().getModel("home");
			oHome.dataLoaded().then(this._onData.bind(this));
			this._restoreLayout();
		},

		_onData: function () {
			var oHome = this.getOwnerComponent().getModel("home");
			var that = this;
			this.data().dataLoaded().then(function () {
				that.viewModel().setProperty("/home/domainOptions", [{ key: "", text: that.text("common.all") }].concat(
					that.data().getProperty("/domains").map(function (d) { return { key: d.id, text: that.domainName(d) }; })));
				if (that.byId("fDomain")) { that.byId("fDomain").setSelectedKey(""); }
			});
			this._updateCounts();
			var aPipes = oHome.getProperty("/pipelines"),
				nWarn = aPipes.filter(function (p) { return p.state !== "Success"; }).length;
			this.viewModel().setProperty("/home/pipeStatus", this.text("home.pipeStatus", [aPipes.length - nWarn, aPipes.length]));
			this._drawCompleteness();
			var oCal = this.byId("runCalendar");
			oCal.setMinDate(new Date("2026-11-01T00:00:00")).setMaxDate(new Date("2026-11-30T00:00:00"));
			oCal.addSelectedDate(new DateTypeRange({ startDate: TODAY }));
			oCal.focusDate(TODAY);
			oHome.getProperty("/runDays").forEach(function (d) {
				oCal.addSpecialDate(new DateTypeRange({ startDate: new Date(d + "T00:00:00"), type: "Type08" }));
			});
		},

		_drawCompleteness: function () {
			var oHome = this.getOwnerComponent().getModel("home"), w = oHome.getProperty("/completeness/weeks"), c = this.colors, rtl = this.isRtl();
			this.byId("completenessChart").setOption({
				grid: { left: rtl ? 8 : 40, right: rtl ? 40 : 8, top: 12, bottom: 48 },
				legend: { bottom: 0, textStyle: { color: c.label, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
				tooltip: { trigger: "axis" },
				xAxis: { type: "category", inverse: rtl, data: w.map(function (x) { return x.week; }), axisLabel: { color: c.label }, axisLine: { lineStyle: { color: c.grid } } },
				yAxis: { type: "value", position: rtl ? "right" : "left", axisLabel: { color: c.label, formatter: function (v) { return v / 1000 + "K"; } }, splitLine: { lineStyle: { color: c.grid } } },
				series: [
					{ name: this.text("home.valid"), type: "bar", stack: "a", barWidth: 28, itemStyle: { color: c.brand }, data: w.map(function (x) { return x.valid; }) },
					{ name: this.text("home.issues"), type: "bar", stack: "a", itemStyle: { color: c.crit }, data: w.map(function (x) { return x.issues; }) }
				]
			});
		},

		/* ---------- Filters (shared by the request and merge cards) ---------- */
		onApplyFilters: function () {
			var f = this.viewModel().getProperty("/home/f"), aCr = [], aMerge = [], aText = [];
			if (f.domain) {
				aCr.push(new Filter("domain", FilterOperator.EQ, f.domain)); aMerge.push(new Filter("domain", FilterOperator.EQ, f.domain));
				aText.push(this.text("home.filter.domain") + ": " + this.byId("fDomain").getSelectedItem().getText());
			}
			if (f.source) {
				aCr.push(new Filter("source", FilterOperator.EQ, f.source)); aMerge.push(new Filter("source", FilterOperator.EQ, f.source));
				aText.push(this.text("home.filter.source") + ": " + this.byId("fSource").getSelectedItem().getText());
			}
			if (f.status) {
				aCr.push(new Filter("stateKey", FilterOperator.EQ, f.status));
				aText.push(this.text("home.filter.status") + ": " + this.byId("fStatus").getSelectedItem().getText());
			}
			if (f.period) {
				var dMin = new Date(TODAY.getTime() - Number(f.period) * 864e5).toISOString().slice(0, 10);
				aCr.push(new Filter("created", FilterOperator.GE, dMin)); aMerge.push(new Filter("detected", FilterOperator.GE, dMin));
				aText.push(this.text("home.filter.period") + ": " + this.byId("fPeriod").getSelectedItem().getText());
			}
			this._crFilters = aCr; this._mergeFilters = aMerge;
			this.byId("crList").getBinding("items").filter(aCr);
			this._filterMerge();
			this.viewModel().setProperty("/home/filterText", aText.length ? aText.join(" · ") : this.text("home.noFilters"));
			this._updateCounts();
		},

		onClearFilters: function () {
			this.viewModel().setProperty("/home/f", { domain: "", source: "", status: "", period: "" });
			this.onApplyFilters();
		},

		onMergeSearch: function (oEvent) {
			this._mergeQuery = oEvent.getParameter("newValue");
			this._filterMerge();
			this._updateCounts();
		},

		_filterMerge: function () {
			var a = (this._mergeFilters || []).slice();
			if (this._mergeQuery) { a.push(new Filter("customer", FilterOperator.Contains, this._mergeQuery)); }
			this.byId("mergeTable").getBinding("items").filter(a);
		},

		_updateCounts: function () {
			var oHome = this.getOwnerComponent().getModel("home"),
				nCr = this.byId("crList").getBinding("items") ? this.byId("crList").getBinding("items").getLength() : 4,
				nMerge = this.byId("mergeTable").getBinding("items") ? this.byId("mergeTable").getBinding("items").getLength() : 6;
			this.viewModel().setProperty("/home/crCount", this.text("home.countOf", [nCr, oHome.getProperty("/changeRequestsTotal")]));
			this.viewModel().setProperty("/home/mergeCount", this.text("home.countOf", [nMerge, oHome.getProperty("/mergeCandidatesTotal")]));
		},

		/* ---------- Card content helpers ---------- */
		recentType: function (k) { return k ? this.text("home.recent." + k) : ""; },
		recentDomain: function (k) { var d = this.data().getProperty("/domains").filter(function (x) { return x.id === k; })[0]; return this.domainName(d); },
		onRecentPress: function (e) { var r = e.getSource().getBindingContext("home").getObject(); this.router().navTo(r.route, r.args); },
		crStateText: function (k) { return k ? this.text("home.cr." + k) : ""; },
		crKindText: function (k) { return k ? this.text("home.kind." + k) : ""; },
		stageText: function (k) { return k ? this.text("home.stage." + k) : ""; },
		runText: function (k) { return k ? this.text("home.run." + k) : ""; },

		onDomainPress: function (oEvent) {
			this.router().navTo("domain", { domainId: oEvent.getSource().getBindingContext("data").getProperty("id") });
		},
		onOwnerDomain: function () { this.router().navTo("domain", { domainId: "customers" }); },
		onOwnerRepo: function () { this.router().navTo("repository", { domainId: "customers", repoId: "customer-master" }); },

		/* J4: approval needs no comment; rejection needs one. */
		onApprove: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("home").getObject();
			MessageToast.show(this.text("home.approved", [o.id]));
		},
		onReject: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("home").getObject(), that = this,
				oArea = new TextArea({ width: "100%", rows: 4, required: true, placeholder: this.text("home.rejectPlaceholder"),
					liveChange: function (e) { oOk.setEnabled(!!e.getParameter("value").trim()); } }),
				oOk = new Button({ text: this.text("home.reject"), type: "Reject", enabled: false, press: function () {
					MessageToast.show(that.text("home.rejected", [o.id])); oDialog.close();
				} }),
				oDialog = new Dialog({
					title: this.text("home.rejectTitle", [o.id]), contentWidth: "28rem",
					content: [new Label({ text: this.text("home.rejectComment"), required: true, labelFor: oArea }), oArea],
					beginButton: oOk,
					endButton: new Button({ text: this.text("common.cancel"), press: function () { oDialog.close(); } }),
					afterClose: function () { oDialog.destroy(); }
				}).addStyleClass("sapUiContentPadding");
			this.getView().addDependent(oDialog);
			oDialog.open();
		},
		onCalendarSelect: function () { /* the calendar is informational in the prototype */ },

		/* ---------- Card layout: drag & drop, show / hide, persisted per browser ---------- */
		onCardDrop: function (oEvent) {
			var oDragged = oEvent.getParameter("draggedControl"), oDropped = oEvent.getParameter("droppedControl"),
				sPos = oEvent.getParameter("dropPosition"), oGrid = this.byId("cards"),
				iDrag = oGrid.indexOfItem(oDragged), iDrop = oGrid.indexOfItem(oDropped);
			oGrid.removeItem(oDragged);
			if (iDrag < iDrop) { iDrop--; }
			if (sPos === "After") { iDrop++; }
			oGrid.insertItem(oDragged, iDrop);
			this._saveLayout();
		},

		_cardTitle: function (oCard) {
			var oHeader = oCard.getHeader();
			return oHeader && oHeader.getTitle ? oHeader.getTitle() : oCard.getId();
		},

		_saveLayout: function () {
			var oGrid = this.byId("cards"), sPrefix = this.createId("");
			this.store(LAYOUT_KEY, oGrid.getItems().map(function (c) {
				return { id: c.getId().replace(sPrefix, ""), visible: c.getVisible() };
			}));
		},

		_restoreLayout: function () {
			var aSaved = this.store(LAYOUT_KEY), oGrid = this.byId("cards"), that = this;
			if (!Array.isArray(aSaved)) { return; }
			aSaved.forEach(function (s, i) {
				var oCard = that.byId(s.id);
				if (!oCard) { return; }
				oGrid.removeItem(oCard); oGrid.insertItem(oCard, i); oCard.setVisible(s.visible !== false);
			});
		},

		onManageCards: function () {
			var oGrid = this.byId("cards"), that = this,
				oList = new List({ mode: "MultiSelect", includeItemNavigation: true }),
				oDialog;
			oGrid.getItems().forEach(function (c) {
				oList.addItem(new StandardListItem({ title: that._cardTitle(c), selected: c.getVisible() }).data("card", c.getId()));
			});
			oDialog = new Dialog({
				title: this.text("home.manageCards"), contentWidth: "24rem", content: [oList],
				buttons: [
					new Button({ text: this.text("home.resetCards"), type: "Transparent", press: function () {
						try { localStorage.removeItem(LAYOUT_KEY); } catch (e) { /* ignore */ }
						window.location.reload();
					} }),
					new Button({ text: this.text("common.save"), type: "Emphasized", press: function () {
						oList.getItems().forEach(function (li) { sap.ui.getCore().byId(li.data("card")).setVisible(li.getSelected()); });
						that._saveLayout(); oDialog.close();
					} }),
					new Button({ text: this.text("common.cancel"), press: function () { oDialog.close(); } })
				],
				afterClose: function () { oDialog.destroy(); }
			});
			this.getView().addDependent(oDialog);
			oDialog.open();
		}
	});
});
