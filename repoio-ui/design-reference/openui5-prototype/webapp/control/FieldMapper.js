/*
 * FieldMapper — Datasphere-style field mapping for the Write-back step: template fields on one side,
 * target-system fields (the write-back allowlist) on the other, curved lines between mapped pairs.
 * Map by dragging a template field onto a target field, or by clicking one then the other.
 * Filter All / Mapped / Unmapped and search each column. Pure OpenUI5 control (no library).
 *
 * mapping = { <targetField>: <templateField> } — a target takes one template field; a template field
 * may feed several targets. Only allowlisted target fields exist here, so nothing else can be written.
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/ui/core/IconPool",
	"sap/ui/core/ResizeHandler"
], function (Control, IconPool, ResizeHandler) {
	"use strict";

	var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
	var icon = function (src, cls) {
		var i = IconPool.getIconInfo(src);
		return i ? "<span class=\"" + (cls || "fmGlyph") + "\" aria-hidden=\"true\" style=\"font-family:'" + esc(i.fontFamily) + "'\">" + esc(i.content) + "</span>" : "";
	};
	var typeMark = function (t) {
		if (t === "decimal" || t === "integer" || t === "number") { return "<span class=\"fmType\">1.23</span>"; }
		if (t === "date") { return icon("sap-icon://calendar", "fmType fmGlyph"); }
		if (t === "code") { return icon("sap-icon://list", "fmType fmGlyph"); }
		return "<span class=\"fmType\">AA</span>";
	};

	return Control.extend("repoio.proto.control.FieldMapper", {
		metadata: {
			properties: {
				source: { type: "object", defaultValue: [] },      // [{ name, label, type, key, req }]
				target: { type: "object", defaultValue: [] },      // [{ name, type, key, codeList }]
				mapping: { type: "object", defaultValue: {} },
				editable: { type: "boolean", defaultValue: true },
				texts: { type: "object", defaultValue: {} }        // all, mapped, unmapped, search, src, tgt, unmap, valueMap, key, auto, hint
			},
			events: { change: { parameters: { mapping: { type: "object" } } } }
		},

		init: function () { this._filter = "all"; this._pick = null; },

		renderer: {
			apiVersion: 2,
			render: function (oRm, c) {
				var T = c.getTexts(), map = c.getMapping() || {}, used = {}, ed = c.getEditable();
				Object.keys(map).forEach(function (k) { used[map[k]] = true; });
				oRm.openStart("div", c).class("repoioMapper").openEnd();
				var seg = ["all", "mapped", "unmapped"].map(function (k) {
					return "<button type=\"button\" class=\"fmSeg" + (c._filter === k ? " fmOn" : "") + "\" data-f=\"" + k + "\" aria-pressed=\"" + (c._filter === k) + "\">" + esc(T[k]) + "</button>";
				}).join("");
				var mappedCount = Object.keys(map).length;
				var col = function (side, title, items) {
					return "<div class=\"fmCol fmCol-" + side + "\"><div class=\"fmColHead\">" + icon("sap-icon://table-view") +
						"<span class=\"fmColTitle\">" + esc(title) + " (" + items.length + ")</span></div>" +
						"<div class=\"fmSearch\"><input type=\"search\" class=\"fmQ\" data-side=\"" + side + "\" placeholder=\"" + esc(T.search) + "\" aria-label=\"" + esc(T.search + " " + title) + "\">" +
						icon("sap-icon://search") + "</div><div class=\"fmList\" role=\"list\">" + items.join("") + "</div></div>";
				};
				var src = (c.getSource() || []).map(function (f) {
					return "<div class=\"fmItem" + (used[f.name] ? " fmUsed" : "") + (c._pick === f.name ? " fmPick" : "") + "\" role=\"listitem\" tabindex=\"0\" data-side=\"src\" data-name=\"" + esc(f.name) + "\"" +
						(ed ? " draggable=\"true\"" : "") + " title=\"" + esc(f.label + " · " + f.name) + "\"><span class=\"fmGrip\">⋮</span>" + typeMark(f.type) +
						"<span class=\"fmName\">" + esc(f.label) + "<small>" + esc(f.name) + "</small></span>" + (f.key ? icon("sap-icon://key", "fmKey fmGlyph") : "") + "</div>";
				});
				var tgt = (c.getTarget() || []).map(function (f) {
					var m = map[f.name];
					return "<div class=\"fmItem" + (m ? " fmUsed" : "") + "\" role=\"listitem\" tabindex=\"0\" data-side=\"tgt\" data-name=\"" + esc(f.name) + "\" title=\"" + esc(f.name + (m ? " ← " + m : "")) + "\">" +
						"<span class=\"fmGrip\">⋮</span>" + typeMark(f.type) + "<span class=\"fmName\" dir=\"ltr\">" + esc(f.name) + "</span>" +
						(f.codeList ? "<span class=\"fmVm\" title=\"" + esc(T.valueMap) + "\">" + icon("sap-icon://value-help") + "</span>" : "") +
						(f.key ? icon("sap-icon://key", "fmKey fmGlyph") : "") +
						(m && ed ? "<button type=\"button\" class=\"fmUnmap\" data-name=\"" + esc(f.name) + "\" title=\"" + esc(T.unmap) + "\" aria-label=\"" + esc(T.unmap + " " + f.name) + "\">" + icon("sap-icon://decline") + "</button>" : "") +
						"</div>";
				});
				oRm.unsafeHtml("<div class=\"fmBar\"><div class=\"fmSegs\" role=\"group\">" + seg + "</div><span class=\"fmCount\">" + esc(T.count ? T.count.replace("{0}", mappedCount).replace("{1}", (c.getTarget() || []).length) : "") + "</span>" +
					(ed ? "<button type=\"button\" class=\"fmAuto\">" + icon("sap-icon://synchronize") + esc(T.auto) + "</button>" : "") + "</div>" +
					"<div class=\"fmCols\"><svg class=\"fmSvg\" aria-hidden=\"true\"></svg>" + col("src", T.src, src) + "<div class=\"fmGap\"></div>" + col("tgt", T.tgt, tgt) + "</div>" +
					(ed ? "<div class=\"fmHint\">" + esc(T.hint) + "</div>" : ""));
				oRm.close("div");
			}
		},

		onAfterRendering: function () {
			var d = this.getDomRef(), that = this;
			if (!d) { return; }
			this._applyFilter();
			if (this._boundEl === d) { setTimeout(function () { that._lines(); }, 0); return; }
			this._boundEl = d; // bind once per DOM element (re-rendering may replace it)
			d.addEventListener("click", this._onClick.bind(this));
			d.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("fmItem")) { e.preventDefault(); that._onItem(e.target); } });
			d.addEventListener("input", function (e) { if (e.target.classList.contains("fmQ")) { that._applyFilter(); } });
			d.addEventListener("dragstart", function (e) {
				var it = e.target.closest && e.target.closest(".fmItem[data-side=src]");
				if (it) { e.dataTransfer.setData("text/plain", it.getAttribute("data-name")); e.dataTransfer.effectAllowed = "link"; }
			});
			d.addEventListener("dragover", function (e) { var it = e.target.closest && e.target.closest(".fmItem[data-side=tgt]"); if (it) { e.preventDefault(); it.classList.add("fmOver"); } });
			d.addEventListener("dragleave", function (e) { var it = e.target.closest && e.target.closest(".fmItem[data-side=tgt]"); if (it) { it.classList.remove("fmOver"); } });
			d.addEventListener("drop", function (e) {
				var it = e.target.closest && e.target.closest(".fmItem[data-side=tgt]");
				if (it) { e.preventDefault(); that._map(it.getAttribute("data-name"), e.dataTransfer.getData("text/plain")); }
			});
			if (!this._rh) { this._rh = ResizeHandler.register(this, function () { that._lines(); }); }
			setTimeout(function () { that._lines(); }, 0);
		},

		_onClick: function (e) {
			var t = e.target, s = t.closest(".fmSeg"), u = t.closest(".fmUnmap"), it = t.closest(".fmItem");
			if (s) { this._filter = s.getAttribute("data-f"); this.invalidate(); return; }
			if (t.closest(".fmAuto")) { this.autoMap(); return; }
			if (u) { e.stopPropagation(); var m = Object.assign({}, this.getMapping()); delete m[u.getAttribute("data-name")]; this._set(m); return; }
			if (it) { this._onItem(it); }
		},
		/* Click a template field, then a target field (keyboard-friendly alternative to drag and drop). */
		_onItem: function (it) {
			if (!this.getEditable()) { return; }
			var side = it.getAttribute("data-side"), name = it.getAttribute("data-name");
			if (side === "src") { this._pick = this._pick === name ? null : name; this.invalidate(); return; }
			if (this._pick) { var p = this._pick; this._pick = null; this._map(name, p); }
		},
		_map: function (tgt, src) {
			if (!this.getEditable() || !src || !tgt) { return; }
			var m = Object.assign({}, this.getMapping()); m[tgt] = src; this._set(m);
		},
		_set: function (m) { this.setProperty("mapping", m); this.fireChange({ mapping: m }); },

		/* Auto-map: the allowlist's suggested template field first, then equal names. */
		autoMap: function () {
			var src = this.getSource() || [], names = {}, m = Object.assign({}, this.getMapping());
			src.forEach(function (f) { names[f.name] = true; names[f.name.replace(/_/g, "").toLowerCase()] = f.name; });
			(this.getTarget() || []).forEach(function (t) {
				if (m[t.name]) { return; }
				if (t.src && names[t.src] === true) { m[t.name] = t.src; return; }
				var hit = names[t.name.replace(/_/g, "").toLowerCase()];
				if (typeof hit === "string") { m[t.name] = hit; }
			});
			this._set(m);
		},

		_applyFilter: function () {
			var d = this.getDomRef(); if (!d) { return; }
			var f = this._filter;
			d.querySelectorAll(".fmCol").forEach(function (col) {
				var q = (col.querySelector(".fmQ").value || "").toLowerCase();
				col.querySelectorAll(".fmItem").forEach(function (it) {
					var used = it.classList.contains("fmUsed"), txt = it.textContent.toLowerCase();
					var show = (f === "all" || (f === "mapped" ? used : !used)) && (!q || txt.indexOf(q) > -1);
					it.style.display = show ? "" : "none";
				});
			});
			this._lines();
		},

		/* Curved lines between visible mapped pairs, measured from the DOM (works in LTR and RTL). */
		_lines: function () {
			var d = this.getDomRef(); if (!d) { return; }
			var box = d.querySelector(".fmCols"), svg = d.querySelector(".fmSvg"); if (!box || !svg) { return; }
			var B = box.getBoundingClientRect(), map = this.getMapping() || {}, out = [];
			svg.setAttribute("width", B.width); svg.setAttribute("height", B.height);
			var find = function (side, name) {
				var el = box.querySelector(".fmItem[data-side=" + side + "][data-name=\"" + CSS.escape(name) + "\"]");
				return el && el.style.display !== "none" ? el.getBoundingClientRect() : null;
			};
			Object.keys(map).forEach(function (t) {
				var a = find("src", map[t]), b = find("tgt", t); if (!a || !b) { return; }
				var ltr = a.left < b.left;
				var x1 = (ltr ? a.right : a.left) - B.left, y1 = a.top + a.height / 2 - B.top, x2 = (ltr ? b.left : b.right) - B.left, y2 = b.top + b.height / 2 - B.top;
				var dx = (x2 - x1) / 2;
				out.push("<path d=\"M" + x1 + " " + y1 + " C" + (x1 + dx) + " " + y1 + " " + (x2 - dx) + " " + y2 + " " + x2 + " " + y2 + "\" class=\"fmLine\" />" +
					"<circle cx=\"" + x2 + "\" cy=\"" + y2 + "\" r=\"3.5\" class=\"fmDot\" />");
			});
			svg.innerHTML = out.join("");
		},

		exit: function () { if (this._rh) { ResizeHandler.deregister(this._rh); this._rh = null; } }
	});
});
