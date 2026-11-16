/* Shared by the golden record page and the full-screen lineage page (J2): texts for the ColumnLineage control, and the
   record's own values per lineage node, so a customer's lineage shows its numbers where they came from. */
sap.ui.define([], function () {
	"use strict";

	var KEYS = ["columns", "find", "home", "open", "prev", "next", "zoomIn", "zoomOut", "fit", "clear", "moreUp", "moreDown", "noColumns",
		"type.table", "type.view", "type.file", "type.topic", "type.writeback", "type.report", "type.api", "type.step",
		"step.ingest", "step.standardise", "step.match", "dq.ok", "dq.warn"];

	return {
		texts: function (ctrl) {
			var o = {};
			KEYS.forEach(function (k) { o[k] = ctrl.text("lin." + k); });
			return o;
		},
		/* Golden values on the golden table and its views; each source table shows the value its own source record holds. */
		values: function (lineage, prov, sourceRows, govName) {
			var g = {}, out = {}, bySrc = {};
			prov.forEach(function (p) { g[p.col] = p.value; });
			(sourceRows || []).forEach(function (s) { bySrc[s.source] = s.values; });
			out.golden_customer = g;
			out.v_customer = { name: g.name, mobile_1: g.mobile_1, account_type: g.account_type, governorate: govName, main_territory_id: g.main_territory_id,
				final_subject: g.final_subject };
			out.mcp_lookup = { name: g.name, mobile_1: g.mobile_1, account_type: g.account_type };
			lineage.nodes.forEach(function (n) {
				var v = n.source && bySrc[n.source];
				if (!v) { return; }
				var m = {};
				lineage.edges.forEach(function (e) {
					if (e.from[0] === n.key && e.to[0] === "raw_customer" && v[e.to[1]]) { m[e.from[1]] = v[e.to[1]]; }
				});
				out[n.key] = m;
			});
			return out;
		}
	};
});
