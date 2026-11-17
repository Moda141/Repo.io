sap.ui.define([
	"sap/ui/core/Control",
	"sap/m/ResponsivePopover",
	"sap/m/List",
	"sap/m/StandardListItem"
], function (Control, ResponsivePopover, List, StandardListItem) {
	"use strict";

	/* Multi-value cell of the grid tables (SAP Fiori "tokens" column): one value shows as a token, several as an
	   "n Items" link that opens the list, a plain value as text. values: string | string[]. */
	return Control.extend("repoio.proto.control.TokenCell", {
		metadata: {
			properties: {
				values: { type: "any", defaultValue: null },
				itemsText: { type: "string", defaultValue: "{0} Items" },
				title: { type: "string", defaultValue: "" },
				state: { type: "string", defaultValue: "None" }
			}
		},
		renderer: {
			apiVersion: 2,
			render: function (rm, c) {
				var v = c.getValues(), arr = Array.isArray(v) ? v.filter(function (x) { return x !== null && x !== undefined && x !== ""; }) : null;
				rm.openStart("div", c).class("repoioTok");
				if (c.getState() !== "None") { rm.class("repoioTok" + c.getState()); }
				rm.openEnd();
				if (arr && arr.length > 1) {
					rm.openStart("a").class("repoioTokMore").attr("href", "#").attr("role", "button").attr("aria-haspopup", "dialog").openEnd();
					rm.text(c.getItemsText().replace("{0}", arr.length)).close("a");
				} else if (arr && arr.length === 1) {
					rm.openStart("span").class("repoioTokOne").attr("title", String(arr[0])).openEnd().text(String(arr[0])).close("span");
				} else if (arr) {
					rm.openStart("span").class("repoioTokNone").openEnd().text("—").close("span");
				} else {
					rm.openStart("span").class(v === null || v === undefined || v === "" ? "repoioTokNone" : "repoioTokText").attr("title", v === null || v === undefined ? "" : String(v))
						.openEnd().text(v === null || v === undefined || v === "" ? "—" : String(v)).close("span");
				}
				rm.close("div");
			}
		},
		onclick: function (e) {
			if (!e.target.classList.contains("repoioTokMore")) { return; }
			e.preventDefault();
			var that = this, v = this.getValues();
			var pop = new ResponsivePopover({ title: this.getTitle() || this.getItemsText().replace("{0}", v.length), placement: "Auto", contentWidth: "16rem",
				content: [new List({ showSeparators: "Inner", items: v.map(function (x) { return new StandardListItem({ title: String(x) }); }) })],
				afterClose: function () { pop.destroy(); } });
			that.addDependent(pop);
			pop.openBy(e.target);
		}
	});
});
