sap.ui.define(["sap/ui/core/mvc/Controller"], function (Controller) {
	"use strict";
	return Controller.extend("repoio.proto.controller.Placeholder", {
		onInit: function () {
			var oRouter = this.getOwnerComponent().getRouter();
			oRouter.getRoute("page").attachPatternMatched(this._onMatched, this);
			oRouter.attachBypassed(this._onMatched.bind(this, null));
		},
		_onMatched: function (oEvent) {
			var oBundle = this.getOwnerComponent().bundle,
				sKey = oEvent && oEvent.getParameter("arguments").key,
				bKnown = sKey && oBundle.hasText("nav." + sKey);
			this.getOwnerComponent().getModel("view").setProperty("/placeholder", {
				title: bKnown ? oBundle.getText("nav." + sKey) : oBundle.getText("placeholder.notFound"),
				text: bKnown && oBundle.hasText("scope." + sKey) ?
					oBundle.getText("scope." + sKey) + "\n\n" + oBundle.getText("placeholder.text") :
					oBundle.getText("placeholder.text"),
				journey: bKnown && oBundle.hasText("journey." + sKey) ? oBundle.getText("journey." + sKey) : ""
			});
		}
	});
});
