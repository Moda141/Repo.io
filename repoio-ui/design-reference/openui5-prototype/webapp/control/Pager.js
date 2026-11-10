/*
 * Pager — Previous / Next paging bar for long sap.m tables (replaces the "More" growing button).
 * The owner keeps the full row list and shows one page; this control only tracks page and size
 * and fires "change". It hides itself when everything fits on one page.
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/m/OverflowToolbar",
	"sap/m/ToolbarSpacer",
	"sap/m/Text",
	"sap/m/Label",
	"sap/m/Select",
	"sap/m/Button",
	"sap/ui/core/Item"
], function (Control, OverflowToolbar, ToolbarSpacer, Text, Label, Select, Button, Item) {
	"use strict";

	return Control.extend("repoio.proto.control.Pager", {
		metadata: {
			properties: {
				total: { type: "int", defaultValue: 0 },
				page: { type: "int", defaultValue: 1 },
				pageSize: { type: "int", defaultValue: 25 }
			},
			aggregations: { _bar: { type: "sap.m.OverflowToolbar", multiple: false, visibility: "hidden" } },
			events: { change: { parameters: { page: { type: "int" }, pageSize: { type: "int" } } } }
		},

		init: function () {
			this._range = new Text({ wrapping: false });
			this._sizeLbl = new Label({ text: "{i18n>pager.size}" });
			this._size = new Select({ width: "5rem", items: [10, 25, 50, 100].map(function (n) { return new Item({ key: String(n), text: String(n) }); }),
				change: function (e) { this._go(1, Number(e.getParameter("selectedItem").getKey())); }.bind(this) });
			this._prev = new Button({ text: "{i18n>pager.prev}", icon: "sap-icon://navigation-left-arrow", type: "Transparent",
				press: function () { this._go(this.getPage() - 1); }.bind(this) });
			this._pageTxt = new Text({ wrapping: false });
			this._next = new Button({ text: "{i18n>pager.next}", icon: "sap-icon://navigation-right-arrow", iconFirst: false, type: "Transparent",
				press: function () { this._go(this.getPage() + 1); }.bind(this) });
			this.setAggregation("_bar", new OverflowToolbar({ style: "Clear", content: [
				this._range, new ToolbarSpacer(), this._sizeLbl, this._size, this._prev, this._pageTxt, this._next
			] }).addStyleClass("repoioPager"));
		},

		pages: function () { return Math.max(1, Math.ceil(this.getTotal() / this.getPageSize())); },

		_go: function (p, size) {
			if (size) { this.setProperty("pageSize", size, true); }
			p = Math.min(Math.max(1, p), this.pages());
			this.setPage(p);
			this.fireChange({ page: p, pageSize: this.getPageSize() });
		},

		onBeforeRendering: function () {
			var that = this, oModel = this.getModel("i18n");
			if (!this._b && oModel) {
				Promise.resolve(oModel.getResourceBundle()).then(function (b) { that._b = b; that.invalidate(); });
			}
			var total = this.getTotal(), size = this.getPageSize(), pages = this.pages(), page = Math.min(this.getPage(), pages),
				from = total ? (page - 1) * size + 1 : 0, to = Math.min(total, page * size), b = this._b;
			this._size.setSelectedKey(String(size));
			this._prev.setEnabled(page > 1);
			this._next.setEnabled(page < pages);
			this._range.setText(b ? b.getText("pager.range", [from, to, total]) : "");
			this._pageTxt.setText(b ? b.getText("pager.page", [page, pages]) : "");
		},

		renderer: {
			apiVersion: 2,
			render: function (oRm, oControl) {
				oRm.openStart("div", oControl);
				oRm.class("repoioPagerWrap");
				if (oControl.getTotal() <= oControl.getPageSize()) { oRm.style("display", "none"); }
				oRm.openEnd();
				oRm.renderControl(oControl.getAggregation("_bar"));
				oRm.close("div");
			}
		}
	});
});
