sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Label",
	"sap/m/Input",
	"sap/m/TextArea",
	"sap/m/Select",
	"sap/m/MessageStrip",
	"sap/m/Table",
	"sap/m/Column",
	"sap/m/ColumnListItem",
	"sap/m/Text",
	"sap/m/VBox",
	"sap/ui/layout/form/SimpleForm",
	"sap/ui/core/Item",
	"sap/ui/model/json/JSONModel"
], function (BaseController, MessageToast, MessageBox, Dialog, Button, Label, Input, TextArea, Select, MessageStrip,
	Table, Column, ColumnListItem, Text, VBox, SimpleForm, Item, JSONModel) {
	"use strict";

	/* Relationship types are defined between the six governed domains only (README §3, CLAUDE.md rule 14);
	   sub-concepts (School, Book …) belong to their domain's concept. */
	var DOMAIN_CONCEPTS = ["Customer", "Vendor", "Product", "Author", "Employee", "Store"];
	var DOMAIN_ITEM = { customer: "customers", vendor: "vendors", product: "products", author: "authors", employee: "employees", store: "stores" };
	var CATS = ["master", "governance", "asset", "business"];
	/* Tree icon per concept category (instead of a plain circle that reads like a radio button). */
	var CAT_ICON = { master: "sap-icon://database", abstract: "sap-icon://dimension", governance: "sap-icon://shield",
		asset: "sap-icon://table-view", business: "sap-icon://business-objects-experience" };
	var LINK_ICON = { entity: "sap-icon://database", glossary: "sap-icon://course-book", kpi: "sap-icon://kpi-corporate-performance", assets: "sap-icon://table-view" };

	return BaseController.extend("repoio.proto.controller.Ontology", {
		onInit: function () {
			this.router().getRoute("ontology").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			if (this._o) { return; }
			var that = this, oData = this.data();
			var fnStart = function () {
				that._o = JSON.parse(JSON.stringify(oData.getProperty("/ontology")));
				that._o.relations.forEach(function (r) { r.tech = /_same_as$/.test(r.id) ? "same_as" : r.id; });
				that._changes = {};
				that.viewModel().setProperty("/onto", {
					name: that.lang() === "ar" ? that._o.nameAr : that._o.nameEn, prefix: that._o.prefix, ns: that._o.ns,
					versions: that._o.versions, version: that._o.versions[0].key, state: that._o.versions[0].state, editable: true, changes: 0,
					tab: "concepts", query: "", show: { type: true, subclass: true }, group: true, showIsolated: false, isolatedCount: 0, layout: "hierarchy", zoom: 100, stats: {}, edgeLabels: true, mode: "schema",
					rec: { domain: "", type: "", query: "", preview: false, rows: [], domains: [], types: [] },
					full: false, rtl: that.isRtl(), sel: {}, graph: { nodes: [], edges: [] }, tree: [], types: [], conceptOptions: []
				});
				that._refresh(true);
			};
			if (oData.dataLoaded) { oData.dataLoaded().then(fnStart); } else { fnStart(); }
		},

		/* ---------- derived models ---------- */

		_name: function (c) { return c ? (this.lang() === "ar" ? c.nameAr : c.nameEn) : ""; },
		_label: function (r) { return this.lang() === "ar" ? r.labelAr : r.labelEn; },
		_concept: function (id) { return this._o.concepts.filter(function (c) { return c.id === id; })[0]; },
		_rel: function (id) { return this._allRels().filter(function (r) { return r.id === id; })[0]; },

		/* Relations plus the is-a edges derived from each concept's parents. */
		_allRels: function () {
			var that = this, a = this._o.relations.slice();
			this._o.concepts.forEach(function (c) {
				c.parent.forEach(function (p) {
					a.push({ id: "is_a__" + c.id + "__" + p, tech: "rdfs:subClassOf", from: c.id, to: p, kind: "subclass",
						labelEn: "is a", labelAr: "نوع من", attrs: [], draft: c.draft || !!that._changes["parent:" + c.id] });
				});
			});
			return a;
		},

		_refresh: function (bGraph) {
			var m = this.viewModel(), that = this, q = (m.getProperty("/onto/query") || "").trim().toLowerCase(),
				show = m.getProperty("/onto/show"), rels = this._allRels(),
				byName = function (a, b) { return that._name(a).localeCompare(that._name(b), that.lang()); };
			var match = function (c) { return !q || [c.id, c.nameEn, c.nameAr].join(" ").toLowerCase().indexOf(q) > -1; };

			if (bGraph !== false && m.getProperty("/onto/mode") === "records") {
				this._refreshRecords();
			} else if (bGraph !== false) {
				m.setProperty("/onto/graph", this._schemaGraph(rels, show));
			}
			m.setProperty("/onto/tree", this._o.concepts.slice().sort(byName).filter(function (c) {
				return match(c) || rels.some(function (r) { return r.from === c.id && r.kind !== "subclass" && (that._label(r) + " " + r.tech).toLowerCase().indexOf(q) > -1; });
			}).map(function (c) {
				var kids = rels.filter(function (r) { return r.from === c.id && r.kind !== "subclass"; }).map(function (r) {
					return { title: that._label(r) + " → " + that._name(that._concept(r.to)), icon: "sap-icon://chain-link", kind: "edge", ref: r.id, tip: that._o.prefix + ":" + r.tech, draft: !!r.draft };
				}).concat(c.props.map(function (p) {
					return { title: p.name, icon: "sap-icon://text", kind: "prop", ref: c.id, tip: p.type };
				}));
				return { title: that._name(c), icon: CAT_ICON[c.cat] || CAT_ICON.master, kind: "node", ref: c.id, count: that._recordCount(c.id),
					tip: that._o.prefix + ":" + c.id, draft: !!c.draft, nodes: kids };
			}));
			m.setProperty("/onto/types", rels.filter(function (r) {
				return (r.kind === "type" || r.kind === "system") && (!q || [that._label(r), r.tech, r.from, r.to].join(" ").toLowerCase().indexOf(q) > -1);
			}).map(function (r) {
				return { id: r.id, label: that._label(r), tech: that._o.prefix + ":" + r.tech, card: r.card, kind: r.kind, draft: !!r.draft,
					pair: that._name(that._concept(r.from)) + (that.isRtl() ? " ← " : " → ") + that._name(that._concept(r.to)) };
			}));
			m.setProperty("/onto/conceptOptions", this._o.concepts.slice().sort(byName).map(function (c) { return { id: c.id, name: that._name(c) }; }));
			m.setProperty("/onto/changes", Object.keys(this._changes).length);
			this._stats();
			if (q) { this.byId("conceptTree").expandToLevel(1); }
		},

		/*
		 * Schema graph. Several relationship types between the same two concepts (or on one concept) are drawn as
		 * one grouped line with a count; tapping it shows them. Concepts with no visible line are hidden unless
		 * "Unlinked" is on, so the connected model stays readable.
		 */
		_pairKey: function (r) { return r.kind === "subclass" ? "" : [r.from, r.to].sort().join("|"); },
		_schemaGraph: function (rels, show) {
			var m = this.viewModel(), that = this, group = m.getProperty("/onto/group"), exp = this._expanded || {}, sel = m.getProperty("/onto/sel") || {};
			var vis = rels.filter(function (r) { return r.kind === "subclass" ? show.subclass : show.type; }), count = {}, bundles = {}, edges = [];
			vis.forEach(function (r) { var k = that._pairKey(r); if (k) { count[k] = (count[k] || 0) + 1; } });
			vis.forEach(function (r) {
				var k = that._pairKey(r);
				if (group && k && count[k] > 1 && !exp[k]) { (bundles[k] = bundles[k] || []).push(r); return; }
				edges.push({ id: r.id, source: r.from, target: r.to, label: that._label(r), kind: r.kind, draft: !!r.draft });
			});
			Object.keys(bundles).forEach(function (k) {
				var b = bundles[k], f = b[0];
				edges.push({ id: "bundle:" + k, source: f.from, target: f.to, kind: "bundle", label: that.text("onto.bundle", [b.length]),
					mixed: b.some(function (r) { return r.from !== f.from; }), draft: b.some(function (r) { return !!r.draft; }) });
			});
			var linked = {};
			edges.forEach(function (e) { linked[e.source] = true; linked[e.target] = true; });
			var isolated = this._o.concepts.filter(function (c) { return !linked[c.id]; });
			m.setProperty("/onto/isolatedCount", isolated.length);
			var keep = function (c) { return linked[c.id] || m.getProperty("/onto/showIsolated") || c.id === sel.id || c.draft || that._changes["c:" + c.id]; };
			return {
				nodes: this._o.concepts.filter(keep).map(function (c) {
					return { id: c.id, label: that._name(c), cat: c.cat, count: that._recordCount(c.id), draft: !!c.draft || !!that._changes["c:" + c.id] };
				}),
				edges: edges
			};
		},
		/* Golden records that are instances of a concept, its sub-concepts included (rdf:type through rdfs:subClassOf). */
		_recordCount: function (id) {
			var o = this._o, kids = {}, seen = {}, n = 0;
			o.concepts.forEach(function (c) { (c.parent || []).forEach(function (p) { (kids[p] = kids[p] || []).push(c.id); }); });
			var walk = function (x) { if (seen[x]) { return; } seen[x] = true; (kids[x] || []).forEach(walk); };
			walk(id);
			(o.records || []).forEach(function (r) { if (seen[r.concept]) { n++; } });
			return n;
		},
		/* Status bar (Studio style): sizes of the model, triples in the Turtle export, and the check result. */
		_stats: function () {
			var o = this._o, ttl = this._turtle(), issues = this._checks().length;
			var triples = ttl.split("\n").filter(function (l) { return !/^@prefix/.test(l) && /( ;| \.)$/.test(l); }).length + (ttl.match(/ , /g) || []).length;
			this.viewModel().setProperty("/onto/stats", { concepts: o.concepts.length, types: o.relations.filter(function (r) { return r.kind !== "subclass"; }).length,
				records: (o.records || []).length, links: (o.links || []).length, triples: triples, issues: issues,
				text: this.text("onto.stat.line", [o.concepts.length, o.relations.filter(function (r) { return r.kind !== "subclass"; }).length, (o.records || []).length, (o.links || []).length]),
				check: issues ? this.text("onto.stat.issues", [issues]) : this.text("onto.stat.clean"), triplesText: this.text("onto.stat.triples", [triples]) });
		},
		onViewport: function (e) { this.viewModel().setProperty("/onto/zoom", Math.round(e.getParameter("zoom") * 100)); },
		onZoomSlider: function (e) { this.byId("graph").zoomTo(e.getParameter("value") / 100); },
		onLayoutKey: function (e) {
			this.viewModel().setProperty("/onto/layout", e.getParameter("item").getKey());
			this.onLayout();
		},
		onGroup: function () { this._expanded = {}; this._refresh(); },
		onIsolated: function () { this._refresh(); this.byId("graph").fit(); },
		/* Make sure an element is drawn before selecting it: open its group, or show an unlinked concept. */
		_reveal: function (sKind, sId) {
			var g = this.viewModel().getProperty("/onto/graph") || { nodes: [], edges: [] }, list = sKind === "node" ? g.nodes : g.edges;
			if (this.viewModel().getProperty("/onto/mode") !== "schema" || list.some(function (x) { return x.id === sId; })) { return; }
			if (sKind === "edge") { var r = this._rel(sId); if (r) { this._expanded = this._expanded || {}; this._expanded[this._pairKey(r)] = true; } }
			else { this.viewModel().setProperty("/onto/showIsolated", true); }
			this._refresh();
		},

		/* ---------- selection ---------- */

		_select: function (sKind, sId, bCenter) {
			if (sKind === "node") { this._selectNode(sId); } else if (sKind === "edge") { this._selectEdge(sId); } else { this.onCloseDetail(); return; }
			this._reveal(sKind, sId);
			this.byId("graph").selectElement(sId, bCenter);
		},

		_selectNode: function (id) {
			var c = this._concept(id), that = this, ar = this.lang() === "ar", L = c.links || {}, links = [];
			if (L.entity) {
				var d = (this.data().getProperty("/domains") || []).filter(function (x) { return x.id === DOMAIN_ITEM[L.entity]; })[0];
				links.push({ type: "entity", ref: DOMAIN_ITEM[L.entity], icon: LINK_ICON.entity, text: d ? this.domainName(d) : L.entity, typeText: this.text("onto.link.entity") });
			}
			["glossary", "kpi", "assets"].forEach(function (k) {
				(L[k] || []).forEach(function (v) { links.push({ type: k, ref: v, icon: LINK_ICON[k], text: v, typeText: that.text("onto.link." + k) }); });
			});
			var rels = this._allRels().filter(function (r) { return r.kind !== "subclass" && (r.from === id || r.to === id); }).map(function (r) {
				var out = r.from === id, self = r.from === r.to;
				return { id: r.id, label: that._label(r), draft: !!r.draft, kindText: that.text("onto.kind." + r.kind),
					icon: self ? "sap-icon://refresh" : out ? "sap-icon://arrow-right" : "sap-icon://arrow-left", // UI5 mirrors these in RTL
					other: self ? that.text("onto.self") : that._name(that._concept(out ? r.to : r.from)) };
			});
			this.viewModel().setProperty("/onto/sel", {
				kind: "node", id: id, title: this._name(c), name: this._name(c), desc: ar ? c.descAr : c.descEn, parents: c.parent.slice(),
				owner: c.owner, kindText: this.text("onto.cat." + c.cat) + (c.draft ? " · " + this.text("onto.draftItem") : ""),
				kindState: c.draft ? "Warning" : "None", links: links, props: c.props, rels: rels, propsCount: c.props.length, relsCount: rels.length,
				domain: this._domainOf(id), linkCount: this._domainOf(id) ? this._recLinks(this._domainOf(id), "").length : 0
			});
		},

		_selectEdge: function (id) {
			var r = this._rel(id), that = this;
			if (!r) { return; }
			this.viewModel().setProperty("/onto/sel", {
				kind: "edge", id: id, rkind: r.kind, title: this._label(r), name: this._label(r), tech: r.kind === "subclass" ? "subClassOf" : r.tech,
				from: r.from, to: r.to, fromName: this._name(this._concept(r.from)), toName: this._name(this._concept(r.to)),
				inverseText: r.inverse ? this._o.prefix + ":" + r.inverse : "—", card: r.card || "—",
				attrsText: r.attrs && r.attrs.length ? r.attrs.join(" · ") : "—",
				kindText: this.text("onto.kind." + r.kind) + (r.draft ? " · " + this.text("onto.draftItem") : ""),
				kindState: r.draft ? "Warning" : r.kind === "type" ? "Information" : "None",
				note: r.kind === "subclass" ? "" : that.text("onto.note." + r.kind),
				linkCount: r.kind === "subclass" ? 0 : this._recLinks("", r.id).length
			});
		},

		onGraphSelect: function (e) {
			var k = e.getParameter("kind"), id = e.getParameter("id"), rec = this.viewModel().getProperty("/onto/mode") === "records";
			if (k === "node") { if (rec) { this._selectRecord(id); } else { this._selectNode(id); } }
			else if (k === "edge" && id.indexOf("bundle:") === 0) { this._openBundle(id.slice(7)); }
			else if (k === "edge") { if (rec) { this._selectLink(id); } else { this._selectEdge(id); } }
			else { this.viewModel().setProperty("/onto/sel", {}); }
		},
		/* A grouped line: draw its relationship types one by one and say which they are. */
		_openBundle: function (key) {
			var that = this, ends = key.split("|"), n = this._allRels().filter(function (r) { return that._pairKey(r) === key; }).length;
			this._expanded = this._expanded || {}; this._expanded[key] = true;
			this.viewModel().setProperty("/onto/sel", {});
			this._refresh();
			this.byId("graph").selectElement(ends[0], true);
			MessageToast.show(ends[0] === ends[1] ? this.text("onto.bundleOpenedSelf", [n, this._name(this._concept(ends[0]))]) :
				this.text("onto.bundleOpened", [n, this._name(this._concept(ends[0])), this._name(this._concept(ends[1]))]));
		},
		onTreeSelect: function (e) {
			var it = e.getParameter("listItem"), k = it.data("kind");
			this._setMode("schema");
			this._select(k === "prop" ? "node" : k, it.data("ref"), true);
		},
		onTypeSelect: function (e) {
			var id = e.getParameter("listItem").data("ref");
			this._setMode("schema");
			this._ensureVisible(this._rel(id).kind);
			this._select("edge", id, true);
		},
		onRelPress: function (e) {
			var id = e.getParameter("listItem").data("ref");
			this._ensureVisible(this._rel(id).kind);
			this._select("edge", id, true);
		},
		onSelectConcept: function (e) { this._setMode("schema"); this._select("node", e.getSource().data("ref"), true); },
		onCloseDetail: function () {
			this.viewModel().setProperty("/onto/sel", {});
			this.byId("graph").selectElement("");
			this.byId("conceptTree").removeSelections(true);
			this.byId("typeList").removeSelections(true);
		},
		_ensureVisible: function (sKind) {
			var p = "/onto/show/" + (sKind === "subclass" ? "subclass" : "type"), m = this.viewModel();
			if (!m.getProperty(p)) { m.setProperty(p, true); this._refresh(); }
		},

		/* ---------- records: governed links between golden records (instance level) ---------- */

		/* The governed domain a concept belongs to: itself or its nearest domain ancestor (School → Customer). */
		_domainOf: function (id) {
			if (DOMAIN_CONCEPTS.indexOf(id) > -1) { return id; }
			var c = this._concept(id);
			if (!c) { return ""; }
			for (var i = 0; i < c.parent.length; i++) { var d = this._domainOf(c.parent[i]); if (d) { return d; } }
			return "";
		},
		_record: function (code) { return (this._o.records || []).filter(function (r) { return r.code === code; })[0]; },
		_recName: function (r) { return r ? (this.lang() === "ar" ? r.nameAr : r.nameEn) : ""; },
		_recLinks: function (sDomain, sType) {
			var that = this;
			return (this._o.links || []).filter(function (l) {
				var a = that._domainOf(that._record(l.from).concept), b = that._domainOf(that._record(l.to).concept);
				return (!sType || l.type === sType) && (!sDomain || a === sDomain || b === sDomain);
			});
		},

		_setMode: function (sMode) {
			var m = this.viewModel();
			if (m.getProperty("/onto/mode") === sMode) { return; }
			m.setProperty("/onto/mode", sMode);
			m.setProperty("/onto/sel", {});
			this._refresh();
			if (sMode === "records") { this.byId("graph").relayout(true); } else { this.byId("graph").fit(); }
		},
		onMode: function (e) {
			this._setMode(e.getParameter("item").getKey()); // selectedKey is bound one-way
		},

		/* Drill down from a concept (its domain) or from a relationship type to the actual record links. */
		onViewLinks: function () {
			var m = this.viewModel(), sel = m.getProperty("/onto/sel");
			m.setProperty("/onto/rec/domain", sel.kind === "node" ? sel.domain : "");
			m.setProperty("/onto/rec/type", sel.kind === "edge" ? sel.id : "");
			m.setProperty("/onto/rec/query", "");
			if (m.getProperty("/onto/mode") === "records") { this.onRecFilter(); } else { this._setMode("records"); }
		},
		onRecFilter: function () {
			this.viewModel().setProperty("/onto/sel", {});
			this._refresh();
			this.byId("graph").relayout(true);
		},

		_refreshRecords: function () {
			var m = this.viewModel(), that = this, f = m.getProperty("/onto/rec"), q = (f.query || "").trim().toLowerCase(), rtl = this.isRtl();
			var match = function (r) { return !q || (r.code + " " + r.nameAr + " " + r.nameEn).toLowerCase().indexOf(q) > -1; };
			var links = this._recLinks(f.domain, f.type).filter(function (l) { return match(that._record(l.from)) || match(that._record(l.to)); });
			var codes = {};
			links.forEach(function (l) { codes[l.from] = true; codes[l.to] = true; });
			var rel = function (l) { return that._rel(l.type); };
			m.setProperty("/onto/graph", {
				nodes: Object.keys(codes).sort().map(function (c) {
					var r = that._record(c), d = that._domainOf(r.concept);
					return { id: c, label: c + "\n" + that._recName(r), cat: "rec-" + d.toLowerCase(), hit: !!q && match(r) };
				}),
				edges: links.map(function (l) { return { id: l.id, source: l.from, target: l.to, label: that._label(rel(l)), kind: rel(l).kind, draft: l.status === "pending" }; })
			});
			m.setProperty("/onto/rec/rows", links.map(function (l) {
				var a = that._record(l.from), b = that._record(l.to);
				return { id: l.id, from: l.from, fromName: that._recName(a), to: l.to, toName: that._recName(b), type: that._label(rel(l)), kind: rel(l).kind,
					attrs: Object.keys(l.attrs).map(function (k) { return k + "=" + l.attrs[k]; }).join(" · ") || "—", status: l.status, cr: l.cr };
			}));
			m.setProperty("/onto/rec/count", links.length);
			// Filter choices: domains with links, and the governed types (optionally narrowed to the domain).
			m.setProperty("/onto/rec/domains", [{ key: "", text: this.text("onto.rec.allDomains") }].concat(["Customer", "Vendor", "Product"].map(function (d) {
				return { key: d, text: that._name(that._concept(d)) };
			})));
			m.setProperty("/onto/rec/types", [{ key: "", text: this.text("onto.rec.allTypes") }].concat(this._o.relations.filter(function (r) {
				return r.kind !== "semantic" && (!f.domain || r.from === f.domain || r.to === f.domain);
			}).map(function (r) {
				return { key: r.id, text: that._name(that._concept(r.from)) + (rtl ? " ← " : " → ") + that._name(that._concept(r.to)) + ": " + that._label(r) };
			})));
			var crumb = [this.text("onto.rec.records")];
			if (f.domain) { crumb.push(this._name(this._concept(f.domain))); }
			if (f.type) { crumb.push(this._label(this._rel(f.type))); }
			m.setProperty("/onto/rec/crumb", crumb.join("  ›  "));
		},

		_selectRecord: function (code) {
			var r = this._record(code), that = this;
			var links = (this._o.links || []).filter(function (l) { return l.from === code || l.to === code; }).map(function (l) {
				var out = l.from === code, other = that._record(out ? l.to : l.from);
				return { id: l.id, label: that._label(that._rel(l.type)), other: other.code + " · " + that._recName(other), draft: l.status === "pending",
					icon: out ? "sap-icon://arrow-right" : "sap-icon://arrow-left", kindText: that.text("onto.rec.status." + l.status) };
			});
			this.viewModel().setProperty("/onto/sel", {
				kind: "record", id: code, title: this._recName(r), code: code, concept: r.concept, conceptName: this._name(this._concept(r.concept)),
				kindText: this.text("onto.rec.golden"), kindState: "Success", sources: r.sources.join(" · "), rels: links, relsCount: links.length
			});
		},

		_selectLink: function (id) {
			var l = (this._o.links || []).filter(function (x) { return x.id === id; })[0], r = this._rel(l.type), a = this._record(l.from), b = this._record(l.to);
			this.viewModel().setProperty("/onto/sel", {
				kind: "link", id: id, title: this._label(r), typeId: r.id, rkind: r.kind, typeText: this._o.prefix + ":" + r.tech,
				from: l.from, to: l.to, fromName: l.from + " · " + this._recName(a), toName: l.to + " · " + this._recName(b),
				attrs: Object.keys(l.attrs).map(function (k) { return { k: k, v: l.attrs[k] }; }),
				status: l.status, statusText: this.text("onto.rec.status." + l.status), statusState: l.status === "pending" ? "Warning" : "Success",
				kindText: this.text("onto.kind." + r.kind), kindState: r.kind === "type" ? "Information" : "None",
				cr: l.cr, by: l.by, on: l.on, isMatch: r.kind === "system",
				note: this.text(r.kind === "system" ? "onto.rec.noteSystem" : l.status === "pending" ? "onto.rec.notePending" : "onto.rec.noteType")
			});
		},

		onRecRowPress: function (e) {
			var id = e.getParameter("listItem").getBindingContext("view").getProperty("id");
			this._selectLink(id); this.byId("graph").selectElement(id, "focus");
		},
		/* Data preview opens under the graph; the graph keeps the rest of the height and is never hidden. */
		onTogglePreview: function () { this._refitGraph(); },
		onClosePreview: function () { this.viewModel().setProperty("/onto/rec/preview", false); this._refitGraph(); },
		_refitGraph: function () { var that = this; setTimeout(function () { that.onFit(); }, 60); },
		onSelectRecord: function (e) { var code = e.getSource().data("ref"); this._selectRecord(code); this.byId("graph").selectElement(code, true); },
		onRecRelPress: function (e) {
			var id = e.getParameter("listItem").data("ref");
			this._selectLink(id); this.byId("graph").selectElement(id, true);
		},
		onGoType: function () {
			var id = this.viewModel().getProperty("/onto/sel/typeId");
			this._setMode("schema"); this._select("edge", id, true);
		},
		onOpenBuilder: function () { this.navKey("relationshipBuilder"); },
		onOpenRequest: function () { MessageToast.show(this.text("onto.linkPlanned", [this.viewModel().getProperty("/onto/sel/cr")])); },

		/* ---------- canvas toolbar ---------- */

		onShow: function () {
			var sel = this.viewModel().getProperty("/onto/sel");
			this._refresh();
			if (sel.kind === "edge" && !this.viewModel().getProperty("/onto/graph").edges.some(function (x) { return x.id === sel.id; })) { this.onCloseDetail(); }
			else if (sel.id) { this.byId("graph").selectElement(sel.id); }
		},
		onLayout: function () { var sel = this.viewModel().getProperty("/onto/sel"); if (sel.id) { this.byId("graph").selectElement(sel.id); } },
		onZoomIn: function () { this.byId("graph").zoomBy(1.25); },
		onZoomOut: function () { this.byId("graph").zoomBy(0.8); },
		onFit: function () { this.byId("graph").fit(this.viewModel().getProperty("/onto/mode") === "records" ? 0.5 : undefined); },
		onSideTab: function () { this.viewModel().setProperty("/onto/query", ""); this._refresh(false); },
		onSearch: function () { this._refresh(false); },

		onCopyUri: function () {
			var sel = this.viewModel().getProperty("/onto/sel"), uri = this._o.ns + (sel.kind === "node" ? sel.id : sel.tech), that = this;
			var done = function () { MessageToast.show(that.text("onto.uriCopied")); };
			try { navigator.clipboard.writeText(uri).then(done, done); } catch (err) { done(); }
		},

		onLink: function (e) {
			var src = e.getSource();
			if (src.data("type") === "entity") { this.router().navTo("domains", { item: src.data("ref") }); return; }
			MessageToast.show(this.text("onto.linkPlanned", [src.getText()]));
		},

		/* ---------- versions and governance ---------- */

		versionStateText: function (s) { return s ? this.text("onto.state." + s) : ""; },
		versionState: function (s) { return { draft: "Information", review: "Warning", published: "Success", retired: "None" }[s] || "None"; },

		onVersion: function (e) {
			var key = e.getParameter("selectedItem").getKey(), v = this._o.versions.filter(function (x) { return x.key === key; })[0], m = this.viewModel();
			m.setProperty("/onto/state", v.state);
			m.setProperty("/onto/editable", v.state === "draft");
		},

		_markChange: function (key) { this._changes[key] = true; this.viewModel().setProperty("/onto/changes", Object.keys(this._changes).length); },

		onEditConcept: function () {
			var m = this.viewModel(), sel = m.getProperty("/onto/sel"), c = this._concept(sel.id), ar = this.lang() === "ar";
			var name = (sel.name || "").trim();
			if (!name) { m.setProperty("/onto/sel/name", this._name(c)); MessageToast.show(this.text("onto.nameRequired")); return; }
			if (ar) { c.nameAr = name; c.descAr = sel.desc; } else { c.nameEn = name; c.descEn = sel.desc; }
			m.setProperty("/onto/sel/title", name);
			this._markChange("c:" + c.id);
			this._refresh();
			this.byId("graph").selectElement(c.id);
		},

		onEditParents: function () {
			var m = this.viewModel(), sel = m.getProperty("/onto/sel"), c = this._concept(sel.id), that = this,
				keys = this.byId("selParents").getSelectedKeys();
			// A concept cannot be its own ancestor: block self and descendants.
			var isDesc = function (cand) {
				if (cand === c.id) { return true; }
				var p = that._concept(cand).parent;
				return p.some(isDesc);
			};
			var bad = keys.filter(isDesc);
			if (bad.length) {
				MessageToast.show(this.text("onto.cycle"));
				m.setProperty("/onto/sel/parents", c.parent.slice());
				return;
			}
			c.parent = keys;
			this._markChange("parent:" + c.id);
			this._refresh();
			this._selectNode(c.id);
			this.byId("graph").selectElement(c.id);
		},

		onSubmit: function () {
			var that = this, n = Object.keys(this._changes).length;
			if (!n) { MessageToast.show(this.text("onto.noChanges")); return; }
			MessageBox.confirm(this.text("onto.submitConfirm", [this.viewModel().getProperty("/onto/version"), n]), {
				title: this.text("onto.submit"),
				onClose: function (a) {
					if (a !== MessageBox.Action.OK) { return; }
					var m = that.viewModel();
					m.setProperty("/onto/state", "review");
					m.setProperty("/onto/editable", false);
					m.setProperty("/onto/versions/0/state", "review");
					MessageToast.show(that.text("onto.submitted"));
				}
			});
		},

		/* Prototype checks in the spirit of the SHACL shapes the service will run (README §2.3). */
		onValidate: function () {
			var msgs = this._checks(), shapes = this._o.concepts.length + this._o.relations.length;
			if (!msgs.length) { MessageBox.success(this.text("onto.v.ok", [shapes])); return; }
			MessageBox.warning(this.text("onto.v.found", [msgs.length, shapes]), { details: "<ul><li>" + msgs.join("</li><li>") + "</li></ul>" });
		},
		_checks: function () {
			var that = this, msgs = [];
			this._o.concepts.forEach(function (c) {
				if (!(c.descEn || "").trim() && !(c.descAr || "").trim()) { msgs.push(that.text("onto.v.noDesc", [that._name(c)])); }
				if (!c.owner) { msgs.push(that.text("onto.v.noOwner", [that._name(c)])); }
				if (c.cat !== "abstract" && !c.props.length) { msgs.push(that.text("onto.v.noProps", [that._name(c)])); }
			});
			this._o.relations.forEach(function (r) {
				if (r.kind !== "semantic" && !r.inverse) { msgs.push(that.text("onto.v.noInverse", [that._label(r)])); }
			});
			return msgs;
		},

		/* ---------- new concept / new relationship type (steward actions into the draft) ---------- */

		_dialog: function (sTitle, aContent, fnOk, sOk) {
			var oDlg = new Dialog({
				title: sTitle, contentWidth: "32rem", draggable: true, resizable: true,
				content: aContent,
				beginButton: new Button({ text: sOk, type: "Emphasized", press: function () { if (fnOk() !== false) { oDlg.close(); } } }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
			return oDlg;
		},

		_form: function (aRows) {
			var oForm = new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanL: 4, labelSpanM: 4, labelSpanS: 12, columnsL: 1, columnsM: 1 });
			aRows.forEach(function (r) { oForm.addContent(r[0]); oForm.addContent(r[1]); });
			return oForm;
		},

		onNewConcept: function () {
			var that = this, touched = false,
				oName = new Input({ valueLiveUpdate: true, placeholder: this.text("onto.newConceptPh") }),
				oTech = new Input({ valueLiveUpdate: true, placeholder: "PascalCase" }),
				oCat = new Select({ items: CATS.map(function (k) { return new Item({ key: k, text: that.text("onto.cat." + k) }); }) }),
				oParent = new Select({ forceSelection: true, items: [new Item({ key: "", text: this.text("onto.noParent") })].concat(
					this.viewModel().getProperty("/onto/conceptOptions").map(function (c) { return new Item({ key: c.id, text: c.name }); })) }),
				oDesc = new TextArea({ rows: 3, width: "100%" });
			oName.attachLiveChange(function () {
				if (touched) { return; }
				oTech.setValue((oName.getValue().match(/[A-Za-z0-9]+/g) || []).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join("").slice(0, 40));
			});
			oTech.attachLiveChange(function () { touched = true; });
			oParent.attachChange(function () {
				var p = that._concept(oParent.getSelectedKey());
				if (p) { oCat.setSelectedKey(p.cat === "abstract" ? "master" : p.cat); }
			});
			this._dialog(this.text("onto.newConcept"), [
				this._form([
					[new Label({ text: this.text("dsp.businessName"), required: true }), oName],
					[new Label({ text: this.text("dsp.technicalName"), required: true }), oTech],
					[new Label({ text: this.text("onto.parents") }), oParent],
					[new Label({ text: this.text("onto.category") }), oCat],
					[new Label({ text: this.text("onto.description") }), oDesc]
				]),
				new MessageStrip({ text: this.text("onto.draftNote", [this.viewModel().getProperty("/onto/version")]), showIcon: true }).addStyleClass("sapUiSmallMarginBeginEnd sapUiSmallMarginBottom")
			], function () {
				var name = oName.getValue().trim(), tech = oTech.getValue().trim(), ok = true;
				oName.setValueState(name ? "None" : "Error").setValueStateText(that.text("onto.nameRequired"));
				if (!name) { ok = false; }
				var techErr = !/^[A-Z][A-Za-z0-9]{1,39}$/.test(tech) ? "onto.techPascal" : that._concept(tech) ? "onto.techTaken" : "";
				oTech.setValueState(techErr ? "Error" : "None").setValueStateText(techErr ? that.text(techErr) : "");
				if (!ok || techErr) { return false; }
				var p = oParent.getSelectedKey();
				that._o.concepts.push({ id: tech, nameEn: name, nameAr: name, cat: oCat.getSelectedKey(), parent: p ? [p] : [], descEn: oDesc.getValue(),
					descAr: oDesc.getValue(), props: [], links: {}, owner: "محمد", draft: true });
				that._markChange("new:" + tech);
				that._refresh();
				that._select("node", tech, true);
				MessageToast.show(that.text("onto.added", [name]));
			}, this.text("common.create"));
		},

		onNewType: function () {
			var that = this, touched = false,
				opts = function () { return DOMAIN_CONCEPTS.map(function (id) { return new Item({ key: id, text: that._name(that._concept(id)) }); }); },
				oFrom = new Select({ items: opts() }), oTo = new Select({ items: opts() }),
				oName = new Input({ valueLiveUpdate: true }), oTech = new Input({ valueLiveUpdate: true, placeholder: "snake_case" }),
				oInv = new Input({ placeholder: "snake_case" }),
				oCard = new Select({ selectedKey: "N:M", items: ["1:1", "1:N", "N:1", "N:M"].map(function (k) { return new Item({ key: k, text: k }); }) }),
				oAttrs = new Input({ placeholder: this.text("onto.attrsPh") });
			var sel = this.viewModel().getProperty("/onto/sel");
			if (sel.kind === "node" && DOMAIN_CONCEPTS.indexOf(sel.id) > -1) { oFrom.setSelectedKey(sel.id); oTo.setSelectedKey(sel.id); }
			oName.attachLiveChange(function () {
				if (!touched) { oTech.setValue((oName.getValue().toLowerCase().match(/[a-z0-9]+/g) || []).join("_").slice(0, 40)); }
			});
			oTech.attachLiveChange(function () { touched = true; });
			this._dialog(this.text("onto.newType"), [
				this._form([
					[new Label({ text: this.text("onto.from"), required: true }), oFrom],
					[new Label({ text: this.text("onto.to"), required: true }), oTo],
					[new Label({ text: this.text("dsp.businessName"), required: true }), oName],
					[new Label({ text: this.text("dsp.technicalName"), required: true }), oTech],
					[new Label({ text: this.text("onto.inverse") }), oInv],
					[new Label({ text: this.text("onto.card") }), oCard],
					[new Label({ text: this.text("onto.attrs") }), oAttrs]
				]),
				new MessageStrip({ text: this.text("onto.typeNote", [this.viewModel().getProperty("/onto/version")]), showIcon: true }).addStyleClass("sapUiSmallMarginBeginEnd sapUiSmallMarginBottom")
			], function () {
				var f = oFrom.getSelectedKey(), t = oTo.getSelectedKey(), name = oName.getValue().trim(), tech = oTech.getValue().trim(), err = "";
				oName.setValueState(name ? "None" : "Error").setValueStateText(that.text("onto.nameRequired"));
				if (!/^[a-z][a-z0-9_]{2,39}$/.test(tech)) { err = "onto.techSnake"; }
				else if (tech === "same_as") { err = "onto.techSystem"; }
				else if (that._o.relations.some(function (r) { return r.from === f && r.to === t && r.tech === tech; })) { err = "onto.techDup"; }
				oTech.setValueState(err ? "Error" : "None").setValueStateText(err ? that.text(err) : "");
				if (!name || err) { return false; }
				var id = that._o.relations.some(function (r) { return r.id === tech; }) ? f.toLowerCase() + "_" + tech : tech;
				var lbl = name;
				that._o.relations.push({ id: id, tech: tech, from: f, to: t, labelEn: lbl, labelAr: lbl, kind: "type", inverse: oInv.getValue().trim(),
					card: oCard.getSelectedKey(), attrs: (oAttrs.getValue().match(/[A-Za-z0-9_]+/g) || []), status: "draft", draft: true });
				that._markChange("new:" + id);
				that._ensureVisible("type");
				that._refresh();
				that._select("edge", id, true);
				MessageToast.show(that.text("onto.added", [name]));
			}, this.text("common.create"));
		},

		/* ---------- SPARQL (permission-filtered endpoint; preset queries in the prototype) ---------- */

		_queries: function () {
			var that = this, P = "PREFIX rio:  <" + this._o.ns + ">\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n\n";
			return [
				{ key: "types", text: this.text("onto.q.types"), cols: ["onto.col.type", "onto.inverse", "onto.card"],
					sparql: P + "SELECT ?type ?inverse ?cardinality WHERE {\n  ?type a rio:RelationshipType ;\n        rdfs:domain rio:Customer ;\n        rdfs:range  rio:Customer .\n  OPTIONAL { ?type rio:inverseName ?inverse }\n  OPTIONAL { ?type rio:cardinality ?cardinality }\n}",
					run: function () {
						return that._o.relations.filter(function (r) { return r.from === "Customer" && r.to === "Customer" && r.kind !== "semantic"; })
							.map(function (r) { return ["rio:" + r.tech, r.inverse ? "rio:" + r.inverse : "—", r.card]; });
					} },
				{ key: "subclasses", text: this.text("onto.q.subclasses"), cols: ["onto.concept", "onto.parents", ""],
					sparql: P + "SELECT ?concept ?parent WHERE {\n  ?concept rdfs:subClassOf+ rio:MasterEntity ;\n           rdfs:subClassOf ?parent .\n}",
					run: function () {
						var under = function (id) { var c = that._concept(id); return c.parent.indexOf("MasterEntity") > -1 || c.parent.some(under); };
						return that._o.concepts.filter(function (c) { return c.id !== "MasterEntity" && under(c.id); })
							.map(function (c) { return ["rio:" + c.id, c.parent.map(function (p) { return "rio:" + p; }).join(", "), ""]; });
					} },
				{ key: "glossary", text: this.text("onto.q.glossary"), cols: ["onto.concept", "onto.link.glossary", ""],
					sparql: P + "SELECT ?concept ?term WHERE {\n  ?concept rio:glossaryTerm ?term .\n}\nORDER BY ?concept",
					run: function () {
						var rows = [];
						that._o.concepts.forEach(function (c) { ((c.links || {}).glossary || []).forEach(function (g) { rows.push(["rio:" + c.id, "\"" + g + "\"", ""]); }); });
						return rows;
					} }
			];
		},

		onSparql: function () {
			var that = this, Q = this._queries(), oRes = new JSONModel({ rows: [], ran: false, cols: Q[0].cols.map(function (k) { return k ? that.text(k) : ""; }) });
			// setValue, not the constructor: braces in SPARQL would be read as a binding.
			var oQuery = new TextArea({ rows: 9, width: "100%", editable: false }).addStyleClass("repoioMono").setValue(Q[0].sparql);
			var oPick = new Select({ width: "100%", items: Q.map(function (q) { return new Item({ key: q.key, text: q.text }); }) });
			oPick.attachChange(function () {
				var q = Q.filter(function (x) { return x.key === oPick.getSelectedKey(); })[0];
				oQuery.setValue(q.sparql);
				oRes.setData({ rows: [], ran: false, cols: q.cols.map(function (k) { return k ? that.text(k) : ""; }) });
			});
			var mkCol = function (i) {
				return new Column({ visible: "{= !!${res>/cols/" + i + "} }", header: new Text({ text: "{res>/cols/" + i + "}" }) });
			};
			var oTable = new Table({ columns: [mkCol(0), mkCol(1), mkCol(2)], noDataText: this.text("onto.q.runHint"),
				items: { path: "res>/rows", template: new ColumnListItem({ cells: [0, 1, 2].map(function (i) { return new Text({ text: "{res>" + i + "}" }).addStyleClass("repoioMono"); }) }) } });
			oTable.setModel(oRes, "res");
			var oDlg = new Dialog({
				title: this.text("onto.sparql"), contentWidth: "44rem", draggable: true, resizable: true,
				content: [new VBox({ items: [
					new MessageStrip({ text: this.text("onto.q.secured"), showIcon: true, type: "Information" }).addStyleClass("sapUiSmallMarginBottom"),
					new Label({ text: this.text("onto.q.preset"), labelFor: oPick }), oPick,
					new Label({ text: "SPARQL" }).addStyleClass("sapUiSmallMarginTop"), oQuery, oTable
				] }).addStyleClass("sapUiSmallMargin")],
				beginButton: new Button({ text: this.text("onto.q.run"), type: "Emphasized", icon: "sap-icon://media-play", press: function () {
					var q = Q.filter(function (x) { return x.key === oPick.getSelectedKey(); })[0];
					oRes.setProperty("/rows", q.run()); oRes.setProperty("/ran", true); oTable.setNoDataText(that.text("onto.q.none"));
				} }),
				endButton: new Button({ text: this.text("common.close"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},

		/* ---------- Turtle export ---------- */

		_turtle: function () {
			var o = this._o, v = this.viewModel().getProperty("/onto/version"),
				lit = function (s, l) { return "\"" + String(s || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"" + (l ? "@" + l : ""); };
			var out = ["@prefix rio:  <" + o.ns + "> .", "@prefix owl:  <http://www.w3.org/2002/07/owl#> .", "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
				"@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .", "", "<" + o.ns.replace(/#$/, "") + "> a owl:Ontology ;", "    owl:versionInfo " + lit(v) + " .", "", "# Concepts"];
			o.concepts.forEach(function (c) {
				var t = ["rio:" + c.id + " a owl:Class", "    rdfs:label " + lit(c.nameEn, "en") + " , " + lit(c.nameAr, "ar")];
				c.parent.forEach(function (p) { t.push("    rdfs:subClassOf rio:" + p); });
				if (c.descEn) { t.push("    rdfs:comment " + lit(c.descEn, "en")); }
				((c.links || {}).glossary || []).forEach(function (g) { t.push("    rio:glossaryTerm " + lit(g)); });
				out.push(t.join(" ;\n") + " .");
				c.props.forEach(function (p) {
					out.push("rio:" + c.id + "_" + p.name + " a owl:DatatypeProperty ;\n    rdfs:label " + lit(p.name) + " ;\n    rdfs:domain rio:" + c.id + " ;\n    rdfs:range " + p.type + " .");
				});
			});
			out.push("", "# Relationship types and semantic properties");
			o.relations.forEach(function (r) {
				var t = ["rio:" + r.id + " a owl:ObjectProperty" + (r.kind !== "semantic" ? " , rio:RelationshipType" : ""),
					"    rdfs:label " + lit(r.labelEn, "en") + " , " + lit(r.labelAr, "ar"), "    rdfs:domain rio:" + r.from, "    rdfs:range rio:" + r.to,
					"    rio:technicalName " + lit(r.tech), "    rio:relationshipKind " + lit(r.kind)];
				if (r.inverse) { t.push("    rio:inverseName " + lit(r.inverse)); }
				if (r.card) { t.push("    rio:cardinality " + lit(r.card)); }
				(r.attrs || []).forEach(function (a) { t.push("    rio:attribute " + lit(a)); });
				out.push(t.join(" ;\n") + " .");
			});
			return out.join("\n") + "\n";
		},

		onExport: function () {
			var that = this, ttl = this._turtle(), file = "repoio-ontology-v" + this.viewModel().getProperty("/onto/version") + ".ttl";
			var oDlg = new Dialog({
				title: this.text("onto.exportTitle"), contentWidth: "48rem", resizable: true, draggable: true,
				content: [new TextArea({ editable: false, width: "100%", rows: 24 }).addStyleClass("repoioMono repoioTtl").setValue(ttl)],
				buttons: [
					new Button({ text: this.text("onto.download"), icon: "sap-icon://download", type: "Emphasized", press: function () {
						try {
							var a = document.createElement("a");
							a.href = URL.createObjectURL(new Blob([ttl], { type: "text/turtle" }));
							a.download = file; document.body.appendChild(a); a.click(); a.remove();
						} catch (err) { MessageToast.show(that.text("onto.downloadBlocked")); }
					} }),
					new Button({ text: this.text("onto.copy"), icon: "sap-icon://copy", press: function () {
						var done = function () { MessageToast.show(that.text("onto.copied")); };
						try { navigator.clipboard.writeText(ttl).then(done, done); } catch (err) { done(); }
					} }),
					new Button({ text: this.text("common.close"), press: function () { oDlg.close(); } })
				],
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		}
	});
});
