sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/lineage",
	"sap/m/MessageToast",
	"sap/m/Popover",
	"sap/m/List",
	"sap/m/StandardListItem",
	"sap/m/VBox",
	"sap/m/Text",
	"repoio/proto/util/imageRequest",
	"repoio/proto/util/rating",
	"repoio/proto/util/semantic"
], function (BaseController, Lin, MessageToast, Popover, List, StandardListItem, VBox, Text, ImageRequest, Rating, Sem) {
	"use strict";

	var SEG_ICON = { teacher: "sap-icon://education", retailer: "sap-icon://retail-store", callCenter: "sap-icon://call", student: "sap-icon://family-care",
			charityStudent: "sap-icon://heart" },
		SEG_COLOR = { teacher: "Accent6", retailer: "Accent8", callCenter: "Accent5", student: "Accent3", charityStudent: "Accent2" },
		GROUPS = {
			basic: ["name", "account_type", "promotion_group", "classification_group"],
			basicMore: ["final_subject", "final_stages", "wholesaler_id", "distributor_id"],
			contact: ["mobile_1", "mobile_2", "mobile_3", "phone", "whatsapp", "contact_mobile", "email"],
			address: ["state_id", "main_territory_id", "territory_1_id", "territory_2_id", "sales_district"],
			type: ["parent_name", "national_id", "linked_account_id"]
		},
		LTR = ["mobile_1", "mobile_2", "mobile_3", "phone", "whatsapp", "contact_mobile", "email", "main_territory_id", "territory_1_id", "territory_2_id",
			"sales_district", "national_id", "linked_account_id", "wholesaler_id", "distributor_id", "account_type"];

	/* J2: one golden record, read only. Every value shows where it came from (source, survivorship rule, model version);
	   a correction goes through "Request a change" (J3), never an inline edit. */
	return BaseController.extend("repoio.proto.controller.GoldenRecord", {
		onInit: function () {
			this.viewModel().setProperty("/go", {});
			this.router().getRoute("goldenRecord").attachPatternMatched(this._onMatched, this);
		},
		_onMatched: function (oEvent) {
			var that = this, a = oEvent.getParameter("arguments"), oG = this.getOwnerComponent().getModel("golden"), oR = this.getOwnerComponent().getModel("rules");
			this._repo = a.repo; this._id = a.id;
			Promise.all([oG.dataLoaded(), oR.dataLoaded(), this.data().dataLoaded ? this.data().dataLoaded() : null]).then(function () {
				that._g = oG.getData();
				that._show();
				var op = that.byId("op");
				if (op.getSections().length) { op.setSelectedSection(op.getSections()[0]); }
			});
		},
		_ar: function () { return this.lang() === "ar"; },
		_t: function (o) { return o ? (this._ar() ? o.ar || o.en : o.en || o.ar) : ""; },
		_srcName: function (id) { var s = (this.data().getProperty("/sources") || {})[id]; return s ? s.name : id; },
		_col: function (k) {
			var c = (this.getOwnerComponent().getModel("rules").getProperty("/repoColumns/" + this._repo) || []).filter(function (x) { return x.col === k; })[0];
			return c ? this._t(c) : k;
		},
		_model: function () {
			return (this.getOwnerComponent().getModel("rules").getProperty("/models") || []).filter(function (m) { return m.repo === this._repo; }, this)[0];
		},
		_display: function (k, v) {
			if (!v) { return "—"; }
			if (k === "state_id") { return this.text("gov." + v) + " (" + v + ")"; }
			if (k === "account_type") {
				var s = ((this._model() || {}).segments || []).filter(function (x) { return x.values.indexOf(v) > -1; })[0];
				return v + (s ? " · " + this._t(s) : "");
			}
			return v;
		},
		_ruleText: function (r) {
			if (!r) { return ""; }
			if (r.indexOf("group:") === 0) { return this.text("mr.grp." + r.slice(6)) + " · " + this.text("go.asGroup"); }
			return r === "create" ? this.text("go.created") : this.text("mr.rule." + r);
		},

		_show: function () {
			var that = this, vm = this.viewModel(), rd = this._g.repos[this._repo], rec = rd && rd.rows.filter(function (r) { return r.id === that._id; })[0];
			if (!rec) { vm.setProperty("/go", { rec: { id: this._id, name: this.text("go.notFound") }, basic: [], basicMore: [], contact: [], address: [], typeFields: [],
				sources: [], prov: [], rel: [], history: [], requests: [], dq: [], facet1: [], facet2: [] }); return; }
			var d = rd.details[rec.id], P = {}, seg = ((this._model() || {}).segments || []).filter(function (s) { return s.key === rec.segment; })[0], repo = (this.data().getProperty("/repos") || {})[this._repo];
			d.prov.forEach(function (p) { P[p.col] = p; });
			this._d = d; this._rec = rec; this._P = P;
			var field = function (k) {
				var p = P[k];
				return { col: k, label: that._col(k), value: that._display(k, p && p.value), dir: LTR.indexOf(k) > -1 ? "LTR" : "Inherit",
					provText: p ? that.text("go.prov", [that._srcName(p.source), that._ruleText(p.rule)]) : "" };
			};
			var g = function (keys, keepEmpty) { return keys.filter(function (k) { return keepEmpty || P[k]; }).map(field); };
			var st = { unchanged: null, openCr: ["Information", "go.banner.openCr"], review: ["Warning", "go.banner.review"] }[rec.status];
			vm.setProperty("/go", {
				rec: rec, repoName: repo ? repo.name : this._repo, icon: rec.image || SEG_ICON[rec.segment] || "sap-icon://customer", color: SEG_COLOR[rec.segment] || "Accent6",
				segIcon: SEG_ICON[rec.segment] || "sap-icon://customer", hasImage: !!rec.image, imgBanner: this._imgBanner(rec.id),
				stars: rec.rating ? rec.rating.stars : 0, ratingText: rec.rating ? this.text("rt.tip", [rec.rating.stars, rec.rating.score]) : "",
				snapped: (seg ? this._t(seg) : "") + " · " + this.text("gov." + rec.state) + " · " + rec.mobile,
				facet1: [{ label: this.text("go.f.segment"), value: seg ? this._t(seg) : "—" }, { label: this.text("go.f.account"), value: rec.accountType, dir: "LTR" },
					{ label: this.text("go.f.gov"), value: this.text("gov." + rec.state) + " · " + rec.territory }],
				facet2: [{ label: this.text("go.f.mobile"), value: rec.mobile, dir: "LTR" }, { label: this.text("go.f.sources"), value: rec.sources.map(this._srcName, this).join(" · ") },
					{ label: this.text("go.f.since"), value: rec.since, dir: "LTR" }, { label: this.text("go.f.changed"), value: rec.changed + " ·", dir: "Inherit", person: rec.changedBy }],
				qualityText: rec.quality.toFixed(1), qualityState: Sem.quality(rec.quality),
				probPct: Math.round(rec.prob * 100), probText: rec.prob.toFixed(3), matchNote: this.text("go.matchNote", [d.sourceRows.length]),
				banner: st ? this.text(st[1], d.review ? [d.review.pair, d.review.prob.toFixed(2)] : [d.requests[0] ? d.requests[0].id : ""]) : "",
				bannerType: st ? st[0] : "None", bannerLink: st ? this.text(rec.status === "review" ? "go.a.matchDetection" : "go.a.openRequest") : "",
				basic: g(GROUPS.basic, true), basicMore: g(GROUPS.basicMore, true), contact: g(GROUPS.contact), address: g(GROUPS.address, true),
				typeFields: g(GROUPS.type), typeTitle: this.text("go.ss.type", [seg ? this._t(seg) : ""]),
				sources: d.sourceRows.map(function (s, i) {
					return { name: that._srcName(s.source), table: s.table, key: s.key, vName: s.values.name, vPhones: [s.values.mobile_1, s.values.mobile_2].filter(Boolean).join(" · "),
						pct: Math.round(s.prob * 100), probText: s.prob.toFixed(2), probState: s.prob >= 0.95 ? "Success" : "Warning",
						role: that.text(i === 0 ? "go.firstSource" : "go.matched"), synced: s.synced };
				}),
				sourcesTitle: this.text("go.sourcesTitle", [d.sourceRows.length]),
				provAll: d.prov, provQ: "",
				rel: d.relationships.map(function (r) { return { type: r.type, typeText: that.text("go.rel." + r.type), target: r.target, targetName: r.targetName, since: r.since }; }),
				relTitle: this.text("go.relTitle", [d.relationships.length]),
				history: d.history.map(function (h) {
					return { at: h.at, label: h.col === "*" ? that.text("go.wholeRecord") : that._col(h.col),
						change: h.col === "*" ? that.text("go.created") : (h.old ? h.old + " → " : "") + h.new + (h.old ? "" : " · " + that.text("go.added")),
						why: that.text("go.why", [that._srcName(h.source), that._ruleText(h.rule), h.version]), cr: h.cr || "—" };
				}),
				historyTitle: this.text("go.historyTitle", [d.history.length]),
				requests: d.requests.map(function (r) { return { id: r.id, whatText: that.text("go.changeOf", [that._col(r.what)]), by: r.by, at: r.at, stepText: that.text("go.step." + r.step) }; }),
				requestsTitle: this.text("go.requestsTitle", [d.requests.length]),
				dq: d.dq.map(function (x) {
					return { text: that.text("go.dq." + x.key), desc: that.text(x.ok ? "go.dq.pass" : "go.dq.fail"), icon: x.ok ? "sap-icon://message-success" : "sap-icon://message-warning",
						color: x.ok ? "Positive" : "Critical" };
				}),
				dqTitle: this.text("go.dqTitle", [d.dq.filter(function (x) { return x.ok; }).length, d.dq.length]),
				linNote: this.text("go.linNote")
			});
			this._provRows();
			// lineage of this record: its own values on the source, golden and consumer columns
			var L = rd.lineage, lin = this.byId("goLineage");
			lin.setNodes(L.nodes); lin.setEdges(L.edges); lin.setTexts(Lin.texts(this));
			lin.setValues(Lin.values(L, d.prov, d.sourceRows, this.text("gov." + rec.state)));
			lin.setUpLevels(3); lin.setDownLevels(1);
			lin.setSelected({ node: "golden_customer", col: "mobile_1" });
			lin.resetView();
		},
		_provRows: function () {
			var that = this, vm = this.viewModel(), q = (vm.getProperty("/go/provQ") || "").toLowerCase(), all = vm.getProperty("/go/provAll") || [];
			var rows = all.map(function (p) {
				return { col: p.col, label: that._col(p.col), value: that._display(p.col, p.value), dir: LTR.indexOf(p.col) > -1 ? "LTR" : "Inherit",
					srcText: that._srcName(p.source), ruleText: that._ruleText(p.rule), candidates: String(p.candidates), verText: "v" + p.version + " · " + p.at, locked: !!p.locked };
			}).filter(function (r) { return !q || (r.label + " " + r.col + " " + r.value).toLowerCase().indexOf(q) > -1; });
			vm.setProperty("/go/prov", rows);
			vm.setProperty("/go/provTitle", this.text("go.provTitle", [rows.length]));
		},
		onProvSearch: function () { this._provRows(); },

		/* Where a value came from: every source value of the column, which one won and why. */
		onProv: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(), k = o.col, p = this._P[k], that = this;
			if (!p) { return; }
			var items = this._d.sourceRows.map(function (s) {
				var v = s.values[k], win = s.source === p.source;
				return new StandardListItem({ title: that._srcName(s.source), description: v || "—", info: win ? that.text("go.won") : "", infoState: "Success",
					icon: win ? "sap-icon://accept" : "" });
			});
			var oPop = new Popover({ title: this._col(k), placement: "Auto", contentWidth: "20rem",
				content: [new VBox({ items: [
					new Text({ text: this.text("go.provLong", [this._srcName(p.source), this._ruleText(p.rule), p.version, p.at]) }).addStyleClass("sapUiSmallMargin"),
					new List({ items: items, showSeparators: "Inner" })] })],
				afterClose: function () { oPop.destroy(); } });
			this.getView().addDependent(oPop);
			oPop.openBy(oEvent.getSource());
		},

		onBackToList: function () { this.router().navTo("goldenRecords", { repo: this._repo }); },
		onLineage: function () {
			var s = this.byId("goLineage").getSelected();
			this.router().navTo("goldenLineage", { repo: this._repo, id: this._id, "?query": s ? { col: s.node + "." + s.col } : {} });
		},
		onLinSelect: function () { /* the control keeps the selection; nothing else depends on it here */ },
		onLinNode: function (oEvent) { MessageToast.show(this.text("go.t.node", [oEvent.getParameter("node")])); },
		onRequest: function () { MessageToast.show(this.text("go.t.request", [this._id])); },
		/* Record image: a change request on image_url (util/imageRequest.js); the record changes only after approval. */
		_imgBanner: function (id) {
			var p = ImageRequest.pending(id);
			return p ? this.text(p.action === "remove" ? "img.banner.remove" : "img.banner.set", [p.cr, p.at]) : "";
		},
		onRating: function (oEvent) { if (this._rec && this._rec.rating) { Rating.open(this, this._rec.rating, oEvent.getSource()); } },
		onImage: function () {
			var that = this, go = this.viewModel().getProperty("/go");
			ImageRequest.open({ ctrl: this, id: go.rec.id, name: go.rec.name, current: go.rec.image || "", icon: go.segIcon,
				onDone: function (r) {
					that.viewModel().setProperty("/go/imgBanner", that._imgBanner(go.rec.id));
					MessageToast.show(that.text("img.t.sent", [r.cr]));
				} });
		},
		onBanner: function () {
			if (this._rec.status === "review") { this.onMatchDetection(); } else { MessageToast.show(this.text("go.t.openRequest", [this._d.requests[0].id])); }
		},
		onMatchDetection: function () { this.router().navTo("matches"); },
		onRelBuilder: function () { this.router().navTo("page", { key: "relationshipBuilder" }); },
		onRules: function () { this.router().navTo("models", { model: this._repo }); },
		onShare: function () {
			try { navigator.clipboard.writeText(window.location.href).catch(function () { /* clipboard blocked */ }); } catch (e) { /* clipboard blocked */ }
			MessageToast.show(this.text("gr.t.share"));
		}
	});
});
