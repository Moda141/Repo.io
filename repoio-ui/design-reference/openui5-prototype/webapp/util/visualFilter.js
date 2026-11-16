/* Visual filter cards of the analytical list layout (Job runs, Match detection, Quarantine): horizontal bars with the
   value inside, or a donut with a legend that carries the counts. Values not in an active filter are greyed out.
   items: [{ key, name, value, color }], selected: [keys]. Mirrors for RTL. */
sap.ui.define([], function () {
	"use strict";
	var OFF = "#eceff2", AXIS = "#6a6d70";
	function on(sel, k) { return !sel || !sel.length || sel.indexOf(k) > -1; }

	return {
		hbar: function (c, items, sel, opt) {
			var rtl = c.isRtl(), w = (opt && opt.labelWidth) || 92, col = c.colors;
			return {
				animation: false, grid: { left: rtl ? 8 : w, right: rtl ? w : 8, top: 4, bottom: 4 },
				xAxis: { type: "value", inverse: rtl, show: false },
				yAxis: { type: "category", inverse: true, position: rtl ? "right" : "left", data: items.map(function (i) { return i.name; }),
					axisLabel: { width: w - 8, overflow: "truncate", fontSize: 11, color: col.label }, axisTick: { show: false }, axisLine: { lineStyle: { color: AXIS } } },
				tooltip: { trigger: "item" },
				graphic: items.length ? [] : [{ type: "text", left: "center", top: "middle", style: { text: (opt && opt.empty) || "—", fill: col.label, fontSize: 12 } }],
				series: [{ type: "bar", barWidth: "62%", data: items.map(function (i) {
					return { value: i.value, key: i.key, itemStyle: { color: on(sel, i.key) ? i.color || col.brand : OFF } };
				}), label: { show: true, position: rtl ? "insideLeft" : "insideRight", color: "#fff", fontSize: 11, formatter: function (p) { return p.value || ""; } } }]
			};
		},
		donut: function (c, items, sel) {
			var rtl = c.isRtl(), col = c.colors, lbl = { fontSize: 11, color: col.label };
			return {
				animation: false, tooltip: { trigger: "item" },
				legend: { orient: "vertical", [rtl ? "left" : "right"]: 0, top: "middle", itemWidth: 10, itemHeight: 10, itemGap: 4, textStyle: lbl,
					formatter: function (n) { var x = items.filter(function (i) { return i.name === n; })[0]; return n + "   " + (x ? x.value : ""); } },
				series: [{ type: "pie", radius: ["42%", "78%"], center: [rtl ? "75%" : "25%", "50%"], label: { show: false },
					data: items.map(function (i) { return { name: i.name, value: i.value, key: i.key, itemStyle: { color: on(sel, i.key) ? i.color : OFF } }; }) }]
			};
		},
		toggle: function (a, k) { a = (a || []).slice(); var i = a.indexOf(k); if (i > -1) { a.splice(i, 1); } else { a.push(k); } return a; }
	};
});
