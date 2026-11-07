sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device"
], function (UIComponent, JSONModel, Device) {
	"use strict";

	return UIComponent.extend("repoio.proto.Component", {
		metadata: {
			manifest: "json",
			interfaces: ["sap.ui.core.IAsyncContentCreation"]
		},

		init: function () {
			UIComponent.prototype.init.apply(this, arguments);
			this.setModel(new JSONModel(Device), "device");
			// Prototype-only UI state (filters, open source tabs, card layout).
			this.setModel(new JSONModel({}), "view");
			// The i18n model loads asynchronously; start routing once texts are available.
			this.bundleReady = Promise.resolve(this.getModel("i18n").getResourceBundle()).then(function (oBundle) {
				this.bundle = oBundle;
				this.getRouter().initialize();
				return oBundle;
			}.bind(this));
		},

		getContentDensityClass: function () {
			return "sapUiSizeCompact";
		}
	});
});
