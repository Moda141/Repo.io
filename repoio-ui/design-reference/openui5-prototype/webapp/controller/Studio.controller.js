sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/control/EChart",
	"sap/m/VBox", "sap/m/HBox", "sap/m/Title", "sap/m/Text", "sap/m/Button", "sap/m/Menu", "sap/m/MenuItem",
	"sap/m/NumericContent", "sap/m/Dialog", "sap/m/MessageToast", "sap/m/MessageBox"
], function (BaseController, EChart, VBox, HBox, Title, Text, Button, Menu, MenuItem, NumericContent, Dialog, MessageToast, MessageBox) {
	"use strict";

	/* Governed KPI catalog: the studio picks measures, it never defines formulas (CLAUDE.md §6.6). */
	var MEASURES = { goldenRecords: "count", openCr: "count", dqScore: "pct", sourceRecords: "count", autoMerge: "pct", crCycle: "hours", customers: "count" },
		TYPES = [["column", "sap-icon://vertical-bar-chart"], ["bar", "sap-icon://horizontal-bar-chart"], ["line", "sap-icon://line-chart"],
			["donut", "sap-icon://donut-chart"], ["stacked", "sap-icon://upstacked-chart"], ["kpi", "sap-icon://kpi-corporate-performance"]],
		PALETTES = {
			blue: ["#5899da", "#2f6497", "#8fb5dd", "#c3d6ea", "#5b8fc7", "#a9c6e8"],
			quartz: ["#5899da", "#5fae7c", "#e3a256", "#df7a7a", "#89b4e3", "#b4bac0"],
			slate: ["#354a5f", "#5b738b", "#8396a8", "#b4c1cc", "#6c8293", "#d5dde4"]
		},
		GOV_SOURCE = "mdm.governance_kpis", GOV_DIMS = ["domain", "week", "source"],
		ALP_DIMS = ["line", "region", "source", "dq"], CR_ST = ["open", "inReview", "approved"],
		WEEKS = ["W38", "W39", "W40", "W41", "W42", "W43", "W44", "W45"];

	function seeded(s) {
		var h = 0, i;
		for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) % 2147483647; }
		return function () { h = (h * 48271) % 2147483647; return h / 2147483647; };
	}

	/* J14: Analytics studio. In the product a story is a versioned definition saved through the reports API;
	   tiles query governed views through the semantic layer with the viewer's own grants. */
	return BaseController.extend("repoio.proto.controller.Studio", {
		onInit: function () {
			this.viewModel().setProperty("/st", { mode: "edit", edit: true, page: "", pages: [], sel: "", dirty: false, b: {} });
			this.router().getRoute("studio").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this, a = oEvent.getParameter("arguments"), oM = this.getOwnerComponent().getModel("analytics");
			Promise.all([oM.dataLoaded(), this.data().dataLoaded()]).then(function () {
				var vm = that.viewModel(), ar = that.lang() === "ar";
				that._doms = that.data().getProperty("/domains");
				that._alp = oM.getProperty("/alp");
				that._report = a.id === "new" ? null : oM.getProperty("/reports").filter(function (r) { return r.id === a.id; })[0];
				that._n = 100;
				if (!that._report) {
					that._source = GOV_SOURCE;
					that._pages = [{ key: "p1", text: that.text("st.page1"), tiles: [] }];
				} else if (that._report.type === "story") {
					that._source = that._report.id === "STY_MDM_OVERVIEW" ? GOV_SOURCE : that._report.source;
					that._pages = JSON.parse(JSON.stringify(oM.getProperty("/story/pages"))).map(function (p) {
						return { key: p.key, text: that.text("st.pg." + p.key), tiles: p.tiles };
					});
				} else {
					that._source = that._report.source;
					that._pages = [{ key: "main", text: that.text("st.pg.main"), tiles: ALP_DIMS.map(function (d, i) {
						return { id: "a" + i, measure: "customers", dim: d, chart: ["bar", "column", "donut", "line"][i] };
					}) }];
				}
				vm.setProperty("/st/isNew", !that._report);
				vm.setProperty("/st/title", that._report ? (ar ? that._report.ar : that._report.en) : that.text("st.untitled"));
				var st = that._report ? that._report.status : "draft";
				vm.setProperty("/st/statusText", that.text("wl.st." + st));
				vm.setProperty("/st/statusState", st === "published" ? "Success" : "None");
				vm.setProperty("/st/dirty", false);
				vm.setProperty("/st/sel", "");
				that._setMode(a.mode === "view" ? "view" : "edit");
				vm.setProperty("/st/page", that._pages[0].key);
				that._pagesModel();
				that._render();
			});
		},

		/* ---------- labels and data ---------- */
		_dimKeys: function (d) {
			if (d === "domain") { return this._doms.map(function (x) { return x.id; }); }
			if (d === "week") { return WEEKS; }
			if (d === "source" && this._source === GOV_SOURCE) { return ["c4c", "erp", "sql"]; }
			return this._alp.dims[d].map(function (v) { return v.key; });
		},
		_dimLabel: function (d, k) {
			var ar = this.lang() === "ar";
			if (d === "domain") { return this.domainName(this._doms.filter(function (x) { return x.id === k; })[0]); }
			if (d === "week") { return k; }
			if (d === "source" && this._source === GOV_SOURCE) { return { c4c: "SAP C4C", erp: "SAP ERP", sql: "SQL Server" }[k]; }
			var v = this._alp.dims[d].filter(function (x) { return x.key === k; })[0];
			return ar ? v.ar : v.en;
		},
		_data: function (t) {
			if (t.data && t.dataFor === undefined) { t.dataFor = t.measure + "/" + t.dim + "/" + (t.chart === "stacked"); }
			if (t.data && t.dataFor === t.measure + "/" + t.dim + "/" + (t.chart === "stacked")) { return t.data; }
			var keys = this._dimKeys(t.dim), u = MEASURES[t.measure], rnd = seeded(t.measure + t.dim), d;
			if (t.measure === "customers") {
				var m = {};
				keys.forEach(function (k) { m[k] = 0; });
				this._alp.rows.forEach(function (r) { var v = t.dim === "dq" ? (r.dq < 70 ? "lt70" : r.dq < 85 ? "70" : r.dq < 95 ? "85" : "95") : r[t.dim]; m[v]++; });
				d = keys.map(function (k) { return m[k]; });
			} else if (t.chart === "kpi") {
				d = [u === "pct" ? 89.6 : u === "hours" ? 18.4 : 4210];
			} else {
				d = keys.map(function () { return u === "pct" ? Math.round(600 + rnd() * 380) / 10 : u === "hours" ? Math.round(80 + rnd() * 300) / 10 : Math.round(20 + rnd() * 900); });
				if (t.chart === "stacked") { d = d.map(function (v) { return [Math.round(v * 0.6), Math.round(v * 0.28), Math.round(v * 0.12)]; }); }
			}
			t.data = d;
			t.dataFor = t.measure + "/" + t.dim + "/" + (t.chart === "stacked");
			return d;
		},
		_title: function (t) {
			return t.title ? this.text("st.tile." + t.title) : this.text("st.tile.auto", [this.text("st.m." + t.measure), t.chart === "kpi" ? "" : this.text("rp.dim." + t.dim)]).replace(/\s+$/, "");
		},

		/* ---------- chart option (RTL aware) ---------- */
		_option: function (t) {
			var that = this, c = this.colors, rtl = this.isRtl(), pal = PALETTES[t.palette || "blue"], lbl = { fontSize: 10, color: c.label },
				keys = this._dimKeys(t.dim), data = this._data(t), idx = keys.map(function (k, i) { return i; });
			if (t.sort) { idx.sort(function (a, b) { var va = [].concat(data[a]).reduce(function (s, v) { return s + v; }, 0), vb = [].concat(data[b]).reduce(function (s, v) { return s + v; }, 0); return t.sort === "asc" ? va - vb : vb - va; }); }
			if (t.rank) { idx = idx.slice(0, t.rank); }
			var names = idx.map(function (i) { return that._dimLabel(t.dim, keys[i]); }), vals = idx.map(function (i) { return data[i]; }),
				showLbl = t.labels !== false, unit = MEASURES[t.measure] === "pct" ? "%" : "";
			if (t.chart === "donut") {
				return { animation: false, color: pal, tooltip: { trigger: "item" },
					legend: { show: t.legend !== false, orient: "vertical", [rtl ? "left" : "right"]: 4, top: "middle", itemWidth: 10, itemHeight: 10, textStyle: lbl,
						formatter: function (n) { var i = names.indexOf(n); return showLbl ? n + "   " + vals[i].toLocaleString("en") + unit : n; } },
					series: [{ type: "pie", radius: ["45%", "75%"], center: [rtl ? "65%" : "35%", "52%"], label: { show: false },
						data: names.map(function (n, i) { return { name: n, value: vals[i] }; }) }] };
			}
			var bar = t.chart === "bar", stacked = t.chart === "stacked",
				cat = { type: "category", data: names, axisLabel: Object.assign({ interval: 0, rotate: t.dim === "domain" && !bar ? (rtl ? -30 : 30) : 0, width: 70, overflow: "truncate" }, lbl), axisTick: { show: false }, axisLine: { lineStyle: { color: c.grid } } },
				val = { type: "value", axisLabel: lbl, splitLine: { lineStyle: { color: c.grid } } },
				series = stacked ? CR_ST.map(function (s, j) {
					return { name: that.text("st.cr." + s), type: "bar", stack: "s", barMaxWidth: 34, itemStyle: { color: pal[j] }, data: vals.map(function (v) { return v[j]; }) };
				}) : [{ name: this.text("st.m." + t.measure), type: t.chart === "line" ? "line" : "bar", barMaxWidth: 34, smooth: false, symbolSize: 6,
					itemStyle: { color: pal[0] }, lineStyle: { color: pal[0] },
					label: { show: showLbl, position: bar ? (rtl ? "left" : "right") : "top", fontSize: 10, color: c.text, formatter: "{c}" + unit }, data: vals }];
			return { animation: false, tooltip: { trigger: "axis" },
				legend: { show: stacked && t.legend !== false, bottom: 0, textStyle: lbl, itemWidth: 10, itemHeight: 10 },
				grid: { left: rtl && bar ? 40 : 8, right: !rtl && bar ? 40 : 8, top: 20, bottom: stacked ? 30 : 4, containLabel: true },
				xAxis: bar ? Object.assign(val, { inverse: rtl }) : Object.assign(cat, { inverse: rtl }),
				yAxis: bar ? Object.assign(cat, { inverse: true, position: rtl ? "right" : "left", axisLabel: Object.assign({ width: 80, overflow: "truncate" }, lbl) }) : Object.assign(val, { position: rtl ? "right" : "left" }),
				series: series };
		},

		/* ---------- rendering ---------- */
		_tiles: function () { var k = this.viewModel().getProperty("/st/page"); return this._pages.filter(function (p) { return p.key === k; })[0].tiles; },
		_pagesModel: function () { this.viewModel().setProperty("/st/pages", this._pages.map(function (p) { return { key: p.key, text: p.text }; })); },

		_render: function () {
			var that = this, oCanvas = this.byId("stCanvas"), sel = this.viewModel().getProperty("/st/sel"), tiles = this._tiles();
			oCanvas.destroyItems();
			this.byId("stEmpty").setVisible(!tiles.length);
			tiles.forEach(function (t) { oCanvas.addItem(that._tile(t, t.id === sel)); });
			this._builder();
		},
		_tile: function (t, bSel) {
			var that = this, u = MEASURES[t.measure],
				oBtn = new Button({ icon: "sap-icon://overflow", type: "Transparent", tooltip: this.text("st.tileMenu"), press: function () { that._menu(t, oBtn); } }).addStyleClass("repoioStTileMenu"),
				oBody = t.chart === "kpi"
					? new VBox({ alignItems: "Center", justifyContent: "Center", height: "12rem", items: [
						new NumericContent({ value: String(this._data(t)[0]), scale: u === "pct" ? "%" : u === "hours" ? this.text("st.u.h") : "", withMargin: false,
							indicator: t.delta < 0 ? "Down" : "Up", valueColor: t.delta < 0 ? "Good" : "Neutral", animateTextChange: false }),
						new Text({ text: this.text("st.kpiDelta", [t.delta || 0]) }).addStyleClass("repoioStKpiDelta")] })
					: new EChart({ height: "12rem", option: this._option(t), ariaLabel: this._title(t) }),
				oTile = new VBox({ renderType: "Bare", items: [
					new HBox({ alignItems: "Start", justifyContent: "SpaceBetween", items: [
						new VBox({ items: [new Title({ text: this._title(t), level: "H4", titleStyle: "H6", wrapping: false }),
							new Text({ text: this.text("st.sub." + (u === "pct" ? "pct" : u === "hours" ? "hours" : "count")) }).addStyleClass("repoioStTileSub")] }),
						oBtn] }).addStyleClass("repoioStTileHead"),
					oBody] }).addStyleClass("repoioStTile");
			if (bSel) { oTile.addStyleClass("repoioStTileSel"); }
			if (t.wide) { oTile.addStyleClass("repoioStTileWide"); }
			oTile.attachBrowserEvent("click", function (e) {
				if (!that.viewModel().getProperty("/st/edit") || e.target.closest(".repoioStTileMenu")) { return; }
				that.viewModel().setProperty("/st/sel", t.id);
				that.byId("stCanvas").getItems().forEach(function (o) { o.removeStyleClass("repoioStTileSel"); });
				oTile.addStyleClass("repoioStTileSel");
				that._builder();
			});
			return oTile;
		},
		_redraw: function (t) { this._dirty(); this._render(); },
		_dirty: function () {
			var vm = this.viewModel();
			vm.setProperty("/st/dirty", true);
			vm.setProperty("/st/titleText", vm.getProperty("/st/title") + "*");
		},

		/* Tile "⋯" menu (SAC). View mode keeps only the reading actions. */
		_menu: function (t, oBtn) {
			var that = this, edit = this.viewModel().getProperty("/st/edit"),
				mi = function (key, icon, items) { return new MenuItem({ key: key, text: that.text("st.mn." + key), icon: icon, items: items || [] }); },
				oMenu = new Menu({ items: [
					mi("sort", "sap-icon://sort", [mi("sortDesc", "sap-icon://sort-descending"), mi("sortAsc", "sap-icon://sort-ascending"), mi("sortNone", "sap-icon://decline")]),
					mi("rank", "sap-icon://competitor", [mi("top3"), mi("top5"), mi("rankNone")]),
					edit ? mi("linked", "sap-icon://chain-link") : null,
					mi("compare", "sap-icon://compare"),
					edit ? mi("showHide", "sap-icon://show", [mi("labels"), mi("legend")]) : null,
					edit ? mi("duplicate", "sap-icon://copy") : null,
					mi("export", "sap-icon://excel-attachment"),
					mi("fullscreen", "sap-icon://full-screen"),
					mi("pin", "sap-icon://pushpin-off"),
					edit ? mi("remove", "sap-icon://delete") : null
				].filter(Boolean), itemSelected: function (e) { that._menuAction(t, e.getParameter("item").getKey()); } });
			this.getView().addDependent(oMenu);
			oMenu.attachEvent("closed", function () { setTimeout(function () { oMenu.destroy(); }, 0); });
			oMenu.openBy(oBtn);
		},
		_menuAction: function (t, k) {
			var that = this, tiles = this._tiles();
			switch (k) {
				case "sortDesc": t.sort = "desc"; this._redraw(t); break;
				case "sortAsc": t.sort = "asc"; this._redraw(t); break;
				case "sortNone": t.sort = ""; this._redraw(t); break;
				case "top3": t.rank = 3; t.sort = t.sort || "desc"; this._redraw(t); break;
				case "top5": t.rank = 5; t.sort = t.sort || "desc"; this._redraw(t); break;
				case "rankNone": t.rank = 0; this._redraw(t); break;
				case "labels": t.labels = t.labels === false; this._redraw(t); break;
				case "legend": t.legend = t.legend === false; this._redraw(t); break;
				case "duplicate":
					tiles.splice(tiles.indexOf(t) + 1, 0, Object.assign(JSON.parse(JSON.stringify(t)), { id: "n" + (++this._n) }));
					this._redraw(t); break;
				case "remove":
					MessageBox.confirm(this.text("st.removeConfirm", [this._title(t)]), { onClose: function (a) {
						if (a !== MessageBox.Action.OK) { return; }
						tiles.splice(tiles.indexOf(t), 1);
						if (that.viewModel().getProperty("/st/sel") === t.id) { that.viewModel().setProperty("/st/sel", ""); }
						that._redraw(t);
					} });
					break;
				case "fullscreen": this._fullscreen(t); break;
				case "linked": MessageToast.show(this.text("st.t.linked", [this._title(t)])); break;
				case "compare": MessageToast.show(this.text("st.t.compare")); break;
				case "export": MessageToast.show(this.text("st.t.export", [this._title(t)])); break;
				case "pin": MessageToast.show(this.text("st.t.pin", [this._title(t)])); break;
			}
		},
		_fullscreen: function (t) {
			var oDlg = new Dialog({ title: this._title(t), stretch: true, content: [
				t.chart === "kpi" ? new Text({ text: String(this._data(t)[0]) }) : new EChart({ height: "calc(100vh - 8rem)", option: this._option(t) })],
				endButton: new Button({ text: this.text("common.close"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); } });
			this.getView().addDependent(oDlg);
			oDlg.open();
		},

		/* ---------- builder ---------- */
		_selTile: function () { var id = this.viewModel().getProperty("/st/sel"); return this._tiles().filter(function (t) { return t.id === id; })[0]; },
		_builder: function () {
			var that = this, t = this._selTile(), vm = this.viewModel(), gov = this._source === GOV_SOURCE;
			if (!t) { vm.setProperty("/st/sel", ""); return; }
			vm.setProperty("/st/b", {
				source: this._source, type: t.chart,
				types: TYPES.map(function (x) { return { key: x[0], icon: x[1], text: that.text("st.ct." + x[0]), selected: x[0] === t.chart }; }),
				measure: this.text("st.m." + t.measure),
				measures: Object.keys(MEASURES).filter(function (m) { return gov ? m !== "customers" : m === "customers"; }).map(function (m) { return { key: m, text: that.text("st.m." + m) }; }),
				dim: this.text("rp.dim." + t.dim), dimKey: t.chart === "kpi" ? "none" : t.dim,
				dims: (gov ? GOV_DIMS : ALP_DIMS).map(function (d) { return { key: d, text: that.text("rp.dim." + d) }; }),
				palettes: Object.keys(PALETTES).map(function (p) { return { key: p, text: that.text("st.pal." + p), selected: (t.palette || "blue") === p }; }),
				filters: [{ text: this.text(t.dim === "week" ? "st.f.weeks" : "st.f.current") }, { text: this.text("st.f.grants") }]
			});
		},
		onChartType: function (oEvent) {
			var t = this._selTile(), k = oEvent.getSource().getBindingContext("view").getProperty("key");
			if (k === "stacked" && t.dim !== "domain" && this._source === GOV_SOURCE) { t.dim = "domain"; }
			if (k === "stacked" && this._source !== GOV_SOURCE) { MessageToast.show(this.text("st.t.noStack")); return; }
			t.chart = k;
			if (k === "kpi") { t.delta = t.delta || -2.1; }
			this._redraw(t);
		},
		onMeasure: function (oEvent) { var t = this._selTile(); t.measure = oEvent.getParameter("item").getKey(); delete t.title; this._redraw(t); },
		onDim: function (oEvent) { var t = this._selTile(); t.dim = oEvent.getParameter("item").getKey(); t.rank = 0; delete t.title; this._redraw(t); },
		onPalette: function (oEvent) { var t = this._selTile(); t.palette = oEvent.getSource().getBindingContext("view").getProperty("key"); this._redraw(t); },

		/* ---------- toolbar ---------- */
		_setMode: function (m) {
			var vm = this.viewModel();
			vm.setProperty("/st/mode", m);
			vm.setProperty("/st/edit", m === "edit");
			if (m !== "edit") { vm.setProperty("/st/sel", ""); }
			vm.setProperty("/st/titleText", vm.getProperty("/st/title") + (vm.getProperty("/st/dirty") ? "*" : ""));
		},
		onMode: function () { this._setMode(this.viewModel().getProperty("/st/mode")); this._render(); },
		onPage: function () { this.viewModel().setProperty("/st/sel", ""); this._render(); },
		onInsert: function (oEvent) {
			var k = oEvent.getParameter("item").getKey(), gov = this._source === GOV_SOURCE;
			if (k === "chart" || k === "kpi") {
				var t = { id: "n" + (++this._n), measure: gov ? (k === "kpi" ? "crCycle" : "goldenRecords") : "customers", dim: gov ? "domain" : "region", chart: k === "kpi" ? "kpi" : "column", delta: k === "kpi" ? -2.1 : undefined };
				this._tiles().push(t);
				this.viewModel().setProperty("/st/sel", t.id);
				this._redraw(t);
			} else { MessageToast.show(this.text("st.t.insertProto", [this.text("st.ins." + k)])); }
		},
		onInsertChart: function () { this.onInsert({ getParameter: function () { return { getKey: function () { return "chart"; } }; } }); },
		onStoryFilter: function () { MessageToast.show(this.text("st.t.storyFilter")); },
		onLinked: function () { MessageToast.show(this.text("st.t.linkedAll")); },
		onBroadcast: function () { this.router().navTo("broadcasts", { query: { report: this._report.id } }); },
		onSave: function () {
			var vm = this.viewModel(), pub = this._report && this._report.status === "published";
			vm.setProperty("/st/dirty", false);
			vm.setProperty("/st/titleText", vm.getProperty("/st/title"));
			MessageToast.show(this.text(pub ? "st.t.savedDraft" : "st.t.saved", [vm.getProperty("/st/title")]));
		},
		onBack: function () {
			var that = this;
			if (!this.viewModel().getProperty("/st/dirty")) { this.router().navTo("reports"); return; }
			MessageBox.warning(this.text("st.leaveConfirm"), { actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
				onClose: function (a) { if (a === MessageBox.Action.OK) { that.viewModel().setProperty("/st/dirty", false); that.router().navTo("reports"); } } });
		}
	});
});
