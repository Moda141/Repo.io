/*
 * SwaggerDoc — OpenUI5 wrapper for Swagger UI (swagger-ui-dist 5.17.14, Apache 2.0; README §7.2:
 * third-party libraries live inside a custom control and follow the UI5 rendering/destroy lifecycle).
 * Renders one OpenAPI 3.1 document. "Try it out" is off in the prototype; in the product it calls
 * the API gateway with the signed-in user's identity, never a shared key.
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/ui/dom/includeStylesheet",
	"repoio/proto/thirdparty/swagger-ui-bundle"
], function (Control, includeStylesheet) {
	"use strict";

	var cssLoaded = false;

	return Control.extend("repoio.proto.control.SwaggerDoc", {
		metadata: {
			properties: {
				spec: { type: "object" },
				tryItOut: { type: "boolean", defaultValue: false },
				height: { type: "sap.ui.core.CSSSize", defaultValue: "auto" }
			}
		},

		renderer: {
			apiVersion: 2,
			render: function (oRm, oControl) {
				oRm.openStart("div", oControl);
				oRm.class("repoioSwagger");
				oRm.attr("dir", "ltr"); // the reference is code-first and stays left to right in both languages
				oRm.style("height", oControl.getHeight());
				oRm.openEnd();
				oRm.openStart("div", oControl.getId() + "-ui").openEnd().close("div");
				oRm.close("div");
			}
		},

		init: function () {
			if (!cssLoaded) {
				cssLoaded = true;
				includeStylesheet(sap.ui.require.toUrl("repoio/proto/thirdparty/swagger-ui.css"), "repoio-swagger-css");
			}
		},

		setSpec: function (oSpec) {
			this.setProperty("spec", oSpec, true);
			this._mount();
			return this;
		},

		onAfterRendering: function () { this._mount(); },

		_mount: function () {
			var oNode = this.getDomRef("ui"), oSpec = this.getSpec(), Lib = window.SwaggerUIBundle;
			if (!oNode || !oSpec || !Lib) { return; }
			if (this._mounted === oSpec && oNode.childNodes.length) { return; }
			this._unmount();
			this._mounted = oSpec;
			var oHost = document.createElement("div"); // a fresh host per document, so no stale React root is reused
			oNode.appendChild(oHost);
			this._ui = Lib({
				domNode: oHost,
				spec: JSON.parse(JSON.stringify(oSpec)),
				deepLinking: false,
				docExpansion: "list",
				defaultModelsExpandDepth: 0,
				defaultModelExpandDepth: 2,
				displayOperationId: false,
				filter: false,
				supportedSubmitMethods: this.getTryItOut() ? ["get", "post", "put", "patch", "delete"] : [],
				validatorUrl: null,
				syntaxHighlight: { activated: true, theme: "agate" }
			});
		},

		_unmount: function () {
			var oNode = this.getDomRef("ui");
			if (oNode) { while (oNode.firstChild) { oNode.removeChild(oNode.firstChild); } }
			this._ui = null;
			this._mounted = null;
		},

		exit: function () { this._unmount(); }
	});
});
