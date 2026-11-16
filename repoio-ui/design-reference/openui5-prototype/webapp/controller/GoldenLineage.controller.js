sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/lineage",
	"sap/m/MessageToast"
], function (BaseController, Lin, MessageToast) {
	"use strict";

	/* J2: full-screen column lineage of one golden record. "?col=node.column" opens with that column traced. */
	return BaseController.extend("repoio.proto.controller.GoldenLineage", {
		onInit: function () {
			this.viewModel().setProperty("/gl", {});
			this.router().getRoute("goldenLineage").attachPatternMatched(this._onMatched, this);
		},
		_onMatched: function (oEvent) {
			var that = this, a = oEvent.getParameter("arguments"), q = a["?query"] || {}, oG = this.getOwnerComponent().getModel("golden"), oR = this.getOwnerComponent().getModel("rules");
			this._repo = a.repo; this._id = a.id;
			Promise.all([oG.dataLoaded(), oR.dataLoaded(), this.data().dataLoaded ? this.data().dataLoaded() : null]).then(function () {
				var rd = oG.getProperty("/repos/" + a.repo), rec = rd && rd.rows.filter(function (r) { return r.id === a.id; })[0], vm = that.viewModel();
				if (!rd || !rec) { vm.setProperty("/gl", { title: that.text("go.notFound"), cols: [] }); return; }
				var d = rd.details[rec.id], L = rd.lineage, lin = that.byId("glLineage"), vals = Lin.values(L, d.prov, d.sourceRows, that.text("gov." + rec.state)),
					home = L.nodes.filter(function (n) { return n.home; })[0], sel = (q.col || "").split("."),
					cols = (oR.getProperty("/repoColumns/" + a.repo) || []).reduce(function (m, c) { m[c.col] = that.lang() === "ar" ? c.ar : c.en; return m; }, {});
				vm.setProperty("/gl", { name: rec.name, title: that.text("gl.title", [rec.name, rec.id]),
					col: sel.length === 2 && sel[0] === home.key ? sel[1] : "mobile_1",
					cols: home.cols.map(function (c) { return { key: c[0], text: (cols[c[0]] || c[0]) + " · " + c[0], value: (vals[home.key] || {})[c[0]] || "" }; }) });
				lin.setNodes(L.nodes); lin.setEdges(L.edges); lin.setTexts(Lin.texts(that)); lin.setValues(vals);
				lin.setUpLevels(3); lin.setDownLevels(2);
				lin.setSelected(sel.length === 2 ? { node: sel[0], col: sel[1] } : { node: home.key, col: vm.getProperty("/gl/col") });
				lin.resetView();
			});
		},
		onCol: function () {
			var lin = this.byId("glLineage"), home = lin.getNodes().filter(function (n) { return n.home; })[0];
			lin.setSelected({ node: home.key, col: this.viewModel().getProperty("/gl/col") });
		},
		onSelect: function (oEvent) {
			var n = oEvent.getParameter("node"), home = this.byId("glLineage").getNodes().filter(function (x) { return x.home; })[0];
			if (n === home.key) { this.viewModel().setProperty("/gl/col", oEvent.getParameter("col")); }
		},
		onNode: function (oEvent) { MessageToast.show(this.text("go.t.node", [oEvent.getParameter("node")])); },
		onList: function () { this.router().navTo("goldenRecords", { repo: this._repo }); },
		onRecord: function () { this.router().navTo("goldenRecord", { repo: this._repo, id: this._id }); }
	});
});
