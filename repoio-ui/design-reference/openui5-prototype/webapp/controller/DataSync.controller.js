sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/sync",
	"sap/ui/core/Fragment",
	"sap/m/MessagePopover",
	"sap/m/MessageItem",
	"sap/m/SelectDialog",
	"sap/m/StandardListItem",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, S, Fragment, MessagePopover, MessageItem, SelectDialog, StandardListItem, MessageToast, MessageBox) {
	"use strict";

	var NOW = "2026-11-11 13:50";

	/* J9b: replication flow editor. The flow is a control-plane definition; Deploy creates the ingest job
	   (Airflow pull DAG or push endpoint) that writes source rows to raw.<entity>. Nothing here touches golden records. */
	return BaseController.extend("repoio.proto.controller.DataSync", {
		onInit: function () {
			this.viewModel().setProperty("/sf", { selIdx: -1, msgs: [], dirty: false });
			this.router().getRoute("dataSyncFlow").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this, id = oEvent.getParameter("arguments").id, oM = this.getOwnerComponent().getModel("sync");
			Promise.all([oM.dataLoaded(), this.data().dataLoaded()]).then(function () {
				that._sync = oM.getData();
				that._orig = id === "new" ? null : that._sync.flows.filter(function (f) { return f.id === id; })[0];
				that._f = that._orig ? JSON.parse(JSON.stringify(that._orig)) :
					{ id: "SYNC_NEW_" + (that._sync.flows.length + 1), en: "", ar: "", conn: "", container: "", repo: "customer-master", status: "draft", interval: "1h", at: "02:00",
						owner: "محمد", changed: NOW, job: "", lastRun: "", lastState: "", objects: [] };
				var vm = that.viewModel();
				vm.setProperty("/sf/isNew", !that._orig);
				vm.setProperty("/sf/dirty", false);
				vm.setProperty("/sf/msgs", []);
				vm.setProperty("/sf/selIdx", -1);
				vm.setProperty("/sf/lang", that.lang());
				vm.setProperty("/sf/rtl", that.isRtl());
				vm.setProperty("/sf/repos", Object.keys(that.data().getProperty("/repos")).map(function (k) {
					var r = S.repo(that, k), d = S.dom(that, r.domainId);
					return { key: k, text: r.name + " · " + r.model, icon: d ? d.icon : "" };
				}));
				that.byId("sfObjects").removeSelections(true);
				that._refresh();
				if (!that._orig) { that.onPickConn(); }
			});
		},

		/* ---------- model → view ---------- */
		_refresh: function () {
			var that = this, vm = this.viewModel(), f = this._f, ar = this.lang() === "ar", conn = f.conn ? S.conn(this, f.conn) : null,
				repo = S.repo(this, f.repo), d = S.dom(this, repo.domainId), ents = this._sync.entities, dirty = vm.getProperty("/sf/dirty");
			vm.setProperty("/sf/f", f);
			vm.setProperty("/sf/status", f.status);
			vm.setProperty("/sf/lastRun", f.lastRun);
			var name = (ar ? f.ar : f.en) || f.en || f.ar || this.text("ds.untitled");
			vm.setProperty("/sf/titleText", name + (dirty ? "*" : ""));
			var st = S.STATUS[f.status];
			vm.setProperty("/sf/statusText", this.text("ds.st." + f.status));
			vm.setProperty("/sf/statusState", st[0]);
			vm.setProperty("/sf/statusIcon", st[1]);
			vm.setProperty("/sf/connText", conn ? S.connText(this, conn) : "");
			vm.setProperty("/sf/connType", conn ? this.text("ds.ct." + conn.type) : "");
			vm.setProperty("/sf/logo", conn ? S.logo(conn) : "");
			vm.setProperty("/sf/delta", conn ? S.deltaMethod(conn) : "");
			vm.setProperty("/sf/repoText", repo.name);
			vm.setProperty("/sf/repoSub", this.text("ds.repoSub", [d ? this.domainName(d) : "", repo.model]));
			vm.setProperty("/sf/domIcon", d ? d.icon : "sap-icon://database");
			var ents2 = f.objects.map(function (o) { return o.entity; }).filter(function (e, i, a) { return a.indexOf(e) === i; });
			vm.setProperty("/sf/lands", (ents2.length ? ents2 : (this._sync.entitiesByDomain[repo.domainId] || ["—"]).slice(0, 1)).map(function (e) { return "raw." + e; }).join(", "));
			vm.setProperty("/sf/intervals", (conn && conn.type === "file" ? ["upload"] : ["15m", "1h", "daily"]).map(function (k) { return { key: k, text: that.text("ds.iv." + k) }; }));
			vm.setProperty("/sf/entities", (this._sync.entitiesByDomain[repo.domainId] || []).map(function (e) { return { key: e, text: that.text("ds.ent." + e) }; }));
			vm.setProperty("/sf/objTitle", this.text("ds.objTitle", [f.objects.length]));
			vm.setProperty("/sf/objects", f.objects.map(function (o) {
				var fields = ents[o.entity] || [], req = fields.filter(function (x) { return x.req; }),
					okReq = req.every(function (x) { return o.mapping[x.name]; }), n = Object.keys(o.mapping).length;
				return Object.assign({}, o, {
					rowsText: o.rows ? that.text("ds.rows", [that.fmt.num(o.rows)]) : "",
					entityText: that.text("ds.ent." + o.entity),
					loadText: that.text(o.load === "delta" ? "ds.load.delta" : "ds.load.initial"), loadIcon: o.load === "delta" ? "sap-icon://synchronize" : "sap-icon://download",
					mapText: that.text("ds.mapped", [n, fields.length]), mapState: okReq ? "Success" : "Error", mapIcon: okReq ? "sap-icon://combine" : "sap-icon://error",
					filterCount: (o.filters || []).length, filterText: (o.filters || []).map(function (x) { return x.col + " " + x.op + " " + x.val; }).join("; "),
					recText: o.last && o.last.initial ? that.text("ds.recs", [that.fmt.num(o.last.initial), that.fmt.num(o.last.delta || 0)]) : "—"
				});
			}));
			this._objProps();
		},
		_objProps: function () {
			var vm = this.viewModel(), i = vm.getProperty("/sf/selIdx"), o = this._f.objects[i];
			if (!o) { vm.setProperty("/sf/selIdx", -1); return; }
			vm.setProperty("/sf/o", o);
			var conn = S.conn(this, this._f.conn), fields = this._sync.entities[o.entity] || [];
			vm.setProperty("/sf/deltaText", this.text("ds.dm." + S.deltaMethod(conn)));
			vm.setProperty("/sf/oFilterText", (o.filters || []).length ? (o.filters || []).map(function (x) { return x.col + " " + x.op + " " + x.val; }).join("; ") : this.text("ds.noFilter"));
			vm.setProperty("/sf/oMapText", this.text("ds.mapped", [Object.keys(o.mapping).length, fields.length]));
		},
		_dirty: function () {
			var vm = this.viewModel();
			vm.setProperty("/sf/dirty", true);
			if (this._f.status === "deployed") { this._f.status = "changed"; }
			this._refresh();
		},
		onDirty: function () { this._dirty(); },

		/* ---------- source / target ---------- */
		onPickConn: function () {
			var that = this, conns = this.data().getProperty("/connections") || [];
			var oDlg = new SelectDialog({ title: this.text("ds.pickConn"),
				items: conns.map(function (c) { return new StandardListItem({ title: S.connText(that, c), description: that.text("ds.ct." + c.type), icon: S.logo(c) || "sap-icon://connected", info: c.id }); }),
				confirm: function (e) {
					var c = conns[e.getParameter("selectedItem").getParent().indexOfItem(e.getParameter("selectedItem"))];
					that._f.conn = c.id;
					that._f.container = { c4c: "c4codataapi", hana: "SAPHANADB", mssql: "dbo", file: "/uploads" }[c.type];
					if (c.type === "file") { that._f.interval = "upload"; } else if (that._f.interval === "upload") { that._f.interval = "1h"; }
					that._dirty();
				},
				cancel: function () { if (!that._f.conn) { that.onBack(); } }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		onRepo: function () { this._dirty(); },
		onConn: function () { this.router().navTo("connections", { conn: this._f.conn }); },
		onFlowSettings: function () { this.byId("sfObjects").removeSelections(true); this.viewModel().setProperty("/sf/selIdx", -1); },

		onAddObjects: function () {
			var that = this, f = this._f, have = f.objects.map(function (o) { return o.source; }),
				avail = (this._sync.catalog[f.conn] || []).filter(function (t) { return have.indexOf(t) < 0; });
			if (!avail.length) { MessageToast.show(this.text("ds.t.noMoreObjects")); return; }
			var oDlg = new SelectDialog({ title: this.text("ds.addObjects"), multiSelect: true, rememberSelections: false,
				items: avail.map(function (t) { return new StandardListItem({ title: t, description: that.text("ds.cols", [(that._sync.source[t] || []).length]), icon: "sap-icon://table-view" }); }),
				confirm: function (e) {
					var repo = S.repo(that, f.repo), ents = that._sync.entitiesByDomain[repo.domainId] || [];
					(e.getParameter("selectedItems") || []).forEach(function (it) {
						var t = it.getTitle();
						f.objects.push({ id: t, source: t, entity: ents[0], load: S.deltaMethod(S.conn(that, f.conn)) === "upload" ? "initial" : "delta", truncate: false, filters: [], mapping: that._autoMap(t, ents[0]), last: {}, rows: null });
					});
					that._dirty();
				}
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		onRemoveObject: function () {
			var i = this.viewModel().getProperty("/sf/selIdx");
			this._f.objects.splice(i, 1);
			this.byId("sfObjects").removeSelections(true);
			this.viewModel().setProperty("/sf/selIdx", -1);
			this._dirty();
		},
		onObjSelect: function (oEvent) {
			var it = oEvent.getParameter("listItem");
			this.viewModel().setProperty("/sf/selIdx", this.byId("sfObjects").indexOfItem(it));
			this._objProps();
		},
		onEntity: function () {
			var o = this._f.objects[this.viewModel().getProperty("/sf/selIdx")];
			o.mapping = this._autoMap(o.source, o.entity);
			this._dirty();
		},
		onObjChange: function () { this._dirty(); },

		/* Same-name / same-meaning auto-mapping (a suggestion; the steward reviews it in the projection). */
		_autoMap: function (table, entity) {
			var cols = this._sync.source[table] || [], m = {}, alias = { name: ["Name", "NAME1", "full_name", "school_name", "TitleEn", "MAKTX"], source_key: [] };
			(this._sync.entities[entity] || []).forEach(function (fd) {
				var hit = cols.filter(function (c) {
					var a = c.name.toLowerCase().replace(/[^a-z]/g, ""), b = fd.name.toLowerCase().replace(/[^a-z]/g, "");
					return a === b || (alias[fd.name] || []).indexOf(c.name) > -1 || (fd.name === "source_key" && c.key);
				})[0];
				if (hit) { m[fd.name] = hit.name; }
			});
			return m;
		},

		/* ---------- projection dialog ---------- */
		onProjection: function () {
			var that = this, vm = this.viewModel(), o = this._f.objects[vm.getProperty("/sf/selIdx")],
				src = (this._sync.source[o.source] || []), fields = this._sync.entities[o.entity] || [];
			vm.setProperty("/pj", {
				title: this.text("ds.pj.title", [o.source, o.entity]), tab: "mapping",
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
		/* Values land in raw as delivered; standardisation (repoio-stream) transforms them, not the sync. */
		onPjTransform: function () { MessageToast.show(this.text("ds.t.noTransform")); },
		onPjAuto: function () {
			var o = this._f.objects[this.viewModel().getProperty("/sf/selIdx")];
			this.viewModel().setProperty("/pj/mapping", Object.assign(this._autoMap(o.source, o.entity), this.viewModel().getProperty("/pj/mapping")));
			this._pjTabs();
		},
		onPjApply: function () {
			var vm = this.viewModel(), o = this._f.objects[vm.getProperty("/sf/selIdx")];
			o.filters = vm.getProperty("/pj/filters");
			var m = vm.getProperty("/pj/mapping"), plain = {};
			Object.keys(m).forEach(function (k) { plain[k] = typeof m[k] === "string" ? m[k] : m[k].src; });
			o.mapping = plain;
			this._pj.close();
			this._dirty();
		},
		onPjCancel: function () { this._pj.close(); },

		/* ---------- toolbar ---------- */
		_validate: function () {
			var msgs = S.validate(this, this._f, this._sync), vm = this.viewModel();
			if (!(this._f.en || this._f.ar)) { msgs.unshift({ type: "Error", title: this.text("ds.v.name") }); }
			if (!this._f.conn) { msgs.unshift({ type: "Error", title: this.text("ds.v.conn") }); }
			vm.setProperty("/sf/msgs", msgs);
			var err = msgs.filter(function (m) { return m.type === "Error"; }).length;
			vm.setProperty("/sf/msgCount", String(msgs.length));
			vm.setProperty("/sf/msgType", err ? "Reject" : msgs.length ? "Critical" : "Accept");
			return err;
		},
		onValidate: function () {
			var err = this._validate(), that = this;
			if (!this.viewModel().getProperty("/sf/msgs").length) { MessageToast.show(this.text("ds.t.valid")); return; }
			setTimeout(function () { that.onMessages(); }, 50);
			return err;
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
		onSave: function () {
			this._commit();
			this._refresh();
			MessageToast.show(this.text(this._f.status === "changed" ? "ds.t.savedChanged" : "ds.t.saved", [this._f.id]));
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
