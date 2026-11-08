/*
 * LineageGraph — impact and lineage view in the style of SAP Datasphere:
 * columns of object cards (source → ingestion → table → matching → consumers)
 * joined by soft curved connectors. Pure HTML + inline SVG, follows RTL/LTR from
 * the page direction. Hovering a card highlights its upstream and downstream path.
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/ui/core/ResizeHandler",
	"sap/ui/core/IconPool"
], function (Control, ResizeHandler, IconPool) {
	"use strict";

	var ICONS = { db: "database", pipe: "process", table: "table-view", gold: "badge", chart: "bar-chart" };
	var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); };

	return Control.extend("repoio.proto.control.LineageGraph", {
		metadata: {
			properties: {
				columns: { type: "object" },   // [{ h, nodes: [{ t, i, kv: [[k, v]], st, current }] }]
				edges: { type: "object" },     // [[fromCol, fromNode, toCol, toNode]]
				typeLabels: { type: "object" } // { db: "Source", ... }
			},
			events: { nodeSelect: { parameters: { column: { type: "int" }, node: { type: "int" } } } }
		},

		renderer: {
			apiVersion: 2,
			render: function (oRm, oControl) {
				var cols = oControl.getColumns() || [], types = oControl.getTypeLabels() || {};
				oRm.openStart("div", oControl).class("rlg").attr("role", "group").openEnd();
				oRm.openStart("div").class("rlgCols").openEnd();
				oRm.openStart("svg").class("rlgSvg").attr("aria-hidden", "true").openEnd().close("svg");
				cols.forEach(function (col, ci) {
					oRm.openStart("div").class("rlgCol").openEnd();
					oRm.openStart("div").class("rlgHead").openEnd().text(col.h).close("div");
					col.nodes.forEach(function (n, ni) {
						var icon = IconPool.getIconInfo(ICONS[n.i] || "document") || {};
						oRm.openStart("div").class("rlgNode").class(n.current ? "rlgCurrent" : "")
							.attr("data-node", ci + "-" + ni).attr("tabindex", "0").attr("role", "button")
							.attr("aria-label", col.h + ": " + n.t).openEnd();
						oRm.openStart("span").class("rlgIcon").class("rlgIcon-" + n.i).style("font-family", icon.fontFamily ? "'" + icon.fontFamily + "'" : "SAP-icons").openEnd()
							.text(icon.content || "").close("span");
						oRm.openStart("div").class("rlgBody").openEnd();
						oRm.openStart("div").class("rlgTitle").attr("title", n.t).openEnd().text(n.t).close("div");
						oRm.openStart("div").class("rlgType").openEnd().text(types[n.i] || "").close("div");
						(n.kv || []).forEach(function (kv) {
							oRm.openStart("div").class("rlgKv").openEnd();
							oRm.openStart("span").class("rlgK").openEnd().text(kv[0]).close("span");
							oRm.openStart("span").class("rlgV").openEnd().text(kv[1]).close("span");
							oRm.close("div");
						});
						oRm.close("div");
						if (n.st) { oRm.openStart("span").class("rlgDot").class("rlgDot-" + n.st).openEnd().close("span"); }
						oRm.close("div");
					});
					oRm.close("div");
				});
				oRm.close("div");
				oRm.close("div");
			}
		},

		onAfterRendering: function () {
			var oDom = this.getDomRef();
			if (!oDom) { return; }
			this._draw();
			oDom.querySelectorAll(".rlgNode").forEach(function (el) {
				el.addEventListener("mouseenter", this._highlight.bind(this, el.getAttribute("data-node")));
				el.addEventListener("focus", this._highlight.bind(this, el.getAttribute("data-node")));
				el.addEventListener("mouseleave", this._highlight.bind(this, null));
				el.addEventListener("blur", this._highlight.bind(this, null));
				el.addEventListener("click", function () {
					var p = el.getAttribute("data-node").split("-");
					this.fireNodeSelect({ column: +p[0], node: +p[1] });
				}.bind(this));
			}, this);
			if (!this._resizeId) { this._resizeId = ResizeHandler.register(this, this._draw.bind(this)); }
		},

		_draw: function () {
			var oDom = this.getDomRef(); if (!oDom) { return; }
			var cols = oDom.querySelector(".rlgCols"), svg = oDom.querySelector(".rlgSvg"), box = cols.getBoundingClientRect(),
				rtl = getComputedStyle(oDom).direction === "rtl", parts = [];
			svg.setAttribute("width", box.width); svg.setAttribute("height", box.height);
			var pos = function (id) {
				var el = oDom.querySelector("[data-node='" + id + "']"); if (!el) { return null; }
				var r = el.getBoundingClientRect();
				return { l: r.left - box.left, r: r.right - box.left, cx: r.left - box.left + r.width / 2, t: r.top - box.top, b: r.bottom - box.top, y: r.top - box.top + r.height / 2 };
			};
			parts.push("<defs><marker id='rlgArrow' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='7' markerHeight='7' orient='auto-start-reverse'><path d='M0,0 L10,5 L0,10 z' fill='#a9b4be'/></marker>" +
				"<marker id='rlgArrowOn' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='7' markerHeight='7' orient='auto-start-reverse'><path d='M0,0 L10,5 L0,10 z' fill='#0a6ed1'/></marker></defs>");
			(this.getEdges() || []).forEach(function (e) {
				var a = pos(e[0] + "-" + e[1]), b = pos(e[2] + "-" + e[3]); if (!a || !b) { return; }
				var d;
				if (e[0] === e[2]) { // same column: short vertical connector between the two cards
					var up = b.b < a.t, y1 = up ? a.t : a.b, y2 = up ? b.b + 2 : b.t - 2;
					d = "M" + a.cx + "," + y1 + " L" + b.cx + "," + y2;
				} else {
					var x1 = rtl ? a.l : a.r, x2 = rtl ? b.r : b.l, dx = (x2 - x1) * 0.5;
					d = "M" + x1 + "," + a.y + " C" + (x1 + dx) + "," + a.y + " " + (x2 - dx) + "," + b.y + " " + (x2 - (rtl ? -2 : 2)) + "," + b.y;
				}
				parts.push("<path class='rlgEdge' data-from='" + e[0] + "-" + e[1] + "' data-to='" + e[2] + "-" + e[3] + "' d='" + d + "' marker-end='url(#rlgArrow)'/>");
			});
			svg.innerHTML = parts.join("");
		},

		/* Highlight every node and edge connected (up- and downstream) to the hovered node. */
		_highlight: function (id) {
			var oDom = this.getDomRef(); if (!oDom) { return; }
			oDom.classList.toggle("rlgFocus", !!id);
			oDom.querySelectorAll(".rlgOn").forEach(function (x) { x.classList.remove("rlgOn"); });
			if (!id) { return; }
			var edges = this.getEdges() || [], seen = {}, walk = function (nid, dir) {
				edges.forEach(function (e) {
					var f = e[0] + "-" + e[1], t = e[2] + "-" + e[3], next = dir > 0 ? (f === nid ? t : null) : (t === nid ? f : null);
					if (next) {
						var p = oDom.querySelector(".rlgEdge[data-from='" + f + "'][data-to='" + t + "']");
						if (p) { p.classList.add("rlgOn"); p.setAttribute("marker-end", "url(#rlgArrowOn)"); }
						if (!seen[next + dir]) { seen[next + dir] = true; walk(next, dir); }
					}
				});
			};
			walk(id, 1); walk(id, -1);
			oDom.querySelectorAll(".rlgEdge").forEach(function (p) { if (!p.classList.contains("rlgOn")) { p.setAttribute("marker-end", "url(#rlgArrow)"); } });
			var on = {}; on[id] = true;
			oDom.querySelectorAll(".rlgEdge.rlgOn").forEach(function (p) { on[p.getAttribute("data-from")] = on[p.getAttribute("data-to")] = true; });
			Object.keys(on).forEach(function (k) { var el = oDom.querySelector("[data-node='" + k + "']"); if (el) { el.classList.add("rlgOn"); } });
		},

		exit: function () {
			if (this._resizeId) { ResizeHandler.deregister(this._resizeId); this._resizeId = null; }
		}
	});
});
