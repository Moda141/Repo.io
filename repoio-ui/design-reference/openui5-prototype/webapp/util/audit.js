/*
 * One way for console pages to append to the audit trail (UX rule 4). In the product the API writes the entry with the
 * change itself — the console never writes audit records; in the prototype this appends to the sample admin model so the
 * Audit log page shows what the page did.
 */
sap.ui.define([], function () {
	"use strict";
	return {
		/* o: { area, action, type, object, en, ar, before, after, ref: { route, args } } */
		log: function (c, o) {
			var oM = c.getOwnerComponent().getModel("admin");
			oM.dataLoaded().then(function () {
				var d = oM.getData();
				d.audit.unshift(Object.assign({ at: d.now.slice(0, 16) + ":00", actor: "محمد" }, o));
			});
		}
	};
});
