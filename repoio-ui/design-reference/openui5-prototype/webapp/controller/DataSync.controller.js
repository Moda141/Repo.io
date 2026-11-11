sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/sync",
	"repoio/proto/util/people",
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
	"sap/m/MessageBox"
], function (BaseController, S, people, Fragment, MessagePopover, MessageItem, Menu, MenuItem, Dialog, Button, Label, Input, Text, Switch, MessageStrip,
	SimpleForm, MessageToast, MessageBox) {
	"use strict";

	var NOW = "2026-11-11 14:10",
		CONTAINER_TYPE = { c4c: "sap-icon://cloud", hana: "sap-icon://database", mssql: "sap-icon://database", file: "sap-icon://folder-blank" };

	function techName(s) { return "SYNC_" + String(s || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40); }

	/* J15: replication flow editor following the SAP Datasphere steps. The flow is a control-plane definition;
	   Deploy creates the ingest job (Airflow pull DAG or upload endpoint) that writes to raw.<entity>. */
	return BaseController.extend("repoio.proto.controller.DataSync", {
		onInit: function () {
			this.viewModel().setProperty("/sf", { selIdx: -1, msgs: [], dirty: false, tab: "projections" });
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
				that.byId("sfObjects").removeSelections(true);
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
			vm.setProperty("/sf/connText", conn ? S.connText(this, conn) : "");
			vm.setProperty("/sf/connType", conn ? this.text("ds.ct." + conn.type) : "");
			vm.setProperty("/sf/logo", conn ? S.logo(conn) : "");
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
			vm.setProperty("/sf/objects", f.objects.map(function (o) {
				var fields = ents[o.entity] || [], okReq = fields.filter(function (x) { return x.req; }).every(function (x) { return o.mapping[x.name]; });
				return Object.assign({}, o, {
					srcSub: (o.rows ? that.text("ds.rows", [that.fmt.num(o.rows)]) + " · " : "") + that.text(o.load === "delta" ? "ds.load.delta" : "ds.load.initial") + (o.truncate ? " · " + that.text("ds.truncateShort") : ""),
					tgtSub: that.text("ds.ent." + o.entity) + " · raw." + o.entity,
					mapText: that.text("ds.mapped", [Object.keys(o.mapping).length, fields.length]), mapState: okReq ? "Success" : "Error"
				});
			}));
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
			vm.setProperty("/sf/oProj", o.projection ? [{ name: o.source.replace(/^.*\./, "") + "_PRJ",
				filterText: (o.filters || []).length ? o.filters.map(function (x) { return x.col + " " + that.text("ds.op." + x.op + "S") + " " + x.val; }).join("; ") : this.text("ds.noFilter"),
				mapText: mapText, mapState: okReq ? "Success" : "Error" }] : []);
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
			vm.setProperty("/sp", { q: "", sel: "", title: this.text({ conn: "ds.pickConn", container: "ds.pickContainer", target: "ds.pickTarget" }[mode]) });
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
					return { id: c.id, name: S.connText(that, c), sub: that.text("ds.ct." + c.type) + " · " + c.id, logo: S.logo(c),
						state: ok ? "Success" : "Warning", stateIcon: ok ? "sap-icon://status-positive" : "sap-icon://status-critical", stateText: that.text(ok ? "ds.sp.ok" : "ds.sp.attention") };
				});
			} else if (this._spMode === "container") {
				var ct = S.conn(this, this._f.conn).type;
				rows = (this._sync.containers[this._f.conn] || []).map(function (k) {
					return { id: k[0], name: k[0], sub: k[1], icon: CONTAINER_TYPE[ct] };
				});
			} else {
				rows = Object.keys(this.data().getProperty("/repos")).map(function (k) {
					var r = S.repo(that, k), d = S.dom(that, r.domainId);
					return { id: k, name: r.name, sub: (d ? that.domainName(d) : "") + " · " + that.text("ds.targetContainer", [r.model]), icon: d ? d.icon : "sap-icon://database" };
				});
			}
			vm.setProperty("/sp/rows", rows.filter(function (r) { return !q || (r.name + " " + r.sub + " " + r.id).toLowerCase().indexOf(q) > -1; }));
		},
		onSpSearch: function () { this._spFilter(); },
		onSpSelect: function (oEvent) { this.viewModel().setProperty("/sp/sel", oEvent.getParameter("listItem").getBindingContext("view").getProperty("id")); },
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
				return { name: t, cols: (that._sync.source[t] || []).length, rows: known ? that.fmt.num(known) : "—" };
			});
			vm.setProperty("/ao", { q: "", step: 1, count: 0, container: f.container, rows: this._aoAll, picked: [] });
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
		onAoSelect: function () { this.viewModel().setProperty("/ao/count", this.byId("aoTable").getSelectedItems().length); },
		onAoNext: function () {
			var that = this, ents = this._sync.entitiesByDomain[S.repo(this, this._f.repo).domainId] || [],
				picked = this.byId("aoTable").getSelectedItems().map(function (it) { return it.getBindingContext("view").getProperty("name"); });
			this._aoPicked = picked.map(function (t) { return { name: t, entity: that._guessEntity(t, ents) }; });
			this.viewModel().setProperty("/ao/picked", this._aoPicked.map(function (p) { return { name: p.name, target: that.text("ds.ao.to", [p.entity + " · " + that.text("ds.ent." + p.entity)]) }; }));
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
			this.byId("sfObjects").removeSelections(true);
			this.viewModel().setProperty("/sf/selIdx", -1);
			this._dirty();
		},
		onObjSelect: function (oEvent) {
			this.viewModel().setProperty("/sf/selIdx", this.byId("sfObjects").indexOfItem(oEvent.getParameter("listItem")));
			this._objProps();
		},
		onObjChange: function () {
			var i = this.viewModel().getProperty("/sf/selIdx"), o = this.viewModel().getProperty("/sf/o");
			this._f.objects[i].load = o.load;
			this._f.objects[i].truncate = o.truncate;
			this._dirty();
		},

		/* Additional options next to a target object (Datasphere: rename / map to existing). The target is always an
		   entity of the repository's model, so it can only be switched to another entity of the domain. */
		onTargetOptions: function (oEvent) {
			var that = this, oBtn = oEvent.getSource(), i = this.byId("sfObjects").indexOfItem(oBtn.getParent()), o = this._f.objects[i],
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
					if (k === "__pj") { that._select(i); that.viewModel().setProperty("/sf/tab", "projections"); that.onProjection(); return; }
					o.entity = k; o.mapping = that._autoMap(o.source, k); that._dirty();
				} });
			this.getView().addDependent(oMenu);
			oMenu.attachEvent("closed", function () { setTimeout(function () { oMenu.destroy(); }, 0); });
			oMenu.openBy(oBtn);
		},
		_select: function (i) {
			var t = this.byId("sfObjects");
			t.setSelectedItem(t.getItems()[i]);
			this.viewModel().setProperty("/sf/selIdx", i);
			this._objProps();
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
				title: this.text("ds.pj.title", [o.source, o.entity]), tab: "filters",
				filters: JSON.parse(JSON.stringify(o.filters || [])), mapping: JSON.parse(JSON.stringify(o.mapping)),
				cols: src, src: src.map(function (c) { return { name: c.name, label: c.label, type: c.type === "code" ? "string" : c.type, key: c.key }; }),
				tgt: fields.map(function (x) { return { name: x.name, type: x.type, key: x.key, codeList: x.codeList }; }),
				texts: { all: this.text("fd.map.all"), mapped: this.text("fd.map.mapped"), unmapped: this.text("fd.map.unmapped"), search: this.text("fd.map.search"),
					src: o.source, tgt: o.entity, unmap: this.text("fd.map.unmap"), valueMap: this.text("ds.pj.valueMap"), auto: this.text("fd.map.auto"),
					hint: this.text("ds.pj.mapperHint"), count: this.text("fd.map.count"), fxTip: this.text("ds.pj.fxTip"), fx: {} }
			});
			this._pjTabs();
			var open = function (d) { d.open(); };
			if (this._pj) { open(this._pj); return; }
			Fragment.load({ id: this.getView().getId(), name: "repoio.proto.fragment.Projection", controller: this }).then(function (d) {
				that._pj = d; that.getView().addDependent(d); open(d);
			});
		},
		_pjTabs: function () {
			var vm = this.viewModel(), p = vm.getProperty("/pj");
			vm.setProperty("/pj/filtersCount", String(p.filters.length));
			vm.setProperty("/pj/mapCount", Object.keys(p.mapping).length + " / " + p.tgt.length);
		},
		onPjAddFilter: function () {
			var vm = this.viewModel(), a = vm.getProperty("/pj/filters").slice();
			a.push({ col: "", op: "eq", val: "" });
			vm.setProperty("/pj/filters", a);
			this._pjTabs();
		},
		onPjRemoveFilter: function (oEvent) {
			var vm = this.viewModel(), a = vm.getProperty("/pj/filters").slice(), i = +oEvent.getSource().getBindingContext("view").getPath().split("/").pop();
			a.splice(i, 1);
			vm.setProperty("/pj/filters", a);
			this._pjTabs();
		},
		onPjMapping: function (oEvent) { this.viewModel().setProperty("/pj/mapping", oEvent.getParameter("mapping")); this._pjTabs(); },
		onPjTransform: function () { MessageToast.show(this.text("ds.t.noTransform")); },
		onPjAuto: function () {
			var o = this._f.objects[this.viewModel().getProperty("/sf/selIdx")];
			this.viewModel().setProperty("/pj/mapping", Object.assign(this._autoMap(o.source, o.entity), this.viewModel().getProperty("/pj/mapping")));
			this._pjTabs();
		},
		onPjApply: function () {
			var vm = this.viewModel(), o = this._f.objects[vm.getProperty("/sf/selIdx")], m = vm.getProperty("/pj/mapping"), plain = {};
			o.filters = vm.getProperty("/pj/filters");
			Object.keys(m).forEach(function (k) { plain[k] = typeof m[k] === "string" ? m[k] : m[k].src; });
			o.mapping = plain;
			o.projection = true;
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
