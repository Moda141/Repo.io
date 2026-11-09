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
	"repoio/proto/thirdparty/cytoscape.min"
], function (Control, ResizeHandler) {
	"use strict";

	var cytoscapeLib = window.cytoscape;
	var FONT = "Arial, Helvetica, sans-serif";
	var MIN_READABLE = 0.7, MAX_FIT = 1.15;

	/* Quiet Quartz Light tints: light fills, one blue for selection, governed links in muted blue. */
	var STYLE = [
		{ selector: "node", style: {
			"width": 34, "height": 34, "background-color": "#d6e9f8", "border-width": 1, "border-color": "#9cc5ea",
			"label": "data(label)", "font-family": FONT, "font-size": 11, "color": "#32363a",
			"text-valign": "bottom", "text-halign": "center", "text-margin-y": 4, "text-wrap": "wrap", "text-max-width": 90,
			"text-background-color": "#ffffff", "text-background-opacity": 0.75, "text-background-padding": 1,
			"overlay-opacity": 0 } },
		{ selector: "node[cat = 'abstract']", style: { "background-color": "#ffffff", "border-style": "dashed", "border-color": "#6a8bad", "border-width": 1.5 } },
		{ selector: "node[cat = 'governance']", style: { "background-color": "#dfe6ee", "border-color": "#a9b6c4" } },
		{ selector: "node[cat = 'asset']", style: { "background-color": "#e3efe8", "border-color": "#a8c8b4" } },
		{ selector: "node[cat = 'business']", style: { "background-color": "#f3ece0", "border-color": "#d2bf9c" } },
		/* Golden records (instance level): rounded squares with code and name. */
		{ selector: "node[cat ^= 'rec-']", style: { "shape": "round-rectangle", "width": 28, "height": 22, "text-max-width": 130, "font-size": 10 } },
		{ selector: "node[cat = 'rec-customer']", style: { "background-color": "#d6e9f8", "border-color": "#7fa7d4" } },
		{ selector: "node[cat = 'rec-vendor']", style: { "background-color": "#f3ece0", "border-color": "#c9b48d" } },
		{ selector: "node[cat = 'rec-product']", style: { "background-color": "#e3efe8", "border-color": "#93bba2" } },
		{ selector: "node[?hit]", style: { "border-width": 2.5, "border-color": "#0a6ed1" } },
		{ selector: "edge[?draft][kind != 'subclass']", style: { "line-style": "dashed" } },
		{ selector: "node[?draft]", style: { "border-style": "dashed", "border-color": "#e9730c", "border-width": 1.5 } },
		{ selector: "node:selected", style: { "border-width": 3, "border-color": "#0a6ed1", "font-weight": "bold" } },
		{ selector: "edge", style: {
			"width": 1, "line-color": "#b4bcc4", "curve-style": "bezier", "target-arrow-shape": "triangle",
			"target-arrow-color": "#b4bcc4", "arrow-scale": 0.8, "label": "data(label)", "font-family": FONT, "font-size": 9,
			"color": "#6a6d70", "text-rotation": "autorotate", "text-background-color": "#ffffff", "text-background-opacity": 0.85,
			"text-background-padding": 1, "control-point-step-size": 36, "overlay-opacity": 0, "loop-sweep": -40 } },
		{ selector: "edge[kind = 'type']", style: { "line-color": "#7fa7d4", "target-arrow-color": "#7fa7d4", "width": 1.25 } },
		{ selector: "edge[kind = 'system']", style: { "line-style": "dotted", "line-color": "#8a9aaa", "target-arrow-color": "#8a9aaa" } },
		{ selector: "edge[kind = 'subclass']", style: { "line-style": "dashed", "target-arrow-shape": "triangle", "target-arrow-fill": "hollow", "line-color": "#c3c9cf", "target-arrow-color": "#9aa3ab", "label": "" } },
		{ selector: "edge[?draft]", style: { "line-color": "#e9730c", "target-arrow-color": "#e9730c" } },
		{ selector: "edge:selected", style: { "width": 2.5, "line-color": "#0a6ed1", "target-arrow-color": "#0a6ed1", "color": "#0a6ed1", "font-weight": "bold" } },
		{ selector: ".faded", style: { "opacity": 0.22 } },
		{ selector: ".nolabel", style: { "label": "" } }
	];

	var LAYOUTS = {
		force: { name: "cose", animate: false, randomize: false, nodeRepulsion: function () { return 160000; }, idealEdgeLength: function () { return 90; },
			edgeElasticity: function () { return 100; }, nodeOverlap: 30, gravity: 20, nestingFactor: 1.2, numIter: 2500, padding: 30, componentSpacing: 50 },
		hierarchy: { name: "breadthfirst", directed: true, spacingFactor: 1.05, padding: 30, animate: false },
		circle: { name: "concentric", padding: 30, animate: false, minNodeSpacing: 34,
			concentric: function (n) { return n.degree(); }, levelWidth: function () { return 3; } }
	};

	return Control.extend("repoio.proto.control.OntologyGraph", {
		metadata: {
			properties: {
				elements: { type: "object" },
				layout: { type: "string", defaultValue: "force" },
				edgeLabels: { type: "boolean", defaultValue: true },
				height: { type: "sap.ui.core.CSSSize", defaultValue: "100%" },
				ariaLabel: { type: "string", defaultValue: "" }
			},
			events: {
				/* kind: "node" | "edge" | "" (background tap clears the selection) */
				select: { parameters: { kind: { type: "string" }, id: { type: "string" } } }
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
		zoomBy: function (f) {
			var cy = this._cy; if (!cy) { return; }
			cy.zoom({ level: cy.zoom() * f, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
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
