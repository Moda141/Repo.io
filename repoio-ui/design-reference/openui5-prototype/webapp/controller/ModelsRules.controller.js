sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/audit",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Label",
	"sap/m/Select",
	"sap/m/Input",
	"sap/m/Text",
	"sap/m/TextArea",
	"sap/m/MultiComboBox",
	"sap/m/MessageStrip",
	"sap/m/StepInput",
	"sap/m/CheckBox",
	"sap/m/Switch",
	"sap/ui/core/Item",
	"sap/ui/core/ListItem",
	"sap/ui/layout/form/SimpleForm",
	"repoio/proto/util/semantic"
], function (BaseController, Audit, MessageToast, MessageBox, Dialog, Button, Label, Select, Input, Text, TextArea, MultiComboBox, MessageStrip,
	StepInput, CheckBox, Switch, Item, ListItem, SimpleForm, Sem) {
	"use strict";

	var DEFAULT_LEVELS = { jw: [0.95, 0.9], lev: [1, 2] },
		DOMAIN_ICON = { customers: "sap-icon://customer", vendors: "sap-icon://supplier", products: "sap-icon://course-book", authors: "sap-icon://user-edit",
			employees: "sap-icon://employee", stores: "sap-icon://retail-store" },
		FIRST_TOKEN = ["name_first_token", "title_first_token"],
		KEY_COLS = ["customer_id", "partner_id", "school_id", "product_id", "vendor_id", "author_id"],
		SEG_ICONS = ["sap-icon://group", "sap-icon://education", "sap-icon://retail-store", "sap-icon://call", "sap-icon://family-care", "sap-icon://heart"],
		LRM = "‎";

	/* J5: Models & rules. One match model per repository: shared Splink comparisons, blocking and training; segments (customer
	   types) with their own thresholds; consolidation into golden records; the change request check; survivorship. The page
	   edits a working copy and previews the effect; "Submit for approval" hands the changed models to the rules API as new
	   versions. Nothing here runs the rules. */
	return BaseController.extend("repoio.proto.controller.ModelsRules", {
		onInit: function () {
			this.viewModel().setProperty("/mr", { tab: "match", q: "", dirtyCount: 0 });
			this.router().getRoute("models").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this, sKey = (oEvent.getParameter("arguments") || {}).model, oM = this.getOwnerComponent().getModel("rules"), oD = this.data();
			Promise.all([oM.dataLoaded(), oD.dataLoaded ? oD.dataLoaded() : null]).then(function () {
				that._src = oM.getData();
				if (!that._w) { that._reset(); }
				var ok = that._w.models.some(function (m) { return m.key === sKey; });
				that._sel = ok ? sKey : that._sel || that._w.models[0].key;
				that._refresh();
			});
		},

		/* ---------- working copy ---------- */
		_reset: function () {
			this._w = { models: JSON.parse(JSON.stringify(this._src.models)) };
			if (this._sel && !this._w.models.some(function (m) { return m.key === this._sel; }.bind(this))) { this._sel = this._w.models[0].key; }
		},
		_ar: function () { return this.lang() === "ar"; },
		_t: function (o) { return o ? (this._ar() ? o.ar || o.en : o.en || o.ar) : ""; },
		_and: function () { return this._ar() ? "، " : ", "; },
		_n: function (v) { return Number(v).toFixed(2); },
		_int: function (v) { return Math.round(v).toLocaleString("en-US"); },
		/* Fields are the columns of the model's repository (its staged table, including the columns the standardise step derives). */
		_cols: function (m) { return (m && this._src.repoColumns[m.repo]) || []; },
		_field: function (k, m) {
			var c = this._cols(m || this._model()).filter(function (x) { return x.col === k; })[0];
			return c || { en: k, ar: k, col: k, kind: "text" };
		},
		_colText: function (c) { return this._t(c) + (c.derived ? " · " + this.text("mr.f.derived") : ""); },
		_domainText: function (id) {
			var d = (this.data().getProperty("/domains") || []).filter(function (x) { return x.id === id; })[0];
			return d ? this.domainName(d) : id;
		},
		_repo: function (id) { return (this.data().getProperty("/repos") || {})[id]; },
		_repoText: function (id) { var r = this._repo(id); return r ? r.name : id; },
		_srcName: function (id) { var s = (this.data().getProperty("/sources") || {})[id]; return s ? s.name : id; },
		_model: function () { var k = this._sel; return this._w.models.filter(function (m) { return m.key === k; })[0]; },
		_active: function (m) { return this._src.models.filter(function (x) { return x.key === m.key; })[0]; },
		/* A segment's own threshold, or the model's. k: autoMerge | review (consolidation) | request (change request stop). */
		_eff: function (m, s, k) {
			if (s && s.own && s.own[k] !== undefined && s.own[k] !== null) { return s.own[k]; }
			return k === "request" ? m.requestCheck.stop : m.consolidation[k];
		},
		_seg: function (m, k) { return (m.segments || []).filter(function (s) { return s.key === k; })[0]; },

		_refresh: function () {
			var that = this, vm = this.viewModel(), q = (vm.getProperty("/mr/q") || "").trim().toLowerCase();
			vm.setProperty("/mr/models", this._w.models.filter(function (m) {
				return !q || [m.en, m.ar, m.repo, m.domain].concat((m.segments || []).map(function (s) { return s.en + " " + s.ar; })).join(" ").toLowerCase().indexOf(q) > -1;
			}).map(function (m) {
				return { key: m.key, text: that._t(m), icon: m.icon || DOMAIN_ICON[m.domain] || "sap-icon://database",
					sub: that._domainText(m.domain) + " · " + ((m.segments || []).length ? that.text("mr.segN", [m.segments.length]) : that.text("mr.seg.byNone")),
					info: m.dirty ? that.text("mr.st.changed") : m.pending ? that.text("mr.st.pending") : that.text("mr.st." + m.status, [m.version]),
					infoState: m.dirty || m.pending ? "Warning" : m.status === "active" ? "Success" : "None", selected: m.key === that._sel };
			}));
			this._show();
			var n = this._w.models.filter(function (m) { return m.dirty; }).length;
			vm.setProperty("/mr/dirtyCount", n);
			vm.setProperty("/mr/dirtyText", this.text("mr.dirtyText", [n]));
		},

		_show: function () {
			var that = this, m = this._model(), vm = this.viewModel();
			if (!m) { vm.setProperty("/mr/m", null); return; }
			var next = m.status === "active" ? Number(m.version) + 1 : m.version;
			m.text = this._t(m);
			m.desc = this._ar() ? m.descAr || m.descEn : m.descEn || m.descAr;
			m.meta = this.text("mr.meta", [this._domainText(m.domain), this._repoText(m.repo), m.owner, m.changed]);
			m.statusText = m.dirty ? this.text("mr.st.changedLong", [next]) : m.pending ? this.text("mr.st.pendingLong", [next, m.status === "active" ? m.version : "—"])
				: this.text("mr.st." + m.status + "Long", [m.version]);
			m.statusState = m.dirty || m.pending ? "Warning" : m.status === "active" ? "Success" : "Information";
			m.statusIcon = m.dirty ? "sap-icon://edit" : m.pending ? "sap-icon://pending" : m.status === "active" ? "sap-icon://accept" : "sap-icon://document";
			m.canDelete = m.status === "draft";
			m.useConsolidate = this.text("mr.use.consolidate", [this._repoText(m.repo)]);
			m.useRequest = this.text("mr.use.request");
			m.useSurvive = this.text("mr.use.survive");
			this._showMatch(m);
			this._showSegments(m);
			this._showConsolidation(m);
			this._showRequest(m);
			this._showSurvivorship(m);
			vm.setProperty("/mr/m", m);
			this._samples();
		},

		/* ---------- 1. match ---------- */
		_showMatch: function (m) {
			var that = this, tr = m.training || { eval: {} }, gate = tr.gate || { precision: 0.95, recall: 0.9 };
			m.comparisons.forEach(function (c) { that._decorateCmp(c); });
			m.cmpCount = m.comparisons.length;
			m.blocking.forEach(function (b) { that._decorateBlk(b); });
			m.trainText = tr.run ? this.text("mr.eval.run", [tr.run, this._int(tr.pairs), this._int(tr.stewardPairs)]) : this.text("mr.eval.never");
			m.gateText = this.text("mr.eval.gate", [this._n(gate.precision), this._n(gate.recall)]);
			var row = function (key, text) {
				var e = (tr.eval || {})[key];
				return { text: text, p: e ? e[0].toFixed(3) : "—", r: e ? e[1].toFixed(3) : "—",
					pState: !e ? "None" : e[0] >= gate.precision ? "Success" : "Error", rState: !e ? "None" : e[1] >= gate.recall ? "Success" : "Error" };
			};
			m.evalRows = [row("all", this.text("mr.eval.all"))].concat((m.segments || []).map(function (s) { return row(s.key, that.text("mr.eval.seg", [that._t(s)])); }));
		},
		_decorateCmp: function (c) {
			var f = this._field(c.field), mt = this._src.methods[c.method];
			c.fieldText = this._t(f);
			c.col = f.col;
			c.hint = this._ar() ? f.hintAr || "" : f.hintEn || "";
			c.methodText = this._t(mt);
			c.splink = "cl." + mt.splink;
			c.levelsText = this._levelsText(c);
			c.weightText = c.weight === undefined || c.weight === null ? this.text("mr.cmp.untrained") : "+" + Number(c.weight).toFixed(1);
		},
		_levelsText: function (c) {
			if (c.method === "exact") { return this.text("mr.lv.exact"); }
			if (c.method === "array") { return this.text("mr.lv.array"); }
			if (c.method === "overlap") { return this.text("mr.lv.overlap"); }
			var lv = c.levels || DEFAULT_LEVELS[c.method];
			return lv.map(function (v) { return (c.method === "lev" ? "≤ " : "≥ ") + v; }).join(" · ") + " · " + this.text("mr.lv.else");
		},
		_decorateBlk: function (b) {
			var that = this, eq = b.fields.filter(function (k) { return that._field(k).kind !== "array"; }),
				arr = b.fields.filter(function (k) { return that._field(k).kind === "array"; }), parts = [];
			if (eq.length) { parts.push(this.text("mr.blk.same", [eq.map(function (k) { return that._t(that._field(k)); }).join(this._ar() ? " و" : " and ")])); }
			arr.forEach(function (k) { parts.push(that.text("mr.blk.share", [that._t(that._field(k))])); });
			b.text = parts.join(this._ar() ? "، و" : ", and ");
			// Equal values use Splink's block_on; a value in common needs a SQL condition (DuckDB list functions).
			b.sql = !arr.length ? "block_on(" + eq.map(function (k) { return "\"" + that._field(k).col + "\""; }).join(", ") + ")"
				: "\"" + eq.map(function (k) { var c = that._field(k).col; return "l." + c + " = r." + c; })
					.concat(arr.map(function (k) { var c = that._field(k).col; return "array_length(list_intersect(l." + c + ", r." + c + ")) >= 1"; })).join(" AND ") + "\"";
		},
		cmpTitle: function (n) { return this.text("mr.cmp.title", [n || 0]); },
		segTitle: function (n) { return this.text("mr.seg.title", [n || 0]); },
		ruleTitle: function (n) { return this.text("mr.sv.fields", [n || 0]); },

		/* ---------- 2. segments ---------- */
		_showSegments: function (m) {
			var that = this, segBy = this._field(m.segmentBy, m);
			m.codeCols = [{ key: "", text: this.text("mr.seg.byNone") }].concat(this._cols(m).filter(function (c) { return c.kind === "code"; })
				.map(function (c) { return { key: c.col, text: that._t(c) }; }));
			m.segCount = (m.segments || []).length;
			var mark = function (v, own) { return that._n(v) + (own ? "" : " · " + that.text("mr.seg.inherited")); };
			m.segRows = (m.segments || []).map(function (s) {
				var own = s.own || {}, exc = (s.exceptions || []).filter(function (e) { return e.on; });
				return { key: s.key, icon: s.icon || SEG_ICONS[0], text: that._t(s),
					filterText: segBy.col + " = " + (s.values || []).join(" | "),
					tplText: (s.templates || []).length ? s.templates.map(function (t) { return that._t(t); }).join(that._and()) : that.text("mr.seg.noTpl"),
					autoText: m.consolidation.auto ? mark(that._eff(m, s, "autoMerge"), own.autoMerge !== undefined) : that.text("mr.con.off"),
					reviewText: mark(that._eff(m, s, "review"), own.review !== undefined),
					requestText: mark(that._eff(m, s, "request"), own.request !== undefined),
					autoOwn: own.autoMerge !== undefined, reviewOwn: own.review !== undefined, requestOwn: own.request !== undefined,
					scopeText: that.text(s.scope === "all" ? "mr.seg.scopeAll" : "mr.seg.scopeSame"),
					excText: exc.map(function (e) { return that.text("mr.exc." + e.key); }).join(that._and()),
					canDelete: !(s.templates || []).length };
			});
		},
		onAddSeg: function () { this._segDialog(null); },
		onEditSeg: function (oEvent) {
			var k = oEvent.getSource().getBindingContext("view").getProperty("key");
			this._segDialog(this._seg(this._model(), k));
		},
		onDelSeg: function (oEvent) {
			var m = this._model(), s = this._seg(m, oEvent.getSource().getBindingContext("view").getProperty("key"));
			m.segments.splice(m.segments.indexOf(s), 1);
			this.onEdit();
		},
		_segDialog: function (oSeg) {
			var that = this, m = this._model(), own = (oSeg && oSeg.own) || {}, hasParent = this._cols(m).some(function (c) { return c.col === "parent_name_std"; }),
				oEn = new Input({ width: "100%", value: oSeg ? oSeg.en : "" }),
				oAr = new Input({ width: "100%", value: oSeg ? oSeg.ar : "" }),
				oVals = new Input({ width: "100%", value: oSeg ? (oSeg.values || []).join(", ") : "", textDirection: "LTR",
					placeholder: this.text("mr.seg.valuesPh") }),
				oOwn = new CheckBox({ text: this.text("mr.seg.own"), selected: !!(oSeg && oSeg.own) }),
				step = function (v) { return new StepInput({ value: v, min: 0.5, max: 0.99, step: 0.01, displayValuePrecision: 2, width: "100%" }); },
				oAuto = step(this._eff(m, oSeg, "autoMerge")), oRev = step(this._eff(m, oSeg, "review")), oReq = step(this._eff(m, oSeg, "request")),
				oScope = new Select({ width: "100%", selectedKey: oSeg ? oSeg.scope || "segment" : "segment", items: [
					new Item({ key: "segment", text: this.text("mr.seg.scopeSame") }), new Item({ key: "all", text: this.text("mr.seg.scopeAll") })] }),
				oSib = new Switch({ state: !!(oSeg && (oSeg.exceptions || []).some(function (e) { return e.key === "siblings" && e.on; })), customTextOn: " ", customTextOff: " ",
					enabled: hasParent }),
				sync = function () { var b = oOwn.getSelected(); [oAuto, oRev, oReq].forEach(function (x) { x.setEnabled(b); }); };
			oOwn.attachSelect(sync);
			sync();
			var oDlg = new Dialog({
				title: this.text(oSeg ? "mr.seg.editTitle" : "mr.seg.addTitle", [this._t(m)]), contentWidth: "32rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1, content: [
					new Label({ text: this.text("mr.f.nameEn"), required: true }), oEn,
					new Label({ text: this.text("mr.f.nameAr"), required: true }), oAr,
					new Label({ text: this.text("mr.seg.values", [this._field(m.segmentBy, m).col]), required: true }), oVals,
					new Text({ text: this.text("mr.seg.valuesHint") }).addStyleClass("repoioUmMuted"),
					new Label({ text: this.text("mr.seg.scope") }), oScope,
					new Text({ text: this.text("mr.seg.scopeHint") }).addStyleClass("repoioUmMuted"),
					new Label({ text: "" }), oOwn,
					new Label({ text: this.text("mr.seg.auto") }), oAuto,
					new Label({ text: this.text("mr.seg.review") }), oRev,
					new Label({ text: this.text("mr.seg.request") }), oReq,
					new Label({ text: this.text("mr.exc.siblings") }), oSib,
					new Text({ text: this.text(hasParent ? "mr.exc.siblings.d" : "mr.exc.needsParent") }).addStyleClass("repoioUmMuted")
				] })],
				beginButton: new Button({ text: this.text("common.save"), type: "Emphasized", press: function () {
					var en = oEn.getValue().trim(), ar = oAr.getValue().trim(), vals = oVals.getValue().split(/[,،|\s]+/).filter(Boolean), bad = false;
					[[oEn, en], [oAr, ar]].forEach(function (x) { x[0].setValueState(x[1] ? "None" : "Error").setValueStateText(that.text("mr.v.required")); bad = bad || !x[1]; });
					var taken = (m.segments || []).filter(function (s) { return s !== oSeg; }).reduce(function (a, s) { return a.concat(s.values || []); }, []),
						clash = vals.filter(function (v) { return taken.indexOf(v) > -1; });
					oVals.setValueState(!vals.length || clash.length ? "Error" : "None")
						.setValueStateText(clash.length ? that.text("mr.v.segTaken", [clash.join(", ")]) : that.text("mr.v.required"));
					bad = bad || !vals.length || clash.length > 0;
					var a = oAuto.getValue(), r = oRev.getValue(), q = oReq.getValue();
					if (oOwn.getSelected() && !(r < a && r < q)) {
						oRev.setValueState("Error").setValueStateText(that.text("mr.v.segBands")); bad = true;
					} else { oRev.setValueState("None"); }
					if (bad) { return; }
					var o = oSeg || { key: en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "segment", templates: [],
						icon: SEG_ICONS[(m.segments || []).length % SEG_ICONS.length] };
					o.en = en; o.ar = ar; o.values = vals; o.scope = oScope.getSelectedKey();
					o.own = oOwn.getSelected() ? { autoMerge: a, review: r, request: q } : null;
					o.exceptions = hasParent ? [{ key: "siblings", on: oSib.getState() }] : [];
					if (!oSeg) {
						while (that._seg(m, o.key)) { o.key += "-2"; }
						m.segments.push(o);
					}
					oDlg.close();
					that.onEdit();
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},

		/* ---------- 3. consolidation ---------- */
		_bandsHtml: function (lo, hi, labels, autoOn, cls) {
			// Three bands over 0.50–1.00 (a picture of the thresholds, nothing is computed here).
			var pct = function (v) { return Math.max(0, Math.min(100, (v - 0.5) / 0.5 * 100)); }, a = pct(lo), b = autoOn ? pct(hi) : 100,
				esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); },
				seg = function (cls, w, t) { return "<span class=\"repoioMrBand " + cls + "\" style=\"flex-basis:" + w.toFixed(1) + "%\" title=\"" + esc(t) + "\"><span>" + esc(t) + "</span></span>"; },
				tick = function (v) { return "<span style=\"left:" + pct(v).toFixed(1) + "%\">" + v.toFixed(2) + "</span>"; };
			return "<div class=\"repoioMrBands" + (cls ? " " + cls : "") + "\" dir=\"ltr\"><div class=\"repoioMrBandRow\">" + seg("repoioMrBandLo", a, labels[0]) + seg("repoioMrBandMid", b - a, labels[1]) +
				(autoOn ? seg("repoioMrBandHi", 100 - b, labels[2]) : "") + "</div><div class=\"repoioMrBandAxis\">" + tick(0.5) + tick(lo) +
				(autoOn ? tick(hi) : "") + tick(1) + "</div></div>";
		},
		/* Pairs per band, from the score histogram of the last run (sample), split by segment share. */
		_conCount: function (m) {
			var segs = (m.segments || []).length ? m.segments : [null], h = m.stats.pairs, out = { auto: 0, review: 0, distinct: 0 };
			segs.forEach(function (s) {
				var share = s ? s.share || 1 / segs.length : 1, a = Math.round(this._eff(m, s, "autoMerge") * 100), r = Math.round(this._eff(m, s, "review") * 100);
				h.forEach(function (c, i) {
					var v = 50 + i, k = v >= a && m.consolidation.auto ? "auto" : v >= r ? "review" : "distinct";
					out[k] += c * share;
				});
			}, this);
			return out;
		},
		_showConsolidation: function (m) {
			var c = m.consolidation, act = this._active(m), T = this.text.bind(this);
			m.conState = c.auto && c.review >= c.autoMerge ? "Error" : "None";
			m.conBands = this._bandsHtml(c.review, c.autoMerge, [T("mr.band.distinct"), T("mr.band.review"), T("mr.band.auto")], c.auto);
			var d = this._conCount(m), a = act ? this._conCount(act) : { auto: 0, review: 0, distinct: 0 }, that = this;
			m.conEst = [["auto", "Success", "sap-icon://combine"], ["review", "Warning", "sap-icon://inspect"], ["distinct", "None", "sap-icon://split"]].map(function (x) {
				var dv = Math.round(d[x[0]]), av = Math.round(a[x[0]]), delta = dv - av;
				return { text: T("mr.band." + x[0]), state: x[1], icon: x[2], activeText: act ? that._int(av) : "—",
					draftText: that._int(dv) + (act && delta ? " (" + (delta > 0 ? "+" : "") + that._int(delta) + ")" : ""), deltaState: delta ? "Warning" : "None" };
			});
			m.conEstNote = this.text("mr.con.estNote", [this._int(m.stats.pairs.reduce(function (s, v) { return s + v; }, 0))]);
		},

		/* ---------- 4. request check ---------- */
		_showRequest: function (m) {
			var that = this, rc = m.requestCheck, fields = this._cols(m).map(function (c) { return c.col; }), T = this.text.bind(this);
			m.reqState = rc.review >= rc.stop ? "Error" : "None";
			m.reqBands = this._bandsHtml(rc.review, rc.stop, [T("mr.band.continue"), T("mr.band.flag"), T("mr.band.stop")], true, "repoioMrReq");
			m.checks = rc.checks.map(function (c) {
				var cat = that._src.checkCatalog.filter(function (x) { return x.key === c.key; })[0] || {};
				c.kind = cat.kind;
				c.text = T("mr.chk." + c.key);
				c.desc = T("mr.chk." + c.key + ".d");
				c.againstText = T("mr.against." + cat.against) + (rc.staged && cat.against !== "openCr" ? " · " + T("mr.against.staged") : "");
				c.bandText = T("mr.gate.byBands", [that._n(rc.review), that._n(rc.stop)]);
				c.available = !cat.needs || fields.indexOf(cat.needs) > -1;
				c.unavailable = c.available ? "" : T("mr.chk.needs", [that._t(that._field(cat.needs, m))]);
				if (!c.available) { c.on = false; }
				return c;
			});
			// Last 30 days of requests, by their highest match probability (sample histogram); number checks come on top.
			var h = m.stats.requests, st = Math.round(rc.stop * 100), rv = Math.round(rc.review * 100), n = { stop: 0, flag: 0, go: 0 };
			h.forEach(function (c, i) { var v = 50 + i; n[v >= st ? "stop" : v >= rv ? "flag" : "go"] += c; });
			m.reqEstText = T("mr.test.est", [this._int(n.stop), this._int(n.flag)]);
		},

		/* ---------- 5. survivorship ---------- */
		_ruleItems: function (kind) {
			var that = this;
			return this._src.rules.filter(function (r) { return r !== "union" || kind === "array"; }).map(function (r) { return { key: r, text: that.text("mr.rule." + r) }; });
		},
		_showSurvivorship: function (m) {
			var that = this, sv = m.survivorship, p = sv.priority;
			m.prioRows = p.map(function (id, i) { return { key: id, rank: String(i + 1), text: that._srcName(id), canUp: i > 0, canDown: i < p.length - 1 }; });
			m.groupRows = sv.groups.map(function (g) {
				g.text = that.text("mr.grp." + g.key);
				g.colsText = g.cols.map(function (k) { return that._t(that._field(k, m)); }).join(that._and());
				g.ruleItems = that._ruleItems("text");
				return g;
			});
			m.ruleRows = sv.rules.map(function (r) {
				var f = that._field(r.col, m);
				r.fieldText = that._t(f); r.colTech = f.col; r.ruleItems = that._ruleItems(f.kind);
				r.means = that.text("mr.rule." + r.rule + ".d", [that._srcName(p[0])]);
				return r;
			});
			m.ruleRows.forEach(function (r) { r.col = r.colTech; });
			m.ruleCount = m.ruleRows.length;
			this._preview(m);
		},
		onPrioUp: function (oEvent) { this._movePrio(oEvent, -1); },
		onPrioDown: function (oEvent) { this._movePrio(oEvent, 1); },
		_movePrio: function (oEvent, d) {
			var p = this._model().survivorship.priority, i = p.indexOf(oEvent.getSource().getBindingContext("view").getProperty("key")), j = i + d;
			if (j < 0 || j >= p.length) { return; }
			p.splice(j, 0, p.splice(i, 1)[0]);
			this.onEdit();
		},
		/* Preview only: which source value the survivorship job would keep on one golden record under this draft. */
		_preview: function (m) {
			var that = this, pv = (this._src.preview || {})[m.repo], sv = m.survivorship, T = this.text.bind(this);
			if (!pv) { m.preview = []; return; }
			m.previewTitle = T("mr.sv.previewTitle", [pv.id]);
			m.preview = pv.values.map(function (row) {
				var grp = row.col.indexOf("group:") === 0 ? row.col.slice(6) : null, g = grp && sv.groups.filter(function (x) { return x.key === grp; })[0],
					r = g ? g : sv.rules.filter(function (x) { return x.col === row.col; })[0], rule = r ? r.rule : "sourcePriority",
					cands = row.v.map(function (v) { return { src: v[0], val: v[1], date: v[2], ok: v[3] }; }),
					live = cands.filter(function (c) { return c.val && (!sv.dqGate || c.ok); }), win, why;
				var rank = function (c) { var i = sv.priority.indexOf(c.src); return i < 0 ? 99 : i; },
					tie = function (a, b) { return sv.tieBreak === "recent" ? (b.date > a.date ? 1 : -1) : rank(a) - rank(b); };
				if (!live.length) { win = null; why = T("mr.sv.why.none"); }
				else if (rule === "union") {
					var vals = [];
					live.forEach(function (c) { c.val.split(/[،,]\s*/).forEach(function (x) { if (vals.indexOf(x) < 0) { vals.push(x); } }); });
					win = { val: vals.join("، "), src: live.map(function (c) { return c.src; }).join("+") }; why = T("mr.sv.why.union", [live.length]);
				} else {
					live.sort(function (a, b) {
						if (rule === "recent") { return a.date === b.date ? rank(a) - rank(b) : b.date > a.date ? 1 : -1; }
						if (rule === "complete") { return b.val.length - a.val.length || tie(a, b); }
						if (rule === "frequent") {
							var fa = live.filter(function (x) { return x.val === a.val; }).length, fb = live.filter(function (x) { return x.val === b.val; }).length;
							return fb - fa || tie(a, b);
						}
						return rank(a) - rank(b);
					});
					win = live[0];
					why = T("mr.sv.why." + rule, [that._srcName(win.src), win.date]);
				}
				var dropped = cands.filter(function (c) { return c.val && sv.dqGate && !c.ok; }).length;
				if (dropped) { why += " · " + T("mr.sv.why.dq", [dropped]); }
				return { fieldText: g ? T("mr.grp." + grp) : that._t(that._field(row.col, m)),
					candText: cands.map(function (c) { return that._srcName(c.src) + ": " + (c.val ? LRM + c.val + LRM : "—") + " (" + c.date + (c.ok ? "" : ", " + T("mr.sv.dqFail")) + ")"; }).join("\n"),
					winText: win ? win.val : "—", why: why };
			});
		},

		onModel: function (oEvent) {
			var k = oEvent.getParameter("listItem").getBindingContext("view").getProperty("key");
			this.router().navTo("models", { model: k }, true);
		},
		onSearch: function () { this._refresh(); },
		onEdit: function () {
			var m = this._model();
			if (m) { m.dirty = true; m.pending = false; }
			this._refresh();
		},

		/* ---------- create, edit and delete a model: one per repository ---------- */
		onCreate: function () { this._modelDialog(null); },
		onEditModel: function () { this._modelDialog(this._model()); },
		_modelDialog: function (oModel) {
			var that = this, repos = this.data().getProperty("/repos") || {},
				taken = this._w.models.map(function (m) { return m.repo; }),
				oEn = new Input({ width: "100%", value: oModel ? oModel.en : "", placeholder: this.text("mr.f.nameEnPh") }),
				oAr = new Input({ width: "100%", value: oModel ? oModel.ar : "", placeholder: this.text("mr.f.nameArPh") }),
				oDomain = new Select({ width: "100%", selectedKey: oModel ? oModel.domain : "customers", enabled: !oModel,
					items: (this.data().getProperty("/domains") || []).map(function (d) { return new Item({ key: d.id, text: that.domainName(d) }); }) }),
				oRepo = new Select({ width: "100%", enabled: !oModel, showSecondaryValues: true }),
				oRepoHint = new Text({ text: "" }).addStyleClass("repoioUmMuted"),
				oDesc = new TextArea({ width: "100%", rows: 2, value: oModel ? (this._ar() ? oModel.descAr : oModel.descEn) : "" }),
				repoHint = function () {
					var r = oRepo.getSelectedKey();
					oRepoHint.setText(r ? that.text("mr.f.repoHint", [that._cols({ repo: r }).length]) : that.text(oRepo.getItems().length ? "mr.f.repoAllTaken" : "mr.f.noRepo"));
				},
				fillRepo = function () {
					var d = oDomain.getSelectedKey(), ids = Object.keys(repos).filter(function (k) { return repos[k].domainId === d && (oModel ? k === oModel.repo : taken.indexOf(k) < 0); });
					oRepo.destroyItems();
					ids.forEach(function (k) { oRepo.addItem(new ListItem({ key: k, text: repos[k].name, additionalText: repos[k].model })); });
					oRepo.setSelectedKey(oModel ? oModel.repo : ids[0] || "");
					oRepo.setValueState(ids.length ? "None" : "Warning");
					repoHint();
				};
			oDomain.attachChange(fillRepo);
			oRepo.attachChange(repoHint);
			fillRepo();
			var oDlg = new Dialog({
				title: this.text(oModel ? "mr.editTitle" : "mr.createTitle"), contentWidth: "30rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1, content: [
					new Label({ text: this.text("mr.f.nameEn"), required: true }), oEn,
					new Label({ text: this.text("mr.f.nameAr"), required: true }), oAr,
					new Label({ text: this.text("mr.f.domain"), required: true }), oDomain,
					new Label({ text: this.text("mr.f.repo"), required: true }), oRepo, oRepoHint,
					new Label({ text: this.text("mr.f.desc") }), oDesc
				] })].concat(oModel ? [] : [new MessageStrip({ text: this.text("mr.f.onePerRepo"), type: "Information", showIcon: true }).addStyleClass("sapUiSmallMargin")]),
				beginButton: new Button({ text: this.text(oModel ? "common.save" : "mr.createBtn"), type: "Emphasized", press: function () {
					var en = oEn.getValue().trim(), ar = oAr.getValue().trim(), bad = false;
					[[oEn, en], [oAr, ar]].forEach(function (x) { x[0].setValueState(x[1] ? "None" : "Error").setValueStateText(that.text("mr.v.required")); bad = bad || !x[1]; });
					var clash = that._w.models.some(function (m) { return m !== oModel && (m.en.toLowerCase() === en.toLowerCase() || m.ar === ar); });
					if (!bad && clash) { oEn.setValueState("Error").setValueStateText(that.text("mr.v.unique")); bad = true; }
					if (!oRepo.getSelectedKey()) { oRepo.setValueState("Error").setValueStateText(that.text("mr.f.noRepoPick")); bad = true; }
					if (bad) { return; }
					var desc = oDesc.getValue().trim();
					if (oModel) {
						oModel.en = en; oModel.ar = ar;
						if (that._ar()) { oModel.descAr = desc; } else { oModel.descEn = desc; }
						oModel.dirty = true; oModel.pending = false;
					} else {
						oModel = that._newModel(en, ar, oDomain.getSelectedKey(), oRepo.getSelectedKey(), desc);
						that._w.models.push(oModel);
						that._sel = oModel.key;
						that.viewModel().setProperty("/mr/tab", "match");
						MessageToast.show(that.text("mr.t.created", [that._t(oModel)]));
					}
					oDlg.close();
					that.router().navTo("models", { model: oModel.key }, true);
					that._refresh();
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		/* A new model starts from the repository's columns: the name and phone comparisons, one blocking rule, the default
		   bands, and source priority for every column. Weights come from the first training run. */
		_newModel: function (en, ar, domain, repo, desc) {
			var cols = this._cols({ repo: repo }), has = function (k) { return cols.some(function (c) { return c.col === k; }); },
				first = FIRST_TOKEN.filter(has)[0], name = ["name_std", "title_std"].filter(has)[0], fields = cols.map(function (c) { return c.col; }),
				r = this._repo(repo) || {};
			return {
				key: repo, en: en, ar: ar, domain: domain, repo: repo, descEn: this._ar() ? "" : desc, descAr: this._ar() ? desc : "",
				status: "draft", version: "1", changed: this._src.now || "2026-11-16", owner: "محمد", icon: DOMAIN_ICON[domain], dirty: true,
				comparisons: [name && { field: name, method: "jw", levels: [0.95, 0.9], weight: null, on: true },
					has("phones") && { field: "phones", method: "array", weight: null, on: true }].filter(Boolean),
				blocking: first ? [{ fields: [first] }] : [],
				training: { gate: { precision: 0.95, recall: 0.9 }, eval: {} },
				segmentBy: "", segments: [],
				consolidation: { auto: false, autoMerge: 0.95, review: 0.8, learn: true },
				requestCheck: { stop: 0.9, review: 0.8, staged: true, checks: this._src.checkCatalog.map(function (c) {
					return { key: c.key, on: c.key !== "similarOpenCr" && (!c.needs || fields.indexOf(c.needs) > -1), outcome: c.kind === "score" ? "band" : "stop" };
				}) },
				survivorship: { priority: (r.sourceIds || []).slice(), dqGate: true, stewardLock: true, tieBreak: "recent", backfill: false, groups: [],
					rules: cols.filter(function (c) { return !c.derived && KEY_COLS.indexOf(c.col) < 0; }).map(function (c) { return { col: c.col, rule: "sourcePriority" }; }) },
				stats: { golden: r.golden || 0, pairs: [], requests: [] }, impact: {}
			};
		},
		onDeleteModel: function () {
			var that = this, m = this._model();
			MessageBox.confirm(this.text("mr.delConfirm", [this._t(m)]), { actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL], emphasizedAction: MessageBox.Action.DELETE,
				onClose: function (a) {
					if (a !== MessageBox.Action.DELETE) { return; }
					that._w.models.splice(that._w.models.indexOf(m), 1);
					that._sel = that._w.models[0] && that._w.models[0].key;
					MessageToast.show(that.text("mr.t.deleted", [that._t(m)]));
					that.router().navTo("models", { model: that._sel }, true);
					that._refresh();
				} });
		},

		/* ---------- comparisons ---------- */
		onAddCmp: function () { this._cmpDialog(null); },
		onEditCmp: function (oEvent) { this._cmpDialog(oEvent.getSource().getBindingContext("view").getObject()); },
		onDelCmp: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(), m = this._model();
			m.comparisons.splice(m.comparisons.indexOf(o), 1);
			this.onEdit();
		},
		_cmpDialog: function (oCmp) {
			var that = this, m = this._model(), M = this._src.methods, F = {},
				used = m.comparisons.filter(function (c) { return c !== oCmp; }).map(function (c) { return c.field; }),
				fieldKeys = this._cols(m).map(function (c) { return c.col; }).filter(function (k) { return FIRST_TOKEN.indexOf(k) < 0 && used.indexOf(k) < 0; });
			this._cols(m).forEach(function (c) { F[c.col] = c; });
			if (!fieldKeys.length) { MessageToast.show(this.text("mr.cmp.allUsed")); return; }
			var oField = new Select({ width: "100%", selectedKey: oCmp ? oCmp.field : fieldKeys[0], showSecondaryValues: true,
					items: fieldKeys.map(function (k) { return new ListItem({ key: k, text: that._colText(F[k]), additionalText: k }); }) }),
				oMethod = new Select({ width: "100%" }),
				oLevels = new Input({ width: "100%", textDirection: "LTR" }),
				oLvLabel = new Label({ text: this.text("mr.cmp.levelsIn") }),
				oHint = new Text({ text: "" }).addStyleClass("repoioUmMuted"),
				oMHint = new Text({ text: "" }).addStyleClass("repoioUmMuted"),
				syncLv = function (bKeep) {
					var k = oMethod.getSelectedKey(), show = !!M[k].levels;
					// What the method compares, so the steward can pick between "any value in common" and the detailed levels
					oMHint.setText(that.text("mr.md." + k));
					oLevels.setVisible(show); oLvLabel.setVisible(show);
					if (show) { oLevels.setValue(((bKeep && oCmp && oCmp.method === k && oCmp.levels) || DEFAULT_LEVELS[k]).join(", ")); }
					oLvLabel.setText(that.text(k === "lev" ? "mr.cmp.levelsLev" : "mr.cmp.levelsIn"));
				},
				sync = function (bKeep) {
					var f = F[oField.getSelectedKey()], kinds = Object.keys(M).filter(function (x) { return M[x].kinds.indexOf(f.kind) > -1; }),
						cur = bKeep && oCmp ? oCmp.method : oMethod.getSelectedKey();
					oMethod.destroyItems();
					kinds.forEach(function (x) { oMethod.addItem(new Item({ key: x, text: that._t(M[x]) + " · " + M[x].splink })); });
					oMethod.setSelectedKey(kinds.indexOf(cur) > -1 ? cur : kinds[0]);
					oHint.setText(that._ar() ? f.hintAr || "" : f.hintEn || "");
					syncLv(bKeep);
				};
			oField.attachChange(function () { sync(false); });
			oMethod.attachChange(function () { syncLv(false); });
			sync(true);
			var oDlg = new Dialog({
				title: this.text(oCmp ? "mr.cmp.editTitle" : "mr.cmp.addTitle", [this._t(m)]), contentWidth: "30rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1, content: [
					new Label({ text: this.text("mr.cmp.field"), required: true }), oField, oHint,
					new Label({ text: this.text("mr.cmp.method"), required: true }), oMethod, oMHint,
					oLvLabel, oLevels
				] }), new MessageStrip({ text: this.text("mr.cmp.retrain"), type: "Information", showIcon: true }).addStyleClass("sapUiSmallMargin")],
				beginButton: new Button({ text: this.text("common.save"), type: "Emphasized", press: function () {
					var k = oMethod.getSelectedKey(), lv = null;
					if (M[k].levels) {
						lv = oLevels.getValue().split(/[,،\s]+/).filter(Boolean).map(Number);
						var ok = lv.length && lv.every(function (v) { return k === "lev" ? v >= 0 && v === Math.round(v) : v > 0 && v < 1; });
						if (!ok) { oLevels.setValueState("Error").setValueStateText(that.text(k === "lev" ? "mr.v.levelsLev" : "mr.v.levels")); return; }
						lv.sort(function (a, b) { return k === "lev" ? a - b : b - a; });
					}
					var o = oCmp || { on: true };
					if (!oCmp || oCmp.field !== oField.getSelectedKey() || oCmp.method !== k) { o.weight = null; } // learned at the next training run
					o.field = oField.getSelectedKey(); o.method = k; o.levels = lv;
					if (!oCmp) { m.comparisons.push(o); }
					oDlg.close();
					that.onEdit();
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},

		/* ---------- blocking rules: which pairs Splink scores at all ---------- */
		onAddBlk: function () {
			var that = this, m = this._model(),
				oFields = new MultiComboBox({ width: "100%", showSecondaryValues: true,
					items: this._cols(m).map(function (c) { return new ListItem({ key: c.col, text: that._colText(c), additionalText: c.col }); }) });
			var oDlg = new Dialog({
				title: this.text("mr.blk.addTitle", [this._t(m)]), contentWidth: "28rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1, content: [
					new Label({ text: this.text("mr.blk.fields"), required: true }), oFields,
					new Text({ text: this.text("mr.blk.fieldsHint") }).addStyleClass("repoioUmMuted")
				] })],
				beginButton: new Button({ text: this.text("mr.blk.add"), type: "Emphasized", press: function () {
					var a = oFields.getSelectedKeys();
					if (!a.length) { oFields.setValueState("Error").setValueStateText(that.text("mr.v.blk")); return; }
					m.blocking.push({ fields: a });
					oDlg.close();
					that.onEdit();
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		onDelBlk: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(), m = this._model();
			m.blocking.splice(m.blocking.indexOf(o), 1);
			this.onEdit();
		},

		/* ---------- the Splink settings the matching service builds from this model (read-only preview) ---------- */
		_splinkText: function (m) {
			// "Shared values in detail": one level per kind of overlap between two lists, learned like any other level
			var overlap = function (col) {
				var l = col + "_l", r = col + "_r";
				return ["        cl.CustomComparison(output_column_name=\"" + col + "\", comparison_levels=[",
					"            cll.NullLevel(\"" + col + "\"),",
					"            cll.CustomLevel(\"array_sort(" + l + ") = array_sort(" + r + ")\", \"same values\"),",
					"            cll.CustomLevel(\"size(array_intersect(" + l + ", " + r + ")) = least(size(" + l + "), size(" + r + "))\", \"one contains the other\"),",
					"            cll.ArrayIntersectLevel(\"" + col + "\", min_intersection=1),",
					"            cll.ElseLevel(),",
					"        ]),"].join("\n");
			};
			var that = this, segBy = m.segmentBy ? this._field(m.segmentBy, m).col : "",
				cmp = m.comparisons.filter(function (c) { return c.on; }).map(function (c) {
					var f = that._field(c.field), mt = that._src.methods[c.method], args = "\"" + f.col + "\"";
					if (c.method === "jw" || c.method === "lev") { args += ", [" + (c.levels || DEFAULT_LEVELS[c.method]).join(", ") + "]"; }
					if (c.method === "array") { args += ", [1]"; }
					if (c.method === "overlap") { return overlap(f.col); }
					return "        cl." + mt.splink + "(" + args + "),";
				}),
				blk = m.blocking.map(function (b) { that._decorateBlk(b); return "        " + b.sql + ","; }),
				segs = (m.segments || []).map(function (s) {
					return "#   " + s.key + ": " + segBy + " in (" + s.values.join(", ") + ")" + (m.consolidation.auto ? " · auto-merge >= " + that._n(that._eff(m, s, "autoMerge")) : "") +
						" · review >= " + that._n(that._eff(m, s, "review")) + " · request stop >= " + that._n(that._eff(m, s, "request")) +
						(s.scope === "all" ? " · matches every segment" : " · matches its own segment") +
						((s.exceptions || []).some(function (e) { return e.on; }) ? " · " + that.text("mr.exc.siblings.code") : "");
				});
			return ["# " + this._t(m) + " · " + m.repo + " · " + this.text("mr.ver.short", [m.dirty && m.status === "active" ? Number(m.version) + 1 : m.version]),
				"from splink import SettingsCreator, block_on",
				"import splink.comparison_library as cl" + (m.comparisons.some(function (c) { return c.on && c.method === "overlap"; }) ?
					"\nimport splink.comparison_level_library as cll" : ""),
				"",
				"# Shared by consolidation and the request check. A missing value adds no weight (Splink null level).",
				"settings = SettingsCreator(",
				"    link_type=\"dedupe_only\",  # consolidation: the repository's own records",
				"    unique_id_column_name=\"record_id\",",
				"    blocking_rules_to_generate_predictions=[",
				blk.join("\n"),
				"    ],",
				"    comparisons=[",
				cmp.join("\n"),
				"    ],",
				")",
				"# Request check: the same settings with link_type=\"link_only\" (change request <-> golden records" + (m.requestCheck.staged ? " and staged records" : "") + ")",
				"# Consolidation: " + (m.consolidation.auto ? "auto-merge >= " + this._n(m.consolidation.autoMerge) + " · " : "no auto-merge · ") + "review >= " + this._n(m.consolidation.review),
				"# Request check: stop >= " + this._n(m.requestCheck.stop) + " · flag for the approver >= " + this._n(m.requestCheck.review)]
				.concat(segs.length ? ["# Segments (" + segBy + "):"].concat(segs) : []).join("\n");
		},
		onSplink: function () {
			var that = this, m = this._model(), s = this._splinkText(m);
			var oDlg = new Dialog({
				title: this.text("mr.splinkTitle", [this._t(m)]), contentWidth: "48rem",
				content: [new MessageStrip({ text: this.text("mr.splinkNote"), type: "Information", showIcon: true }).addStyleClass("sapUiSmallMargin"),
					new TextArea({ value: s, editable: false, width: "100%", rows: 26, textDirection: "LTR" }).addStyleClass("repoioMrCode")],
				beginButton: new Button({ text: this.text("mr.copy"), icon: "sap-icon://copy", press: function () {
					try { navigator.clipboard.writeText(s).catch(function () { /* clipboard blocked */ }); } catch (e) { /* clipboard blocked */ }
					MessageToast.show(that.text("mr.t.copied"));
				} }),
				endButton: new Button({ text: this.text("common.close"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},

		/* ---------- 6. impact: sample change requests under the active version and this draft ---------- */
		_reqResult: function (s, m) {
			var that = this, seg = this._seg(m, s.segment), rc = m.requestCheck, stop = this._eff(m, seg, "request"), worst = "passed", why = [], skipped = [];
			(s.hits || []).forEach(function (h) {
				var c = rc.checks.filter(function (x) { return x.key === h.check; })[0], cat = that._src.checkCatalog.filter(function (x) { return x.key === h.check; })[0] || {};
				if (!c || !c.on) { return; }
				if (h.exception && seg && (seg.exceptions || []).some(function (e) { return e.key === h.exception && e.on; })) { skipped.push(h); return; }
				var r = cat.kind === "score" ? (h.score >= stop ? "stopped" : h.score >= rc.review ? "review" : "passed") : c.outcome === "review" ? "review" : "stopped";
				if (r === "passed") { return; }
				why.push("• " + that.text("mr.chk." + h.check) + ": " + (that._ar() ? h.ar : h.en));
				if (r === "stopped" || worst === "passed") { worst = r; }
			});
			return { result: worst, why: why, skipped: skipped };
		},
		_samples: function () {
			var that = this, ar = this._ar(), m = this._model(), act = m && this._active(m),
				meta = Sem.GROUPS.gate;
			this.viewModel().setProperty("/mr/samples", this._src.samples.filter(function (s) { return m && s.model === m.key; }).map(function (s) {
				var d = that._reqResult(s, m), a = act ? that._reqResult(s, act) : null, seg = that._seg(m, s.segment);
				return {
					id: s.id, by: s.by, name: s.name, phonesText: s.phones.join(" · "), segText: seg ? that._t(seg) : s.template,
					activeText: a ? that.text("mr.res." + a.result) : "—", activeState: a ? meta[a.result][0] : "None", activeIcon: a ? meta[a.result][1] : "",
					draftText: that.text("mr.res." + d.result), draftState: meta[d.result][0], draftIcon: meta[d.result][1],
					changed: !!a && a.result !== d.result, highlight: meta[d.result][0],
					why: d.why.length ? d.why.join("\n") : that.text("mr.res.none", [Number(s.best).toFixed(2)]),
					note: d.skipped.length ? (ar ? s.noteAr : s.noteEn) || that.text("mr.res.exception") : ""
				};
			}));
			if (m) { this.viewModel().setProperty("/mr/m/svImpact", this._svImpact(m, act)); }
		},
		/* Golden records whose values would change under this draft's survivorship (sample counts from a simulation run). */
		_svImpact: function (m, act) {
			if (!act) { return []; }
			var that = this, sv = m.survivorship, av = act.survivorship, out = [], imp = m.impact || {}, T = this.text.bind(this),
				ruleOf = function (s, col) { var r = s.rules.filter(function (x) { return x.col === col; })[0]; return r && r.rule; },
				cnt = function (col, rule) { return (imp[col] || {})[rule] || 0; };
			sv.rules.forEach(function (r) {
				var was = ruleOf(av, r.col);
				if (was && was !== r.rule) {
					out.push({ text: that._t(that._field(r.col, m)), fromTo: T("mr.imp.ruleChange", [T("mr.rule." + was), T("mr.rule." + r.rule)]), n: cnt(r.col, r.rule) });
				}
			});
			sv.groups.forEach(function (g) {
				var was = av.groups.filter(function (x) { return x.key === g.key; })[0];
				if (was && was.rule !== g.rule) {
					out.push({ text: T("mr.grp." + g.key), fromTo: T("mr.imp.ruleChange", [T("mr.rule." + was.rule), T("mr.rule." + g.rule)]),
						n: Math.max.apply(null, g.cols.map(function (c) { return cnt(c, g.rule); })) });
				}
			});
			if (sv.priority.join() !== av.priority.join()) {
				var cols = sv.rules.filter(function (r) { return r.rule === "sourcePriority"; }).map(function (r) { return r.col; });
				out.push({ text: T("mr.sv.prio"), fromTo: T("mr.imp.ruleChange", [av.priority.map(this._srcName, this).join(" › "), sv.priority.map(this._srcName, this).join(" › ")]),
					n: cols.reduce(function (s, c) { return s + cnt(c, "sourcePriority"); }, 0) });
			}
			if (sv.dqGate !== av.dqGate) { out.push({ text: T("mr.sv.dq"), fromTo: T(sv.dqGate ? "mr.imp.on" : "mr.imp.off"), n: null }); }
			if (sv.stewardLock !== av.stewardLock) { out.push({ text: T("mr.sv.lock"), fromTo: T(sv.stewardLock ? "mr.imp.on" : "mr.imp.off"), n: null }); }
			if (sv.tieBreak !== av.tieBreak) { out.push({ text: T("mr.sv.tie"), fromTo: T("mr.imp.ruleChange", [T("mr.rule." + av.tieBreak), T("mr.rule." + sv.tieBreak)]), n: null }); }
			return out.map(function (o) {
				o.countText = o.n === null ? T("mr.imp.atRun") : T("mr.imp.count", [that._int(o.n), (o.n / Math.max(1, m.stats.golden) * 100).toFixed(1)]);
				return o;
			});
		},

		/* ---------- draft ---------- */
		onDiscard: function () {
			this._reset();
			MessageToast.show(this.text("mr.t.discarded"));
			this.router().navTo("models", { model: this._sel }, true);
			this._refresh();
		},
		_problem: function (m) {
			var c = m.consolidation, rc = m.requestCheck;
			if (!m.comparisons.some(function (x) { return x.on; }) || !m.blocking.length) { return ["match", "mr.v.submit"]; }
			if (c.auto && c.review >= c.autoMerge) { return ["consolidate", "mr.v.bandsSubmit"]; }
			if (rc.review >= rc.stop) { return ["gate", "mr.v.reqBandsSubmit"]; }
			if ((m.segments || []).length && !m.segmentBy) { return ["segments", "mr.v.segBy"]; }
			return null;
		},
		onSubmit: function () {
			var that = this, changed = this._w.models.filter(function (m) { return m.dirty; }),
				bad = changed.filter(function (m) { return that._problem(m); })[0];
			if (bad) {
				var p = this._problem(bad);
				this._sel = bad.key;
				this.router().navTo("models", { model: bad.key }, true);
				this.viewModel().setProperty("/mr/tab", p[0]);
				this._refresh();
				MessageBox.error(this.text(p[1], [this._t(bad)]));
				return;
			}
			changed.forEach(function (m) {
				var v = m.status === "active" ? Number(m.version) + 1 : Number(m.version);
				Audit.log(that, { area: "data", action: m.status === "active" ? "update" : "create", type: "setting", object: that._t(m) + " · " + that.text("mr.ver.short", [v]),
					en: "Match model submitted for approval", ar: "إرسال نموذج المطابقة للموافقة", ref: { route: "models", args: { model: m.key } } });
				m.dirty = false;
				m.pending = true;
			});
			MessageToast.show(this.text("mr.t.submitted", [changed.length]));
			this._refresh();
		}
	});
});
