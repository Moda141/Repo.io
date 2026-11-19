sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/audit",
	"repoio/proto/util/visualFilter",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Label",
	"sap/m/Select",
	"sap/m/TextArea",
	"sap/m/Text",
	"sap/ui/core/Item",
	"sap/ui/layout/form/SimpleForm"
], function (BaseController, Audit, VF, MessageToast, MessageBox, Dialog, Button, Label, Select, TextArea, Text, Item, SimpleForm) {
	"use strict";

	var FIELDS = ["name", "mobile_1", "mobile_2", "whatsapp", "email", "account_type", "state_id", "main_territory_id", "territory_1_id", "final_subject",
			"final_stages", "parent_name", "national_id", "changed"],
		COMP = { name: "name", mobile_1: "phones", state_id: "state_id", main_territory_id: "main_territory_id", territory_1_id: "territory_1_id",
			final_subject: "final_subject", final_stages: "final_stages", parent_name: "parent_name", national_id: "national_id" },
		PHONES = ["mobile_1", "mobile_2", "whatsapp"],
		LTR = ["mobile_1", "mobile_2", "whatsapp", "email", "account_type", "main_territory_id", "territory_1_id", "national_id", "changed"],
		NUMBER_CHECKS = ["phoneGolden", "phoneOpenCr", "nationalId"],
		STEWARDS = ["سارة عادل", "أحمد ناصر", "هالة سمير", "كريم فؤاد"];

	/* J5: Match detection — one queue, four views of it (consolidation pairs, stopped requests, second approvals, decided).
	   The console sends decisions to the match review API; it never merges records itself. */
	return BaseController.extend("repoio.proto.controller.MatchDetection", {
		onInit: function () {
			this.viewModel().setProperty("/md", { tab: "pairs", layout: "OneColumn", f: { q: "", seg: [], bands: [], age: [], assigned: "" }, filterMode: "visual", onlyDiff: false,
				count: {}, it: {}, selCount: 0 });
			this.router().getRoute("matches").attachPatternMatched(this._onMatched, this);
			this._key = this._onKey.bind(this);
			document.addEventListener("keydown", this._key);
		},
		exit: function () { document.removeEventListener("keydown", this._key); },

		_onMatched: function (oEvent) {
			var that = this, a = oEvent.getParameter("arguments") || {}, q = a["?query"] || {},
				oS = this.getOwnerComponent().getModel("stewardship"), oR = this.getOwnerComponent().getModel("rules");
			Promise.all([oS.dataLoaded(), oR.dataLoaded(), this.data().dataLoaded ? this.data().dataLoaded() : null]).then(function () {
				if (!that._q) {
					var d = JSON.parse(JSON.stringify(oS.getData()));
					that._cfg = d;
					that._q = { pairs: d.pairs, requests: d.requests, second: d.second, decided: d.decided };
				}
				if (q.tab) { that.viewModel().setProperty("/md/tab", q.tab); }
				that._lists();
				that._refresh();
				if (a.id) { that._open(a.id); } else { that.viewModel().setProperty("/md/layout", "OneColumn"); that._openId = null; that._refresh(); }
			});
		},

		/* ---------- helpers ---------- */
		_ar: function () { return this.lang() === "ar"; },
		_t: function (o) { return o ? (this._ar() ? o.ar || o.en : o.en || o.ar) : ""; },
		_me: function () { return this._cfg.me; },
		_model: function () { return (this.getOwnerComponent().getModel("rules").getProperty("/models") || []).filter(function (m) { return m.repo === "customer-master"; })[0]; },
		_seg: function (k) { return ((this._model() || {}).segments || []).filter(function (s) { return s.key === k; })[0]; },
		_segText: function (k) { var s = this._seg(k); return s ? this._t(s) : k; },
		_col: function (k) {
			if (k === "changed") { return this.text("md.changedInSource"); }
			var c = (this.getOwnerComponent().getModel("rules").getProperty("/repoColumns/customer-master") || []).filter(function (x) { return x.col === k; })[0];
			return c ? this._t(c) : k;
		},
		_compLabel: function (k) { return k === "phones" ? this.text("md.phones") : this._col(k); },
		_srcName: function (id) {
			if (id === "request") { return this.text("md.src.request"); }
			if (id === "golden") { return this.text("md.src.golden"); }
			var s = (this.data().getProperty("/sources") || {})[id]; return s ? s.name : id;
		},
		_val: function (k, v) {
			if (!v) { return "—"; }
			if (k === "state_id") { return this.text("gov." + v) + " (" + v + ")"; }
			if (k === "account_type") { var s = ((this._model() || {}).segments || []).filter(function (x) { return x.values.indexOf(v) > -1; })[0]; return v + (s ? " · " + this._t(s) : ""); }
			return v;
		},
		_band: function (it) {
			var s = this._seg(it.segment), m = this._model(), auto = (s && s.own && s.own.autoMerge) || m.consolidation.autoMerge;
			return it.prob >= this._cfg.batch.minProb ? "hi" : it.prob >= (auto + ((s && s.own && s.own.review) || m.consolidation.review)) / 2 ? "mid" : "lo";
		},
		_eligible: function (it) { return it.kind === "pair" && it.prob >= this._cfg.batch.minProb && !(it.risks || []).length; },
		/* A second steward approves merges of groups, of records with different national IDs or with an open request, and
		   releases of requests stopped by matching numbers. */
		_needsSecond: function (it) {
			if (it.kind === "request") { return NUMBER_CHECKS.indexOf(it.check) > -1; }
			return it.kind === "cluster" || (it.risks || []).some(function (r) { return r === "idDiffers" || r === "openCr"; });
		},
		_names: function (it) {
			var r = it.records;
			return it.kind === "cluster" ? this.text("md.clusterName", [r[0].name, r.length - 1]) : it.kind === "request" ? r[0].name : r[0].name + "  ⟷  " + r[1].name;
		},
		_find: function (id) {
			var q = this._q, out = null;
			["pairs", "requests", "second", "decided"].some(function (k) {
				var x = q[k].filter(function (i) { return i.id === id; })[0];
				if (x) { out = { list: k, it: x }; }
				return !!x;
			});
			return out;
		},
		_reasons: function (it) {
			var that = this;
			return (it.parts || []).filter(function (p) { return p.w > 0; }).sort(function (a, b) { return b.w - a.w; }).slice(0, 2).map(function (p) {
				return that._compLabel(p.comp) + " " + that._levelText(p).toLowerCase();
			}).join(" · ");
		},
		_levelText: function (p) {
			if (!p || p.level === "null") { return this.text("md.lv.null"); }
			if (p.level === "jw95" || p.level === "jw90") { return this.text("md.lv.similar", [p.sim ? p.sim.toFixed(2) : p.level === "jw95" ? "0.95" : "0.90"]); }
			return this.text("md.lv." + p.level);
		},

		/* ---------- queue ---------- */
		_lists: function () {
			var that = this;
			this.viewModel().setProperty("/md/segs", ((this._model() || {}).segments || []).map(function (s) { return { key: s.key, text: that._t(s) }; }));
		},
		_ageKey: function (it) { var a = it.age || 0; return a <= 1 ? "new" : a <= this._cfg.slaDays ? "near" : "over"; },
		_active: function () { var f = this.viewModel().getProperty("/md/f"); return f.seg.length + f.bands.length + f.age.length + (f.assigned ? 1 : 0); },
		/* skip: the dimension a visual filter card counts, so each card shows the other filters applied (ALP behaviour). */
		_match: function (it, tab, skip) {
			var f = this.viewModel().getProperty("/md/f"), q = (f.q || "").trim().toLowerCase(), me = this._me();
			if (q && [it.id, it.ref || "", it.requester || ""].concat((it.records || []).map(function (r) { return r.name + " " + r.id + " " + r.mobile_1; })).join(" ")
				.toLowerCase().indexOf(q) < 0 && (it.names || "").toLowerCase().indexOf(q) < 0) { return false; }
			if (tab === "decided") { return true; }
			if (skip !== "seg" && f.seg.length && f.seg.indexOf(it.segment) < 0) { return false; }
			if (skip !== "bands" && f.bands.length && f.bands.indexOf(this._band(it)) < 0) { return false; }
			if (skip !== "age" && f.age.length && f.age.indexOf(this._ageKey(it)) < 0) { return false; }
			if (f.assigned === "me" && it.assigned !== me) { return false; }
			if (f.assigned === "none" && it.assigned) { return false; }
			return true;
		},
		_refresh: function () {
			var that = this, vm = this.viewModel(), tab = vm.getProperty("/md/tab"), q = this._q, T = this.text.bind(this), me = this._me(), sla = this._cfg.slaDays,
				checked = this._checked || {};
			var src = tab === "pairs" ? q.pairs.filter(function (i) { return i.state === "open"; }) : q[tab];
			var rows = src.filter(function (i) { return that._match(i, tab); }).map(function (it) {
				var age = it.age || 0, over = age > sla, r = { id: it.id, kind: it.kind, navigated: it.id === that._openId, checked: !!checked[it.id], flags: [], p1: "", p2: "", c2t: "", p5: "" };
				if (tab === "decided") {
					r.title = it.names; r.sub = it.id; r.c2 = T("md.dec." + it.decision); r.c2b = ""; r.p2 = it.by; r.c2t = "· " + it.at; r.probText = it.prob.toFixed(3); r.probState = "None";
					r.c4 = it.note || "—"; r.c5 = that._segText(it.segment); r.c5State = "None"; r.highlight = "None";
					return r;
				}
				r.title = that._names(it);
				r.sub = it.kind === "request" ? it.id + " · " + it.ref : it.records.map(function (x) { return x.id; }).join(" · ");
				r.probText = it.prob.toFixed(3);
				r.probState = it.prob >= 0.93 ? "Success" : it.prob >= 0.85 ? "Information" : "Warning";
				r.c5 = over ? T("md.ageOver", [age]) : T("md.age", [age]); r.c5State = over ? "Error" : age >= sla ? "Warning" : "None"; r.c5Icon = over ? "sap-icon://alert" : "";
				r.highlight = over ? "Error" : age >= sla ? "Warning" : "None"; // highlight only the SLA exceptions
				(it.risks || []).forEach(function (k) { r.flags.push({ text: T("md.risk." + k), icon: "sap-icon://warning2" }); });
				if (tab === "pairs") {
					r.c2 = that._segText(it.segment); r.c2b = it.records.slice(1).map(function (x) { return that._srcName(x.source); }).join(" · ");
					r.c4 = that._reasons(it); r.c5b = it.assigned ? T("md.assignedToL") : T("md.as.none"); r.p5 = it.assigned || "";
				} else if (tab === "requests") {
					r.c2 = T("mr.chk." + it.check); r.c2b = T("md.byL"); r.p2 = it.requester; r.c4 = T("md.against", [it.ref, it.records[1].name]);
					if (it.requester === me) { r.flags.push({ text: T("md.yourRequest"), icon: "sap-icon://employee" }); }
					r.c5b = "";
				} else {
					r.c2 = T("md.firstL." + it.first.decision); r.p1 = it.first.by; r.c2b = it.first.at; r.c4 = it.kind === "request" ? T("mr.chk." + it.check) : that._reasons(it);
					if (it.first.by === me) { r.flags.push({ text: T("md.yourDecision"), icon: "sap-icon://employee" }); }
					r.c5b = "";
				}
				return r;
			});
			rows.forEach(function (r) { r.short = [r.c2, r.c5].filter(Boolean).join(" · "); });
			vm.setProperty("/md/rows", rows);
			vm.setProperty("/md/count", { pairs: q.pairs.filter(function (i) { return i.state === "open"; }).length, requests: q.requests.length, second: q.second.length, decided: q.decided.length });
			vm.setProperty("/md/listTitle", T("md.list." + tab, [rows.length]));
			vm.setProperty("/md/noData", T("md.none." + tab));
			vm.setProperty("/md/col2", T("md.col2." + tab));
			vm.setProperty("/md/col4", T("md.col4." + tab));
			vm.setProperty("/md/col5", T("md.col5." + tab));
			var open = q.pairs.filter(function (i) { return i.state === "open"; }).concat(q.requests), today = q.decided.filter(function (d) { return d.at.indexOf("2026-11-16") === 0; }).length,
				oldest = Math.max.apply(null, open.map(function (i) { return i.age || 0; }).concat([0])), tr = this._cfg.training,
				batch = q.pairs.filter(function (i) { return i.state === "open" && that._eligible(i); }).length;
			vm.setProperty("/md/summary", T("md.summary", [open.length, batch, q.second.length, today, oldest, sla]));
			vm.setProperty("/md/active", this._active());
			vm.setProperty("/md/clearText", T("md.clear", [this._active()]));
			this._charts(src, tab);
			vm.setProperty("/md/trainText", T("md.train", [tr.since]));
			this._batchState();
		},
		_batchState: function () {
			var that = this, vm = this.viewModel(), ids = Object.keys(this._checked || {}).filter(function (k) { return that._checked[k]; }),
				items = ids.map(function (id) { return (that._find(id) || {}).it; }).filter(Boolean), bad = items.filter(function (i) { return !that._eligible(i); }),
				max = this._cfg.batch.max;
			vm.setProperty("/md/selCount", items.length);
			vm.setProperty("/md/batchText", this.text("md.a.batch", [items.length]));
			vm.setProperty("/md/batchOk", items.length > 0 && !bad.length && items.length <= max);
			vm.setProperty("/md/batchWhy", !items.length ? this.text("md.batchHint", [this._cfg.batch.minProb.toFixed(2), max]) : bad.length ? this.text("md.batchBad", [bad.length])
				: items.length > max ? this.text("md.batchMax", [max]) : "");
		},
		onTab: function (oEvent) {
			this.viewModel().setProperty("/md/tab", oEvent.getParameter("key"));
			this._checked = {};
			this._refresh();
		},
		onFilter: function () { this._refresh(); },
		/* The three visual filter cards: queue by customer type, by probability band, by waiting time against the SLA. */
		_charts: function (src, tab) {
			var that = this, f = this.viewModel().getProperty("/md/f"), C = this.colors, T = this.text.bind(this), vm = this.viewModel(),
				cnt = function (dim, keyOf) { var m = {}; src.filter(function (i) { return that._match(i, tab, dim); }).forEach(function (i) { var k = keyOf(i); if (k) { m[k] = (m[k] || 0) + 1; } }); return m; },
				segs = cnt("seg", function (i) { return i.segment; }), bands = cnt("bands", function (i) { return i.prob !== undefined ? that._band(i) : ""; }),
				ages = tab === "decided" ? {} : cnt("age", function (i) { return that._ageKey(i); }), segPal = ["#5899da", "#7fa7d4", "#2f6497", "#9cc0e5", "#4b7ab0"];
			vm.setProperty("/md/vf", { seg: T("md.vf.seg"), band: T("md.vf.band"), age: T("md.vf.age", [this._cfg.slaDays]) });
			this.byId("vfMdSeg").setOption(VF.hbar(this, ((this._model() || {}).segments || []).map(function (s, i) {
				return { key: s.key, name: that._t(s), value: segs[s.key] || 0, color: segPal[i % segPal.length] };
			}).filter(function (x) { return x.value || f.seg.indexOf(x.key) > -1; }), f.seg, { labelWidth: 110, empty: T("md.vf.empty") }));
			this.byId("vfMdBand").setOption(VF.donut(this, [["hi", C.pos], ["mid", C.info], ["lo", C.crit]].map(function (b) {
				return { key: b[0], name: T("md.bandShort." + b[0]), value: bands[b[0]] || 0, color: b[1] };
			}).filter(function (x) { return x.value || f.bands.indexOf(x.key) > -1; }), f.bands));
			this.byId("vfMdAge").setOption(VF.hbar(this, [["new", C.info], ["near", C.crit], ["over", C.neg]].map(function (b) {
				return { key: b[0], name: T("md.age." + b[0]), value: ages[b[0]] || 0, color: b[1] };
			}), f.age, { labelWidth: 110, empty: T("md.vf.empty") }), true);
		},
		onVfSelect: function (oEvent) {
			var d = oEvent.getParameter("data"), dim = oEvent.getSource().data("dim"), vm = this.viewModel();
			if (!d || !d.key) { return; }
			vm.setProperty("/md/f/" + dim, VF.toggle(vm.getProperty("/md/f/" + dim), d.key));
			this._refresh();
		},
		onClear: function () {
			var vm = this.viewModel(), q = vm.getProperty("/md/f/q");
			vm.setProperty("/md/f", { q: q, seg: [], bands: [], age: [], assigned: "" });
			this._refresh();
		},
		onSelectRows: function (oEvent) {
			var that = this;
			this._checked = this._checked || {};
			(oEvent.getParameter("listItems") || []).forEach(function (li) { that._checked[li.getBindingContext("view").getProperty("id")] = li.getSelected(); });
			if (oEvent.getParameter("selectAll") === false && !oEvent.getParameter("selected")) { this._checked = {}; }
			this._batchState();
		},
		onSelectEligible: function () {
			var that = this, n = 0, max = this._cfg.batch.max;
			this._checked = {};
			this.viewModel().getProperty("/md/rows").forEach(function (r) {
				var it = that._find(r.id).it;
				if (that._eligible(it) && n < max) { that._checked[r.id] = true; n++; }
			});
			this._refresh();
			MessageToast.show(this.text("md.t.selected", [n]));
		},
		onAssignMe: function () {
			var that = this, n = 0;
			Object.keys(this._checked || {}).forEach(function (id) { if (that._checked[id]) { that._find(id).it.assigned = that._me(); n++; } });
			this._refresh();
			MessageToast.show(this.text("md.t.assigned", [n]));
		},

		/* ---------- one item: the comparison ---------- */
		onOpen: function (oEvent) { this.router().navTo("matches", { id: oEvent.getSource().getBindingContext("view").getProperty("id") }); },
		_open: function (id) {
			var f = this._find(id), vm = this.viewModel();
			if (!f) { MessageToast.show(this.text("md.t.gone", [id])); this.router().navTo("matches", {}, true); return; }
			this._openId = id;
			if (f.list !== vm.getProperty("/md/tab") && vm.getProperty("/md/layout") === "OneColumn") { vm.setProperty("/md/tab", f.list); }
			if (vm.getProperty("/md/layout") === "OneColumn") { vm.setProperty("/md/layout", "TwoColumnsMidExpanded"); }
			this.byId("mdQueue").setHeaderExpanded(false); // the queue column is narrow while an item is open
			this._show(f);
			this._refresh();
		},
		_show: function (f) {
			var that = this, it = f.it, vm = this.viewModel(), T = this.text.bind(this), me = this._me(), recs = it.records || [],
				inc = it.include || recs.map(function () { return true; });
			it.include = inc;
			if (f.list === "decided") {
				vm.setProperty("/md/it", { title: it.names, subtitle: it.id + " · " + this._segText(it.segment), probText: it.prob.toFixed(3), probState: "None", weightText: "",
					facts: [{ label: T("md.c.decision"), value: T("md.dec." + it.decision) }, { label: T("md.c.by"), value: it.by + " · " + it.at }, { label: T("md.c.note"), value: it.note || "—" }],
					fields: [], members: [], merged: [], impact: [{ icon: "sap-icon://history", text: T("md.decidedNote") }], canMerge: false, whyText: "", whyHeight: "1px",
					actions: it.decision === "merge" ? "decidedMerge" : "", strip: "", footNote: "" });
				this.byId("mdWhy").setOption(null);
				return;
			}
			var parts = {};
			(it.parts || []).forEach(function (p) { parts[p.comp] = p; });
			var only = vm.getProperty("/md/onlyDiff"), A = recs[0], B = recs[1];
			var fields = FIELDS.map(function (k) {
				var a = A[k] || "", b = B[k] || "", comp = COMP[k], p = comp && parts[comp], same = a === b,
					phoneShared = PHONES.indexOf(k) > -1 && a && [B.mobile_1, B.mobile_2, B.whatsapp].indexOf(a) > -1;
				return { col: k, label: that._col(k), a: that._val(k, a), b: that._val(k, b), dir: LTR.indexOf(k) > -1 ? "LTR" : "Inherit",
					aCls: !same && a && b ? "repoioMdDiff" : "", bCls: !same && a && b ? "repoioMdDiff" : "",
					levelText: p ? that._levelText(p) : phoneShared ? T("md.lv.share") : "", levelState: p ? (p.w > 0 ? "Success" : p.w < 0 ? "Error" : "None") : "None",
					levelIcon: p ? (p.w > 0 ? "sap-icon://accept" : p.w < 0 ? "sap-icon://decline" : "") : "",
					wText: p ? (p.w > 0 ? "+" : "") + p.w.toFixed(1) : "", highlight: p && p.w < 0 ? "Warning" : "None", diff: !same, empty: !a && !b };
			}).filter(function (r) { return !r.empty && (!only || r.diff); });
			var second = f.list === "second", risky = this._needsSecond(it), isReq = it.kind === "request",
				reasonsSecond = (it.risks || []).filter(function (r) { return r !== "numbers"; }).map(function (r) { return T("md.risk." + r); }).join(that._ar() ? "، " : ", ");
			var strip = "", stripType = "Information";
			if (second) {
				strip = T(it.first.by === me ? "md.strip.ownFirst" : "md.strip.second", [it.first.by, T("md.dec." + (it.first.decision === "release" ? "released" : "merge")), it.first.at]);
				stripType = it.first.by === me ? "Warning" : "Information";
			} else if (isReq) {
				strip = T("md.strip.request", [T("mr.chk." + it.check), it.ref]) + (risky ? " " + T("md.strip.releaseSecond") : "");
				stripType = "Warning";
			} else if (risky) {
				strip = T("md.strip.risky", [reasonsSecond || T("md.risk.cluster")]); stripType = "Warning";
			} else if (this._eligible(it)) { strip = T("md.strip.eligible", [this._cfg.batch.minProb.toFixed(2)]); stripType = "Success"; }
			var survivors = recs.map(function (r, i) { return { key: String(i), text: (i === 0 ? "A" : String.fromCharCode(65 + i)) + " · " + r.id }; });
			if (it.survivor === undefined) { it.survivor = recs.findIndex(function (r) { return r.id.indexOf("GR-") === 0; }); if (it.survivor < 0) { it.survivor = 0; } }
			var members = it.kind === "cluster" ? recs.map(function (r, i) {
				return { idx: i, name: r.name, idText: String.fromCharCode(65 + i) + " · " + r.id + " · " + that._srcName(r.source), on: inc[i], canDrop: i !== it.survivor,
					links: (it.links || []).filter(function (l) { return l.a === i || l.b === i; }).map(function (l) {
						return String.fromCharCode(65 + (l.a === i ? l.b : l.a)) + " " + l.prob.toFixed(2); }).join(" · ") };
			}) : [];
			vm.setProperty("/md/it", {
				id: it.id, title: this._names(it), subtitle: it.id + " · " + this._segText(it.segment) + " · " + T("md.since", [it.since]),
				probText: it.prob.toFixed(3), probState: it.prob >= 0.93 ? "Success" : it.prob >= 0.85 ? "Information" : "Warning",
				weightText: T("md.weight", [(it.weight > 0 ? "+" : "") + Number(it.weight).toFixed(2)]),
				facts: [{ label: T("gr.f.seg"), value: this._segText(it.segment) },
					{ label: T("md.c.band"), value: T("md.band." + this._band(it)) },
					{ label: isReq ? T("md.c.requester") : T("md.c.assigned"), value: isReq || it.assigned ? "" : T("md.as.none"), person: isReq ? it.requester : it.assigned || "" },
					{ label: T("md.c.from"), value: isReq ? T("md.fromCheck") : T("md.fromRun", [it.run]) }],
				colA: isReq ? T("md.colRequest") : "A · " + this._srcName(A.source), colB: isReq ? T("md.colGolden", [B.id]) : "B · " + this._srcName(B.source),
				fields: fields, members: members, canMerge: !isReq, survivors: survivors, survivor: String(it.survivor),
				strip: strip, stripType: stripType,
				actions: second ? "second" : isReq ? "request" : "pair",
				mergeText: risky ? T("md.a.mergeSecond") : T("md.a.merge"),
				releaseText: risky ? T("md.a.releaseSecond") : T("md.a.release"),
				canRelease: it.requester !== me, releaseWhy: it.requester === me ? T("md.sod.request") : "",
				canSecond: second && it.first.by !== me, secondWhy: second && it.first.by === me ? T("md.sod.second") : "",
				footNote: second ? T("md.foot.second") : T("md.foot.labelled", [this._cfg.training.since])
			});
			this._merged(it);
			this._impact(it, f.list);
			this._why(it);
		},
		_why: function (it) {
			var that = this, C = this.colors, rtl = this.isRtl(), parts = [{ comp: "prior", w: this._cfg.prior, level: "" }].concat((it.parts || []).filter(function (p) { return p.level !== "null"; })),
				names = parts.map(function (p) { return p.comp === "prior" ? that.text("md.prior") : that._compLabel(p.comp); }),
				vals = parts.map(function (p) { return { value: p.w, itemStyle: { color: p.comp === "prior" ? C.neutral : p.w >= 0 ? C.pos : C.neg } }; });
			this.viewModel().setProperty("/md/it/whyText", this.text("md.whyText", [Number(it.weight).toFixed(2), it.prob.toFixed(3)]));
			this.viewModel().setProperty("/md/it/whyHeight", (parts.length * 26 + 40) + "px");
			this.byId("mdWhy").setOption({
				animation: false, grid: { left: rtl ? 50 : 10, right: rtl ? 10 : 50, top: 10, bottom: 20, containLabel: true },
				xAxis: { type: "value", inverse: rtl, axisLabel: { color: C.label }, splitLine: { lineStyle: { color: C.grid } } },
				yAxis: { type: "category", data: names, inverse: true, position: rtl ? "right" : "left", axisLabel: { color: C.text }, axisTick: { show: false } },
				tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
				series: [{ type: "bar", data: vals, barMaxWidth: 16, label: { show: true, position: rtl ? "left" : "right", color: C.text,
					formatter: function (p) { return (p.value > 0 ? "+" : "") + p.value.toFixed(1); } } }]
			});
		},
		/* Preview of the golden record after the merge, by the active survivorship rules (the survivorship job decides). */
		_merged: function (it) {
			var that = this, vm = this.viewModel(), m = this._model();
			if (it.kind === "request" || !m) { vm.setProperty("/md/it/merged", []); return; }
			var sv = m.survivorship, recs = it.records.filter(function (r, i) { return it.include[i]; }), groupOf = {}, done = {}, out = [];
			sv.groups.forEach(function (g) { g.cols.forEach(function (c) { groupOf[c] = g; }); });
			var rank = function (r) { var i = sv.priority.indexOf(r.source); return i < 0 ? 9 : i; },
				pick = function (rule, cands, col) {
					var c = cands.slice();
					if (rule === "recent") { c.sort(function (a, b) { return b.changed > a.changed ? 1 : b.changed < a.changed ? -1 : rank(a) - rank(b); }); }
					else if (rule === "complete") { c.sort(function (a, b) { return String(b[col]).length - String(a[col]).length || rank(a) - rank(b); }); }
					else if (rule === "frequent") { c.sort(function (a, b) { var fa = cands.filter(function (x) { return x[col] === a[col]; }).length, fb = cands.filter(function (x) { return x[col] === b[col]; }).length; return fb - fa || rank(a) - rank(b); }); }
					else { c.sort(function (a, b) { return rank(a) - rank(b); }); }
					return c[0];
				},
				letter = function (r) { return String.fromCharCode(65 + it.records.indexOf(r)); };
			FIELDS.filter(function (k) { return k !== "changed"; }).forEach(function (k) {
				if (done[k]) { return; }
				var g = groupOf[k];
				if (g) {
					var cands = recs.filter(function (r) { return g.cols.some(function (c) { return r[c]; }); }), w = cands.length && pick(g.rule, cands, g.cols[0]);
					g.cols.forEach(function (c) {
						done[c] = true;
						if (FIELDS.indexOf(c) < 0 || !w || !w[c]) { return; }
						out.push({ label: that._col(c), value: that._val(c, w[c]), dir: LTR.indexOf(c) > -1 ? "LTR" : "Inherit",
							from: letter(w) + " · " + that._srcName(w.source), rule: that.text("mr.grp." + g.key) + " · " + that.text("mr.rule." + g.rule) });
					});
					return;
				}
				var r = sv.rules.filter(function (x) { return x.col === k; })[0], rule = r ? r.rule : "sourcePriority", c2 = recs.filter(function (x) { return x[k]; });
				if (!c2.length) { return; }
				var val, from;
				if (rule === "union") {
					var all = [];
					c2.forEach(function (x) { String(x[k]).split(/،\s*/).forEach(function (v) { if (all.indexOf(v) < 0) { all.push(v); } }); });
					val = all.join("، "); from = c2.map(letter).join(" + ");
				} else { var wn = pick(rule, c2, k); val = wn[k]; from = letter(wn) + " · " + that._srcName(wn.source); }
				out.push({ label: that._col(k), value: that._val(k, val), dir: LTR.indexOf(k) > -1 ? "LTR" : "Inherit", from: from, rule: that.text("mr.rule." + rule) });
			});
			vm.setProperty("/md/it/merged", out);
		},
		_impact: function (it, list) {
			var T = this.text.bind(this), recs = it.records, keep = recs[it.survivor || 0], out = [];
			if (it.kind === "request") {
				out.push({ icon: "sap-icon://open-command-field", text: T("md.imp.release", [it.id]) });
				out.push({ icon: "sap-icon://decline", text: T("md.imp.reject", [it.requester, it.ref]) });
				if (this._needsSecond(it)) { out.push({ icon: "sap-icon://group", text: T("md.imp.releaseSecond") }); }
			} else {
				var others = recs.filter(function (r, i) { return r !== keep && it.include[i]; });
				out.push({ icon: "sap-icon://combine", text: T("md.imp.keep", [keep.id, others.map(function (r) { return r.id; }).join(", ")]) });
				out.push({ icon: "sap-icon://chain-link", text: T("md.imp.sameAs", [others.length]) });
				out.push({ icon: "sap-icon://history", text: T("md.imp.changeLog") });
				if ((it.risks || []).indexOf("openCr") > -1) { out.push({ icon: "sap-icon://request", text: T("md.imp.openCr") }); }
				if (it.kind === "cluster" && it.include.some(function (x) { return !x; })) { out.push({ icon: "sap-icon://split", text: T("md.imp.dropped") }); }
				out.push({ icon: "sap-icon://learning-assistant", text: T("md.imp.labelled") });
				if (this._needsSecond(it) && list !== "second") { out.push({ icon: "sap-icon://group", text: T("md.imp.second") }); }
			}
			this.viewModel().setProperty("/md/it/impact", out);
		},
		onOnlyDiff: function () { var f = this._find(this._openId); if (f) { this._show(f); } },
		onSurvivor: function () {
			var f = this._find(this._openId);
			f.it.survivor = Number(this.viewModel().getProperty("/md/it/survivor"));
			this._show(f);
		},
		onMember: function (oEvent) {
			var f = this._find(this._openId), i = oEvent.getSource().getBindingContext("view").getProperty("idx");
			f.it.include[i] = oEvent.getParameter("selected");
			if (f.it.include.filter(Boolean).length < 2) { f.it.include[i] = true; MessageToast.show(this.text("md.t.keepTwo")); }
			this._show(f);
		},

		/* ---------- decisions ---------- */
		_reasonDialog: function (title, keys, required, fnOk, extra) {
			var that = this, oSel = keys ? new Select({ width: "100%", items: keys.map(function (k) { return new Item({ key: k, text: that.text("md.reason." + k) }); }) }) : null,
				oNote = new TextArea({ width: "100%", rows: 3, placeholder: this.text(required ? "md.noteRequired" : "md.noteOptional") }),
				content = [];
			if (extra) { content.push(extra); }
			if (oSel) { content.push(new Label({ text: this.text("md.reason"), required: true }), oSel); }
			content.push(new Label({ text: this.text("md.c.note"), required: required }), oNote);
			var oDlg = new Dialog({ title: title, contentWidth: "28rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1, content: content })],
				beginButton: new Button({ text: this.text("gr.ok"), type: "Emphasized", press: function () {
					if (required && !oNote.getValue().trim()) { oNote.setValueState("Error").setValueStateText(that.text("mr.v.required")); return; }
					oDlg.close();
					fnOk(oSel ? oSel.getSelectedKey() : "", oNote.getValue().trim());
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); } });
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		_remove: function (list, it) { var a = this._q[list], i = a.indexOf(it); if (i > -1) { a.splice(i, 1); } },
		_decide: function (it, list, decision, note) {
			var T = this.text.bind(this);
			this._remove(list, it);
			if (list === "pairs") { it.state = "done"; }
			this._q.decided.unshift({ id: it.id, kind: it.kind, decision: decision, by: this._me(), at: "2026-11-16 " + new Date().toTimeString().slice(0, 5),
				names: this._names(it), prob: it.prob, segment: it.segment, note: note || "" });
			if (it.kind !== "request") { this._cfg.training.since++; }
			Audit.log(this, { area: "data", action: "update", type: "record", object: it.id + " · " + this._names(it),
				en: "Match decision: " + decision, ar: "قرار مطابقة: " + T("md.dec." + decision), ref: { route: "matches", args: { id: it.id } } });
		},
		_toSecond: function (it, list, decision, note) {
			this._remove(list, it);
			if (list === "pairs") { it.state = "second"; }
			it.first = { by: this._me(), at: "2026-11-16 " + new Date().toTimeString().slice(0, 5), decision: decision, survivor: it.survivor, note: note || "" };
			this._q.second.unshift(it);
			Audit.log(this, { area: "data", action: "update", type: "record", object: it.id + " · " + this._names(it),
				en: "Match decision sent for a second approval", ar: "قرار مطابقة اتبعت لموافقة تانية", ref: { route: "matches", args: { id: it.id } } });
		},
		_next: function (id) {
			var rows = this.viewModel().getProperty("/md/rows"), i = rows.findIndex(function (r) { return r.id === id; }), nxt = rows[i + 1] || rows[i - 1];
			this._refresh();
			var left = this.viewModel().getProperty("/md/rows");
			nxt = nxt && left.some(function (r) { return r.id === nxt.id; }) ? nxt : left[0];
			if (nxt) { this.router().navTo("matches", { id: nxt.id }, true); } else { this.onClose(); }
		},
		onMerge: function () {
			var that = this, f = this._find(this._openId), it = f.it, second = this._needsSecond(it);
			this._reasonDialog(this.text(second ? "md.a.mergeSecond" : "md.a.merge"), null, second, function (r, note) {
				if (second) { that._toSecond(it, f.list, "merge", note); MessageToast.show(that.text("md.t.sentSecond", [it.id])); }
				else { that._decide(it, f.list, "merge", note); MessageToast.show(that.text("md.t.merged", [it.records[it.survivor].id])); }
				that._next(it.id);
			}, new Text({ text: this.text("md.mergeConfirm", [it.records[it.survivor].id]) }));
		},
		onDistinct: function () {
			var that = this, f = this._find(this._openId), it = f.it;
			this._reasonDialog(this.text("md.a.distinct"), ["differentPerson", "siblings", "sameNameOnly", "other"], false, function (r, note) {
				that._decide(it, f.list, "distinct", that.text("md.reason." + r) + (note ? " · " + note : ""));
				MessageToast.show(that.text("md.t.distinct", [it.id]));
				that._next(it.id);
			});
		},
		onDefer: function () {
			var that = this, f = this._find(this._openId), it = f.it,
				oWho = new Select({ width: "100%", items: [this._me()].concat(STEWARDS).map(function (s) { return new Item({ key: s, text: that.personLabel(s) }); }), selectedKey: it.assigned || this._me() });
			this._reasonDialog(this.text("md.a.defer"), null, false, function (r, note) {
				it.assigned = oWho.getSelectedKey();
				MessageToast.show(that.text("md.t.assigned1", [it.id, it.assigned]));
				that._refresh(); that._show(f);
			}, new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1,
				content: [new Label({ text: this.text("md.assignTo") }), oWho] }));
		},
		onRelease: function () {
			var that = this, f = this._find(this._openId), it = f.it, second = this._needsSecond(it);
			if (it.requester === this._me()) { MessageBox.error(this.text("md.sod.request")); return; }
			this._reasonDialog(this.text(second ? "md.a.releaseSecond" : "md.a.release"), ["notDuplicate", "sharedNumber", "siblings", "other"], true, function (r, note) {
				var n = that.text("md.reason." + r) + " · " + note;
				if (second) { that._toSecond(it, f.list, "release", n); MessageToast.show(that.text("md.t.sentSecond", [it.id])); }
				else { that._decide(it, f.list, "released", n); MessageToast.show(that.text("md.t.released", [it.id])); }
				that._next(it.id);
			});
		},
		onRejectRequest: function () {
			var that = this, f = this._find(this._openId), it = f.it;
			this._reasonDialog(this.text("md.a.reject"), ["duplicateOf", "other"], true, function (r, note) {
				that._decide(it, f.list, "rejected", that.text("md.reason." + r) + " · " + note);
				MessageToast.show(that.text("md.t.rejected", [it.id]));
				that._next(it.id);
			});
		},
		onApproveSecond: function () {
			var that = this, f = this._find(this._openId), it = f.it;
			if (it.first.by === this._me()) { MessageBox.error(this.text("md.sod.second")); return; }
			this._reasonDialog(this.text("md.a.approve"), null, false, function (r, note) {
				that._decide(it, "second", it.first.decision === "release" ? "released" : "merge", [it.first.note, note].filter(Boolean).join(" · "));
				MessageToast.show(that.text("md.t.approved", [it.id]));
				that._next(it.id);
			}, new Text({ text: this.text("md.approveConfirm", [it.first.by]) }));
		},
		onSendBack: function () {
			var that = this, f = this._find(this._openId), it = f.it;
			this._reasonDialog(this.text("md.a.sendBack"), null, true, function () {
				that._remove("second", it);
				delete it.first;
				if (it.kind === "request") { that._q.requests.unshift(it); } else { it.state = "open"; if (that._q.pairs.indexOf(it) < 0) { that._q.pairs.unshift(it); } }
				MessageToast.show(that.text("md.t.sentBack", [it.id]));
				that._next(it.id);
			});
		},
		onUnmerge: function () { MessageToast.show(this.text("md.t.unmerge", [this._openId])); },
		onBatch: function () {
			var that = this, ids = Object.keys(this._checked || {}).filter(function (k) { return that._checked[k]; });
			MessageBox.confirm(this.text("md.batchConfirm", [ids.length]), { actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL], emphasizedAction: MessageBox.Action.OK,
				onClose: function (a) {
					if (a !== MessageBox.Action.OK) { return; }
					ids.forEach(function (id) { var f = that._find(id); f.it.survivor = f.it.survivor || 0; that._decide(f.it, "pairs", "merge", that.text("md.batchNote")); });
					that._checked = {};
					MessageToast.show(that.text("md.t.batch", [ids.length]));
					if (ids.indexOf(that._openId) > -1) { that.onClose(); } else { that._refresh(); }
				} });
		},

		/* ---------- layout, navigation, keyboard ---------- */
		onClose: function () {
			this._openId = null;
			this.viewModel().setProperty("/md/layout", "OneColumn");
			this.byId("mdQueue").setHeaderExpanded(true);
			this.router().navTo("matches", {}, true);
		},
		onFull: function () {
			var vm = this.viewModel();
			vm.setProperty("/md/layout", vm.getProperty("/md/layout") === "MidColumnFullScreen" ? "TwoColumnsMidExpanded" : "MidColumnFullScreen");
		},
		_step: function (d) {
			var rows = this.viewModel().getProperty("/md/rows"), i = rows.findIndex(function (r) { return r.id === this._openId; }.bind(this)), n = rows[i + d];
			if (n) { this.router().navTo("matches", { id: n.id }, true); }
		},
		onPrev: function () { this._step(-1); },
		onNext: function () { this._step(1); },
		onModels: function () { this.router().navTo("models", { model: "customer-master" }); },
		/* J / K next and previous, Shift + M merge, Shift + N not a match. Ignored while typing. */
		_onKey: function (e) {
			var dom = this.getView().getDomRef(), t = e.target, tag = t && t.tagName;
			if (!dom || !dom.offsetParent || /INPUT|TEXTAREA|SELECT/.test(tag) || (t && t.isContentEditable) || document.querySelector(".sapMDialog")) { return; }
			var act = this.viewModel().getProperty("/md/it/actions");
			if (e.key === "j" || e.key === "J" && !e.shiftKey) { this._step(1); }
			else if (e.key === "k") { this._step(-1); }
			else if (e.shiftKey && e.key === "M" && act === "pair") { this.onMerge(); }
			else if (e.shiftKey && e.key === "N" && act === "pair") { this.onDistinct(); }
			else { return; }
			e.preventDefault();
		}
	});
});
