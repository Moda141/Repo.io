sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/sync",
	"repoio/proto/util/people",
	"repoio/proto/util/jobRuns",
	"sap/ui/core/Fragment",
	"sap/m/MessagePopover",
	"sap/m/MessageItem",
	"sap/m/Menu",
	"sap/m/MenuItem",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Label",
	"sap/m/Input",
	"sap/m/Text",
	"sap/m/Switch",
	"sap/m/MessageStrip",
	"sap/ui/layout/form/SimpleForm",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"repoio/proto/util/folders"
], function (BaseController, S, people, R, Fragment, MessagePopover, MessageItem, Menu, MenuItem, Dialog, Button, Label, Input, Text, Switch, MessageStrip,
	SimpleForm, MessageToast, MessageBox, Fld) {
	"use strict";

	var NOW = "2026-11-11 14:10",
		CONTAINER_TYPE = { c4c: "sap-icon://cloud", hana: "sap-icon://database", mssql: "sap-icon://database", file: "sap-icon://folder-blank" };

	function techName(s) { return "SYNC_" + String(s || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40); }

	/* J15: replication flow editor following the SAP Datasphere steps. The flow is a control-plane definition;
	   Deploy creates the ingest job (Airflow pull DAG or upload endpoint) that writes to raw.<entity>. */
	return BaseController.extend("repoio.proto.controller.DataSync", {
		onInit: function () {
			this.viewModel().setProperty("/sf", { selIdx: -1, msgs: [], dirty: false, mid: "projections", details: true, qSrc: "", qTgt: "" });
			this.router().getRoute("dataSyncFlow").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this, id = oEvent.getParameter("arguments").id, oM = this.getOwnerComponent().getModel("sync");
			Promise.all([oM.dataLoaded(), this.data().dataLoaded()]).then(function () {
				that._sync = oM.getData();
				that._orig = id === "new" ? null : that._sync.flows.filter(function (f) { return f.id === id; })[0];
				that._f = that._orig ? JSON.parse(JSON.stringify(that._orig)) :
					{ id: "", en: "", ar: "", conn: "", container: "", repo: "", status: "draft", interval: "1h", at: "02:00",
						owner: "محمد", changed: NOW, job: "", lastRun: "", lastState: "", objects: [] };
				var vm = that.viewModel();
				vm.setProperty("/sf/isNew", !that._orig);
				vm.setProperty("/sf/dirty", false);
				vm.setProperty("/sf/msgs", []);
				vm.setProperty("/sf/selIdx", -1);
				vm.setProperty("/sf/qSrc", "");
				vm.setProperty("/sf/qTgt", "");
				that._refresh();
			});
		},

		/* ---------- model → view ---------- */
		_refresh: function () {
			var that = this, vm = this.viewModel(), f = this._f, ar = this.lang() === "ar", conn = f.conn ? S.conn(this, f.conn) : null,
				repo = f.repo ? S.repo(this, f.repo) : null, d = repo ? S.dom(this, repo.domainId) : null, ents = this._sync.entities, dirty = vm.getProperty("/sf/dirty");
			vm.setProperty("/sf/f", f);
			vm.setProperty("/sf/status", f.status);
			vm.setProperty("/sf/lastRun", f.lastRun);
			var name = (ar ? f.ar : f.en) || f.en || f.ar;
			vm.setProperty("/sf/name", name);
			vm.setProperty("/sf/titleText", (name || this.text("ds.untitled")) + (dirty ? "*" : ""));
			var st = S.STATUS[f.status];
			vm.setProperty("/sf/statusText", this.text("ds.st." + f.status));
			vm.setProperty("/sf/statusState", st[0]);
			vm.setProperty("/sf/statusIcon", st[1]);
			var pp = people.get(f.owner);
			vm.setProperty("/sf/ownerText", pp && !ar ? pp.en : f.owner);
			// ADR-0005: Deploy writes the flow's DAG to dags/<domain>/<repository>/sync/<flow>.py.
			var seg = f.repo ? Fld.path(this, f.repo, "sync") : null;
			vm.setProperty("/sf/dagFile", seg && f.id ? Fld.file(seg, f.id) : "—");
			vm.setProperty("/sf/dagId", seg && f.id ? Fld.dagId(seg, f.id) : "—");
			vm.setProperty("/sf/connText", conn ? S.connText(this, conn) : "");
			vm.setProperty("/sf/connType", conn ? this.text("ds.ct." + conn.type) : "");
			vm.setProperty("/sf/connIcon", conn ? S.icon(conn) : "");
			vm.setProperty("/sf/delta", conn ? S.deltaMethod(conn) : "");
			vm.setProperty("/sf/repoText", repo ? repo.name : "");
			vm.setProperty("/sf/domText", d ? this.domainName(d) : "");
			vm.setProperty("/sf/domIcon", d ? d.icon : "sap-icon://database");
			vm.setProperty("/sf/targetContainer", repo ? this.text("ds.targetContainer", [repo.model]) : "");
			var mins = f.interval === "15m" ? 15 : f.interval === "1h" ? 60 : f.interval === "daily" ? 1440 : (f.mins || 60);
			vm.setProperty("/sf/hours", Math.floor(mins / 60));
			vm.setProperty("/sf/minutes", mins % 60);
			vm.setProperty("/sf/emptyText", this.text(!f.conn ? "ds.empty.conn" : !f.container ? "ds.empty.container" : !f.repo ? "ds.empty.target" : "ds.noObjects"));
			vm.setProperty("/sf/objTitle", this.text("ds.objTitle", [f.objects.length]));
			var sel = vm.getProperty("/sf/selIdx"), qs = (vm.getProperty("/sf/qSrc") || "").toLowerCase(), qt = (vm.getProperty("/sf/qTgt") || "").toLowerCase();
			vm.setProperty("/sf/rows", f.objects.map(function (o, i) {
				var fields = ents[o.entity] || [], miss = fields.filter(function (x) { return x.req && !o.mapping[x.name]; }).map(function (x) { return x.name; });
				return { idx: i, source: o.source, entity: o.entity, load: o.load, truncate: !!o.truncate, projection: !!o.projection, sel: i === sel,
					srcLabel: o.source + " (" + (that._sync.source[o.source] || []).length + ")", srcInfo: o.rows ? that.text("ds.rows", [that.fmt.num(o.rows)]) : o.source,
					tgtLabel: o.entity + " (" + fields.length + ")", isNewTarget: f.status === "draft",
					pjName: o.projectionName || o.source.replace(/^.*\./, "") + "_PRJ", nFilters: String((o.filters || []).length),
					nMap: Object.keys(o.mapping).length + "/" + fields.length, missing: miss.length > 0,
					mapTip: miss.length ? that.text("ds.pj.missing", [miss.join(", ")]) : that.text("ds.mapped", [Object.keys(o.mapping).length, fields.length]) };
			}).filter(function (r) { return (!qs || r.source.toLowerCase().indexOf(qs) > -1) && (!qt || r.entity.toLowerCase().indexOf(qt) > -1); }));
			var cts = conn ? this.text("ds.cts." + conn.type) : "", ctx = conn ? S.connText(this, conn) : "";
			vm.setProperty("/sf/connLine", conn ? (ctx.indexOf(cts) > -1 ? ctx : ctx + " (" + cts + ")") : "");
			vm.setProperty("/sf/pjTab", this.text("ds.pjTab", [f.objects.filter(function (o) { return o.projection; }).length]));
			vm.setProperty("/sf/srcObjTitle", this.text("ds.objectsN", [f.objects.length]));
			var oT = this.byId("sfObjects");
			oT.removeSelections(true);
			oT.getItems().forEach(function (it) { if (it.getBindingContext("view").getProperty("idx") === sel) { oT.setSelectedItem(it); } });
			var hasD = f.objects.some(function (o) { return o.load === "delta"; }), la = S.LAST[f.lastState];
			vm.setProperty("/sf/fact", {
				objects: String(f.objects.length),
				load: f.objects.length ? S.load(this, f) : "—",
				interval: conn ? S.interval(this, f) : "—",
				last: la ? this.text("jr.st." + f.lastState) + " · " + R.date(f.lastRun, this.lang()).replace(/:\d\d$/, "") : this.text("ds.never"), lastState: la ? la[0] : "None", lastIcon: la ? la[1] : ""
			});
			vm.setProperty("/sf/linkText", f.objects.length ? this.text("ds.linkText", [f.objects.length]) + (hasD ? "\n" + S.interval(this, f) : "") : "");
			this._objProps();
		},
		_objProps: function () {
			var that = this, vm = this.viewModel(), i = vm.getProperty("/sf/selIdx"), o = this._f.objects[i];
			if (!o) { vm.setProperty("/sf/selIdx", -1); return; }
			var conn = S.conn(this, this._f.conn), fields = this._sync.entities[o.entity] || [],
				okReq = fields.filter(function (x) { return x.req; }).every(function (x) { return o.mapping[x.name]; }),
				mapText = this.text("ds.mapped", [Object.keys(o.mapping).length, fields.length]);
			vm.setProperty("/sf/o", Object.assign({}, o, { hasProjection: !!o.projection }));
			vm.setProperty("/sf/oEntityText", this.text("ds.ent." + o.entity));
			vm.setProperty("/sf/oLoadText", this.text(o.load === "delta" ? "ds.load.delta" : "ds.load.initial"));
			vm.setProperty("/sf/deltaText", this.text("ds.dm." + S.deltaMethod(conn)));
			vm.setProperty("/sf/oMapText", (o.projection ? this.text("ds.pjOn") : this.text("ds.pjOff")) + " · " + mapText);
			vm.setProperty("/sf/oPrjName", o.projectionName || o.source.replace(/^.*\./, "") + "_PRJ");
			vm.setProperty("/sf/oPrjSub", ((o.filters || []).length ? this.text("ds.prjFilters", [o.filters.length]) : this.text("ds.noFilter")) + " · " + mapText);
			var missing = fields.filter(function (x) { return x.req && !o.mapping[x.name]; }).map(function (x) { return x.name; });
			vm.setProperty("/sf/oMissing", missing.length ? this.text("ds.pj.missing", [missing.join(", ")]) : "");
			var l = o.last || {};
			vm.setProperty("/sf/oInitial", l.initial ? this.fmt.num(l.initial) : "—");
			vm.setProperty("/sf/oDelta", l.initial ? this.fmt.num(l.delta || 0) : "—");
			vm.setProperty("/sf/oRejected", l.initial ? this.fmt.num(l.rejected || 0) : "—");
		},
		_dirty: function () {
			this.viewModel().setProperty("/sf/dirty", true);
			if (this._f.status === "deployed") { this._f.status = "changed"; }
			this._refresh();
		},
		onName: function () {
			var n = this.viewModel().getProperty("/sf/name");
			this._f[this.lang() === "ar" ? "ar" : "en"] = n;
			if (this.lang() === "ar" && !this._f.en) { this._f.en = n; }
			this._dirty();
		},
		onInterval: function () {
			var vm = this.viewModel(), m = (+vm.getProperty("/sf/hours")) * 60 + (+vm.getProperty("/sf/minutes"));
			if (m < 15) { m = 15; }
			this._f.interval = m === 15 ? "15m" : m === 60 ? "1h" : m === 1440 ? "daily" : "custom";
			this._f.mins = m;
			this._dirty();
		},

		/* ---------- compact picker (connection, container, target) ---------- */
		_picker: function (mode) {
			var that = this, vm = this.viewModel();
			this._spMode = mode;
			vm.setProperty("/sp", { q: "", sel: "", title: this.text({ conn: "ds.pickConn", container: "ds.pickContainer", target: "ds.pickTargetConn" }[mode]) });
			this._spFilter();
			var open = function (d) { that.byId("spList").removeSelections(true); d.open(); };
			if (this._sp) { open(this._sp); return; }
			Fragment.load({ id: this.getView().getId(), name: "repoio.proto.fragment.SourcePicker", controller: this }).then(function (d) {
				that._sp = d; that.getView().addDependent(d); open(d);
			});
		},
		_spFilter: function () {
			var that = this, vm = this.viewModel(), q = (vm.getProperty("/sp/q") || "").toLowerCase(), rows;
			if (this._spMode === "conn") {
				rows = (this.data().getProperty("/connections") || []).map(function (c) {
					var ok = c.state === "active";
					return { id: c.id, name: S.connText(that, c), type: that.text("ds.cts." + c.type), icon: S.icon(c),
						sub: that.text(ok ? "ds.sp.ok" : "ds.sp.attention"), state: ok ? "Success" : "Warning", stateIcon: ok ? "sap-icon://status-positive" : "sap-icon://status-critical" };
				});
			} else if (this._spMode === "container") {
				var ct = S.conn(this, this._f.conn).type;
				rows = (this._sync.containers[this._f.conn] || []).map(function (k) {
					return { id: k[0], name: k[0], type: that.text("ds.cts." + ct), sub: k[1], icon: CONTAINER_TYPE[ct], state: "None" };
				});
			} else {
				rows = Object.keys(this.data().getProperty("/repos")).map(function (k) {
					var r = S.repo(that, k), d = S.dom(that, r.domainId);
					return { id: r.code || k, key: k, name: r.name, type: d ? that.domainName(d) : "", sub: that.text("ds.targetContainer", [r.model]), icon: d ? d.icon : "sap-icon://database", state: "None" };
				});
			}
			vm.setProperty("/sp/rows", rows.filter(function (r) { return !q || [r.id, r.name, r.type, r.sub].join(" ").toLowerCase().indexOf(q) > -1; }));
		},
		onSpSearch: function () { this._spFilter(); },
		onSpSelect: function (oEvent) { var r = oEvent.getParameter("listItem").getBindingContext("view").getObject(); this.viewModel().setProperty("/sp/sel", r.key || r.id); },
		onSpConfirm: function () {
			var id = this.viewModel().getProperty("/sp/sel"), f = this._f;
			if (this._spMode === "conn") {
				if (f.conn !== id) { f.container = ""; }
				f.conn = id;
				var c = S.conn(this, id);
				if (c.type === "file") { f.interval = "upload"; } else if (f.interval === "upload") { f.interval = "1h"; }
			} else if (this._spMode === "container") { f.container = id; } else { f.repo = id; }
			this._sp.close();
			this._dirty();
		},
		onSpCancel: function () { this._sp.close(); },
		onSpAfterClose: function () {},
		onPickConn: function () { this._picker("conn"); },
		onPickContainer: function () { this._picker("container"); },
		onPickTarget: function () { this._picker("target"); },
		onConn: function () { this.router().navTo("connections", { conn: this._f.conn }); },

		/* Target settings (settings icon next to the target, Datasphere): fixed for a Repo.io repository. */
		onTargetSettings: function () {
			var oDlg = new Dialog({ title: this.text("ds.targetSettings"), contentWidth: "28rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanL: 6, labelSpanM: 6, content: [
					new Label({ text: this.text("ds.ts.deltaCapture") }), new Switch({ state: true, enabled: false }),
					new Label({ text: this.text("ds.ts.quarantine") }), new Switch({ state: true, enabled: false }),
					new Label({ text: this.text("ds.ts.topic") }), new Text({ text: this.viewModel().getProperty("/sf/objects").map(function (o) { return "raw." + o.entity; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(", ") || "raw.<entity>" }).addStyleClass("repoioMono")
				] }), new MessageStrip({ text: this.text("ds.ts.note"), type: "Information", showIcon: true }).addStyleClass("sapUiSmallMargin")],
				endButton: new Button({ text: this.text("common.close"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); } });
			this.getView().addDependent(oDlg);
			oDlg.open();
		},

		/* ---------- Add Source Objects (browse → Next → Add Selection) ---------- */
		onAddObjects: function () {
			var that = this, vm = this.viewModel(), f = this._f;
			if (!f.repo) { MessageToast.show(this.text("ds.t.targetFirst")); this.onPickTarget(); return; }
			var have = f.objects.map(function (o) { return o.source; });
			this._aoAll = (this._sync.catalog[f.conn] || []).filter(function (t) { return have.indexOf(t) < 0; }).map(function (t) {
				var known = (that._sync.flows.map(function (x) { return x.objects; }).reduce(function (a, b) { return a.concat(b); }, []).filter(function (o) { return o.source === t && o.rows; })[0] || {}).rows;
				return { name: t, cols: (that._sync.source[t] || []).length, rows: known ? that.fmt.num(known) : "—", type: that.text("ds.ot." + S.conn(that, f.conn).type) };
			});
			var cn = S.conn(this, f.conn);
			vm.setProperty("/ao", { q: "", step: 1, count: 0, container: f.container, rows: this._aoAll, picked: [],
				searchIn: this.text("ds.ao.searchIn", [cn.id, f.container]), searchPh: this.text("ds.ao.searchPh", [cn.id, f.container]),
				countText: this.text("ds.objectsN", [this._aoAll.length]), selectionText: this.text("ds.ao.selection", [0]) });
			var open = function (d) { that.byId("aoTable").removeSelections(true); that.byId("aoNav").to(that.byId("aoPick")); d.open(); };
			if (this._ao) { open(this._ao); return; }
			Fragment.load({ id: this.getView().getId(), name: "repoio.proto.fragment.AddObjects", controller: this }).then(function (d) {
				that._ao = d; that.getView().addDependent(d); open(d);
			});
		},
		onAoSearch: function () {
			var vm = this.viewModel(), q = (vm.getProperty("/ao/q") || "").toLowerCase();
			vm.setProperty("/ao/rows", this._aoAll.filter(function (r) { return r.name.toLowerCase().indexOf(q) > -1; }));
		},
		onAoSelect: function () {
			var n = this.byId("aoTable").getSelectedItems().length;
			this.viewModel().setProperty("/ao/count", n);
			this.viewModel().setProperty("/ao/selectionText", this.text("ds.ao.selection", [n]));
		},
		onAoTab: function (oEvent) {
			if (oEvent.getParameter("item").getKey() === "sel") { if (this.viewModel().getProperty("/ao/count")) { this.onAoNext(); } else { this.viewModel().setProperty("/ao/step", 1); } }
			else { this.onAoBack(); }
		},
		onAoNext: function () {
			var that = this, ents = this._sync.entitiesByDomain[S.repo(this, this._f.repo).domainId] || [],
				picked = this.byId("aoTable").getSelectedItems().map(function (it) { return it.getBindingContext("view").getProperty("name"); });
			this._aoPicked = picked.map(function (t) { return { name: t, entity: that._guessEntity(t, ents) }; });
			var cn = this._f.conn + "/" + this._f.container + "/", ty = this.text("ds.ot." + S.conn(this, this._f.conn).type);
			this.viewModel().setProperty("/ao/picked", this._aoPicked.map(function (p) { return { name: p.name, type: ty, location: (cn + p.name).replace(/\/\//g, "/"), target: p.entity + " · " + that.text("ds.ent." + p.entity) }; }));
			this.viewModel().setProperty("/ao/pickedTitle", this.text("ds.ao.review", [picked.length]));
			this.viewModel().setProperty("/ao/step", 2);
			this.byId("aoNav").to(this.byId("aoReview"));
		},
		onAoBack: function () { this.viewModel().setProperty("/ao/step", 1); this.byId("aoNav").back(); },
		onAoAdd: function () {
			var that = this, f = this._f, upload = S.deltaMethod(S.conn(this, f.conn)) === "upload";
			this._aoPicked.forEach(function (p) {
				f.objects.push({ id: p.name, source: p.name, entity: p.entity, load: upload ? "initial" : "delta", truncate: false, filters: [], projection: false,
					mapping: that._autoMap(p.name, p.entity), last: {}, rows: null });
			});
			this._ao.close();
			this._dirty();
		},
		onAoCancel: function () { this._ao.close(); },
		/* Default target object: the domain entity whose name best matches the source object. */
		_guessEntity: function (t, ents) {
			var n = t.toLowerCase();
			return ents.filter(function (e) { return /addr/.test(n) ? /address/.test(e) : /contact/.test(n) ? /contact/.test(e) : false; })[0] || ents[0];
		},

		onRemoveObject: function () {
			var i = this.viewModel().getProperty("/sf/selIdx");
			this._f.objects.splice(i, 1);
			this.viewModel().setProperty("/sf/selIdx", -1);
			this._dirty();
		},
		onObjSelect: function (oEvent) { this._select(oEvent.getParameter("listItem").getBindingContext("view").getProperty("idx")); },
		_rowIdx: function (oEvent) { return oEvent.getSource().getBindingContext("view").getProperty("idx"); },
		onRowSearch: function () { this._refresh(); },
		onRowSetting: function (oEvent) {
			var r = oEvent.getSource().getBindingContext("view").getObject(), o = this._f.objects[r.idx];
			o.load = r.load; o.truncate = r.truncate;
			if (r.truncate) { MessageToast.show(this.text("ds.truncateWarn")); }
			this._dirty();
		},
		onRowProjection: function (oEvent) { this._select(this._rowIdx(oEvent)); this.onProjection(); },
		onRowRemoveProjection: function (oEvent) { this._select(this._rowIdx(oEvent)); this.onRemoveProjection(); },
		onRemoveRow: function (oEvent) { this._select(this._rowIdx(oEvent)); this.onRemoveObject(); },
		onCloseDetails: function () { this.viewModel().setProperty("/sf/details", false); },
		onObjChange: function () {
			var i = this.viewModel().getProperty("/sf/selIdx"), o = this.viewModel().getProperty("/sf/o");
			this._f.objects[i].load = o.load;
			this._f.objects[i].truncate = o.truncate;
			this._dirty();
		},

		/* Additional options next to a target object (Datasphere: rename / map to existing). The target is always an
		   entity of the repository's model, so it can only be switched to another entity of the domain. */
		onTargetOptions: function (oEvent) {
			var that = this, oBtn = oEvent.getSource(), i = this._rowIdx(oEvent), o = this._f.objects[i],
				ents = this._sync.entitiesByDomain[S.repo(this, this._f.repo).domainId] || [],
				oMenu = new Menu({ items: [
					new MenuItem({ text: this.text("ds.opt.map"), icon: "sap-icon://dimension", items: ents.map(function (e) {
						return new MenuItem({ text: e + " · " + that.text("ds.ent." + e), key: e, icon: e === o.entity ? "sap-icon://accept" : "" });
					}) }),
					new MenuItem({ text: this.text("ds.opt.rename"), icon: "sap-icon://edit", enabled: false, tooltip: this.text("ds.opt.renameNo") }),
					new MenuItem({ text: this.text("ds.opt.projection"), icon: "sap-icon://filter-fields", key: "__pj" })
				], itemSelected: function (e) {
					var k = e.getParameter("item").getKey();
					if (!k) { return; }
					if (k === "__pj") { that._select(i); that.onProjection(); return; }
					o.entity = k; o.mapping = that._autoMap(o.source, k); that._dirty();
				} });
			this.getView().addDependent(oMenu);
			oMenu.attachEvent("closed", function () { setTimeout(function () { oMenu.destroy(); }, 0); });
			oMenu.openBy(oBtn);
		},
		_select: function (i) {
			this.viewModel().setProperty("/sf/selIdx", i);
			this.viewModel().setProperty("/sf/details", true);
			this._refresh();
		},

		_autoMap: function (table, entity) {
			var cols = this._sync.source[table] || [], m = {}, alias = { name: ["Name", "NAME1", "full_name", "school_name", "TitleEn", "MAKTX"] };
			(this._sync.entities[entity] || []).forEach(function (fd) {
				var hit = cols.filter(function (c) {
					var a = c.name.toLowerCase().replace(/[^a-z]/g, ""), b = fd.name.toLowerCase().replace(/[^a-z]/g, "");
					return a === b || (alias[fd.name] || []).indexOf(c.name) > -1 || (fd.name === "source_key" && c.key);
				})[0];
				if (hit) { m[fd.name] = hit.name; }
			});
			return m;
		},

		/* ---------- projection (one per object, as in Datasphere) ---------- */
		onProjection: function () {
			var that = this, vm = this.viewModel(), o = this._f.objects[vm.getProperty("/sf/selIdx")],
				src = (this._sync.source[o.source] || []), fields = this._sync.entities[o.entity] || [];
			vm.setProperty("/pj", {
				title: this.text(o.projection ? "ds.pj.editTitle" : "ds.addProjection"), tab: "filters",
				name: o.projectionName || o.source.replace(/^.*\./, "") + "_PRJ", srcName: o.source, tgtName: o.entity,
				srcLine: this.text("ds.pj.srcLine", [o.source, src.length]), cur: {}, colQ: "",
				filters: JSON.parse(JSON.stringify(o.filters || [])), mapping: JSON.parse(JSON.stringify(o.mapping)),
				cols: src, src: src.map(function (c) { return { name: c.name, label: c.label, type: c.type === "code" ? "string" : c.type, key: c.key }; }),
				tgt: fields.map(function (x) { return { name: x.name, type: x.type, key: x.key, req: x.req, codeList: x.codeList }; }),
				texts: { all: this.text("fd.map.all"), mapped: this.text("fd.map.mapped"), unmapped: this.text("fd.map.unmapped"), search: this.text("fd.map.search"),
					src: o.source, tgt: o.entity, unmap: this.text("fd.map.unmap"), valueMap: this.text("ds.pj.valueMap"), auto: this.text("fd.map.auto"),
					hint: this.text("ds.pj.mapperHint"), count: this.text("fd.map.count"), fxTip: this.text("ds.pj.fxTip"), fx: {} }
			});
			this._pjTabs();
			this._pjCols();
			var open = function (d) { d.open(); };
			if (this._pj) { open(this._pj); return; }
			Fragment.load({ id: this.getView().getId(), name: "repoio.proto.fragment.Projection", controller: this }).then(function (d) {
				that._pj = d; that.getView().addDependent(d); open(d);
			});
		},
		/* Counts on the tabs, the required model fields still unmapped, and whether Apply is allowed. */
		_pjTabs: function () {
			var vm = this.viewModel(), p = vm.getProperty("/pj"),
				missing = p.tgt.filter(function (x) { return x.req && !p.mapping[x.name]; }).map(function (x) { return x.name; }),
				badFilter = p.filters.some(function (f) { return !f.col || !String(f.val || "").trim(); });
			vm.setProperty("/pj/filtersCount", String(p.filters.length));
			vm.setProperty("/pj/mapCount", Object.keys(p.mapping).length + " / " + p.tgt.length);
			vm.setProperty("/pj/missing", missing.length ? this.text("ds.pj.missing", [missing.join(", ")]) : "");
			vm.setProperty("/pj/valid", !!String(p.name || "").trim() && !badFilter);
		},
		onPjCheck: function () { this._pjTabs(); },
		/* Filter tab (Datasphere): select a source column, define the expression, Add Expression. */
		_opText: function (f) {
			var v = f.op === "between" ? f.val + ", " + f.val2 : f.val, o = { eq: "=", ne: "<>", between: "BETWEEN", in: "IN", notIn: "NOT IN" }[f.op];
			return "( " + f.col + " " + o + " " + (f.op === "in" || f.op === "notIn" ? "(" + v + ")" : v) + " )";
		},
		_pjCols: function () {
			var that = this, vm = this.viewModel(), p = vm.getProperty("/pj"), q = (p.colQ || "").toLowerCase(),
				used = p.filters.map(function (f) { return f.col; }), cur = (p.cur || {}).col,
				mark = { date: "📅", integer: "12", decimal: "1.2", code: "≡" };
			vm.setProperty("/pj/colRows", p.cols.filter(function (c) { return !q || (c.name + " " + c.label).toLowerCase().indexOf(q) > -1; }).map(function (c) {
				return { name: c.name, label: c.label, key: !!c.key, used: used.indexOf(c.name) > -1, selected: c.name === cur, typeMark: mark[c.type] || "AA" };
			}));
			vm.setProperty("/pj/filters", p.filters.map(function (f) { return Object.assign({}, f, { text: that._opText(f) }); }));
			vm.setProperty("/pj/expr", p.filters.map(function (f) { return that._opText(f); }).join(" AND "));
		},
		onPjColSearch: function () { this._pjCols(); },
		onPjColPick: function (oEvent) {
			var n = oEvent.getParameter("listItem").getBindingContext("view").getProperty("name");
			this.viewModel().setProperty("/pj/cur", { col: n, op: "eq", val: "", val2: "" });
			this.viewModel().setProperty("/pj/addFor", this.text("ds.pj.addFor", [n]));
		},
		onPjAddExpr: function () {
			var vm = this.viewModel(), c = vm.getProperty("/pj/cur"), a = vm.getProperty("/pj/filters").map(function (f) { return { col: f.col, op: f.op, val: f.val, val2: f.val2 }; });
			a.push({ col: c.col, op: c.op, val: c.val, val2: c.val2 });
			vm.setProperty("/pj/filters", a);
			vm.setProperty("/pj/cur", { col: c.col, op: "eq", val: "", val2: "" });
			this._pjTabs();
			this._pjCols();
		},
		onPjRemoveFilter: function (oEvent) {
			var vm = this.viewModel(), a = vm.getProperty("/pj/filters").slice(), i = +oEvent.getSource().getBindingContext("view").getPath().split("/").pop();
			a.splice(i, 1);
			vm.setProperty("/pj/filters", a);
			this._pjTabs();
			this._pjCols();
		},
		onPjMapping: function (oEvent) { this.viewModel().setProperty("/pj/mapping", oEvent.getParameter("mapping")); this._pjTabs(); },
		onPjTransform: function () { MessageToast.show(this.text("ds.t.noTransform")); },
		onPjApply: function () {
			var vm = this.viewModel(), o = this._f.objects[vm.getProperty("/sf/selIdx")], m = vm.getProperty("/pj/mapping"), plain = {};
			o.filters = vm.getProperty("/pj/filters").map(function (f) { return { col: f.col, op: f.op, val: f.val, val2: f.val2 }; });
			Object.keys(m).forEach(function (k) { plain[k] = typeof m[k] === "string" ? m[k] : m[k].src; });
			o.mapping = plain;
			o.projection = true;
			o.projectionName = vm.getProperty("/pj/name");
			this._pj.close();
			this._dirty();
		},
		onPjCancel: function () { this._pj.close(); },
		onRemoveProjection: function () {
			var o = this._f.objects[this.viewModel().getProperty("/sf/selIdx")];
			o.projection = false;
			o.filters = [];
			o.mapping = this._autoMap(o.source, o.entity);
			this._dirty();
		},

		/* ---------- toolbar: Save, Deploy, Run, Validate, monitor ---------- */
		_validate: function () {
			var msgs = S.validate(this, this._f, this._sync), vm = this.viewModel();
			if (!this._f.repo) { msgs.unshift({ type: "Error", title: this.text("ds.v.target") }); }
			if (!this._f.container && this._f.conn) { msgs.unshift({ type: "Error", title: this.text("ds.v.container") }); }
			if (!this._f.conn) { msgs.unshift({ type: "Error", title: this.text("ds.v.conn") }); }
			vm.setProperty("/sf/msgs", msgs);
			var err = msgs.filter(function (m) { return m.type === "Error"; }).length;
			vm.setProperty("/sf/msgCount", String(msgs.length));
			vm.setProperty("/sf/msgType", err ? "Reject" : msgs.length ? "Critical" : "Accept");
			return err;
		},
		onValidate: function () {
			var that = this;
			this._validate();
			if (!this.viewModel().getProperty("/sf/msgs").length) { MessageToast.show(this.text("ds.t.valid")); return; }
			setTimeout(function () { that.onMessages(); }, 50);
		},
		onMessages: function () {
			if (!this._mp) {
				this._mp = new MessagePopover({ items: { path: "view>/sf/msgs", template: new MessageItem({ type: "{view>type}", title: "{view>title}", subtitle: "{view>subtitle}" }) } });
				this.getView().addDependent(this._mp);
			}
			this._mp.openBy(this.byId("sfMsgBtn"));
		},
		_commit: function () {
			this._f.changed = NOW;
			if (this._orig) { Object.assign(this._orig, JSON.parse(JSON.stringify(this._f))); }
			else { this._orig = JSON.parse(JSON.stringify(this._f)); this._sync.flows.push(this._orig); this.viewModel().setProperty("/sf/isNew", false); }
			this.viewModel().setProperty("/sf/dirty", false);
		},
		/* Save: a new flow asks for its name first; the technical name is fixed after the first save (Datasphere). */
		onSave: function () {
			var that = this;
			if (this._orig) { this._commit(); this._refresh(); MessageToast.show(this.text(this._f.status === "changed" ? "ds.t.savedChanged" : "ds.t.saved", [this._f.id])); return; }
			var oName = new Input({ value: this.viewModel().getProperty("/sf/name"), valueLiveUpdate: true, liveChange: function (e) { oTech.setValue(techName(e.getParameter("value"))); oOk.setEnabled(!!e.getParameter("value").trim()); } }),
				oTech = new Input({ value: techName(oName.getValue()) }).addStyleClass("repoioMono"),
				oOk = new Button({ text: this.text("common.save"), type: "Emphasized", enabled: !!oName.getValue().trim(), press: function () {
					that._f[that.lang() === "ar" ? "ar" : "en"] = oName.getValue();
					if (!that._f.en) { that._f.en = oName.getValue(); }
					that._f.id = oTech.getValue();
					oDlg.close();
					that._commit();
					that._refresh();
					MessageToast.show(that.text("ds.t.saved", [that._f.id]));
				} }),
				oDlg = new Dialog({ title: this.text("ds.saveTitle"), contentWidth: "26rem",
					content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanL: 12, labelSpanM: 12, content: [
						new Label({ text: this.text("dsp.businessName"), required: true }), oName,
						new Label({ text: this.text("dsp.technicalName"), required: true }), oTech
					] }), new MessageStrip({ text: this.text("ds.saveNote"), type: "Information", showIcon: true }).addStyleClass("sapUiSmallMargin")],
					beginButton: oOk, endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
					afterClose: function () { oDlg.destroy(); } });
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		onDeploy: function () {
			if (this._validate()) { this.onMessages(); MessageToast.show(this.text("ds.t.fixFirst")); return; }
			this._f.status = "deployed";
			if (!this._f.job) { this._f.job = this._f.id.toLowerCase(); }
			this._commit();
			this._refresh();
			MessageToast.show(this.text("ds.t.deployedOne", [this._f.id]));
		},
		onRun: function () {
			if (this.viewModel().getProperty("/sf/dirty")) { MessageToast.show(this.text("ds.t.saveFirst")); return; }
			this._f.lastState = "running";
			this._f.lastRun = NOW;
			this._commit();
			this._refresh();
			MessageToast.show(this.text("ds.t.runOne", [this._f.id]));
		},
		onMonitor: function () {
			this.viewModel().setProperty("/jrPending", this._f.job || this._f.id.toLowerCase());
			this.router().navTo("jobs");
		},
		onBack: function () {
			var that = this;
			if (!this.viewModel().getProperty("/sf/dirty")) { this.router().navTo("dataSync"); return; }
			MessageBox.warning(this.text("st.leaveConfirm"), { actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
				onClose: function (a) { if (a === MessageBox.Action.OK) { that.viewModel().setProperty("/sf/dirty", false); that.router().navTo("dataSync"); } } });
		}
	});
});
