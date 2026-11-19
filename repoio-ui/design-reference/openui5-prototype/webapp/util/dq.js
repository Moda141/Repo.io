sap.ui.define(["repoio/proto/util/semantic"], function (Sem) {
	"use strict";

	/* Shared presentation helpers of the Data Quality pages (Test cases, test detail, test editor, alerts).
	   Business rules stay on the server: the threshold and the severity of a test come with the test; the page only
	   compares the last result with the threshold the API returned, the same way every page colors a score. */

	var SRC = { c4c: "SAP C4C", s4: "SAP S/4HANA", csv: "Excel / CSV" };

	return {
		SRC: SRC,
		load: function (c) {
			var C = c.getOwnerComponent();
			return Promise.all([C.getModel("dq").dataLoaded(), c.data().dataLoaded()]).then(function () { return C.getModel("dq"); });
		},
		check: function (m, key) { return (m.getProperty("/checks") || []).filter(function (x) { return x.key === key; })[0] || {}; },

		/* Repository tests carry their own names; source-table tests are named from the check and the column. */
		name: function (c, t) {
			var ar = c.lang() === "ar";
			if (t.level === "repository" && (ar ? t.ar : t.en)) { return ar ? t.ar : t.en; }
			return c.text("dq.auto." + t.check, [t.column]);
		},
		where: function (c, t) {
			if (t.level === "repository") {
				var r = c.data().getProperty("/repos/" + t.repo);
				return { icon: "sap-icon://database", text: r ? r.name : t.repo, sub: t.table + (t.column ? " · " + t.column : "") };
			}
			return { icon: "sap-icon://table-view", text: SRC[t.source] || t.source, sub: t.schema + "." + t.table + (t.column ? " · " + t.column : "") };
		},
		last: function (t) { return t.runs && t.runs.length ? t.runs[t.runs.length - 1] : null; },
		/* pass / fail (below the threshold) / warn (below the threshold of a warn-only test) / notRun */
		result: function (t) {
			var l = this.last(t);
			if (!l || t.status === "draft" || t.status === "disabled") { return "notRun"; }
			if (l.pass >= t.threshold) { return "pass"; }
			return t.severity === "warn" ? "warn" : "fail";
		},
		pct: function (v) { return v === null || v === undefined ? "—" : (v >= 99.95 && v < 100 ? "99.9" : v === 100 ? "100" : v.toFixed(1)) + "%"; },

		/* 14-run pass rate as a small inline SVG: the line, the threshold dashed, the last point marked. Newest at the
		   reading end (right in LTR, left in RTL). */
		spark: function (t, rtl) {
			var runs = t.runs || [];
			if (!runs.length) { return "<span class=\"repoioDqSparkNone\">—</span>"; }
			var w = 88, h = 22, p = 2, vals = runs.map(function (r) { return r.pass; }),
				lo = Math.min.apply(null, vals.concat([t.threshold])) - 0.5, hi = 100, span = Math.max(0.5, hi - lo),
				x = function (i) { var v = p + i * (w - 2 * p) / Math.max(1, vals.length - 1); return rtl ? w - v : v; },
				y = function (v) { return h - p - (v - lo) * (h - 2 * p) / span; },
				col = { pass: "var(--sapPositiveElementColor,#30914c)", fail: "var(--sapNegativeElementColor,#d32030)",
					warn: "var(--sapCriticalElementColor,#e76500)", notRun: "var(--sapContent_LabelColor,#556b82)" }[this.result(t)],
				pts = vals.map(function (v, i) { return x(i).toFixed(1) + "," + y(v).toFixed(1); }).join(" "), li = vals.length - 1;
			return "<svg class=\"repoioDqSpark\" width=\"" + w + "\" height=\"" + h + "\" viewBox=\"0 0 " + w + " " + h + "\" aria-hidden=\"true\">" +
				"<line x1=\"0\" x2=\"" + w + "\" y1=\"" + y(t.threshold).toFixed(1) + "\" y2=\"" + y(t.threshold).toFixed(1) +
				"\" stroke=\"var(--sapContent_LabelColor,#556b82)\" stroke-width=\"1\" stroke-dasharray=\"3 3\" opacity=\"0.6\"/>" +
				"<polyline points=\"" + pts + "\" fill=\"none\" stroke=\"" + col + "\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/>" +
				"<circle cx=\"" + x(li).toFixed(1) + "\" cy=\"" + y(vals[li]).toFixed(1) + "\" r=\"2.4\" fill=\"" + col + "\"/></svg>";
		},

		/* One row of a test list, ready to bind. */
		row: function (c, m, t) {
			var res = this.result(t), l = this.last(t), w = this.where(c, t), ck = this.check(m, t.check),
				st = Sem.of("lifecycle", t.status === "disabled" ? "paused" : t.status), sv = Sem.of("dqSeverity", t.severity), rs = Sem.of("dq", res);
			return Object.assign({}, t, {
				name: this.name(c, t), whereIcon: w.icon, whereText: w.text, whereSub: w.sub,
				checkText: c.text("dq.chk." + t.check), checkIcon: ck.icon, dimText: c.text("dq.dim." + t.dim),
				sevText: c.text("dq.sev." + t.severity), sevState: sv[0], sevIcon: sv[1],
				result: res, resText: res === "notRun" ? c.text("dq.res.notRun") : this.pct(l.pass), resState: rs[0], resIcon: rs[1],
				thText: c.text("dq.threshold", [t.threshold]),
				failedText: l ? c.fmt.num(l.failed) : "—", checkedText: l && l.checked ? c.text("dq.ofChecked", [c.fmt.num(l.checked)]) : "",
				lastRun: l ? l.d : "—", spark: this.spark(t, c.isRtl()),
				statusText: c.text("dq.st." + t.status), statusState: st[0], statusIcon: st[1],
				authorText: c.text("dq.author." + t.author), isPython: t.author === "python"
			});
		}
	};
});
