/*
 * Shared helpers for the Data sync pages (Datasphere replication flow pattern):
 * connection display, load / interval texts, status maps and flow validation.
 * In the product these read the sync API and the connections registry; here model/sync.json
 * and model/sample-data.json.
 */
sap.ui.define([], function () {
	"use strict";

	var LOGO = { c4c: "img/logos/sap.png", hana: "img/logos/sap.png", mssql: "img/logos/sqlserver.png", file: "img/logos/csv-xls.png" },
		STATUS = { draft: ["None", "sap-icon://edit"], deployed: ["Success", "sap-icon://sys-enter-2"], changed: ["Warning", "sap-icon://edit-outside"], running: ["Information", "sap-icon://in-progress"] },
		LAST = { succeeded: ["Success", "sap-icon://sys-enter-2"], succeededWithFailures: ["Warning", "sap-icon://alert"], failed: ["Error", "sap-icon://error"], running: ["Information", "sap-icon://in-progress"] },
		/* How changes are detected per connection type: delta is the source system's job, the flow only picks it. */
		DELTA = { c4c: "watermark", hana: "cdc", mssql: "watermark", file: "upload" };

	var H = {
		STATUS: STATUS, LAST: LAST,
		conn: function (c, id) { return (c.data().getProperty("/connections") || []).filter(function (x) { return x.id === id; })[0] || { id: id, type: "file", name: id, nameEn: id }; },
		connText: function (c, conn) { return c.lang() === "ar" ? conn.name : (conn.nameEn || conn.name); },
		logo: function (conn) { return LOGO[conn.type] || ""; },
		deltaMethod: function (conn) { return DELTA[conn.type] || "watermark"; },
		repo: function (c, id) { return c.data().getProperty("/repos/" + id) || { id: id, name: id, domainId: "customers", model: "" }; },
		dom: function (c, id) { return (c.data().getProperty("/domains") || []).filter(function (d) { return d.id === id; })[0]; },
		interval: function (c, f) {
			if (f.interval === "upload") { return c.text("ds.iv.upload"); }
			if (f.interval === "custom") { return c.text("ds.iv.custom", [Math.floor(f.mins / 60), f.mins % 60]); }
			return c.text("ds.iv." + f.interval) + (f.interval === "daily" && f.at ? " · " + f.at : "");
		},
		load: function (c, f) {
			var hasDelta = f.objects.some(function (o) { return o.load === "delta"; }), hasInit = f.objects.some(function (o) { return o.load === "initial"; });
			return hasDelta && hasInit ? c.text("ds.load.mixed") : c.text(hasDelta ? "ds.load.delta" : "ds.load.initial");
		},
		/* Validation the service would run on Validate / Deploy (the UI only shows the result). */
		validate: function (c, f, sync) {
			var msgs = [], ents = sync.entities;
			if (!f.objects.length) { msgs.push({ type: "Error", title: c.text("ds.v.noObjects") }); }
			f.objects.forEach(function (o) {
				var fields = ents[o.entity] || [], cols = (sync.source[o.source] || []).map(function (x) { return x.name; });
				fields.forEach(function (fd) {
					if (fd.req && !o.mapping[fd.name]) {
						msgs.push({ type: "Error", title: c.text(fd.key ? "ds.v.key" : "ds.v.req", [fd.name]), subtitle: o.source + " → " + o.entity });
					}
				});
				(o.filters || []).forEach(function (fl) {
					if (!fl.col || !String(fl.val || "").trim()) { msgs.push({ type: "Error", title: c.text("ds.v.filter"), subtitle: o.source }); }
				});
				if (o.load === "delta" && H.deltaMethod(H.conn(c, f.conn)) === "watermark" && !cols.some(function (n) { return /Change|Modified|AEDAT|LAEDA/i.test(n); })) {
					msgs.push({ type: "Warning", title: c.text("ds.v.watermark"), subtitle: o.source });
				}
				if (o.truncate) { msgs.push({ type: "Warning", title: c.text("ds.v.truncate"), subtitle: o.source }); }
			});
			return msgs;
		}
	};
	return H;
});
