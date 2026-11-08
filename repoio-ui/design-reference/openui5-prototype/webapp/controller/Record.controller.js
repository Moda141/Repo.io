sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast"
], function (BaseController, MessageToast) {
	"use strict";

	var ICON = { customers: "sap-icon://customer", products: "sap-icon://course-book", vendors: "sap-icon://supplier", authors: "sap-icon://edit" };
	var COLOR = { customers: "Accent6", products: "Accent4", vendors: "Accent8", authors: "Accent2" };

	/* J2 — golden record view: attributes with survivorship provenance, source records, relationships, history, lineage. */
	return BaseController.extend("repoio.proto.controller.Record", {
		onInit: function () {
			this.viewModel().setProperty("/lang", this.lang());
			this.router().getRoute("record").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var id = oEvent.getParameter("arguments").recordId, that = this;
			this.data().dataLoaded().then(function () { that._load(id); });
		},

		_load: function (id) {
			var oData = this.data(), r = oData.getProperty("/goldenIndex").filter(function (x) { return x.id === id; })[0];
			if (!r) { this.router().getTargets().display("placeholder"); return; }
			var d = oData.getProperty("/domains").filter(function (x) { return x.id === r.domainId; })[0], that = this;
			var srcCol = { h: this.text("lin.col.sources"), nodes: r.sources.map(function (s) {
				var S = oData.getProperty("/sources/" + s.id);
				return { t: S.name, i: "db", kv: [[that.text("repo.lastSync"), S.sync.slice(5)]], st: S.state === "Success" ? "pos" : "crit" };
			}) };
			var lineage = [srcCol,
				{ h: this.text("lin.col.pipeline"), nodes: [{ t: "standardise → dq", i: "pipe", kv: [["Great Expectations", this.fmt.pct(r.quality)]], st: r.quality >= 85 ? "pos" : "crit" }] },
				{ h: this.text("lin.col.match"), nodes: [{ t: "Splink match", i: "pipe", kv: [[this.text("repo.matchProb"), r.prob.toFixed(2)]], st: r.prob >= 0.9 ? "pos" : "crit" }] },
				{ h: this.text("rec.golden"), nodes: [{ t: r.name, i: "gold", kv: [["ID", r.id]], current: true }] },
				{ h: this.text("lin.col.consumers"), nodes: [{ t: "SAP C4C (write-back)", i: "db", kv: [[this.text("lin.via"), "Workflow"]] }, { t: "Power BI", i: "chart", kv: [[this.text("lin.via"), "Trino"]] }] }];
			var edges = [];
			r.sources.forEach(function (s, i) { edges.push([0, i, 1, 0]); });
			edges.push([1, 0, 2, 0], [2, 0, 3, 0], [3, 0, 4, 0], [3, 0, 4, 1]);
			this._rec = r;
			this.viewModel().setProperty("/rec", Object.assign({}, r, {
				domainName: this.domainName(d), icon: ICON[r.domainId], iconColor: COLOR[r.domainId],
				reviewText: this.text(r.stateKey === "neg" ? "rec.reviewConflict" : r.stateKey === "neutral" ? "rec.reviewArchived" : "rec.review"),
				lineage: lineage, edges: edges,
				lineageTypes: { db: this.text("lin.db"), pipe: this.text("lin.pipe"), table: this.text("lin.table"), gold: this.text("lin.gold"), chart: this.text("lin.chart") }
			}));
			this.byId("page").setSelectedSection(this.byId("secAttrs"));
		},

		changeText: function (k) { return k ? this.text("rec.change." + k) : ""; },
		onRequestChange: function () { MessageToast.show(this.text("rec.requestToast", [this._rec.id])); this.navKey("templatesCatalog"); },
		onAddRelationship: function () { this.navKey("relationshipBuilder"); },
		onUnmerge: function () { MessageToast.show(this.text("rec.unmergeToast")); },
		onNav: function (e) { this.navKey(e.getSource().data("key")); },
		onToExplore: function () { this.router().navTo("explore"); },
		onToDomain: function () { this.router().navTo("domain", { domainId: this._rec.domainId }); },
		onToRepo: function () { this.router().navTo("repository", { domainId: this._rec.domainId, repoId: this._rec.repoId }); }
	});
});
