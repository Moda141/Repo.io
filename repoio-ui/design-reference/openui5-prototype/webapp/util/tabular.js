/*
 * Browser-side readers for the file-upload preview: CSV/TXT and XLSX.
 * Preview only — the server re-parses and validates every row on import (README §2.3 bulk upload:
 * per-row validation, rejected rows never enter the batch). No third-party dependency: XLSX is a
 * zip of XML parts, unpacked with the browser's DecompressionStream and read with DOMParser.
 */
sap.ui.define([], function () {
	"use strict";

	var DELIMS = { comma: ",", semicolon: ";", tab: "\t", space: " ", dot: ".", colon: ":", dash: "-", pipe: "|" };

	/* RFC 4180 CSV: quoted fields, doubled quotes, CRLF/LF, delimiter inside quotes. */
	function parseCsv(text, delim) {
		var rows = [], row = [], field = "", i = 0, q = false, c;
		if (text.charCodeAt(0) === 0xFEFF) { text = text.slice(1); } // BOM
		while (i < text.length) {
			c = text[i];
			if (q) {
				if (c === "\"") {
					if (text[i + 1] === "\"") { field += "\""; i += 2; continue; }
					q = false; i++; continue;
				}
				field += c; i++; continue;
			}
			if (c === "\"") { q = true; i++; continue; }
			if (c === delim) { row.push(field); field = ""; i++; continue; }
			if (c === "\r") { i++; continue; }
			if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
			field += c; i++;
		}
		if (field !== "" || row.length) { row.push(field); rows.push(row); }
		return rows.filter(function (r) { return r.length > 1 || (r[0] || "").trim() !== ""; });
	}

	/* Pick the delimiter that splits the first lines into the most consistent column count (> 1). */
	function detectDelimiter(text) {
		var sample = text.slice(0, 20000), best = { key: "comma", score: -1 };
		["comma", "semicolon", "tab", "pipe", "colon", "space"].forEach(function (k) {
			var rows = parseCsv(sample, DELIMS[k]).slice(0, 20);
			if (rows.length === 0) { return; }
			var n = rows[0].length;
			if (n < 2) { return; }
			var same = rows.filter(function (r) { return r.length === n; }).length / rows.length;
			var score = same * 10 + Math.min(n, 30) / 30;
			if (score > best.score) { best = { key: k, score: score }; }
		});
		return best.key;
	}

	function decode(buffer, encoding) {
		try { return new TextDecoder(encoding || "utf-8").decode(buffer); }
		catch (e) { return new TextDecoder("utf-8").decode(buffer); }
	}

	/* ---------- XLSX ---------- */

	function u16(v, o) { return v.getUint16(o, true); }
	function u32(v, o) { return v.getUint32(o, true); }

	/* Read the zip central directory and return { name: async () => Uint8Array }. */
	function unzip(buffer) {
		var v = new DataView(buffer), eocd = -1;
		for (var p = buffer.byteLength - 22; p >= Math.max(0, buffer.byteLength - 65557); p--) {
			if (u32(v, p) === 0x06054b50) { eocd = p; break; }
		}
		if (eocd < 0) { throw new Error("not-a-zip"); }
		var count = u16(v, eocd + 10), off = u32(v, eocd + 16), files = {}, dec = new TextDecoder("utf-8");
		for (var n = 0; n < count; n++) {
			if (u32(v, off) !== 0x02014b50) { throw new Error("bad-zip"); }
			var method = u16(v, off + 10), csize = u32(v, off + 20), nlen = u16(v, off + 28), xlen = u16(v, off + 30), clen = u16(v, off + 32),
				lho = u32(v, off + 42), name = dec.decode(new Uint8Array(buffer, off + 46, nlen));
			files[name] = { method: method, csize: csize, lho: lho };
			off += 46 + nlen + xlen + clen;
		}
		return function (name) {
			var f = files[name];
			if (!f) { return Promise.resolve(null); }
			var start = f.lho + 30 + u16(v, f.lho + 26) + u16(v, f.lho + 28), raw = new Uint8Array(buffer, start, f.csize);
			if (f.method === 0) { return Promise.resolve(raw); }
			if (f.method !== 8 || typeof DecompressionStream === "undefined") { return Promise.reject(new Error("unsupported-zip")); }
			var stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
			return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
		};
	}

	function xml(bytes) { return new DOMParser().parseFromString(new TextDecoder("utf-8").decode(bytes), "application/xml"); }
	function els(doc, tag) { return Array.prototype.slice.call(doc.getElementsByTagNameNS("*", tag)); }
	function colIndex(ref) {
		var m = /^([A-Z]+)/.exec(ref || ""), n = 0;
		if (!m) { return -1; }
		for (var i = 0; i < m[1].length; i++) { n = n * 26 + (m[1].charCodeAt(i) - 64); }
		return n - 1;
	}

	/* Returns Promise<{ sheets: [name], read: (sheetName) => Promise<rows> }>. */
	function openXlsx(buffer) {
		var get = unzip(buffer);
		return Promise.all([get("xl/workbook.xml"), get("xl/_rels/workbook.xml.rels"), get("xl/sharedStrings.xml")]).then(function (a) {
			if (!a[0]) { throw new Error("not-xlsx"); }
			var wb = xml(a[0]), rels = a[1] ? xml(a[1]) : null, shared = [];
			if (a[2]) {
				els(xml(a[2]), "si").forEach(function (si) { shared.push(els(si, "t").map(function (t) { return t.textContent; }).join("")); });
			}
			var target = {};
			if (rels) { els(rels, "Relationship").forEach(function (r) { target[r.getAttribute("Id")] = r.getAttribute("Target"); }); }
			var sheets = els(wb, "sheet").map(function (s) {
				var rid = s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || s.getAttribute("r:id");
				var t = (target[rid] || "").replace(/^\/?xl\//, "").replace(/^\//, "");
				return { name: s.getAttribute("name"), path: "xl/" + t };
			});
			return {
				sheets: sheets.map(function (s) { return s.name; }),
				read: function (name) {
					var s = sheets.filter(function (x) { return x.name === name; })[0] || sheets[0];
					return get(s.path).then(function (bytes) {
						var rows = [];
						els(xml(bytes), "row").forEach(function (r) {
							var out = [];
							els(r, "c").forEach(function (c, k) {
								var idx = colIndex(c.getAttribute("r")), t = c.getAttribute("t"), vEl = els(c, "v")[0], val = vEl ? vEl.textContent : "";
								if (idx < 0) { idx = k; }
								if (t === "s") { val = shared[parseInt(val, 10)] || ""; }
								else if (t === "inlineStr") { val = els(c, "t").map(function (x) { return x.textContent; }).join(""); }
								else if (t === "b") { val = val === "1" ? "TRUE" : "FALSE"; }
								out[idx] = val;
							});
							for (var i = 0; i < out.length; i++) { if (out[i] === undefined) { out[i] = ""; } }
							if (out.some(function (x) { return String(x).trim() !== ""; })) { rows.push(out); }
						});
						return rows;
					});
				}
			};
		});
	}

	return { DELIMS: DELIMS, parseCsv: parseCsv, detectDelimiter: detectDelimiter, decode: decode, openXlsx: openXlsx };
});
