/*
 * FlowCanvas — the Repo.io flow designer canvas (ADR-0002). Pure OpenUI5 control: HTML cards for nodes,
 * one SVG layer for the connectors, "+" handles on every connector to insert a step, pan and zoom.
 *
 * The control draws what the controller gives it (`model`: nodes with positions and card content,
 * edges with ports). It owns no workflow rules; the flow model and validation live in util/flowModel.js
 * and the controller. Layout is computed left-to-right and mirrored here for RTL.
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/ui/core/IconPool",
	"sap/ui/core/ResizeHandler"
], function (Control, IconPool, ResizeHandler) {
	"use strict";

	var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
	var PAD = 48;

	var icon = function (src) {
		var i = IconPool.getIconInfo(src);
		return i ? "<span class=\"rfGlyph\" aria-hidden=\"true\" style=\"font-family:'" + esc(i.fontFamily) + "'\">" + esc(i.content) + "</span>" : "";
	};

	return Control.extend("repoio.proto.control.FlowCanvas", {
		metadata: {
			properties: {
				/* { nodes: [{ id, type, x, y, w, h, title, subtitle, icon, lines:[{k,v}], code, issues, outcome, selected }],
				     edges: [{ from, to, port, index, label, negative }], width, height } */
				flow: { type: "object" },
				rtl: { type: "boolean", defaultValue: false },
				readOnly: { type: "boolean", defaultValue: false },
				zoomText: { type: "string", defaultValue: "" },
				ariaLabel: { type: "string", defaultValue: "" },
				insertLabel: { type: "string", defaultValue: "Add step" },
				zoomInLabel: { type: "string", defaultValue: "Zoom in" },
				zoomOutLabel: { type: "string", defaultValue: "Zoom out" },
				fitLabel: { type: "string", defaultValue: "Fit" }
			},
			events: {
				select: { parameters: { id: { type: "string" } } },
				insert: { parameters: { from: { type: "string" }, port: { type: "string" }, domRef: { type: "object" } } },
				remove: { parameters: { id: { type: "string" } } }
			}
		},

		init: function () { this._z = 1; this._tx = 0; this._ty = 0; this._fitNext = true; },

		renderer: {
			apiVersion: 2,
			render: function (oRm, c) {
				oRm.openStart("div", c);
				oRm.class("repoioFlow");
				if (c.getReadOnly()) { oRm.class("rfRO"); }
				oRm.attr("role", "application");
				oRm.attr("aria-label", c.getAriaLabel());
				oRm.openEnd();
				oRm.openStart("div", c.getId() + "-stage").class("rfStage").attr("dir", "ltr").openEnd();
				oRm.unsafeHtml(c._html());
				oRm.close("div");
				// Zoom bar (like the reference: bottom corner)
				oRm.openStart("div").class("rfZoom").attr("dir", "ltr").openEnd();
				oRm.unsafeHtml("<button type=\"button\" class=\"rfZBtn\" data-act=\"out\" title=\"" + esc(c.getZoomOutLabel()) + "\">" + icon("sap-icon://less") + "</button>" +
					"<span class=\"rfZPct\" id=\"" + c.getId() + "-pct\">100%</span>" +
					"<button type=\"button\" class=\"rfZBtn\" data-act=\"in\" title=\"" + esc(c.getZoomInLabel()) + "\">" + icon("sap-icon://add") + "</button>" +
					"<span class=\"rfZSep\"></span>" +
					"<button type=\"button\" class=\"rfZBtn\" data-act=\"fit\" title=\"" + esc(c.getFitLabel()) + "\">" + icon("sap-icon://popup-window") + "</button>");
				oRm.close("div");
				oRm.unsafeHtml(c._mini());
				oRm.close("div");
			}
		},

		/* Minimap: the whole flow in miniature, with the visible area; click to jump there. */
		_mini: function () {
			var m = this.getFlow(); if (!m || !m.nodes.length) { return ""; }
			var g = this._geo(), W = m.width + PAD * 2, H = m.height + PAD * 2, s = Math.min(168 / W, 96 / H);
			this._miniScale = s;
			var rects = m.nodes.map(function (n0) {
				var n = g.byId[n0.id];
				return "<rect x=\"" + n.x * s + "\" y=\"" + n.y * s + "\" width=\"" + Math.max(2, n.w * s) + "\" height=\"" + Math.max(2, n.h * s) + "\" rx=\"1.5\" class=\"rfMiniN" +
					(n.run === "on" || n.run === "fail" || n.run === "stop" ? " rfMiniRun" : "") + (n.issues ? " rfMiniBad" : "") + "\" />";
			}).join("");
			return "<div class=\"rfMini\" dir=\"ltr\" style=\"width:" + Math.ceil(W * s) + "px;height:" + Math.ceil(H * s) + "px\" title=\"" + esc(this.getFitLabel()) + "\">" +
				"<svg width=\"" + Math.ceil(W * s) + "\" height=\"" + Math.ceil(H * s) + "\">" + rects + "<rect class=\"rfMiniView\" x=\"0\" y=\"0\" width=\"0\" height=\"0\" /></svg></div>";
		},

		/* Positions in LTR space; mirrored for RTL so the flow reads right-to-left in Arabic. */
		_geo: function () {
			var m = this.getFlow() || { nodes: [], edges: [], width: 0, height: 0 }, rtl = this.getRtl(), byId = {};
			m.nodes.forEach(function (n) {
				byId[n.id] = Object.assign({}, n, { x: (rtl ? m.width - n.x - n.w : n.x) + PAD, y: n.y + PAD });
			});
			return { m: m, byId: byId, rtl: rtl };
		},

		_html: function () {
			var g = this._geo(), m = g.m, byId = g.byId, rtl = g.rtl, ro = this.getReadOnly(), that = this;
			var W = m.width + PAD * 2, H = m.height + PAD * 2, svg = [], plus = [], labels = [];
			m.edges.forEach(function (e) {
				var a = byId[e.from], b = byId[e.to];
				if (!a || !b) { return; }
				var x1 = rtl ? a.x : a.x + a.w, y1 = a.y + a.h / 2, x2 = rtl ? b.x + b.w : b.x, y2 = b.y + b.h / 2;
				var dx = (x2 - x1) / 2;
				var ec = (e.negative ? " rfNeg" : "") + (m.overlay === "run" ? (e.run ? " rfOnPath" : " rfOffPath") : "");
				svg.push("<path class=\"rfEdge" + ec + "\" d=\"M" + x1 + " " + y1 + " C" + (x1 + dx) + " " + y1 + " " + (x2 - dx) + " " + y2 + " " + x2 + " " + y2 + "\" />");
				svg.push("<path class=\"rfArrow" + ec + "\" d=\"M" + x2 + " " + y2 + " l" + (rtl ? 7 : -7) + " -4 l0 8 z\" />");
				var px = x2 + (rtl ? 30 : -30), py = y2;
				if (e.label) {
					// Branch label sits on the vertical part of the curve, or near the start of a straight line.
					var lx = x1 + (rtl ? -1 : 1) * Math.max(24, Math.abs(dx) * 0.55), ly = y1 === y2 ? y1 - 15 : (y1 + y2) / 2;
					labels.push("<span class=\"rfPort" + (e.negative ? " rfNeg" : "") + "\" style=\"left:" + lx + "px;top:" + ly + "px\">" + esc(e.label) + "</span>");
				}
				if (!ro && !m.overlay) {
					plus.push("<button type=\"button\" class=\"rfPlus\" data-from=\"" + esc(e.from) + "\" data-port=\"" + esc(e.port) + "\" style=\"left:" + px + "px;top:" + py + "px\"" +
						" title=\"" + esc(that.getInsertLabel()) + "\" aria-label=\"" + esc(that.getInsertLabel()) + "\">" + icon("sap-icon://add") + "</button>");
				}
			});
			var cards = m.nodes.map(function (n0) {
				var n = byId[n0.id], cls = "rfNode rfT-" + n.type + (n.selected ? " rfSel" : "") + (n.issues && !m.overlay ? " rfBad" : "") + (n.outcome ? " rfO-" + n.outcome : "") +
					(n.run ? " rfRun-" + n.run : "") + (n.diff ? " rfDiff-" + n.diff : "");
				// Overlay tag (test run step result, "new" / "changed", run statistics) sits above the card.
				var tag = n.tag ? "<span class=\"rfTag rfTag-" + esc(n.tagKind || "info") + "\">" + esc(n.tag) + "</span>" : "";
				var stats = n.stats ? "<div class=\"rfStats\">" + n.stats.map(function (st) {
					return "<span class=\"rfStat" + (st.bad ? " rfStatBad" : "") + "\" title=\"" + esc(st.title || "") + "\">" + (st.icon ? icon(st.icon) : "") + esc(st.text) + "</span>";
				}).join("") + "</div>" : "";
				var st = "left:" + n.x + "px;top:" + n.y + "px;width:" + n.w + "px;height:" + n.h + "px";
				var aria = esc(n.title + (n.subtitle ? ", " + n.subtitle : "") + (n.issues ? ", " + n.issues : ""));
				if (n.type === "end" || (n.type === "begin" && !n.lines)) {
					return "<div class=\"" + cls + " rfPill\" style=\"" + st + "\" data-id=\"" + esc(n.id) + "\" tabindex=\"0\" role=\"button\" aria-label=\"" + aria + "\">" + tag +
						icon(n.icon) + "<span class=\"rfPillText\">" + esc(n.title) + "</span>" + (n.issues && !m.overlay ? "<span class=\"rfWarn\" title=\"" + esc(n.issues) + "\">!</span>" : "") + stats + "</div>";
				}
				var body = (n.lines || []).map(function (l) {
					return "<div class=\"rfLine\"><span class=\"rfK\">" + esc(l.k) + "</span><span class=\"rfV\">" + esc(l.v) + "</span></div>";
				}).join("");
				if (n.code) { body += "<pre class=\"rfCode\" dir=\"ltr\">" + esc(n.code) + "</pre>"; }
				if (n.note) { body += "<div class=\"rfNote\">" + esc(n.note) + "</div>"; }
				if (n.badges && n.badges.length) { body += "<div class=\"rfBadges\">" + n.badges.map(function (b) { return "<span class=\"rfBadge\">" + esc(b) + "</span>"; }).join("") + "</div>"; }
				return "<div class=\"" + cls + " rfCard\" style=\"" + st + "\" data-id=\"" + esc(n.id) + "\" tabindex=\"0\" role=\"button\" aria-label=\"" + aria + "\">" + tag + stats +
					(n.eyebrow ? "<div class=\"rfEyebrow\">" + icon("sap-icon://flag") + esc(n.eyebrow) + "</div>" : "") +
					"<div class=\"rfHead\"><span class=\"rfIcon\">" + icon(n.icon) + "</span><div class=\"rfTitles\"><div class=\"rfTitle\">" + esc(n.title) + "</div>" +
					(n.subtitle ? "<div class=\"rfSub\">" + esc(n.subtitle) + "</div>" : "") + "</div>" +
					(m.overlay ? "" : n.issues ? "<span class=\"rfWarn\" title=\"" + esc(n.issues) + "\">!</span>" : "<span class=\"rfOk\" title=\"OK\">" + icon("sap-icon://accept") + "</span>") +
					"</div><div class=\"rfBody\">" + body + "</div></div>";
			}).join("");
			return "<svg class=\"rfSvg\" width=\"" + W + "\" height=\"" + H + "\" aria-hidden=\"true\">" + svg.join("") + "</svg>" + labels.join("") + cards + plus.join("");
		},

		onAfterRendering: function () {
			var d = this.getDomRef(), that = this;
			if (!d) { return; }
			this._stage = d.querySelector(".rfStage");
			this._apply();
			if (this._fitNext) { this._fitNext = false; setTimeout(function () { that.fit(); }, 30); }
			if (this._boundEl !== d) { // bind once per DOM element (re-rendering may replace it)
				this._boundEl = d;
				d.addEventListener("click", this._onClick.bind(this));
				d.addEventListener("keydown", this._onKey.bind(this));
				d.addEventListener("pointerdown", this._onDown.bind(this));
				d.addEventListener("wheel", this._onWheel.bind(this), { passive: false });
			}
			if (!this._rh) { this._rh = ResizeHandler.register(this, function () { if (that._autoFit) { that.fit(); } }); }
		},

		_onClick: function (e) {
			if (this._dragged) { this._dragged = false; return; }
			var t = e.target, z = t.closest(".rfZBtn"), p = t.closest(".rfPlus"), n = t.closest(".rfNode"), mini = t.closest(".rfMini");
			if (mini) {
				// Centre the canvas on the clicked point of the minimap.
				var r = mini.getBoundingClientRect(), d = this.getDomRef(), s = this._miniScale || 1;
				var x = (e.clientX - r.left) / s, y = (e.clientY - r.top) / s;
				this._tx = d.clientWidth / 2 - x * this._z; this._ty = d.clientHeight / 2 - y * this._z; this._autoFit = false; this._apply();
				return;
			}
			if (z) { var a = z.getAttribute("data-act"); if (a === "in") { this.zoomBy(1.2); } else if (a === "out") { this.zoomBy(1 / 1.2); } else { this.fit(); } return; }
			if (p) { this.fireInsert({ from: p.getAttribute("data-from"), port: p.getAttribute("data-port"), domRef: p }); return; }
			this.fireSelect({ id: n ? n.getAttribute("data-id") : "" });
		},
		_onKey: function (e) {
			var n = e.target.closest && e.target.closest(".rfNode");
			if (!n) { return; }
			if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.fireSelect({ id: n.getAttribute("data-id") }); }
			if ((e.key === "Delete" || e.key === "Backspace") && !this.getReadOnly()) { e.preventDefault(); this.fireRemove({ id: n.getAttribute("data-id") }); }
		},
		/* Pan by dragging the background. */
		_onDown: function (e) {
			if (e.button !== 0 || e.target.closest(".rfNode, .rfPlus, .rfZoom, .rfMini")) { return; }
			var sx = e.clientX, sy = e.clientY, tx = this._tx, ty = this._ty, that = this, moved = false;
			var mv = function (ev) {
				if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) { moved = true; }
				that._tx = tx + ev.clientX - sx; that._ty = ty + ev.clientY - sy; that._autoFit = false; that._apply();
			};
			var up = function () { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); that._dragged = moved; };
			window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
		},
		/* Wheel pans; Ctrl/⌘ + wheel zooms at the pointer. */
		_onWheel: function (e) {
			e.preventDefault();
			this._autoFit = false;
			if (e.ctrlKey || e.metaKey) {
				var r = this.getDomRef().getBoundingClientRect();
				this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
			} else { this._tx -= e.deltaX; this._ty -= e.deltaY; this._apply(); }
		},

		zoomBy: function (f, cx, cy) {
			var d = this.getDomRef(); if (!d) { return; }
			cx = cx == null ? d.clientWidth / 2 : cx; cy = cy == null ? d.clientHeight / 2 : cy;
			var z = Math.max(0.3, Math.min(2, this._z * f));
			this._tx = cx - (cx - this._tx) * z / this._z; this._ty = cy - (cy - this._ty) * z / this._z; this._z = z;
			this._autoFit = false; this._apply();
		},
		fit: function () {
			var d = this.getDomRef(), m = this.getFlow(); if (!d || !m) { return; }
			var W = m.width + PAD * 2, H = m.height + PAD * 2, cw = d.clientWidth, ch = d.clientHeight - 40;
			if (!cw || !ch) { return; }
			// Fit when it fits; otherwise stay readable and start from Begin (left in LTR, right in RTL).
			this._z = Math.max(0.72, Math.min(1, cw / W, ch / H));
			var over = W * this._z > cw;
			this._tx = !over ? (cw - W * this._z) / 2 : (this.getRtl() ? cw - W * this._z : 0);
			this._ty = Math.max(0, (ch - H * this._z) / 2);
			this._autoFit = true; this._apply();
		},
		/* Keep a node in view (after inserting it). */
		reveal: function (id) {
			var d = this.getDomRef(), g = this._geo(), n = g.byId[id]; if (!d || !n) { return; }
			var x = n.x * this._z + this._tx, y = n.y * this._z + this._ty, w = n.w * this._z, h = n.h * this._z;
			if (x < 16) { this._tx += 16 - x; } else if (x + w > d.clientWidth - 16) { this._tx -= x + w - d.clientWidth + 16; }
			if (y < 16) { this._ty += 16 - y; } else if (y + h > d.clientHeight - 56) { this._ty -= y + h - d.clientHeight + 56; }
			this._apply();
		},
		focusNode: function (id) {
			var d = this.getDomRef(), el = d && d.querySelector(".rfNode[data-id=\"" + id + "\"]");
			if (el) { el.focus({ preventScroll: true }); }
		},
		_apply: function () {
			if (this._stage) { this._stage.style.transform = "translate(" + this._tx + "px," + this._ty + "px) scale(" + this._z + ")"; }
			var d = this.getDomRef(), p = d && d.querySelector(".rfZPct");
			if (p) { p.textContent = Math.round(this._z * 100) + "%"; }
			var v = d && d.querySelector(".rfMiniView"), s = this._miniScale;
			if (v && s) {
				v.setAttribute("x", Math.max(0, -this._tx / this._z * s)); v.setAttribute("y", Math.max(0, -this._ty / this._z * s));
				v.setAttribute("width", d.clientWidth / this._z * s); v.setAttribute("height", d.clientHeight / this._z * s);
			}
		},

		exit: function () { if (this._rh) { ResizeHandler.deregister(this._rh); this._rh = null; } }
	});
});
