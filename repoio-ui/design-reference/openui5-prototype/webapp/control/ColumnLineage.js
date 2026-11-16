/*
 * ColumnLineage — column-level lineage graph (J2): one card per table, view, file, topic or consumer, with its columns;
 * small step nodes (ingest, standardise, match) between them; curved connectors at table level, and the full path of a
 * selected column highlighted from source to consumers. Cards collapse to the columns on the selected path; the home
 * card lists every column with "Find column" and pages. Pan by dragging, zoom with Ctrl + wheel or the buttons, a
 * minimap in the corner, and "<" / ">" to show more levels. Mirrors for RTL. Plain DOM + SVG, no third-party library;
 * the control owns no lineage rules: nodes and edges come from the catalog API (here: sample data).
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/ui/core/IconPool"
], function (Control, IconPool) {
	"use strict";

	var CARD_W = 300, STEP_W = 44, GAP_X = 64, GAP_Y = 22, PAGE = 10, PAD = 40,
		ICON = { table: "table-view", view: "show", file: "excel-attachment", topic: "message-popup", writeBack: "upload-to-cloud",
			writeback: "upload-to-cloud", report: "bar-chart", api: "chain-link", step: "process" },
		SYS_ICON = { c4c: "customer", s4: "factory", csv: "excel-attachment", iceberg: "database", trino: "sys-find", kafka: "message-popup",
			powerbi: "bar-chart", repoio: "business-objects-experience", mcp: "chain-link" },
		STEP_ICON = { ingest: "download", standardise: "edit", match: "combine" };

	function esc(s) { return String(s === undefined || s === null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
	function icon(name, cls) {
		var i = IconPool.getIconInfo("sap-icon://" + name);
		return "<span class=\"repoioLinIco " + (cls || "") + "\" aria-hidden=\"true\">" + (i ? i.content : "") + "</span>";
	}

	return Control.extend("repoio.proto.control.ColumnLineage", {
		metadata: {
			properties: {
				nodes: { type: "object", defaultValue: [] },
				edges: { type: "object", defaultValue: [] },
				/* { nodeKey: { column: value } } — a golden record's own values, shown under the column names */
				values: { type: "object", defaultValue: null },
				/* { node, col } — the column whose path is highlighted */
				selected: { type: "object", defaultValue: null },
				texts: { type: "object", defaultValue: {} },
				height: { type: "sap.ui.core.CSSSize", defaultValue: "36rem" },
				upLevels: { type: "int", defaultValue: 2 },
				downLevels: { type: "int", defaultValue: 1 }
			},
			events: {
				select: { parameters: { node: { type: "string" }, col: { type: "string" } } },
				nodePress: { parameters: { node: { type: "string" } } }
			}
		},

		init: function () {
			this._expanded = {};
			this._page = {};
			this._find = {};
			this._view = null; // { x, y, k }
		},

		/* ---------- state helpers ---------- */
		_t: function (k) { return (this.getTexts() || {})[k] || k; },
		_rtl: function () { return sap.ui.getCore().getConfiguration().getRTL(); },
		_node: function (k) { return this.getNodes().filter(function (n) { return n.key === k; })[0]; },
		_home: function () { return this.getNodes().filter(function (n) { return n.home; })[0] || this.getNodes()[0]; },
		_isExpanded: function (n) { return this._expanded[n.key] !== undefined ? this._expanded[n.key] : !!n.home; },
		_visible: function () {
			var up = -this.getUpLevels(), down = this.getDownLevels();
			return this.getNodes().filter(function (n) { return n.level >= up - 0.5 && n.level <= down; });
		},
		_hiddenSide: function (side) {
			var lv = this.getNodes().map(function (n) { return n.level; });
			return side < 0 ? Math.min.apply(null, lv) < -this.getUpLevels() - 0.5 : Math.max.apply(null, lv) > this.getDownLevels();
		},
		/* Every column on the path of the selected column: upstream and downstream, through any number of hops. */
		_path: function () {
			var sel = this.getSelected(), E = this.getEdges(), cols = {}, edges = [];
			if (!sel) { return { cols: cols, edges: edges }; }
			var id = function (n, c) { return n + "\u0001" + c; }, walk = function (start, dir) {
				var q = [start], seen = {};
				seen[start] = true;
				while (q.length) {
					var cur = q.shift();
					E.forEach(function (e, i) {
						var a = id(e.from[0], e.from[1]), b = id(e.to[0], e.to[1]), from = dir > 0 ? a : b, to = dir > 0 ? b : a;
						if (from === cur) { edges[i] = true; if (!seen[to]) { seen[to] = true; q.push(to); } }
					});
				}
				return seen;
			};
			var s = id(sel.node, sel.col);
			[walk(s, 1), walk(s, -1)].forEach(function (m) { Object.keys(m).forEach(function (k) { cols[k] = true; }); });
			return { cols: cols, edges: edges, id: id };
		},

		/* ---------- rendering ---------- */
		renderer: {
			apiVersion: 2,
			render: function (rm, c) {
				var rtl = c._rtl(), P = c._path(), T = c._t.bind(c), vals = c.getValues() || {};
				rm.openStart("div", c).class("repoioLin").style("height", c.getHeight()).attr("dir", rtl ? "rtl" : "ltr").openEnd();
				rm.openStart("div").class("repoioLinViewport").attr("tabindex", "-1").openEnd();
				rm.openStart("div").class("repoioLinStage").openEnd();
				rm.unsafeHtml("<svg class=\"repoioLinEdges\" aria-hidden=\"true\"></svg>");
				c._visible().forEach(function (n) {
					var html;
					if (n.type === "step") {
						html = "<div class=\"repoioLinStep\" data-node=\"" + esc(n.key) + "\" title=\"" + esc(T("step." + n.name) + " · " + n.engine) + "\" tabindex=\"0\" role=\"img\" aria-label=\"" +
							esc(T("step." + n.name)) + "\">" + icon(STEP_ICON[n.name] || "process") + "<span class=\"repoioLinStepTxt\">" + esc(T("step." + n.name)) + "</span></div>";
						rm.unsafeHtml(html);
						return;
					}
					var exp = c._isExpanded(n), q = (c._find[n.key] || "").toLowerCase(), all = n.cols.filter(function (x) { return !q || x[0].toLowerCase().indexOf(q) > -1; }),
						pages = Math.max(1, Math.ceil(all.length / PAGE)), pg = Math.min(c._page[n.key] || 1, pages), v = vals[n.key] || {},
						onPath = n.cols.filter(function (x) { return P.cols[P.id ? P.id(n.key, x[0]) : ""]; }),
						shown = exp ? all.slice((pg - 1) * PAGE, pg * PAGE) : onPath,
						sel = c.getSelected();
					html = "<div class=\"repoioLinCard" + (n.home ? " repoioLinHome" : "") + (onPath.length ? " repoioLinOnPath" : "") + "\" data-node=\"" + esc(n.key) + "\">";
					if (n.home) { html += "<span class=\"repoioLinHomeTag\">" + icon("home") + esc(T("home")) + "</span>"; }
					html += "<div class=\"repoioLinHead\">" + icon(SYS_ICON[n.system] || ICON[n.type] || "table-view", "repoioLinSys") +
						"<div class=\"repoioLinHeadTxt\"><div class=\"repoioLinPath\"><span>" + esc(T("type." + n.type)) + "</span><span class=\"repoioLinSep\">|</span><bdi>" +
						n.path.map(esc).join(" <span class=\"repoioLinChev\">›</span> ") + "</bdi></div><div class=\"repoioLinName\"><bdi>" + esc(n.name) + "</bdi></div></div>" +
						(n.dq ? "<span class=\"repoioLinDq repoioLinDq-" + n.dq + "\" title=\"" + esc(T("dq." + n.dq)) + "\">" + icon(n.dq === "ok" ? "message-success" : "message-warning") + "</span>" : "") +
						"<button type=\"button\" class=\"repoioLinBtn\" data-act=\"open\" title=\"" + esc(T("open")) + "\" aria-label=\"" + esc(T("open")) + "\">" + icon("overflow") + "</button></div>";
					html += "<button type=\"button\" class=\"repoioLinColsBar\" data-act=\"toggle\" aria-expanded=\"" + exp + "\"><span>" + esc(T("columns")) +
						"</span><span class=\"repoioLinCount\">" + n.cols.length + "</span><span class=\"repoioLinGrow\"></span>" + icon(exp ? "slim-arrow-up" : "slim-arrow-down") + "</button>";
					if (exp) {
						html += "<div class=\"repoioLinFind\">" + icon("search") + "<input type=\"search\" data-act=\"find\" value=\"" + esc(c._find[n.key] || "") + "\" placeholder=\"" +
							esc(T("find")) + "\" aria-label=\"" + esc(T("find")) + "\"/></div>";
					}
					if (shown.length) {
						html += "<div class=\"repoioLinCols\">";
						shown.forEach(function (x) {
							var on = P.cols[P.id ? P.id(n.key, x[0]) : ""], isSel = sel && sel.node === n.key && sel.col === x[0],
								val = v[x[0]];
							html += "<div class=\"repoioLinCol" + (on ? " repoioLinColOn" : "") + (isSel ? " repoioLinColSel" : "") + "\" data-col=\"" + esc(x[0]) +
								"\" role=\"button\" tabindex=\"0\" aria-pressed=\"" + !!isSel + "\">" +
								"<span class=\"repoioLinKind\">" + ({ number: "#", date: "◷", bool: "◐", array: "[ ]", code: "≡" }[x[1]] || "A") + "</span>" +
								"<span class=\"repoioLinColName\"><bdi>" + esc(x[0]) + "</bdi>" + (val ? "<span class=\"repoioLinVal\"><bdi>" + esc(val) + "</bdi></span>" : "") + "</span>" +
								icon("action", "repoioLinColGo") + "</div>";
						});
						html += "</div>";
					} else if (exp) {
						html += "<div class=\"repoioLinEmpty\">" + esc(T("noColumns")) + "</div>";
					}
					if (exp && pages > 1) {
						html += "<div class=\"repoioLinPager\"><button type=\"button\" class=\"repoioLinBtn\" data-act=\"page\" data-page=\"" + (pg - 1) + "\"" + (pg <= 1 ? " disabled" : "") +
							" aria-label=\"" + esc(T("prev")) + "\">" + icon(rtl ? "navigation-right-arrow" : "navigation-left-arrow") + "</button>";
						for (var i = 1; i <= pages; i++) {
							html += "<button type=\"button\" class=\"repoioLinPg" + (i === pg ? " repoioLinPgOn" : "") + "\" data-act=\"page\" data-page=\"" + i + "\">" + i + "</button>";
						}
						html += "<button type=\"button\" class=\"repoioLinBtn\" data-act=\"page\" data-page=\"" + (pg + 1) + "\"" + (pg >= pages ? " disabled" : "") +
							" aria-label=\"" + esc(T("next")) + "\">" + icon(rtl ? "navigation-left-arrow" : "navigation-right-arrow") + "</button></div>";
					}
					html += "</div>";
					rm.unsafeHtml(html);
				});
				if (c._hiddenSide(-1)) { rm.unsafeHtml("<button type=\"button\" class=\"repoioLinMore\" data-act=\"more\" data-side=\"-1\" title=\"" + esc(T("moreUp")) + "\">" + icon(rtl ? "slim-arrow-right" : "slim-arrow-left") + "</button>"); }
				if (c._hiddenSide(1)) { rm.unsafeHtml("<button type=\"button\" class=\"repoioLinMore\" data-act=\"more\" data-side=\"1\" title=\"" + esc(T("moreDown")) + "\">" + icon(rtl ? "slim-arrow-left" : "slim-arrow-right") + "</button>"); }
				rm.close("div"); // stage
				rm.close("div"); // viewport
				rm.unsafeHtml("<div class=\"repoioLinTools\">" +
					"<button type=\"button\" class=\"repoioLinBtn\" data-act=\"zoom\" data-z=\"1.2\" title=\"" + esc(T("zoomIn")) + "\">" + icon("zoom-in") + "</button>" +
					"<button type=\"button\" class=\"repoioLinBtn\" data-act=\"zoom\" data-z=\"0.833\" title=\"" + esc(T("zoomOut")) + "\">" + icon("zoom-out") + "</button>" +
					"<button type=\"button\" class=\"repoioLinBtn\" data-act=\"fit\" title=\"" + esc(T("fit")) + "\">" + icon("full-screen") + "</button>" +
					(c.getSelected() ? "<button type=\"button\" class=\"repoioLinBtn\" data-act=\"clear\" title=\"" + esc(T("clear")) + "\">" + icon("clear-filter") + "</button>" : "") + "</div>");
				rm.unsafeHtml("<div class=\"repoioLinMini\" aria-hidden=\"true\"><svg></svg></div>");
				rm.close("div");
			}
		},

		/* ---------- layout: measure the cards, place them by level, then draw the connectors ---------- */
		onAfterRendering: function () {
			var dom = this.getDomRef();
			if (!dom) { return; }
			if (!this._visible().length) { return; }
			var that = this, rtl = this._rtl(), stage = dom.querySelector(".repoioLinStage"), vis = this._visible(),
				levels = vis.map(function (n) { return n.level; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; }),
				colX = {}, x = PAD, el = {}, H = {};
			vis.forEach(function (n) { el[n.key] = stage.querySelector("[data-node=\"" + n.key + "\"]"); });
			levels.forEach(function (lv) {
				var isStep = vis.some(function (n) { return n.level === lv && n.type === "step"; });
				colX[lv] = { x: x, w: isStep ? STEP_W : CARD_W };
				x += (isStep ? STEP_W : CARD_W) + GAP_X;
			});
			var W = x - GAP_X + PAD, colH = {};
			levels.forEach(function (lv) {
				var ns = vis.filter(function (n) { return n.level === lv; });
				colH[lv] = ns.reduce(function (s, n) { H[n.key] = el[n.key].offsetHeight; return s + H[n.key]; }, 0) + GAP_Y * (ns.length - 1);
			});
			var Hmax = Math.max.apply(null, levels.map(function (lv) { return colH[lv]; })) + PAD * 2 + 30, pos = {};
			levels.forEach(function (lv) {
				var y = (Hmax - colH[lv]) / 2;
				vis.filter(function (n) { return n.level === lv; }).forEach(function (n) {
					var left = rtl ? W - colX[lv].x - colX[lv].w : colX[lv].x;
					pos[n.key] = { x: left, y: y, w: colX[lv].w, h: H[n.key] };
					el[n.key].style.left = left + "px";
					el[n.key].style.top = y + "px";
					y += H[n.key] + GAP_Y;
				});
			});
			stage.style.width = W + "px";
			stage.style.height = Hmax + "px";
			this._pos = pos; this._W = W; this._H = Hmax;
			// "show more levels" buttons at the outer edges
			dom.querySelectorAll(".repoioLinMore").forEach(function (b) {
				var side = Number(b.getAttribute("data-side")), left = (side < 0) !== rtl;
				b.style.top = (Hmax / 2 - 14) + "px";
				b.style.left = left ? "6px" : (W - 34) + "px";
			});
			this._drawEdges(stage.querySelector(".repoioLinEdges"), el);
			this._wire(dom);
			if (!this._view) { this._fit(); } else { this._apply(); }
			if (this._refocus) {
				var inp = stage.querySelector("[data-node=\"" + this._refocus + "\"] input");
				if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
				this._refocus = null;
			}
		},

		_anchor: function (key, col, side, el) {
			var p = this._pos[key], card = el[key], row = col && card && card.querySelector(".repoioLinCol[data-col=\"" + (window.CSS && CSS.escape ? CSS.escape(col) : col) + "\"]"),
				y = row ? p.y + row.offsetTop + row.offsetHeight / 2 : p.y + (card.querySelector(".repoioLinHead") ? 30 : p.h / 2);
			return { x: side > 0 ? p.x + p.w : p.x, y: y };
		},
		_drawEdges: function (svg, el) {
			var that = this, rtl = this._rtl(), P = this._path(), E = this.getEdges(), pos = this._pos, faint = {}, hot = [], out = [];
			svg.setAttribute("width", this._W); svg.setAttribute("height", this._H);
			// table level: one faint curve per pair of visible nodes (through the step between them)
			E.forEach(function (e, i) {
				var a = e.from[0], b = e.to[0];
				if (!pos[a] || !pos[b]) { return; }
				var k = a + ">" + b;
				if (!faint[k]) { faint[k] = { a: a, b: b, via: e.via && pos[e.via] ? e.via : null }; }
				if (P.edges[i]) { hot.push(e); }
			});
			var outSide = rtl ? -1 : 1, inSide = -outSide,
				curve = function (p1, p2) {
					var dx = Math.max(30, Math.abs(p2.x - p1.x) / 2) * (p2.x >= p1.x ? 1 : -1);
					return "M" + p1.x + " " + p1.y + " C" + (p1.x + dx) + " " + p1.y + " " + (p2.x - dx) + " " + p2.y + " " + p2.x + " " + p2.y;
				},
				stepPt = function (k, side) { var p = pos[k]; return { x: side > 0 ? p.x + p.w : p.x, y: p.y + p.h / 2 - 8 }; },
				seg = function (cls, a, ac, b, bc, via, marker) {
					var p1 = that._anchor(a, ac, outSide, el), p2 = that._anchor(b, bc, inSide, el);
					if (via) {
						out.push("<path class=\"" + cls + "\" d=\"" + curve(p1, stepPt(via, inSide)) + "\"/>");
						out.push("<path class=\"" + cls + "\" d=\"" + curve(stepPt(via, outSide), p2) + "\"" + (marker ? " marker-end=\"url(#" + marker + ")\"" : "") + "/>");
					} else {
						out.push("<path class=\"" + cls + "\" d=\"" + curve(p1, p2) + "\"" + (marker ? " marker-end=\"url(#" + marker + ")\"" : "") + "/>");
					}
				},
				mk = this.getId() + "-arr";
			out.push("<defs><marker id=\"" + mk + "\" viewBox=\"0 0 10 10\" refX=\"9\" refY=\"5\" markerWidth=\"7\" markerHeight=\"7\" orient=\"auto-start-reverse\">" +
				"<path d=\"M0 0 L10 5 L0 10 z\" class=\"repoioLinArrow\"/></marker></defs>");
			Object.keys(faint).forEach(function (k) { var f = faint[k]; seg("repoioLinEdge", f.a, null, f.b, null, f.via, null); });
			hot.forEach(function (e) { seg("repoioLinEdgeOn", e.from[0], e.from[1], e.to[0], e.to[1], e.via && pos[e.via] ? e.via : null, mk); });
			svg.innerHTML = out.join("");
		},

		/* ---------- pan, zoom, minimap ---------- */
		_vp: function () { var d = this.getDomRef(); return d && d.querySelector(".repoioLinViewport"); },
		/* Fit the whole graph (bAll), or open at a readable size centred on the home card. */
		_fit: function (bAll) {
			var vp = this._vp();
			if (!vp || !this._pos) { return; }
			var fit = Math.min(1, vp.clientWidth / this._W, vp.clientHeight / this._H), k = bAll ? Math.max(0.3, fit) : Math.max(0.8, Math.min(1, fit)),
				h = this._pos[this._home().key];
			this._view = { k: k, x: (vp.clientWidth - this._W * k) / 2, y: (vp.clientHeight - this._H * k) / 2 };
			if (!bAll && h && this._W * k > vp.clientWidth) { this._view.x = vp.clientWidth / 2 - (h.x + h.w / 2) * k; }
			if (!bAll && h && this._H * k > vp.clientHeight) { this._view.y = Math.min(16, vp.clientHeight / 2 - (h.y + h.h / 2) * k); }
			this._apply();
		},
		_apply: function () {
			var d = this.getDomRef(), v = this._view;
			if (!d || !v) { return; }
			d.querySelector(".repoioLinStage").style.transform = "translate(" + v.x + "px," + v.y + "px) scale(" + v.k + ")";
			this._mini();
		},
		_zoom: function (f, cx, cy) {
			var vp = this._vp(), v = this._view, k = Math.max(0.3, Math.min(1.6, v.k * f));
			cx = cx === undefined ? vp.clientWidth / 2 : cx; cy = cy === undefined ? vp.clientHeight / 2 : cy;
			v.x = cx - (cx - v.x) * (k / v.k); v.y = cy - (cy - v.y) * (k / v.k); v.k = k;
			this._apply();
		},
		_mini: function () {
			var d = this.getDomRef(), vp = this._vp(), v = this._view, box = d && d.querySelector(".repoioLinMini");
			if (!box || !this._pos) { return; }
			var mw = box.clientWidth, mh = box.clientHeight, s = Math.min(mw / this._W, mh / this._H), ox = (mw - this._W * s) / 2, oy = (mh - this._H * s) / 2, html = "",
				P = this._path(), that = this;
			Object.keys(this._pos).forEach(function (k) {
				var p = that._pos[k], n = that._node(k), on = n.cols && n.cols.some(function (c) { return P.cols[P.id ? P.id(k, c[0]) : ""]; });
				html += "<rect x=\"" + (ox + p.x * s) + "\" y=\"" + (oy + p.y * s) + "\" width=\"" + Math.max(2, p.w * s) + "\" height=\"" + Math.max(2, p.h * s) + "\" class=\"" +
					(n.home ? "repoioLinMiniHome" : on ? "repoioLinMiniOn" : "repoioLinMiniNode") + "\"/>";
			});
			html += "<rect class=\"repoioLinMiniView\" x=\"" + (ox + (-v.x / v.k) * s) + "\" y=\"" + (oy + (-v.y / v.k) * s) + "\" width=\"" + (vp.clientWidth / v.k * s) +
				"\" height=\"" + (vp.clientHeight / v.k * s) + "\"/>";
			box.querySelector("svg").innerHTML = html;
			this._miniScale = { s: s, ox: ox, oy: oy };
		},

		/* ---------- interaction (listeners live on this render's DOM and go with it) ---------- */
		_wire: function (dom) {
			var that = this, vp = dom.querySelector(".repoioLinViewport"), mini = dom.querySelector(".repoioLinMini");
			vp.addEventListener("mousedown", function (e) {
				if (e.button !== 0 || e.target.closest(".repoioLinCard, .repoioLinStep, button, input")) { return; }
				var sx = e.clientX, sy = e.clientY, ox = that._view.x, oy = that._view.y,
					move = function (m) { that._view.x = ox + m.clientX - sx; that._view.y = oy + m.clientY - sy; that._apply(); },
					up = function () { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); vp.classList.remove("repoioLinDrag"); };
				vp.classList.add("repoioLinDrag");
				window.addEventListener("mousemove", move);
				window.addEventListener("mouseup", up);
				e.preventDefault();
			});
			vp.addEventListener("wheel", function (e) {
				if (e.ctrlKey || e.metaKey) {
					var r = vp.getBoundingClientRect();
					that._zoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top);
				} else {
					that._view.x -= e.shiftKey ? e.deltaY : e.deltaX;
					that._view.y -= e.shiftKey ? 0 : e.deltaY;
					that._apply();
				}
				e.preventDefault();
			}, { passive: false });
			mini.addEventListener("mousedown", function (e) {
				var r = mini.getBoundingClientRect(), m = that._miniScale, v = that._view,
					gx = (e.clientX - r.left - m.ox) / m.s, gy = (e.clientY - r.top - m.oy) / m.s;
				v.x = vp.clientWidth / 2 - gx * v.k; v.y = vp.clientHeight / 2 - gy * v.k;
				that._apply();
			});
		},
		onclick: function (e) {
			var t = e.target, act = t.closest && t.closest("[data-act]"), card = t.closest && t.closest("[data-node]"), key = card && card.getAttribute("data-node"),
				row = t.closest && t.closest(".repoioLinCol");
			if (act) {
				var a = act.getAttribute("data-act");
				if (a === "toggle") { this._expanded[key] = !this._isExpanded(this._node(key)); this.invalidate(); }
				else if (a === "page") { this._page[key] = Number(act.getAttribute("data-page")); this.invalidate(); }
				else if (a === "open") { this.fireNodePress({ node: key }); }
				else if (a === "zoom") { this._zoom(Number(act.getAttribute("data-z"))); }
				else if (a === "fit") { this._fit(true); }
				else if (a === "clear") { this.setSelected(null); this.fireSelect({ node: "", col: "" }); }
				else if (a === "more") {
					if (Number(act.getAttribute("data-side")) < 0) { this.setUpLevels(this.getUpLevels() + 1); } else { this.setDownLevels(this.getDownLevels() + 1); }
					this._view = null;
				}
				return;
			}
			if (row && key) { this._select(key, row.getAttribute("data-col")); }
		},
		onkeydown: function (e) {
			var row = e.target.closest && e.target.closest(".repoioLinCol"), card = e.target.closest && e.target.closest("[data-node]");
			if (row && card && (e.key === "Enter" || e.key === " ")) { this._select(card.getAttribute("data-node"), row.getAttribute("data-col")); e.preventDefault(); }
		},
		oninput: function (e) {
			var card = e.target.closest && e.target.closest("[data-node]");
			if (!card || e.target.getAttribute("data-act") !== "find") { return; }
			var key = card.getAttribute("data-node");
			this._find[key] = e.target.value;
			this._page[key] = 1;
			this._refocus = key;
			this.invalidate();
		},
		_select: function (node, col) {
			var s = this.getSelected(), same = s && s.node === node && s.col === col;
			this.setSelected(same ? null : { node: node, col: col });
			this.fireSelect({ node: same ? "" : node, col: same ? "" : col });
		},
		/* Changing the selection or the levels re-renders but keeps the current pan and zoom. */
		setSelected: function (v) { this.setProperty("selected", v); return this; },
		resetView: function () { this._view = null; this.invalidate(); }
	});
});
