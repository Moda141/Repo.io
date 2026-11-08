/*
 * BpmnDesigner — OpenUI5 wrapper for the bpmn-js Modeler (README §2.6 / J7: "bpmn-js canvas inside
 * OpenUI5"; README §7.2: third-party libraries live inside a custom control and follow the UI5
 * rendering and destroy lifecycle).
 *
 * bpmn-js is the designer only: it edits BPMN 2.0 XML. Nothing executes in the browser; published
 * definitions run in Flowable behind the repoio-service adapter. Repo.io task settings are stored as
 * repoio:* extension attributes on standard BPMN elements, so the palette stays standard BPMN.
 *
 * Licence note (bpmn.io licence): the bpmn.io watermark rendered in the canvas must stay visible and
 * must not be covered by other elements.
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/ui/dom/includeStylesheet",
	"repoio/proto/thirdparty/bpmn-js/bpmn-modeler.production.min"
], function (Control, includeStylesheet) {
	"use strict";

	var BpmnJS = window.BpmnJS;
	var cssDone = false;
	function loadCss() {
		if (cssDone) { return; }
		cssDone = true;
		["diagram-js.css", "bpmn-js.css", "bpmn-embedded.css"].forEach(function (f) {
			includeStylesheet(sap.ui.require.toUrl("repoio/proto/thirdparty/bpmn-js/" + f));
		});
	}

	/* moddle extension: Repo.io attributes on standard BPMN types (serialised as repoio:*). */
	var REPOIO_MODDLE = {
		name: "Repo.io workflow", prefix: "repoio", uri: "urn:repoio:workflow", xml: { tagAlias: "lowerCase" }, associations: [],
		types: [{
			name: "RepoioProps", isAbstract: true,
			"extends": ["bpmn:Process", "bpmn:Task", "bpmn:Gateway", "bpmn:Event", "bpmn:SequenceFlow"],
			properties: [
				"taskType", "domain", "owner", "techName", "approverType", "approvers", "approverTeam", "approvalRule", "dueIn", "escalateTo",
				"scriptId", "scriptVersion", "timeoutMin", "connection", "targetSystem", "entity", "fieldMapping",
				"conflictPolicy", "backoff", "outcome"
			].map(function (n) { return { name: n, isAttr: true, type: "String" }; }).concat([
				{ name: "retries", isAttr: true, type: "Integer" }
			])
		}]
	};

	return Control.extend("repoio.proto.control.BpmnDesigner", {
		metadata: {
			properties: {
				readOnly: { type: "boolean", defaultValue: false },
				height: { type: "sap.ui.core.CSSSize", defaultValue: "100%" }
			},
			events: {
				ready: {},
				selectionChange: { parameters: { id: { type: "string" } } },
				changed: {},
				elementChanged: { parameters: { id: { type: "string" } } }
			}
		},

		renderer: {
			apiVersion: 2,
			render: function (oRm, oControl) {
				oRm.openStart("div", oControl);
				oRm.class("repoioBpmn");
				if (oControl.getReadOnly()) { oRm.class("repoioBpmnRO"); }
				oRm.style("height", oControl.getHeight());
				oRm.openEnd();
				oRm.close("div");
			}
		},

		init: function () {
			loadCss();
			// The modeler lives in its own container node that is moved into the control's DOM after
			// every rendering, so UI5 re-rendering never loses the diagram.
			this._host = document.createElement("div");
			this._host.className = "repoioBpmnHost";
			this._modeler = new BpmnJS({
				container: this._host,
				moddleExtensions: { repoio: REPOIO_MODDLE },
				bpmnRenderer: { defaultFillColor: "#ffffff", defaultStrokeColor: "#475e75", defaultLabelColor: "#32363a" }
			});
			var bus = this._modeler.get("eventBus"), that = this;
			// Published versions are immutable. The rule check below covers the UI tools (palette, context
			// pad, keyboard); wrapping the command stack also covers direct modelling API calls and undo/redo.
			bus.on("commandStack.canExecute", 10000, function () { return that.getReadOnly() ? false : undefined; });
			var cs = this._modeler.get("commandStack");
			["execute", "undo", "redo"].forEach(function (fn) {
				var orig = cs[fn].bind(cs);
				cs[fn] = function () { return that.getReadOnly() ? undefined : orig.apply(null, arguments); };
			});
			bus.on("selection.changed", function (e) {
				var s = e.newSelection || [];
				that.fireSelectionChange({ id: s.length === 1 ? s[0].id : "" });
			});
			bus.on("commandStack.changed", function () { that.fireChanged(); });
			bus.on("element.changed", function (e) { that.fireElementChanged({ id: e.element.id }); });
		},

		setReadOnly: function (b) {
			this.setProperty("readOnly", b, true);
			var d = this.getDomRef();
			if (d) { d.classList.toggle("repoioBpmnRO", !!b); }
			return this;
		},

		onAfterRendering: function () {
			var d = this.getDomRef();
			if (d && this._host.parentNode !== d) { d.appendChild(this._host); }
			if (this._modeler) { this._modeler.get("canvas").resized(); }
		},

		exit: function () {
			if (this._modeler) { this._modeler.destroy(); this._modeler = null; }
			this._host = null;
		},

		/* ---------- API used by the page controller ---------- */

		get: function (s) { return this._modeler.get(s); },
		importXML: function (sXml) {
			var that = this;
			return this._modeler.importXML(sXml).then(function (r) { that.fit(); that.fireReady(); return r; });
		},
		saveXML: function () { return this._modeler.saveXML({ format: true }).then(function (r) { return r.xml; }); },
		fit: function () {
			var c = this._modeler.get("canvas");
			c.resized();
			c.zoom("fit-viewport", "auto");
			// Leave room for the palette at the left edge and a little air around the diagram.
			c.zoom(Math.min(1, c.zoom() * 0.88), "auto");
			c.scroll({ dx: 28, dy: 0 });
		},
		zoomBy: function (f) { var c = this._modeler.get("canvas"); c.zoom(c.zoom() * f); },
		undo: function () { this._modeler.get("commandStack").undo(); },
		redo: function () { this._modeler.get("commandStack").redo(); },
		canUndo: function () { return this._modeler.get("commandStack").canUndo(); },
		canRedo: function () { return this._modeler.get("commandStack").canRedo(); },
		element: function (id) { return id ? this._modeler.get("elementRegistry").get(id) : null; },
		root: function () { return this._modeler.get("canvas").getRootElement(); },
		elements: function () {
			return this._modeler.get("elementRegistry").filter(function (e) { return e.type !== "label" && e.type !== "bpmn:Process" && !e.labelTarget; });
		},
		select: function (id) {
			var el = this.element(id), sel = this._modeler.get("selection");
			if (el) { sel.select(el); this._modeler.get("canvas").scrollToElement(el); } else { sel.select(null); }
		},
		update: function (id, props) {
			var el = id ? this.element(id) : this.root();
			if (el) { this._modeler.get("modeling").updateProperties(el, props); }
		},
		removeSelected: function () {
			var sel = this._modeler.get("selection").get();
			if (sel.length) { this._modeler.get("modeling").removeElements(sel.slice()); }
		},

		/* Build a shape for a building block: { type, name, attrs, timer } */
		_shape: function (o) {
			var f = this._modeler.get("bpmnFactory"), ef = this._modeler.get("elementFactory"), m = this._modeler.get("moddle");
			var bo = f.create(o.type, Object.assign({ name: o.name }, o.attrs || {}));
			if (o.timer) {
				bo.eventDefinitions = [m.create("bpmn:TimerEventDefinition", { timeDuration: m.create("bpmn:FormalExpression", { body: o.timer }) })];
				bo.eventDefinitions[0].$parent = bo;
			}
			return ef.createShape({ type: o.type, businessObject: bo });
		},

		/* Click on a building block: append it after the selected node, or after the open end of the flow. */
		append: function (o) {
			if (this.getReadOnly()) { return null; }
			var reg = this._modeler.get("elementRegistry"), sel = this._modeler.get("selection").get()[0];
			var isNode = function (e) { return e && e.type !== "bpmn:SequenceFlow" && e.type !== "label" && e.type !== "bpmn:EndEvent" && e.type !== "bpmn:Process" && !e.labelTarget; };
			var src = isNode(sel) ? sel : null;
			if (!src) {
				var open = reg.filter(function (e) { return isNode(e) && !(e.outgoing || []).length; });
				src = open[open.length - 1] || reg.filter(function (e) { return e.type === "bpmn:StartEvent"; })[0];
			}
			var shape = this._shape(o), modeling = this._modeler.get("modeling");
			// A step with exactly one outgoing path gets the new block inserted into that path
			// (src → new → old target) instead of a dangling branch. Gateways keep branching.
			var next = null;
			if (src && !/Gateway$/.test(src.type) && (src.outgoing || []).length === 1 && o.type !== "bpmn:EndEvent") {
				next = src.outgoing[0].target;
				modeling.removeConnection(src.outgoing[0]);
			}
			if (src) { shape = this._modeler.get("autoPlace").append(src, shape); }
			else { shape = modeling.createShape(shape, { x: 200, y: 200 }, this.root()); }
			if (next) {
				// Make room: push everything from the old target onwards to the right.
				var dx = shape.x + shape.width + 50 - next.x;
				if (dx > 0) {
					var moved = {}, stack = [next], reg = this._modeler.get("elementRegistry");
					while (stack.length) {
						var n = stack.pop();
						if (moved[n.id] || n === shape) { continue; }
						moved[n.id] = n;
						(n.outgoing || []).forEach(function (f) { if (f.target) { stack.push(f.target); } });
					}
					modeling.moveElements(Object.keys(moved).map(function (k) { return reg.get(k); }), { x: dx, y: 0 });
				}
				modeling.moveElements([shape], { x: 0, y: src.y + src.height / 2 - (shape.y + shape.height / 2) });
				modeling.connect(shape, next);
			}
			this._modeler.get("selection").select(shape);
			return shape.id;
		},

		/* Drag a building block onto the canvas (same mechanism the bpmn-js palette uses). */
		startCreate: function (oEvent, o) {
			if (this.getReadOnly()) { return; }
			this._modeler.get("create").start(oEvent, this._shape(o));
		},

		setMarkers: function (aIds, sMarker) {
			var canvas = this._modeler.get("canvas"), reg = this._modeler.get("elementRegistry");
			reg.forEach(function (e) { if (canvas.hasMarker(e, sMarker)) { canvas.removeMarker(e, sMarker); } });
			(aIds || []).forEach(function (id) { if (reg.get(id)) { canvas.addMarker(id, sMarker); } });
		},

		/* Small type badges under Repo.io tasks (Datasphere shows the task kind under the name). */
		setBadges: function (aBadges) {
			var ov = this._modeler.get("overlays");
			ov.remove({ type: "repoio-badge" });
			(aBadges || []).forEach(function (b) {
				var el = document.createElement("div");
				el.className = "repoioBpmnBadge repoioBpmnBadge-" + b.kind;
				el.textContent = b.text;
				try { ov.add(b.id, "repoio-badge", { position: { bottom: -6, left: 4 }, html: el }); } catch (e) { /* element gone */ }
			});
		}
	});
});
