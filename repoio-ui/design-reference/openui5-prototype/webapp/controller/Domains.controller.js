sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast"
], function (BaseController, MessageToast) {
	"use strict";

	function short(n) { return n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "K" : String(n); }

	/* SAP Datasphere "Space Management" layout for master-data domains. */
	return BaseController.extend("repoio.proto.controller.Domains", {
		onInit: function () {
			this.viewModel().setProperty("/lang", this.lang());
			this.viewModel().setProperty("/domains", { mode: "cards", items: [], selected: 0 });
			this.router().getRoute("domains").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			var that = this;
			this.data().dataLoaded().then(function () { that._load(); });
		},

		_load: function () {
			var that = this, oData = this.data(), repos = oData.getProperty("/repos"), q = (this._q || "").toLowerCase();
			var capAll = 0, goldenAll = 0, owners = {}, src = {}, pub = 0, nRepos = 0, qSum = 0, qN = 0;
			var all = oData.getProperty("/domains").map(function (d) {
				var cap = 0, own = {}, attention = 0;
				d.repos.forEach(function (r) {
					var R = repos[r]; cap += R.cap; nRepos++;
					if (R.status === "Deployed") { pub++; }
					if (["Warning", "Error"].indexOf(R.healthState) > -1) { attention++; }
					R.owners.forEach(function (o) { own[o.name] = owners[o.name] = true; });
					R.sourceIds.forEach(function (s) { src[s] = true; });
				});
				capAll += cap; goldenAll += d.golden; if (d.quality !== null) { qSum += d.quality; qN++; }
				var hs = !d.repoCount ? "None" : attention ? "Warning" : "Success";
				return Object.assign({}, d, {
					selected: false, title: that.domainName(d), techName: d.nameEn.toUpperCase().replace(/[^A-Z]+/g, "_").replace(/_$/, ""),
					teamText: that.lang() === "ar" ? d.teamAr : d.team, ownerCount: Object.keys(own).length,
					healthState: hs, healthText: !d.repoCount ? that.text("domains.noRepo") : attention ? that.text("health.attention") : that.text("health.healthy"),
					healthIcon: hs === "Success" ? "sap-icon://sys-enter-2" : hs === "Warning" ? "sap-icon://alert" : "sap-icon://border",
					updatedText: that.text("dsp.updatedOn", [d.updated]),
					capPct: cap ? d.golden / cap * 100 : 0, capText: cap ? that.text("space.ofCap", [that.fmt.num(d.golden), that.fmt.num(cap)]) : "0"
				});
			});
			var items = all.filter(function (d) { return !q || [d.title, d.nameEn, d.techName, d.teamText, d.owner].join(" ").toLowerCase().indexOf(q) > -1; });
			var nSrc = Object.keys(src).length, nAllSrc = Object.keys(oData.getProperty("/sources")).length, avg = qSum / qN;
			this.viewModel().setProperty("/domains", Object.assign(this.viewModel().getProperty("/domains"), {
				items: items, selected: 0, count: String(all.length), owners: String(Object.keys(owners).length),
				healthy: String(all.filter(function (d) { return d.healthState === "Success"; }).length),
				attention: String(all.filter(function (d) { return d.healthState === "Warning"; }).length),
				empty: String(all.filter(function (d) { return !d.repoCount; }).length),
				capPct: goldenAll / capAll * 100, capText: this.text("space.ofCap", [short(goldenAll), short(capAll)]),
				pubPct: pub / nRepos * 100, pubText: this.text("space.ofCap", [pub, nRepos]),
				quality: avg, qualityText: this.fmt.pct(avg),
				srcPct: nSrc / nAllSrc * 100, srcText: this.text("space.ofSources", [nSrc, nAllSrc]),
				summary: this.text("domains.kpi.summary", [all.length, nRepos, this.fmt.num(goldenAll)])
			}));
		},

		onCardSelect: function () { this._countSelected(); },
		onTableSelect: function () { this._countSelected(); },
		_countSelected: function () {
			var n = this.viewModel().getProperty("/domains/mode") === "table" ? this.byId("domainsTable").getSelectedItems().length :
				this.viewModel().getProperty("/domains/items").filter(function (d) { return d.selected; }).length;
			this.viewModel().setProperty("/domains/selected", n);
		},
		onSearch: function (e) { this._q = e.getParameter("newValue"); this._load(); },
		onCreate: function () { MessageToast.show(this.text("alp.createToast")); },
		onEdit: function () { MessageToast.show(this.text("alp.editToast")); },
		onDelete: function () { MessageToast.show(this.text("alp.deleteToast")); },
		onMonitor: function () { this.navKey("dataJobs"); }
	});
});
