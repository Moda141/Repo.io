/*
 * Repo.io flow model (ADR-0002). The designer edits this small tree; publishing compiles it to BPMN 2.0
 * for Flowable (in the product the compile runs in repoio-service; the engine is unchanged).
 *
 * node = { id, type, name, props, next: { <port>: childId } }
 * The flow is a tree that starts at Begin → Template. Nodes are only inserted on an existing path
 * ("+" between two nodes), so every branch always ends in an End node: no dangling steps by construction.
 */
sap.ui.define([], function () {
	"use strict";

	var PORTS = {
		begin: ["out"], template: ["out"], approval: ["approved", "rejected"], notification: ["out"], script: ["out"],
		validation: ["passed", "failed"], writeBack: ["out"], condition: ["yes", "no"], end: []
	};
	/* Where a new node's secondary branch goes by default. */
	var BRANCH_END = { rejected: "rejected", failed: "rejected", no: "completed" };
	var INSERTABLE = ["approval", "notification", "script", "validation", "writeBack", "condition"];

	var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

	function Flow(o) { this.nodes = o.nodes; this.root = o.root; this.seq = o.seq || 100; }

	Flow.PORTS = PORTS;
	Flow.INSERTABLE = INSERTABLE;
	Flow.fromJSON = function (o) { return new Flow(clone(o)); };

	Flow.prototype.toJSON = function () { return { root: this.root, seq: this.seq, nodes: clone(this.nodes) }; };
	Flow.prototype.node = function (id) { return this.nodes[id]; };
	Flow.prototype.ports = function (id) { return PORTS[this.nodes[id].type] || []; };
	Flow.prototype._id = function (type) { this.seq += 1; return type + "_" + this.seq; };

	Flow.prototype.parentOf = function (id) {
		for (var k in this.nodes) {
			var n = this.nodes[k];
			for (var p in n.next) { if (n.next[p] === id) { return { id: k, port: p }; } }
		}
		return null;
	};

	/* Nodes in flow order (depth-first, main path first). */
	Flow.prototype.ordered = function () {
		var out = [], that = this;
		(function walk(id) {
			if (!id || !that.nodes[id]) { return; }
			out.push(that.nodes[id]);
			that.ports(id).forEach(function (p) { walk(that.nodes[id].next[p]); });
		}(this.root));
		return out;
	};

	/* Steps before a node on its path (used e.g. to offer "previous approvers" as recipients). */
	Flow.prototype.ancestors = function (id) {
		var a = [], p = this.parentOf(id);
		while (p) { a.unshift(this.nodes[p.id]); p = this.parentOf(p.id); }
		return a;
	};

	Flow.prototype.insert = function (parentId, port, type, props, name) {
		var parent = this.nodes[parentId], id = this._id(type), that = this;
		var n = { id: id, type: type, name: name || "", props: props || {}, next: {} };
		var ports = PORTS[type];
		n.next[ports[0]] = parent.next[port];
		ports.slice(1).forEach(function (p) {
			var eid = that._id("end");
			that.nodes[eid] = { id: eid, type: "end", name: "", props: { outcome: BRANCH_END[p] || "completed" }, next: {} };
			n.next[p] = eid;
		});
		this.nodes[id] = n;
		parent.next[port] = id;
		return id;
	};

	/* Removing a step keeps its main path; side branches (e.g. "rejected") are removed with it. */
	Flow.prototype.removable = function (id) { var t = this.nodes[id] && this.nodes[id].type; return !!t && t !== "begin" && t !== "template" && t !== "end"; };
	Flow.prototype.subtreeSize = function (id) {
		var c = 0, that = this;
		(function walk(x) { if (!x) { return; } c += 1; that.ports(x).forEach(function (p) { walk(that.nodes[x].next[p]); }); }(id));
		return c;
	};
	Flow.prototype.sideBranchSize = function (id) {
		var that = this, ports = this.ports(id);
		return ports.slice(1).reduce(function (s, p) { return s + that.subtreeSize(that.nodes[id].next[p]); }, 0);
	};
	Flow.prototype.remove = function (id) {
		if (!this.removable(id)) { return false; }
		var n = this.nodes[id], par = this.parentOf(id), ports = this.ports(id), that = this;
		ports.slice(1).forEach(function (p) {
			(function drop(x) { if (!x) { return; } that.ports(x).forEach(function (q) { drop(that.nodes[x].next[q]); }); delete that.nodes[x]; }(n.next[p]));
		});
		this.nodes[par.id].next[par.port] = n.next[ports[0]];
		delete this.nodes[id];
		return true;
	};

	/*
	 * Lane layout: columns by depth, rows ("lanes") by branch. The main path stays on its parent's lane; every
	 * other branch takes the nearest lane below that is free for all the columns its subtree needs, so branches
	 * never overlap. size(node) → {w, h}. Positions are LTR; the canvas mirrors x for RTL.
	 */
	Flow.prototype.layout = function (size, opt) {
		opt = opt || {};
		var gapX = opt.gapX || 80, gapY = opt.gapY || 36, that = this, colW = [], depthOf = {}, maxDepth = {}, laneOf = {}, used = {};
		(function d(id, depth) {
			depthOf[id] = depth; colW[depth] = Math.max(colW[depth] || 0, size(that.nodes[id]).w);
			var m = depth;
			that.ports(id).forEach(function (p) { var c = that.nodes[id].next[p]; if (c) { m = Math.max(m, d(c, depth + 1)); } });
			maxDepth[id] = m;
			return m;
		}(this.root, 0));
		var free = function (lane, from, to) { for (var i = from; i <= to; i++) { if (used[lane + ":" + i]) { return false; } } return true; };
		(function place(id, lane) {
			laneOf[id] = lane; used[lane + ":" + depthOf[id]] = true;
			that.ports(id).forEach(function (p, i) {
				var c = that.nodes[id].next[p]; if (!c) { return; }
				if (i === 0) { place(c, lane); return; }
				var l = lane + 1;
				while (!free(l, depthOf[c], maxDepth[c])) { l += 1; }
				place(c, l);
			});
		}(this.root, 0));
		var laneH = [];
		Object.keys(laneOf).forEach(function (id) { var l = laneOf[id]; laneH[l] = Math.max(laneH[l] || 0, size(that.nodes[id]).h); });
		var laneY = [], y = 0;
		for (var l = 0; l < laneH.length; l++) { laneY[l] = y; y += (laneH[l] || 0) + (laneH[l] ? gapY : 0); }
		var colX = [0];
		for (var i = 1; i < colW.length; i++) { colX[i] = colX[i - 1] + colW[i - 1] + gapX; }
		var pos = {}, maxX = 0, maxY = 0;
		Object.keys(laneOf).forEach(function (id) {
			var s = size(that.nodes[id]), dpt = depthOf[id], l = laneOf[id];
			// Centre each node on its lane's mid-line so straight connections stay straight.
			pos[id] = { x: colX[dpt] + (colW[dpt] - s.w) / 2, y: laneY[l] + (laneH[l] - s.h) / 2, w: s.w, h: s.h, lane: l };
			maxX = Math.max(maxX, pos[id].x + s.w); maxY = Math.max(maxY, pos[id].y + s.h);
		});
		var edges = [];
		Object.keys(this.nodes).forEach(function (k) {
			var n = that.nodes[k];
			that.ports(k).forEach(function (p, i) { if (n.next[p]) { edges.push({ from: k, port: p, index: i, to: n.next[p] }); } });
		});
		return { pos: pos, edges: edges, width: maxX, height: maxY };
	};

	/* ---------- BPMN 2.0 compile (what Flowable receives; Repo.io settings stay as repoio:* attributes) ---------- */

	var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };

	Flow.prototype.toBpmn = function (meta, label) {
		var that = this, els = [], flows = [], fseq = 0;
		var attrs = function (o) {
			return Object.keys(o || {}).filter(function (k) { return o[k] !== "" && o[k] != null && typeof o[k] !== "object"; })
				.map(function (k) { return " repoio:" + k + "=\"" + esc(o[k]) + "\""; }).join("");
		};
		var flow = function (a, b, name, cond) {
			fseq += 1;
			var id = "Flow_" + fseq;
			flows.push("    <bpmn:sequenceFlow id=\"" + id + "\" sourceRef=\"" + a + "\" targetRef=\"" + b + "\"" + (name ? " name=\"" + esc(name) + "\"" : "") +
				(cond ? ">\n      <bpmn:conditionExpression xsi:type=\"bpmn:tFormalExpression\">" + esc(cond) + "</bpmn:conditionExpression>\n    </bpmn:sequenceFlow>" : " />"));
		};
		var json = function (o) { return o === undefined ? "" : esc(JSON.stringify(o)); };
		(function emit(id, from, fromName, cond) {
			var n = that.nodes[id], p = n.props || {}, nm = esc(n.name || label(n)), next = n.next, gw;
			switch (n.type) {
			case "begin":
				els.push("    <bpmn:startEvent id=\"" + id + "\" name=\"" + nm + "\" />"); break;
			case "template":
				// The template binds the workflow; no runtime step of its own.
				els.push("    <bpmn:serviceTask id=\"" + id + "\" name=\"" + nm + "\" repoio:taskType=\"loadRequest\"" + attrs({ template: p.template }) + " />"); break;
			case "approval":
				els.push("    <bpmn:userTask id=\"" + id + "\" name=\"" + nm + "\" repoio:taskType=\"approval\"" +
					attrs({ approverType: p.approverType, approvers: (p.approvers || []).join(","), approverTeam: p.approverTeam, rule: p.rule, sla: p.sla, escalateTo: p.escalateTo }) + " />");
				break;
			case "notification":
				els.push("    <bpmn:sendTask id=\"" + id + "\" name=\"" + nm + "\" repoio:taskType=\"notification\"" +
					attrs({ channels: (p.channels || []).join(","), recipients: (p.recipients || []).join(","), subject: p.subject }) + " repoio:message=\"" + esc(p.message) + "\" />"); break;
			case "script":
				// A service task that calls the isolated worker API: the engine never runs the code itself.
				els.push("    <bpmn:serviceTask id=\"" + id + "\" name=\"" + nm + "\" repoio:taskType=\"script\"" + attrs({ language: p.language, timeoutMin: p.timeoutMin }) +
					" repoio:code=\"" + esc(p.code) + "\" />"); break;
			case "validation":
				els.push("    <bpmn:serviceTask id=\"" + id + "\" name=\"" + nm + "\" repoio:taskType=\"validation\"" +
					attrs({ rule: p.rule, fields: (p.fields || []).join(","), source: p.source, threshold: p.threshold, severity: p.severity }) + " />"); break;
			case "writeBack":
				els.push("    <bpmn:serviceTask id=\"" + id + "\" name=\"" + nm + "\" repoio:taskType=\"writeBack\"" +
					attrs({ connection: p.connection, entity: p.entity, conflict: p.conflict, retries: p.retries }) + " repoio:mapping=\"" + json(p.mapping) + "\" />"); break;
			case "condition":
				els.push("    <bpmn:exclusiveGateway id=\"" + id + "\" name=\"" + nm + "\" />"); break;
			case "end":
				els.push("    <bpmn:endEvent id=\"" + id + "\" name=\"" + nm + "\"" + attrs({ outcome: p.outcome }) + " />"); break;
			}
			if (from) { flow(from, id, fromName, cond); }
			var ports = PORTS[n.type];
			if (n.type === "approval" || n.type === "validation") {
				// Two outcomes become an exclusive gateway on the task's result.
				gw = id + "_gw";
				els.push("    <bpmn:exclusiveGateway id=\"" + gw + "\" />");
				flow(id, gw);
				var v = n.type === "approval" ? "decision" : "validation";
				emit(next[ports[0]], gw, label({ type: "port", port: ports[0] }), "${" + v + " == '" + ports[0] + "'}");
				emit(next[ports[1]], gw, label({ type: "port", port: ports[1] }), "${" + v + " == '" + ports[1] + "'}");
			} else if (n.type === "condition") {
				var expr = "${" + (p.field ? "record." + p.field : "true") + " " + ({ eq: "==", ne: "!=", gt: ">", lt: "<" }[p.op] || "==") + " '" + (p.value || "") + "'}";
				if (p.op === "empty") { expr = "${empty record." + p.field + "}"; }
				if (p.op === "notEmpty") { expr = "${not empty record." + p.field + "}"; }
				emit(next.yes, id, label({ type: "port", port: "yes" }), expr);
				emit(next.no, id, label({ type: "port", port: "no" }), "${!(" + expr.slice(2, -1) + ")}");
			} else {
				ports.forEach(function (port) { if (next[port]) { emit(next[port], id); } });
			}
		}(this.root));
		return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
			"<bpmn:definitions xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n" +
			"  xmlns:repoio=\"urn:repoio:bpmn\" id=\"Definitions_" + esc(meta.tech) + "\" targetNamespace=\"urn:repoio:workflows\">\n" +
			"  <bpmn:process id=\"" + esc(meta.tech) + "\" name=\"" + esc(meta.name) + "\" isExecutable=\"true\" repoio:domain=\"" + esc(meta.domain) +
			"\" repoio:version=\"" + esc(meta.version) + "\" repoio:designer=\"repoio-flow\">\n" +
			els.join("\n") + "\n" + flows.join("\n") + "\n  </bpmn:process>\n</bpmn:definitions>\n";
	};

	return Flow;
});
