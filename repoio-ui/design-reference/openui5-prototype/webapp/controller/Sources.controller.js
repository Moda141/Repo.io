sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/ActionSheet",
	"sap/m/Button"
], function (BaseController, ActionSheet, Button) {
	"use strict";

	/* Multi Instance: open sources of the current repository stay as tabs until closed. */
	return BaseController.extend("repoio.proto.controller.Sources", {
		onInit: function () {
			this._open = {};
			this.router().getRoute("sources").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this;
			this._args = oEvent.getParameter("arguments");
			this.data().dataLoaded().then(function () { that._load(); });
		},

		_load: function () {
			var a = this._args, oData = this.data(), R = oData.getProperty("/repos/" + a.repoId);
			if (!R || !oData.getProperty("/sources/" + a.sourceId)) { this.router().getTargets().display("placeholder"); return; }
			var d = oData.getProperty("/domains").filter(function (x) { return x.id === R.domainId; })[0];
			var aOpen = this._open[a.repoId] || R.sourceIds.slice();
			if (aOpen.indexOf(a.sourceId) < 0) { aOpen.push(a.sourceId); }
			this._open[a.repoId] = aOpen;
			this.viewModel().setProperty("/sources", {
				repoName: R.name, domainName: this.domainName(d),
				open: aOpen.map(function (s) { return oData.getProperty("/sources/" + s); })
			});
			this._select(a.sourceId);
		},

		_select: function (sId) {
			var oTabs = this.byId("tabs");
			var oItem = oTabs.getItems().filter(function (i) { return i.getKey() === sId; })[0];
			if (oItem) { oTabs.setSelectedItem(oItem); }
		},

		_item: function (v) { return typeof v === "string" ? sap.ui.getCore().byId(v) : v; },

		onSelectTab: function (oEvent) {
			var oItem = this._item(oEvent.getParameter("item"));
			if (!oItem) { return; }
			var sKey = oItem.getKey();
			if (sKey === this._args.sourceId) { return; }
			this.router().navTo("sources", Object.assign({}, this._args, { sourceId: sKey }), true);
		},

		onCloseTab: function (oEvent) {
			oEvent.preventDefault();
			var sKey = this._item(oEvent.getParameter("item")).getKey(), aOpen = this._open[this._args.repoId];
			if (aOpen.length === 1) { return; }
			aOpen.splice(aOpen.indexOf(sKey), 1);
			if (sKey === this._args.sourceId) {
				this.router().navTo("sources", Object.assign({}, this._args, { sourceId: aOpen[0] }), true);
			} else { this._load(); }
		},

		onAddTab: function (oEvent) {
			var that = this, oData = this.data(), aOpen = this._open[this._args.repoId],
				aClosed = oData.getProperty("/repos/" + this._args.repoId + "/sourceIds").filter(function (s) { return aOpen.indexOf(s) < 0; }),
				oSheet = new ActionSheet({ title: this.text("src.openSource"), showCancelButton: true,
					afterClose: function () { oSheet.destroy(); } });
			if (!aClosed.length) { oSheet.addButton(new Button({ text: this.text("src.allOpen"), enabled: false })); }
			aClosed.forEach(function (s) {
				oSheet.addButton(new Button({ text: oData.getProperty("/sources/" + s + "/name"), press: function () {
					aOpen.push(s); that.router().navTo("sources", Object.assign({}, that._args, { sourceId: s }));
				} }));
			});
			this.getView().addDependent(oSheet);
			oSheet.openBy(oEvent.getSource ? oEvent.getSource() : this.byId("tabs"));
		},

		onRepoPress: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject();
			this.router().navTo("repository", { domainId: o.domainId, repoId: o.id });
		},

		onTablePress: function (oEvent) {
			var t = oEvent.getSource().getBindingContext("view").getObject(),
				sSource = oEvent.getSource().getBindingContext("view").getPath().split("/")[3];
			var src = this.viewModel().getProperty("/sources/open/" + sSource + "/id");
			this.router().navTo("table", Object.assign({}, this._args, { sourceId: src, schema: t.schema, tableId: t.id }));
		},

		onToDomains: function () { this.router().navTo("domains"); },
		onToDomain: function () { this.router().navTo("domain", { domainId: this._args.domainId }); },
		onToRepo: function () { this.router().navTo("repository", { domainId: this._args.domainId, repoId: this._args.repoId }); }
	});
});
