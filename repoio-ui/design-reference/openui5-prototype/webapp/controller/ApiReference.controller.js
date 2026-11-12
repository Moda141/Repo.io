sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast"
], function (BaseController, MessageToast) {
	"use strict";

	var AREA = ["data", "stewardship", "integration", "process", "agents", "platform", "admin"],
		KIND = { rest: "sap-icon://chain-link", graphql: "sap-icon://overview-chart", mcp: "sap-icon://da" };

	/* API reference (J16): one OpenAPI 3.1 document per API family; the catalog in API management links here. */
	return BaseController.extend("repoio.proto.controller.ApiReference", {
		onInit: function () {
			this.viewModel().setProperty("/ref", { q: "", items: [], sel: {} });
			this.router().getRoute("apiReference").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this, oM = this.getOwnerComponent().getModel("apidocs"), sId = oEvent.getParameter("arguments").api;
			oM.dataLoaded().then(function () {
				that._docs = oM.getProperty("/docs");
				that._select(sId || that._docs[0]["x-repoio"].id);
			});
		},

		_items: function () {
			var that = this, vm = this.viewModel(), q = (vm.getProperty("/ref/q") || "").toLowerCase(), sel = vm.getProperty("/ref/sel/id");
			vm.setProperty("/ref/items", this._docs.filter(function (d) {
				return !q || (d.info.title + " " + Object.keys(d.paths).join(" ") + " " + d.info.description).toLowerCase().indexOf(q) > -1;
			}).map(function (d) {
				var x = d["x-repoio"], n = Object.keys(d.paths).reduce(function (s, p) { return s + Object.keys(d.paths[p]).length; }, 0);
				return {
					id: x.id, title: d.info.title, icon: KIND[x.kind] || KIND.rest, ms: x.deprecated ? that.text("ref.deprecated") : x.milestone,
					deprecated: x.deprecated, pathsText: that.text("ref.ops", [n]),
					areaText: (AREA.indexOf(x.area) + 1) + ". " + that.text("ref.area." + x.area), selected: x.id === sel
				};
			}));
		},

		_select: function (sId) {
			var d = this._docs.filter(function (x) { return x["x-repoio"].id === sId; })[0] || this._docs[0], x = d["x-repoio"], vm = this.viewModel();
			vm.setProperty("/ref/sel", {
				id: x.id, title: d.info.title, version: d.info.version, icon: KIND[x.kind] || KIND.rest, base: d.servers[0].url, spec: d,
				statusText: x.deprecated ? this.text("ref.deprecatedUntil", [x.sunset]) : this.text("ref.planned", [x.milestone]),
				statusState: x.deprecated ? "Warning" : "Information", statusIcon: x.deprecated ? "sap-icon://past" : "sap-icon://pending"
			});
			this._items();
		},

		onSearch: function () { this._items(); },
		onPick: function (oEvent) {
			var id = oEvent.getParameter("listItem").getBindingContext("view").getProperty("id");
			this.router().navTo("apiReference", { api: id }, true);
		},
		onBack: function () { this.router().navTo("apiManagement"); },
		onDownload: function () {
			var s = this.viewModel().getProperty("/ref/sel");
			try {
				var a = document.createElement("a"), url = URL.createObjectURL(new Blob([JSON.stringify(s.spec, null, 2)], { type: "application/json" }));
				a.href = url; a.download = s.id + "-" + s.version + ".openapi.json"; document.body.appendChild(a); a.click(); a.remove();
				setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
			} catch (e) { MessageToast.show(this.text("ref.t.downloadFail")); }
		},
		onCopyLink: function () {
			var that = this, link = window.location.href.split("#")[0] + "#/integration/api/reference/" + this.viewModel().getProperty("/ref/sel/id");
			try { navigator.clipboard.writeText(link).then(function () { MessageToast.show(that.text("api.t.copied")); }); } catch (e) { MessageToast.show(link); }
		}
	});
});
