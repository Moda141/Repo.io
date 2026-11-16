sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"repoio/proto/util/repoConnect",
	"repoio/proto/util/folders"
], function (BaseController, MessageToast, RepoConnect, Fld) {
	"use strict";

	var STATUS = { Deployed: "published", Draft: "draft", Archived: "retired" },
		STATUS_STATE = { published: "Success", draft: "Information", retired: "None" },
		STATUS_ICON = { published: "sap-icon://sys-enter-2", draft: "sap-icon://edit", retired: "sap-icon://locked" },
		DOMAIN_COLOR = { customers: "Accent6", products: "Accent8", vendors: "Accent5", authors: "Accent3", employees: "Accent9", stores: "Accent2" },
		CLASS_STATE = { public: "Success", internal: "Information", confidential: "Warning" },
		KIND_ICON = { bi: "sap-icon://bar-chart", platform: "sap-icon://cloud", agent: "sap-icon://ai", app: "sap-icon://chain-link" },
		DIMS = ["completeness", "validity", "uniqueness", "consistency", "timeliness"];

	/* One data product: overview, fields, sources, quality, access and consumers. Read only (ADR-0006 for access). */
	return BaseController.extend("repoio.proto.controller.DataProduct", Object.assign({}, RepoConnect, {
		onInit: function () {
			this.viewModel().setProperty("/dpo", {});
			this.router().getRoute("dataProduct").attachPatternMatched(this._onMatched, this);
		},
		_onMatched: function (oEvent) {
			var that = this, C = this.getOwnerComponent();
			this._id = oEvent.getParameter("arguments").id;
			Promise.all([this.data().dataLoaded(), C.getModel("products").dataLoaded(), C.getModel("rules").dataLoaded()]).then(function () {
				that._show();
				var op = that.byId("op");
				op.setSelectedSection(op.getSections()[0]);
			});
		},
		_show: function () {
			var that = this, T = this.text.bind(this), C = this.getOwnerComponent(), n = this.fmt.num, ar = this.lang() === "ar",
				r = this.data().getProperty("/repos/" + this._id), p = C.getModel("products").getProperty("/products/" + this._id);
			if (!r || !p) { this.router().navTo("dataProducts", {}, true); return; }
			var domains = this.data().getProperty("/domains"), sources = this.data().getProperty("/sources"),
				d = domains.filter(function (x) { return x.id === r.domainId; })[0], st = STATUS[r.status] || "draft", pub = st !== "draft",
				table = Fld.repoFolder(r), ent = p.entity;
			this._domainId = r.domainId;
			var chips = [{ text: T("dp.class." + p.classification), state: CLASS_STATE[p.classification], icon: "sap-icon://shield", inv: false }];
			if (p.pii.length) { chips.push({ text: T("dp.pii"), state: "Warning", icon: "sap-icon://private", inv: true }); }
			r.tags.forEach(function (t) { chips.push({ text: t, state: "None", icon: "", inv: true }); });

			var cols = (C.getModel("rules").getProperty("/repoColumns/" + this._id) || []).map(function (c) {
				return { col: c.col, name: ar ? c.ar : c.en, kindText: T("dp.kind." + (c.kind || "text")), hint: (ar ? c.hintAr : c.hintEn) || "",
					derived: !!c.derived, pii: p.pii.indexOf(c.col) > -1 };
			});
			this._fields = cols;

			var dims = p.dims ? DIMS.map(function (k) {
				var v = p.dims[k];
				return { label: T("dp.dim." + k), value: v, text: v.toFixed(1) + "%", state: v >= 95 ? "Success" : v >= 85 ? "Information" : v >= 75 ? "Warning" : "Error" };
			}) : [];
			var channels = C.getModel("products").getProperty("/channels").map(function (c) {
				return { icon: c.icon, name: T("dp.ch." + c.key), desc: T("dp.ch." + c.key + ".d"), milestoneText: T("dp.planned", [c.milestone]),
					endpoint: c.endpoint.replace("{table}", table).replace("{entity}", ent) };
			});
			var consumers = p.consumers.map(function (c) {
				return { name: c.name, icon: KIND_ICON[c.kind], toolText: T("dp.kindc." + c.kind) + " · " + c.tool, owner: c.owner, lastRead: c.lastRead,
					readsText: n(c.reads) };
			});

			this.viewModel().setProperty("/dpo", {
				title: r.name, icon: d ? d.icon : "sap-icon://product", color: DOMAIN_COLOR[r.domainId] || "Accent6",
				domainText: this.domainName(d), typeLine: T("dp.typeLine", [this.domainName(d)]), versionText: T("dp.version", [p.version]),
				published: st === "published", hasRecords: pub && !!C.getModel("golden").getProperty("/repos/" + this._id),
				statusText: T("dp.status." + st), statusState: STATUS_STATE[st], statusIcon: STATUS_ICON[st],
				updatedText: p.refreshed ? T("dp.refreshedOn", [p.refreshed]) : T("dp.notRefreshed"),
				goldenText: pub ? n(r.golden) : "—", qualityNum: pub ? r.quality.toFixed(1) : "—", qualityState: pub ? r.qualityState : "None",
				banner: st === "draft" ? T("dp.banner.draft") : st === "retired" ? T("dp.banner.retired") : "", bannerType: st === "draft" ? "Information" : "Warning",
				owners: r.owners, chips: chips,
				facts: [
					{ label: T("home.filter.domain"), value: this.domainName(d), dir: "Inherit" },
					{ label: T("dp.team"), value: d ? (ar ? d.teamAr : d.team) : "—", dir: "Inherit" },
					{ label: T("repo.model"), value: r.model, dir: "Inherit" }
				],
				desc: ar ? p.purposeAr : p.purposeEn,
				uses: (ar ? p.useAr : p.useEn).map(function (u) { return { text: u }; }),
				details: [
					{ label: T("dp.d.repo"), value: r.code, dir: "LTR", mono: true },
					{ label: T("dp.d.table"), value: "iceberg.golden." + table, dir: "LTR", mono: true },
					{ label: T("repo.model"), value: r.model, dir: "Inherit" },
					{ label: T("dp.d.version"), value: p.version, dir: "LTR" },
					{ label: T("dp.d.published"), value: p.published || "—", dir: "LTR" },
					{ label: T("dp.d.cadence"), value: T("dp.cadence." + p.cadence), dir: "Inherit" },
					{ label: T("dp.d.class"), value: T("dp.class." + p.classification), dir: "Inherit" },
					{ label: T("dp.d.changes"), value: "changes." + ent, dir: "LTR", mono: true }
				],
				fq: "", fields: cols, fieldsTitle: T("dp.fieldsTitle", [cols.length]),
				sources: r.sourceRows.map(function (s) {
					return { priority: String(s.priority), name: s.name, type: s.type, tables: String(s.tables), rowsText: n(s.rows),
						qualityText: that.fmt.pct(s.quality), qualityState: s.qualityState };
				}).sort(function (a, b) { return a.priority - b.priority; }),
				hasDims: !!p.dims, dims: dims, channels: channels,
				consumers: consumers, consumersTitle: T("dp.consumersTitle", [consumers.length])
			});
			this._trend(p);
		},
		_trend: function (p) {
			var c = this.colors, rtl = this.isRtl(), days = (this.data().getProperty("/trend") || []).map(function (t) { return t.d; });
			this.byId("dpTrend").setOption(!p.trend.length ? null : {
				animation: false, grid: { left: rtl ? 8 : 36, right: rtl ? 36 : 8, top: 8, bottom: 22 }, tooltip: { trigger: "axis" },
				xAxis: { type: "category", inverse: rtl, data: days.slice(-p.trend.length), axisLabel: { color: c.label, fontSize: 11 }, axisLine: { lineStyle: { color: c.grid } } },
				yAxis: { type: "value", position: rtl ? "right" : "left", min: function (v) { return Math.floor(v.min - 2); }, max: 100,
					axisLabel: { color: c.label, fontSize: 11 }, splitLine: { lineStyle: { color: c.grid } } },
				series: [{ type: "line", data: p.trend, smooth: true, symbolSize: 5, lineStyle: { color: c.brand, width: 2 }, itemStyle: { color: c.brand },
					areaStyle: { color: "rgba(88,153,218,0.12)" } }]
			});
		},
		onFieldSearch: function (e) {
			var q = (e.getParameter("newValue") || "").toLowerCase(), f = this._fields.filter(function (x) {
				return !q || (x.name + " " + x.col + " " + x.hint).toLowerCase().indexOf(q) > -1;
			});
			this.viewModel().setProperty("/dpo/fields", f);
			this.viewModel().setProperty("/dpo/fieldsTitle", this.text("dp.fieldsTitle", [f.length]));
		},
		onConnect: function () { this._openRepoConnect(this._id); },
		onBrowse: function () { this.router().navTo("goldenRecords", { repo: this._id }); },
		onBack: function () { this.router().navTo("dataProducts"); },
		onBackDomain: function () { this.router().navTo("domains", { item: this._domainId }); },
		onCopyLink: function () {
			var that = this, url = window.location.href.split("#")[0] + "#/data-products/" + encodeURIComponent(this._id),
				done = function () { MessageToast.show(that.text("cat.linkCopied")); };
			try { navigator.clipboard.writeText(url).then(done, done); } catch (err) { done(); }
		}
	}));
});
