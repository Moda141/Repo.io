sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/List",
	"sap/m/StandardListItem",
	"sap/m/Popover",
	"sap/m/SearchField",
	"sap/m/Table",
	"sap/m/Column",
	"sap/m/ColumnListItem",
	"sap/m/Text",
	"sap/m/Toolbar",
	"repoio/proto/util/rating"
], function (BaseController, MessageToast, Dialog, Button, List, StandardListItem, Popover, SearchField, Table, Column, ColumnListItem, Text, Toolbar, Rating) {
	"use strict";

	var FILTERS = ["status", "id", "name", "mobile", "gov", "seg", "src", "quality"],
		DEFAULT_SHOW = { status: true, id: true, name: true, mobile: true, gov: true, seg: true, src: false, quality: false },
		COLS = ["image", "seg", "mobile", "gov", "src", "quality", "rating", "status", "changed"],
		SEG_ICON = { teacher: "sap-icon://education", retailer: "sap-icon://retail-store", callCenter: "sap-icon://call", student: "sap-icon://family-care",
			charityStudent: "sap-icon://heart" },
		SEG_COLOR = { teacher: "Accent6", retailer: "Accent8", callCenter: "Accent5", student: "Accent3", charityStudent: "Accent2" },
		VARIANTS = {
			standard: {},
			teachers: { seg: ["teacher"] },
			review: { status: "review" },
			lowQuality: { quality: "low" }
		},
		EMPTY = function () { return { q: "", status: "", id: "", name: "", mobile: "", gov: [], seg: [], src: [], quality: "" }; };

	/* J2: golden records list. Filters apply on Go (Fiori List Report); the variant shows "*" when the filters differ from
	   it. In the product the rows come from the golden records API (paged and filtered on the server). */
	return BaseController.extend("repoio.proto.controller.GoldenRecords", {
		onInit: function () {
			var show = this.store("repoio-gr-show") || DEFAULT_SHOW, cols = this.store("repoio-gr-cols") || {};
			COLS.forEach(function (k) { if (cols[k] === undefined) { cols[k] = true; } });
			this.viewModel().setProperty("/gr", { repo: "customer-master", variant: "standard", f: EMPTY(), applied: EMPTY(), show: show, cols: cols,
				page: 1, size: 25, sel: "" });
			this.router().getRoute("goldenRecords").attachPatternMatched(this._onMatched, this);
		},
		_onMatched: function (oEvent) {
			var that = this, sRepo = (oEvent.getParameter("arguments") || {}).repo, oG = this.getOwnerComponent().getModel("golden"),
				oR = this.getOwnerComponent().getModel("rules");
			Promise.all([oG.dataLoaded(), oR.dataLoaded(), this.data().dataLoaded ? this.data().dataLoaded() : null]).then(function () {
				that._g = oG.getData();
				if (sRepo) { that.viewModel().setProperty("/gr/repo", sRepo); }
				that._lists();
				that._apply();
			});
		},
		_ar: function () { return this.lang() === "ar"; },
		_t: function (o) { return o ? (this._ar() ? o.ar || o.en : o.en || o.ar) : ""; },
		_repoData: function () { return this._g.repos[this.viewModel().getProperty("/gr/repo")]; },
		_segments: function () {
			var m = (this.getOwnerComponent().getModel("rules").getProperty("/models") || []).filter(function (x) { return x.repo === this.viewModel().getProperty("/gr/repo"); }, this)[0];
			return (m && m.segments) || [];
		},
		_srcName: function (id) { var s = (this.data().getProperty("/sources") || {})[id]; return s ? s.name : id; },

		/* value lists for the filter bar */
		_lists: function () {
			var that = this, vm = this.viewModel(), repos = this.data().getProperty("/repos") || {}, rd = this._repoData();
			vm.setProperty("/gr/repos", Object.keys(repos).filter(function (k) { return repos[k].statusKey !== "archived"; }).map(function (k) {
				return { key: k, text: repos[k].name + " · " + that.domainName((that.data().getProperty("/domains") || []).filter(function (d) { return d.id === repos[k].domainId; })[0]) };
			}));
			var rows = rd ? rd.rows : [], uniq = function (f) { return rows.map(f).filter(function (v, i, a) { return v && a.indexOf(v) === i; }); };
			vm.setProperty("/gr/govs", uniq(function (r) { return r.state; }).sort().map(function (k) { return { key: k, text: that.text("gov." + k) }; }));
			vm.setProperty("/gr/segs", this._segments().map(function (s) { return { key: s.key, text: that._t(s) }; }));
			vm.setProperty("/gr/srcs", uniq(function (r) { return r.sources.join(","); }).join(",").split(",").filter(function (v, i, a) { return v && a.indexOf(v) === i; })
				.map(function (k) { return { key: k, text: that._srcName(k) }; }));
		},
		_match: function (r, f) {
			var q = (f.q || "").trim().toLowerCase(), segs = this._segments(), seg = segs.filter(function (s) { return s.key === r.segment; })[0];
			if (q && [r.id, r.name, r.mobile, r.territory, this.text("gov." + r.state), seg ? this._t(seg) : ""].join(" ").toLowerCase().indexOf(q) < 0) { return false; }
			if (f.status && r.status !== f.status) { return false; }
			if (f.id && r.id.toLowerCase().indexOf(f.id.trim().toLowerCase()) < 0) { return false; }
			if (f.name && r.name.indexOf(f.name.trim()) < 0) { return false; }
			if (f.mobile && r.mobile.indexOf(f.mobile.replace(/\D/g, "")) < 0) { return false; }
			if (f.gov.length && f.gov.indexOf(r.state) < 0) { return false; }
			if (f.seg.length && f.seg.indexOf(r.segment) < 0) { return false; }
			if (f.src.length && !f.src.some(function (s) { return r.sources.indexOf(s) > -1; })) { return false; }
			if (f.quality === "low" && r.quality >= 80) { return false; }
			if (f.quality === "mid" && (r.quality < 80 || r.quality >= 90)) { return false; }
			if (f.quality === "high" && r.quality < 90) { return false; }
			return true;
		},
		_active: function (f) {
			return FILTERS.filter(function (k) { var v = f[k]; return Array.isArray(v) ? v.length : !!v; }).length + (f.q ? 1 : 0);
		},
		_same: function (a, b) { return JSON.stringify(a) === JSON.stringify(b); },
		_variantFilters: function (k) { var f = EMPTY(), v = VARIANTS[k] || {}; Object.keys(v).forEach(function (x) { f[x] = JSON.parse(JSON.stringify(v[x])); }); return f; },

		_apply: function () {
			var that = this, vm = this.viewModel(), g = vm.getProperty("/gr"), rd = this._repoData(), segs = this._segments(),
				all = rd ? rd.rows.filter(function (r) { return that._match(r, g.applied); }) : [],
				size = g.size, pages = Math.max(1, Math.ceil(all.length / size)), page = Math.min(g.page, pages),
				ST = { unchanged: ["None", ""], openCr: ["Information", "sap-icon://request"], review: ["Warning", "sap-icon://inspect"] };
			this._all = all;
			vm.setProperty("/gr/page", page);
			vm.setProperty("/gr/count", all.length);
			vm.setProperty("/gr/rows", all.slice((page - 1) * size, page * size).map(function (r) {
				var seg = segs.filter(function (s) { return s.key === r.segment; })[0];
				return { id: r.id, name: r.name, mobile: r.mobile, stateName: that.text("gov." + r.state), territory: r.territory, changed: r.changed, changedBy: r.changedBy,
					segText: seg ? that._t(seg) : "—", acctText: that.text("gr.acct", [r.accountType]),
					icon: r.image || SEG_ICON[r.segment] || "sap-icon://customer", color: SEG_COLOR[r.segment] || "Accent6",
					stars: r.rating ? r.rating.stars : 0, rating: r.rating, ratingTip: r.rating ? that.text("rt.tip", [r.rating.stars, r.rating.score]) : "",
					srcText: r.sources.map(function (s) { return that._srcName(s); }).join(" · "),
					qualityText: r.quality.toFixed(1), qualityState: r.quality >= 90 ? "Success" : r.quality >= 80 ? "Warning" : "Error",
					statusText: that.text("gr.st." + r.status), statusState: ST[r.status][0], statusIcon: ST[r.status][1], selected: r.id === g.sel };
			}));
			vm.setProperty("/gr/countText", this.text("gr.count", [this.fmt.num(all.length)]));
			vm.setProperty("/gr/noData", rd ? this.text("gr.noMatch") : this.text("gr.noSample"));
			vm.setProperty("/gr/total", rd ? this.fmt.num(rd.total) : "—");
			this._header();
		},
		_header: function () {
			var that = this, vm = this.viewModel(), g = vm.getProperty("/gr"), n = this._active(g.f), stale = !this._same(g.f, g.applied),
				changed = !this._same(g.applied, this._variantFilters(g.variant));
			vm.setProperty("/gr/variants", Object.keys(VARIANTS).map(function (k) { return { key: k, text: that.text("gr.v." + k), current: k === g.variant }; }));
			vm.setProperty("/gr/variantText", this.text("gr.v." + g.variant) + (changed ? " *" : ""));
			vm.setProperty("/gr/adaptText", this.text(n ? "gr.adaptN" : "gr.adapt", [n]));
			vm.setProperty("/gr/stale", stale);
			vm.setProperty("/gr/staleText", this.text("gr.stale"));
			vm.setProperty("/gr/filterSummary", n ? this.text("gr.filtered", [n]) : this.text("gr.noFilters"));
			var rd = this._repoData();
			vm.setProperty("/gr/sampleNote", rd ? this.text("gr.sampleNote", [this.fmt.num(rd.rows.length), this.fmt.num(rd.total)]) : "");
		},

		/* ---------- filter bar ---------- */
		onFilterChange: function () { this._header(); },
		onGo: function () {
			var vm = this.viewModel();
			vm.setProperty("/gr/applied", JSON.parse(JSON.stringify(vm.getProperty("/gr/f"))));
			vm.setProperty("/gr/page", 1);
			this._apply();
		},
		onRepo: function () {
			var vm = this.viewModel();
			vm.setProperty("/gr/sel", "");
			this.router().navTo("goldenRecords", { repo: vm.getProperty("/gr/repo") }, true);
			this._lists();
			this._apply();
		},
		onVariant: function (oEvent) {
			var k = oEvent.getParameter("item").getKey(), vm = this.viewModel(), f = this._variantFilters(k);
			vm.setProperty("/gr/variant", k);
			vm.setProperty("/gr/f", f);
			vm.setProperty("/gr/applied", JSON.parse(JSON.stringify(f)));
			vm.setProperty("/gr/page", 1);
			// a variant can only filter on fields the filter bar shows
			Object.keys(VARIANTS[k]).forEach(function (x) { vm.setProperty("/gr/show/" + x, true); });
			this._apply();
		},
		/* Adapt Filters: choose which fields the filter bar shows (SAP "Adapt Filters" dialog). */
		onAdapt: function () {
			var that = this, vm = this.viewModel(), show = vm.getProperty("/gr/show"),
				oList = new List({ mode: "MultiSelect", includeItemInSelection: true, items: FILTERS.map(function (k) {
					var f = vm.getProperty("/gr/f/" + k), on = Array.isArray(f) ? f.length : !!f;
					return new StandardListItem({ title: that.text("gr.f." + k), info: on ? that.text("gr.inUse") : "", infoState: "Information", selected: !!show[k] }).data("k", k);
				}) }),
				oDlg = new Dialog({ title: this.text("gr.adaptTitle"), contentWidth: "24rem", content: [oList],
					beginButton: new Button({ text: this.text("gr.ok"), type: "Emphasized", press: function () {
						oList.getItems().forEach(function (it) {
							var k = it.data("k");
							vm.setProperty("/gr/show/" + k, it.getSelected());
							if (!it.getSelected()) { vm.setProperty("/gr/f/" + k, Array.isArray(vm.getProperty("/gr/f/" + k)) ? [] : ""); }
						});
						that.store("repoio-gr-show", vm.getProperty("/gr/show"));
						oDlg.close();
						that._header();
					} }),
					endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
					afterClose: function () { oDlg.destroy(); } });
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		/* Value help for the record ID: search the records and pick one. */
		onValueHelp: function () {
			var that = this, vm = this.viewModel(), rd = this._repoData(), rows = rd ? rd.rows : [],
				oTable = new Table({ mode: "SingleSelectMaster", growing: true, growingThreshold: 12, columns: [
					new Column({ header: new Text({ text: this.text("gr.c.id") }) }), new Column({ header: new Text({ text: this.text("gr.c.name") }) })] }),
				fill = function (q) {
					oTable.destroyItems();
					rows.filter(function (r) { return !q || (r.id + " " + r.name).toLowerCase().indexOf(q.toLowerCase()) > -1; }).forEach(function (r) {
						oTable.addItem(new ColumnListItem({ cells: [new Text({ text: r.id, textDirection: "LTR" }), new Text({ text: r.name })] }).data("id", r.id));
					});
				},
				oDlg = new Dialog({ title: this.text("gr.f.id"), contentWidth: "30rem", contentHeight: "26rem",
					subHeader: new Toolbar({ content: [new SearchField({ liveChange: function (e) { fill(e.getParameter("newValue")); } })] }),
					content: [oTable],
					endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
					afterClose: function () { oDlg.destroy(); } });
			oTable.attachSelectionChange(function (e) {
				vm.setProperty("/gr/f/id", e.getParameter("listItem").data("id"));
				that._header();
				oDlg.close();
			});
			fill("");
			this.getView().addDependent(oDlg);
			oDlg.open();
		},

		/* ---------- table ---------- */
		onPage: function (oEvent) {
			var vm = this.viewModel();
			vm.setProperty("/gr/page", oEvent.getParameter("page"));
			vm.setProperty("/gr/size", oEvent.getParameter("pageSize"));
			this._apply();
		},
		onSelect: function (oEvent) {
			var o = oEvent.getParameter("listItem").getBindingContext("view").getObject();
			this.viewModel().setProperty("/gr/sel", o.id);
		},
		_go: function (id, sub) {
			var repo = this.viewModel().getProperty("/gr/repo");
			if (sub === "lineage") { this.router().navTo("goldenLineage", { repo: repo, id: id }); } else { this.router().navTo("goldenRecord", { repo: repo, id: id }); }
		},
		onOpen: function (oEvent) { this._go(oEvent.getSource().getBindingContext("view").getProperty("id")); },
		onRating: function (oEvent) {
			var r = oEvent.getSource().getBindingContext("view").getProperty("rating");
			if (r) { Rating.open(this, r, oEvent.getSource()); }
		},
		onOpenSelected: function () { this._go(this.viewModel().getProperty("/gr/sel")); },
		onLineage: function () { this._go(this.viewModel().getProperty("/gr/sel"), "lineage"); },
		/* Golden records are never created or edited here: these start a change request (J3). */
		onCreate: function () { MessageToast.show(this.text("gr.t.create")); },
		onCopy: function () { MessageToast.show(this.text("gr.t.copy", [this.viewModel().getProperty("/gr/sel")])); },
		onExport: function () { MessageToast.show(this.text("gr.t.export", [this.fmt.num((this._all || []).length)])); },
		onShare: function () {
			var url = window.location.href;
			try { navigator.clipboard.writeText(url).catch(function () { /* clipboard blocked */ }); } catch (e) { /* clipboard blocked */ }
			MessageToast.show(this.text("gr.t.share"));
		},
		onColumns: function (oEvent) {
			var vm = this.viewModel(), that = this, oCols = vm.getProperty("/gr/cols"),
				oList = new List({ mode: "MultiSelect", includeItemInSelection: true, items: COLS.map(function (k) {
					return new StandardListItem({ title: that.text("gr.c." + k), selected: !!oCols[k] }).data("col", k);
				}), selectionChange: function (e) {
					e.getParameter("listItems").forEach(function (it) { vm.setProperty("/gr/cols/" + it.data("col"), it.getSelected()); });
					that.store("repoio-gr-cols", vm.getProperty("/gr/cols"));
				} }),
				oPop = new Popover({ title: this.text("gr.columns"), placement: "Bottom", contentWidth: "15rem", content: [oList], afterClose: function () { oPop.destroy(); } });
			this.getView().addDependent(oPop);
			oPop.openBy(oEvent.getSource());
		}
	});
});
