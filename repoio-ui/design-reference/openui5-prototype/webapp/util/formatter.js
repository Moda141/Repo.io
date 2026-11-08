sap.ui.define([], function () {
	"use strict";
	// Western digits in both languages (Arabic UI keeps Latin numerals for data).
	var nf = new Intl.NumberFormat("en-US"),
		pf = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
	return {
		num: function (v) { return v === null || v === undefined || v === "" ? "—" : nf.format(v); },
		pct: function (v) { return v === null || v === undefined ? "—" : pf.format(v) + "%"; },
		dec: function (v) { return v === null || v === undefined ? "—" : Number(v).toFixed(2); },
		qualityState: function (v) { return v === null || v === undefined ? "None" : v >= 90 ? "Success" : v >= 75 ? "Warning" : "Error"; },
		joinNames: function (a) { return (a || []).map(function (x) { return x.name; }).join(" · "); },
		priority: function (p, n) { return p ? p + " / " + n : "—"; }
	};
});
