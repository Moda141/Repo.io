/*
 * OntologyGraph — OpenUI5 wrapper for Cytoscape.js (README §2.3: "Cytoscape.js: optional graph
 * visualization embedded in OpenUI5"; README §7.2: third-party libraries live inside a custom
 * control and follow the UI5 rendering and destroy lifecycle).
 *
 * The control only draws what it is given. Concepts, relationship types and their meaning come
 * from the ontology API (here: sample data); the control owns no business rules.
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/ui/core/ResizeHandler",
	"repoio/proto/thirdparty/cytoscape.min",
	"repoio/proto/thirdparty/cytoscape-dagre.bundle"
], function (Control, ResizeHandler) {
	"use strict";

	var cytoscapeLib = window.cytoscape;
	// Hierarchical layout (dagre), registered once with Cytoscape.
	if (cytoscapeLib && window.cytoscapeDagre && !cytoscapeLib.__repoioDagre) { cytoscapeLib.use(window.cytoscapeDagre); cytoscapeLib.__repoioDagre = true; }
	var FONT = "Arial, Helvetica, sans-serif";
	var MIN_READABLE = 0.7, MAX_FIT = 1.15;

	/*
	 * "Studio" look (reference: Ontology Studio), on the Quartz Light theme: a light canvas, concepts as white
	 * label-sized cards with a coloured border per category, records as small filled circles, relationship
	 * types in teal, is-a in dashed violet, one blue for selection.
	 */
	var C = { master: "#e8955a", abstract: "#8b83d6", governance: "#8a9aaa", asset: "#2f9e7a", business: "#c99a2e",
		type: "#1d9e75", subclass: "#7f77dd", system: "#5b8fd6", sel: "#2563eb", draft: "#e9730c", ink: "#1f2937", muted: "#6b7280", canvas: "#f4f6fa" };
	var STYLE = [
		{ selector: "node", style: {
			"shape": "round-rectangle", "width": "label", "height": "label", "padding": 11, "background-color": "#ffffff",
			"border-width": 2, "border-color": C.master, "label": "data(label)", "font-family": FONT, "font-size": 12, "color": C.ink,
			"text-valign": "center", "text-halign": "center", "text-wrap": "ellipsis", "text-max-width": 150, "min-width": 48,
			"overlay-opacity": 0, "transition-property": "border-color border-width opacity", "transition-duration": "0.15s" } },
		{ selector: "node[cat = 'abstract']", style: { "border-style": "dashed", "border-color": C.abstract, "color": "#4b4f8a" } },
		{ selector: "node[cat = 'governance']", style: { "border-color": C.governance } },
		{ selector: "node[cat = 'asset']", style: { "border-color": C.asset } },
		{ selector: "node[cat = 'business']", style: { "border-color": C.business } },
		/* Golden records (instance level): filled circles with the code and name underneath. */
		{ selector: "node[cat ^= 'rec-']", style: { "shape": "ellipse", "width": 26, "height": 26, "padding": 0, "min-width": 26, "border-width": 2,
			"text-valign": "bottom", "text-margin-y": 5, "text-wrap": "wrap", "text-max-width": 120, "font-size": 10, "color": "#374151",
			"text-background-color": C.canvas, "text-background-opacity": 0.85, "text-background-padding": 1 } },
		{ selector: "node[cat = 'rec-customer']", style: { "background-color": "#60a5fa", "border-color": "#3b82f6" } },
		{ selector: "node[cat = 'rec-vendor']", style: { "background-color": "#f5a470", "border-color": "#e8955a" } },
		{ selector: "node[cat = 'rec-product']", style: { "background-color": "#5fc7a0", "border-color": "#1d9e75" } },
		{ selector: "node[?hit]", style: { "border-width": 3, "border-color": C.sel } },
		{ selector: "node[?draft]", style: { "border-style": "dashed", "border-color": C.draft } },
		{ selector: "node:selected", style: { "border-width": 3, "border-color": C.sel, "background-color": "#eff6ff", "font-weight": "bold" } },
		{ selector: "node[cat ^= 'rec-']:selected", style: { "background-color": "#2563eb" } },
		{ selector: "edge", style: {
			"width": 1.5, "line-color": C.type, "curve-style": "bezier", "control-point-step-size": 30, "target-arrow-shape": "triangle",
			"target-arrow-color": C.type, "arrow-scale": 0.9, "source-distance-from-node": 2, "target-distance-from-node": 2,
			"label": "data(label)", "font-family": FONT, "font-size": 9, "color": C.type, "text-rotation": "autorotate",
			"text-background-color": C.canvas, "text-background-opacity": 0.9, "text-background-padding": 2, "overlay-opacity": 0, "loop-sweep": -40 } },
		{ selector: "edge[kind = 'system']", style: { "line-style": "dotted", "line-color": C.system, "target-arrow-color": C.system, "color": C.system, "width": 1.25 } },
		{ selector: "edge[kind = 'subclass']", style: { "line-style": "dashed", "line-dash-pattern": [6, 4], "line-color": C.subclass, "target-arrow-color": C.subclass,
			"target-arrow-shape": "triangle-backcurve", "label": "" } },
		/* Grouped parallel relationships: one thicker line with a count pill; no arrow when they run both ways. */
		{ selector: "edge[kind = 'bundle']", style: { "width": 2.5, "color": "#0f6e54", "font-size": 10, "font-weight": "bold", "text-rotation": "none",
			"text-background-color": "#e7f6f0", "text-background-opacity": 1, "text-background-padding": 3, "text-background-shape": "roundrectangle",
			"text-border-width": 1, "text-border-color": "#9fd8c3", "text-border-opacity": 1 } },
		{ selector: "edge[kind = 'bundle'][?mixed]", style: { "target-arrow-shape": "none" } },
		{ selector: "edge[?draft]", style: { "line-style": "dashed", "line-color": C.draft, "target-arrow-color": C.draft, "color": C.draft } },
		{ selector: "edge:selected", style: { "width": 3, "line-color": C.sel, "target-arrow-color": C.sel, "color": C.sel, "font-weight": "bold" } },
		{ selector: ".faded", style: { "opacity": 0.18 } },
		{ selector: ".nolabel", style: { "label": "" } }
	];

	var LAYOUTS = {
		hierarchy: window.cytoscapeDagre ? { name: "dagre", rankDir: "TB", nodeSep: 26, rankSep: 64, edgeSep: 12, padding: 30, animate: false, nodeDimensionsIncludeLabels: true }
			: { name: "breadthfirst", directed: true, spacingFactor: 1.05, padding: 30, animate: false },
		force: { name: "cose", animate: false, randomize: false, nodeRepulsion: function () { return 160000; }, idealEdgeLength: function () { return 90; },
			edgeElasticity: function () { return 100; }, nodeOverlap: 30, gravity: 20, nestingFactor: 1.2, numIter: 2500, padding: 30, componentSpacing: 50 },
		circle: { name: "concentric", padding: 30, animate: false, minNodeSpacing: 34,
			concentric: function (n) { return n.degree(); }, levelWidth: function () { return 3; } }
	};

	return Control.extend("repoio.proto.control.OntologyGraph", {
		metadata: {
			properties: {
				elements: { type: "object" },
				layout: { type: "string", defaultValue: "hierarchy" },
				edgeLabels: { type: "boolean", defaultValue: true },
				height: { type: "sap.ui.core.CSSSize", defaultValue: "100%" },
				ariaLabel: { type: "string", defaultValue: "" }
			},
			events: {
				/* kind: "node" | "edge" | "" (background tap clears the selection) */
				select: { parameters: { kind: { type: "string" }, id: { type: "string" } } },
				/* The zoom level changed (wheel, pinch, fit, buttons); drives the zoom slider. */
				viewport: { parameters: { zoom: { type: "float" } } }
			}
		},

		renderer: {
			apiVersion: 2,
			render: function (oRm, oControl) {
				oRm.openStart("div", oControl);
				oRm.class("repoioGraph");
				oRm.style("height", oControl.getHeight());
				oRm.attr("role", "application");
				oRm.attr("tabindex", "0");
				if (oControl.getAriaLabel()) { oRm.attr("aria-label", oControl.getAriaLabel()); }
				oRm.openEnd();
				oRm.close("div");
			}
		},

		/* Re-setting elements keeps node positions that are already known, so a filter change
		   or a new concept does not reshuffle the whole picture. */
		setElements: function (oElements) {
			this.setProperty("elements", oElements, true);
			if (this._cy) { this._load(false); }
			return this;
		},
		setLayout: function (sLayout) {
			this.setProperty("layout", sLayout, true);
			if (this._cy) { this._positions = {}; this._load(true); }
			return this;
		},
		setEdgeLabels: function (bOn) {
			this.setProperty("edgeLabels", bOn, true);
			if (this._cy) { this._cy.edges().toggleClass("nolabel", !bOn); }
			return this;
		},

		/* Select one element by id (or clear with ""), centre it and dim everything outside its neighbourhood. */
		selectElement: function (sId, bCenter) {
			var cy = this._cy;
			if (!cy) { this._pendingSelect = sId; return; }
			cy.elements().unselect().removeClass("faded");
			if (!sId) { return; }
			var el = cy.getElementById(sId);
			if (!el || el.empty()) { return; }
			el.select();
			var hood = el.isNode() ? el.closedNeighborhood() : el.union(el.connectedNodes());
			cy.elements().not(hood).addClass("faded");
			if (bCenter === "focus") {
				// Zoom to the element and its neighbours, readable but never closer than MAX_FIT.
				cy.stop(); cy.fit(hood, 70);
				if (cy.zoom() > MAX_FIT) { cy.zoom(MAX_FIT); cy.center(hood); }
			} else if (bCenter) { cy.animate({ center: { eles: el }, duration: 250 }); }
		},
		zoomBy: function (f) { var cy = this._cy; if (cy) { this.zoomTo(cy.zoom() * f); } },
		zoomTo: function (z) {
			var cy = this._cy; if (!cy) { return; }
			cy.zoom({ level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), z)), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
		},
		/* Fit the whole graph, but never below a zoom where labels stay legible; centre instead. */
		/* Lay the current elements out again (used when the record filter changes the node set). */
		relayout: function (bRun) {
			var cy = this._cy; if (!cy || !bRun) { return; }
			cy.layout(LAYOUTS[this.getLayout()] || LAYOUTS.force).run();
			this.fit(0.5); // record views show every group at once
			var that = this;
			cy.nodes().forEach(function (n) { that._positions[n.id()] = Object.assign({}, n.position()); });
		},
		fit: function (fMin) {
			var that = this;
			this._fitMin = typeof fMin === "number" ? fMin : MIN_READABLE;
			// Deferred: the container often changes size in the same tick (crumb bar, side panels).
			clearTimeout(this._fitTimer);
			this._fitTimer = setTimeout(function () {
				var cy = that._cy; if (!cy) { return; }
				cy.resize();
				cy.fit(undefined, 30);
				if (cy.zoom() < that._fitMin) { cy.zoom(that._fitMin); cy.center(); }
				if (cy.zoom() > MAX_FIT) { cy.zoom(MAX_FIT); cy.center(); }
			}, 30);
		},

		onBeforeRendering: function () { this._dispose(); },

		onAfterRendering: function () {
			var oDom = this.getDomRef();
			if (!oDom || !cytoscapeLib) { return; }
			this._cy = cytoscapeLib({ container: oDom, style: STYLE, minZoom: 0.25, maxZoom: 3,
				boxSelectionEnabled: false, selectionType: "single", autoungrabify: false });
			this._cy.on("tap", function (e) {
				if (e.target === this._cy) { this.selectElement(""); this.fireSelect({ kind: "", id: "" }); return; }
				var el = e.target;
				this.selectElement(el.id());
				this.fireSelect({ kind: el.isNode() ? "node" : "edge", id: el.id() });
			}.bind(this));
			this._cy.on("dragfree", "node", function (e) { this._positions[e.target.id()] = Object.assign({}, e.target.position()); }.bind(this));
			this._cy.on("zoom", function () { this.fireViewport({ zoom: this._cy.zoom() }); }.bind(this));
			// Count pills on concept cards (records of that concept), kept in a DOM layer above the canvas.
			this._badgeLayer = document.createElement("div");
			this._badgeLayer.className = "repoioGraphBadges";
			oDom.appendChild(this._badgeLayer);
			this._cy.on("render", this._queueBadges.bind(this));
			this._load(true);
			this._resizeId = ResizeHandler.register(this, function () { if (this._cy) { this._cy.resize(); } }.bind(this));
		},

		_load: function (bFit) {
			var cy = this._cy, o = this.getElements() || { nodes: [], edges: [] }, that = this;
			this._positions = this._positions || {};
			cy.elements().forEach(function (n) { if (n.isNode()) { that._positions[n.id()] = Object.assign({}, n.position()); } });
			cy.elements().remove();
			cy.add(o.nodes.map(function (n) { return { group: "nodes", data: n }; }));
			cy.add(o.edges.map(function (e) { return { group: "edges", data: e }; }));
			this._spreadLoops();
			cy.edges().toggleClass("nolabel", !this.getEdgeLabels());
			var aNew = cy.nodes().filter(function (n) { return !that._positions[n.id()]; });
			if (aNew.length === cy.nodes().length) {
				// First load: seed a circle so the force layout is deterministic, then lay out.
				cy.layout({ name: "circle", padding: 30 }).run();
				cy.layout(LAYOUTS[this.getLayout()] || LAYOUTS.force).run();
				bFit = true;
			} else {
				cy.nodes().forEach(function (n) {
					if (that._positions[n.id()]) { n.position(that._positions[n.id()]); }
				});
				aNew.forEach(function (n) {
					// A new concept appears next to its first neighbour (or the centre).
					var nb = n.neighborhood("node").filter(function (m) { return !!that._positions[m.id()]; })[0];
					var p = nb ? nb.position() : { x: cy.width() / 2, y: cy.height() / 2 };
					n.position({ x: p.x + 70, y: p.y + 50 });
				});
			}
			if (bFit) { this.fit(this._fitMin); }
			if (this._pendingSelect !== undefined) { this.selectElement(this._pendingSelect, false); this._pendingSelect = undefined; }
		},

		_queueBadges: function () {
			if (this._badgeFrame) { return; }
			this._badgeFrame = window.requestAnimationFrame(function () { this._badgeFrame = null; this._drawBadges(); }.bind(this));
		},
		_drawBadges: function () {
			var cy = this._cy, layer = this._badgeLayer; if (!cy || !layer) { return; }
			var html = [], rtl = document.documentElement.dir === "rtl", z = cy.zoom();
			if (z >= 0.45) {
				cy.nodes().forEach(function (n) {
					var c = n.data("count"); if (!c || n.style("display") === "none") { return; }
					var bb = n.renderedBoundingBox({ includeLabels: false }), x = rtl ? bb.x1 : bb.x2;
					html.push('<span class="repoioGraphBadge' + (n.hasClass("faded") ? " repoioGraphBadgeFaded" : "") + '" style="left:' + Math.round(x) + "px;top:" +
						Math.round(bb.y1) + 'px">' + c + "</span>");
				});
			}
			layer.innerHTML = html.join("");
		},

		/* Several self-relations on one concept (Customer → Customer …) fan out instead of overlapping. */
		_spreadLoops: function () {
			var byNode = {};
			this._cy.edges().forEach(function (e) {
				if (e.source().id() === e.target().id()) { (byNode[e.source().id()] = byNode[e.source().id()] || []).push(e); }
			});
			Object.keys(byNode).forEach(function (k) {
				byNode[k].forEach(function (e, i) {
					e.style({ "loop-direction": (-60 + i * 55) + "deg", "loop-sweep": "-35deg", "control-point-step-size": 46 });
				});
			});
		},

		_dispose: function () {
			if (this._badgeFrame) { window.cancelAnimationFrame(this._badgeFrame); this._badgeFrame = null; }
			this._badgeLayer = null;
			if (this._resizeId) { ResizeHandler.deregister(this._resizeId); this._resizeId = null; }
			if (this._cy) {
				this._positions = this._positions || {};
				var that = this;
				this._cy.nodes().forEach(function (n) { that._positions[n.id()] = Object.assign({}, n.position()); });
				this._cy.destroy(); this._cy = null;
			}
		},

		exit: function () { clearTimeout(this._fitTimer); this._dispose(); this._positions = null; }
	});
});
