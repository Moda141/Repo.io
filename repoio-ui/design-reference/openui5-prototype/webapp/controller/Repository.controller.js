sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"repoio/proto/util/repoConnect",
	"repoio/proto/util/rating",
	"repoio/proto/util/semantic"
], function (BaseController, MessageToast, RepoConnect, Rating, Sem) {
	"use strict";

	var HEALTH_ICON = { healthy: "sap-icon://sys-enter-2", attention: "sap-icon://alert", draft: "sap-icon://edit", archived: "sap-icon://locked" },
		STATE_ICON = { Success: "sap-icon://sys-enter-2", Warning: "sap-icon://alert", Error: "sap-icon://error", None: "" },
		GOLDEN = { pos: "golden.pos", crit: "golden.crit", neg: "golden.neg" };

	/* Repository page (Domain management). Read only; model from Models & rules (model/rules.json), the rest sample data. */
	return BaseController.extend("repoio.proto.controller.Repository", Object.assign({}, RepoConnect, {
		onInit: function () {
			this.viewModel().setProperty("/rp", {});
			this.router().getRoute("repository").attachPatternMatched(this._onMatched, this);
		},
		_onMatched: function (oEvent) {
			var that = this, C = this.getOwnerComponent();
			this._id = oEvent.getParameter("arguments").repo;
			Promise.all([this.data().dataLoaded(), C.getModel("rules").dataLoaded(), C.getModel("golden").dataLoaded(), C.getModel("tables").dataLoaded()]).then(function () {
				that._show();
				if (that._golden) { that.onGoldenFilter(); }
				var op = that.byId("op");
				op.setSelectedSection(op.getSections()[0]);
			});
		},

		_show: function () {
			var that = this, T = this.text.bind(this), n = this.fmt.num, ar = this.lang() === "ar", C = this.getOwnerComponent(), D = this.data(),
				r = D.getProperty("/repos/" + this._id);
			if (!r) { this.router().navTo("domains", {}, true); return; }
			var d = D.getProperty("/domains").filter(function (x) { return x.id === r.domainId; })[0], sources = D.getProperty("/sources"),
				M = (C.getModel("rules").getProperty("/models") || []).filter(function (m) { return m.repo === r.id; })[0],
				cols = C.getModel("rules").getProperty("/repoColumns/" + r.id) || [],
				goldenIds = (C.getModel("golden").getProperty("/repos/" + r.id + "/details")) || {},
				deployed = r.status === "Deployed";
			this._domainId = r.domainId;
			this._model = M;

			// Attributes: repository columns with their role in matching and survivorship rule (from the match model)
			var role = function (col) {
				if (!M) { return "—"; }
				var c = M.comparisons.filter(function (x) { return x.field === col && x.on; })[0],
					b = M.blocking.some(function (x) { return x.fields.indexOf(col) > -1; }), out = [];
				if (c) { out.push(T("rp.role." + c.method)); }
				if (b) { out.push(T("rp.role.block")); }
				return out.join(" · ") || "—";
			};
			var surv = function (col) {
				if (!M) { return "—"; }
				var S = M.survivorship, r1 = S.rules.filter(function (x) { return x.col === col; })[0],
					g = S.groups.filter(function (x) { return x.cols.indexOf(col) > -1; })[0];
				return T("mr.rule." + (r1 ? r1.rule : g ? g.rule : "sourcePriority"));
			};
			this._attrs = cols.map(function (c) {
				return { col: c.col, label: ar ? c.ar : c.en, derived: !!c.derived, kindText: T("rp.kind." + (c.kind || "text")), role: role(c.col), surv: surv(c.col) };
			});

			var prio = (M ? M.survivorship.priority : r.sourceRows.slice().sort(function (a, b) { return a.priority - b.priority; }).map(function (s) { return s.id; }))
				.map(function (s, i) { return (i + 1) + ". " + (sources[s] ? sources[s].name : s); }).join("  ›  ");
			var matchFacts = M ? [
				{ label: T("rp.autoMerge"), value: M.consolidation.auto ? "≥ " + M.consolidation.autoMerge.toFixed(2) : T("rp.off"), dir: "LTR" },
				{ label: T("rp.review"), value: M.consolidation.review.toFixed(2) + " – " + M.consolidation.autoMerge.toFixed(2), dir: "LTR" },
				{ label: T("rp.requestStop"), value: "≥ " + M.requestCheck.stop.toFixed(2), dir: "LTR" },
				{ label: T("repo.blocking"), value: M.blocking.map(function (b) { return b.fields.join(" + "); }).join("  ·  "), dir: "LTR" },
				{ label: T("rp.segmentBy"), value: M.segmentBy ? M.segmentBy + " (" + M.segments.length + ")" : "—", dir: "LTR" },
				{ label: T("repo.priority"), value: prio, dir: "Inherit" }
			] : [];

			// Golden records: the golden records API sample when there is one (customer-master), otherwise the repository sample
			var G = C.getModel("golden").getProperty("/repos/" + r.id), STK = { unchanged: "pos", openCr: "crit", review: "crit" };
			var gr = (G ? G.rows.map(function (g) {
				return { id: g.id, name: g.name, sub: that.text("gov." + g.state), image: g.image, quality: g.quality, prob: g.prob, nSrc: g.sources.length,
					srcText: g.sources.map(function (k) { return sources[k] ? sources[k].name : k; }).join(" · "), rating: g.rating, stateKey: STK[g.status] || "pos",
					stateText: T("gr.st." + g.status), state: Sem.state("record", g.status), lastMerge: g.changed };
			}) : (r.goldenRecords || []).map(function (g) {
				return { id: g.id, name: g.name, sub: g.sub, image: "", quality: g.quality, prob: g.prob, nSrc: g.sources.length,
					srcText: g.sources.map(function (s) { return s.name; }).join(" · "), rating: g.rating, stateKey: g.stateKey,
					stateText: T(GOLDEN[g.stateKey] || "golden.pos"), state: g.state, lastMerge: g.lastMerge };
			})).map(function (g) {
				return Object.assign(g, { avatar: g.image || "sap-icon://customer", qualityText: g.quality.toFixed(2) + "%", qNum: g.quality.toFixed(1),
					qualityState: Sem.quality(g.quality), probText: (g.prob * 100).toFixed(1) + "%",
					stars: g.rating ? g.rating.stars : 0, ratingTip: g.rating ? T("rt.tip", [g.rating.stars, g.rating.score]) : "",
					stateIcon: STATE_ICON[g.state] || "", open: !!goldenIds[g.id], attn: g.stateKey !== "pos" || (g.rating && g.rating.stars < 3) });
			});
			this._golden = gr;
			var nAttn = gr.filter(function (g) { return g.attn; }).length,
				avg = gr.length ? gr.reduce(function (x, g) { return x + (g.rating ? g.rating.stars : 0); }, 0) / gr.length : 0,
				bk = Rating.buckets(gr), bmax = Math.max.apply(null, bk.concat([1]));
			var bar = function (val, max, label, sub) {
				var pct = max ? Math.min(100, val / max * 100) : 0;
				return "<div class=\"repoioRpMeter\"><div class=\"repoioRpMeterTrack\"><span style=\"width:" + pct.toFixed(1) + "%\">" + label + "</span></div>" +
					"<div class=\"repoioRpMeterSub\">" + sub + "</div></div>";
			};
			var ratingBar = "<div class=\"repoioRpStars\">" + bk.map(function (c, i) {
				return "<div class=\"repoioRpStarCol\" title=\"" + T("rt.bucket", [i + 1, c]) + "\"><span style=\"height:" + Math.round(c / bmax * 100) + "%\"></span><i>" + (i + 1) + "★</i></div>";
			}).join("") + "</div>";

			// Tables of the participating sources that feed this repository
			var tables = [];
			r.sourceIds.forEach(function (sid) {
				(sources[sid].tables || []).forEach(function (t) {
					if (t.usedIn.some(function (u) { return u.id === r.id; })) {
						tables.push({ source: sid, schema: t.schema, table: t.id, name: t.name, path: sid + " / " + t.schema + " / " + t.id, sourceName: sources[sid].name,
							rowsText: n(t.rows), cols: String(t.cols), qualityText: that.fmt.pct(t.quality), qNum: t.quality.toFixed(1), qualityState: t.qualityState, profiled: t.profiled });
					}
				});
			});

			// Tags classify the repository (PII, tier, business line); they are not statuses, so they stay neutral (Fiori semantic rule).
			var tags = r.tags.map(function (t) { return { text: t, icon: t === "PII" ? "sap-icon://private" : /^Tier/.test(t) ? "sap-icon://tag" : "" }; });
			this.viewModel().setProperty("/rp", {
				name: r.name, sub: T("rp.sub", [r.code]), icon: d ? d.icon : "sap-icon://badge", domainText: this.domainName(d), model: r.model,
				owners: r.owners, tags: tags, deployed: deployed,
				healthText: T("health." + r.healthKey), healthState: r.healthState, healthIcon: HEALTH_ICON[r.healthKey] || "",
				hasModel: !!M, hasGoldenList: deployed && !!C.getModel("golden").getProperty("/repos/" + r.id),
				code: T("rp.sub", [r.code]), deployedText: deployed ? r.deployed : T("repo.notDeployed"),
				big: [
					{ label: T("domains.col.status"), value: T("health." + r.healthKey), dir: "Inherit", state: r.healthKey === "healthy" ? "Success" : r.healthState, icon: HEALTH_ICON[r.healthKey] || "" },
					{ label: T("domains.col.quality"), value: deployed ? r.quality.toFixed(1) + "%" : "—", dir: "LTR" },
					{ label: T("repo.golden"), value: deployed ? n(r.golden) : "—", dir: "LTR" }
				],
				capBar: bar(deployed ? r.golden : 0, r.cap, deployed ? n(r.golden) : "0", T("rp.capOf", [n(r.cap)])),
				avgStars: Math.round(avg * 2) / 2, avgText: gr.length ? T("rp.avg", [avg.toFixed(1), gr.length]) : T("rp.noRatings"), ratingBar: ratingBar,
				attrsTab: T("rp.tab.attrs", [this._attrs.length]), goldenTab: T("rp.tab.golden", [gr.length]),
				sourcesTab: T("rp.tab.sources", [r.sourceIds.length]), tablesTab: T("rp.tab.tables", [tables.length]), gsort: "rating",
				kpis: [
					{ label: T("domains.col.status"), text: T("health." + r.healthKey), state: r.healthState, icon: HEALTH_ICON[r.healthKey] || "sap-icon://status-inactive" },
					{ label: T("repo.golden"), value: deployed ? n(r.golden) : "—", unit: "", state: "None" },
					{ label: T("repo.sources"), value: String(r.sourceIds.length), unit: "", state: "None" },
					{ label: T("domains.col.quality"), value: deployed ? r.quality.toFixed(1) : "—", unit: deployed ? "%" : "", state: deployed ? r.qualityState : "None" },
					{ label: T("repo.deployed"), value: deployed ? r.deployed : T("repo.notDeployed"), unit: "", state: "None" }
				],
				modelFacts: [
					{ label: T("repo.model"), value: r.model, dir: "Inherit" },
					{ label: T("rp.matchModel"), value: M ? (ar ? M.ar : M.en) : "—", dir: "Inherit" },
					{ label: T("repo.version"), value: M ? "v" + M.version : "—", dir: "LTR" },
					{ label: T("repo.modelStatus"), value: M ? T("rp.mstatus." + M.status) : "—", dir: "Inherit" },
					{ label: T("domain.owner"), value: M ? M.owner : (r.owners[0] || {}).name || "—", dir: "Inherit" },
					{ label: T("rp.changed"), value: M ? M.changed : "—", dir: "LTR" }
				],
				matchFacts: matchFacts,
				aq: "", attrs: this._attrs, attrsTitle: T("rp.attrsN", [this._attrs.length]),
				gf: "all", gq: "", golden: [], goldenTitle: T("rp.goldenSample", [gr.length, n(deployed ? r.golden : 0)]),
				gc: { all: T("rp.gc.all", [gr.length]), attn: T("rp.gc.attn", [nAttn]) },
				goldenEmpty: deployed ? T("repo.goldenEmpty") : T("repo.goldenEmptyDraft"),
				goldenFooter: T("repo.goldenFooter", [gr.length, n(r.golden)]),
				sources: r.sourceRows.slice().sort(function (a, b) { return a.priority - b.priority; }).map(function (s) {
					return { name: s.name, host: s.host, type: s.type, priority: String(s.priority), tables: String(s.tables), rowsText: n(s.rows),
						qualityText: that.fmt.pct(s.quality), qNum: s.quality.toFixed(1), qualityState: s.qualityState, contribText: T("rp.contrib", [s.contributes, s.goldenCount]),
						sync: s.sync, stateText: T("rp.sync." + s.state), state: s.state === "None" ? "None" : s.state, stateIcon: STATE_ICON[s.state] || "" };
				}),
				tables: tables
			});
		},

		onAttrSearch: function (e) {
			var q = (e.getParameter("newValue") || "").toLowerCase(), f = this._attrs.filter(function (a) { return !q || (a.label + " " + a.col + " " + a.role).toLowerCase().indexOf(q) > -1; });
			this.viewModel().setProperty("/rp/attrs", f);
			this.viewModel().setProperty("/rp/attrsTitle", this.text("rp.attrsN", [f.length]));
		},
		onGoldenFilter: function () {
			var V = this.viewModel(), k = V.getProperty("/rp/gf"), q = (V.getProperty("/rp/gq") || "").toLowerCase(), sort = V.getProperty("/rp/gsort");
			V.setProperty("/rp/golden", this._golden.filter(function (g) { return (k === "all" || g.attn) && (!q || (g.name + " " + g.id).toLowerCase().indexOf(q) > -1); })
				.sort(function (a, b) {
					if (sort === "quality") { return b.quality - a.quality; }
					if (sort === "name") { return a.name.localeCompare(b.name); }
					return (b.stars - a.stars) || (b.quality - a.quality);
				}));
		},
		onRating: function (e) {
			var r = e.getSource().getBindingContext("view").getProperty("rating");
			if (r) { Rating.open(this, r, e.getSource()); }
		},
		onRequestRecord: function (e) { MessageToast.show(this.text("go.t.request", [e.getSource().getBindingContext("view").getProperty("id")])); },
		onGolden: function (e) {
			var o = e.getSource().getBindingContext("view").getObject();
			if (o.open) { this.router().navTo("goldenRecord", { repo: this._id, id: o.id }); }
		},
		onTable: function (e) {
			var o = e.getSource().getBindingContext("view").getObject();
			this.router().navTo("table", { source: o.source, schema: o.schema, table: o.table });
		},
		onConnect: function () { this._openRepoConnect(this._id); },
		onOpenGolden: function () { this.router().navTo("goldenRecords", { repo: this._id }); },
		onOpenModel: function () { this.router().navTo("models", { model: this._model ? this._model.key : undefined }); },
		onRequestModel: function () { MessageToast.show(this.text("repo.requestChangeToast")); },
		onToCatalog: function () { this.router().navTo("domains"); },
		onToDomain: function () {
			var r = this.data().getProperty("/repos/" + this._id);
			if (r) { this.router().navTo("domain", { domain: r.domainId }); } else { this.router().navTo("domains"); }
		},
		onCopyLink: function () {
			var that = this, done = function () { MessageToast.show(that.text("cat.linkCopied")); };
			try { navigator.clipboard.writeText(window.location.href).then(done, done); } catch (err) { done(); }
		}
	}));
});
