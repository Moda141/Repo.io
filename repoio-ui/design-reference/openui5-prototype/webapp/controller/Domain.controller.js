sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast"
], function (BaseController, MessageToast) {
	"use strict";

	/* Spaces page: one card per repository of the domain (ADR-0001), with a status chart in the header. */
	return BaseController.extend("repoio.proto.controller.Domain", {
		onInit: function () {
			this.viewModel().setProperty("/lang", this.lang());
			this.router().getRoute("domain").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var sId = oEvent.getParameter("arguments").domainId, that = this;
			this._q = "";
			this.data().dataLoaded().then(function () { that._load(sId); });
		},

		_load: function (sId) {
			var oData = this.data(), that = this, d = oData.getProperty("/domains").filter(function (x) { return x.id === sId; })[0];
			if (!d) { this.router().getTargets().display("placeholder"); return; }
			var q = (this._q || "").toLowerCase(), cap = 0, src = {}, owners = {};
			var all = d.repos.map(function (r) {
				var R = oData.getProperty("/repos/" + r);
				cap += R.cap; R.sourceIds.forEach(function (s) { src[s] = true; }); R.owners.forEach(function (o) { owners[o.name] = true; });
				return Object.assign({}, R, {
					selected: false,
					capPct: Math.min(100, R.golden / R.cap * 100),
					capText: that.text("space.ofCap", [that.fmt.num(R.golden), that.fmt.num(R.cap)]),
					deployedText: R.deployed === "—" ? that.text("repo.notDeployed") : that.text("space.deployedOn", [R.deployed]),
					sourceNames: R.sourceIds.map(function (s) { return oData.getProperty("/sources/" + s + "/name"); }).join(" · ")
				});
			});
			var repos = all.filter(function (R) { return !q || (R.name + " " + R.code + " " + R.model).toLowerCase().indexOf(q) > -1; });
			var cnt = function (st) { return all.filter(function (R) { return st.indexOf(R.healthState) > -1; }).length; };
			var nSrc = Object.keys(src).length, nAllSrc = Object.keys(oData.getProperty("/sources")).length;
			this._domainId = sId;
			this.viewModel().setProperty("/domain", {
				id: sId, name: this.domainName(d), nameEn: d.nameEn, owner: d.owner, teamText: this.lang() === "ar" ? d.teamAr : d.team,
				repoCount: d.repoCount, quality: d.quality, qualityState: d.qualityState,
				ownerCount: Object.keys(owners).length, healthy: cnt(["Success"]), attention: cnt(["Warning", "Error"]), drafts: cnt(["Information"]), archived: cnt(["None"]),
				capPct: cap ? d.golden / cap * 100 : 0, capText: this.text("space.ofCap", [this.fmt.num(d.golden), this.fmt.num(cap)]),
				srcPct: nSrc / nAllSrc * 100, srcText: this.text("space.ofSources", [nSrc, nAllSrc]),
				summary: this.text("domain.summary", [d.repoCount, this.fmt.num(d.golden)]),
				repoText: this.text("domain.repoTitle", [repos.length]),
				mode: this.viewModel().getProperty("/domain/mode") || "cards", selected: 0,
				repos: repos
			});
			if (d.repoCount) { this._drawStatus(all); }
		},

		_drawStatus: function (all) {
			var c = this.colors, rtl = this.isRtl(), that = this,
				keys = ["healthy", "attention", "draft", "archived"], col = { healthy: c.pos, attention: c.crit, draft: c.info, archived: c.neutral },
				val = { healthy: 0, attention: 0, draft: 0, archived: 0 };
			all.forEach(function (R) { val[R.healthKey === "failed" ? "attention" : R.healthKey]++; });
			this.byId("statusChart").setOption({
				tooltip: { trigger: "item" },
				grid: { left: 0, right: 0, top: 4, bottom: 28 },
				xAxis: { type: "value", show: false, inverse: rtl, max: all.length },
				yAxis: { type: "category", show: false, data: [""] },
				legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11, color: c.text } },
				series: keys.filter(function (k) { return val[k]; }).map(function (k) {
					return { name: that.text("health." + k), type: "bar", stack: "s", barWidth: 22, data: [val[k]], itemStyle: { color: col[k] },
						label: { show: true, color: "#fff", fontWeight: "bold" } };
				})
			});
		},

		onCardSelect: function () { this._countSelected(); },
		onTableSelect: function () { this._countSelected(); },
		_countSelected: function () {
			var mode = this.viewModel().getProperty("/domain/mode");
			var n = mode === "table" ? this.byId("repoTable").getSelectedItems().length :
				this.viewModel().getProperty("/domain/repos").filter(function (R) { return R.selected; }).length;
			this.viewModel().setProperty("/domain/selected", n);
		},

		onSearch: function (e) { this._q = e.getParameter("newValue"); this._load(this._domainId); },
		onRepoPress: function (e) {
			var o = e.getSource().getBindingContext("view").getObject();
			this.router().navTo("repository", { domainId: this._domainId, repoId: o.id });
		},
		onToDomains: function () { this.router().navTo("domains"); },
		onAddRepo: function () { MessageToast.show(this.text("domain.addRepoToast")); }
	});
});
