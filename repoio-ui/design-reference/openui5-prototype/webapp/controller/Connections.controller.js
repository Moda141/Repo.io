sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/people",
	"sap/ui/core/Fragment",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/layout/form/SimpleForm",
	"sap/ui/core/Title",
	"sap/m/Label",
	"sap/m/Input",
	"sap/m/Select",
	"sap/m/Switch",
	"sap/m/Text",
	"sap/m/VBox",
	"sap/ui/core/Item"
], function (BaseController, people, Fragment, MessageToast, MessageBox, SimpleForm, CoreTitle, Label, Input, Select, Switch, Text, VBox, Item) {
	"use strict";

	/* The four agreed source types. Features drive both the filter panel and the ingestion section. */
	var TYPES = [
		{ key: "hana", name: "SAP HANA", icon: "sap-icon://it-host", logo: "img/logos/sap.png", logoH: "2.5rem", source: "sap", categories: ["onprem", "cloud"], features: ["pull", "writeback", "profiling"] },
		{ key: "c4c", name: "SAP Cloud for Customer", icon: "sap-icon://cloud", logo: "img/logos/sap.png", logoH: "2.5rem", source: "sap", categories: ["cloud"], features: ["push", "pull", "writeback", "profiling"] },
		{ key: "mssql", name: "Microsoft SQL Server", icon: "sap-icon://database", logo: "img/logos/sqlserver.png", logoH: "4rem", source: "nonsap", categories: ["onprem"], features: ["pull", "profiling"] },
		{ key: "file", name: "CSV / Excel", icon: "sap-icon://excel-attachment", logo: "img/logos/csv-xls.png", logoH: "3.5rem", source: "nonsap", categories: ["file"], features: ["upload", "profiling"] }
	];
	var FACETS = {
		features: ["pull", "push", "upload", "writeback", "profiling"],
		categories: ["cloud", "onprem", "file"],
		sources: ["sap", "nonsap"]
	};
	var SCHEDULES = ["hourly", "daily_0130", "daily_0200", "weekly"];

	/* Step 2 property sheets, one per type: sections of fields. `when` hides a field until its condition holds. */
	var opts = function (prefix, keys) { return keys.map(function (k) { return { k: k, t: prefix + k }; }); };
	var CREDENTIAL_HINT = "cp.secretHint";
	var PROPS = {
		hana: [
			{ t: "cp.sec.details", f: [
				{ k: "category", kind: "select", o: opts("conn.cat.", ["onprem", "cloud"]), d: "onprem" },
				{ k: "host", kind: "text", req: true, ph: "hana-host.example.local" },
				{ k: "port", kind: "number", req: true, d: "30015" },
				{ k: "tenant", kind: "text", ph: "S4P" } ] },
			{ t: "cp.sec.security", f: [
				{ k: "ssl", kind: "switch", d: true },
				{ k: "verify", kind: "switch", d: true, when: function (v) { return v.ssl; } } ] },
			{ t: "cp.sec.credentials", f: [
				{ k: "auth", kind: "select", o: opts("cp.auth.", ["basic", "x509"]), d: "basic" },
				{ k: "user", kind: "text", req: true, when: function (v) { return v.auth === "basic"; } },
				{ k: "password", kind: "password", req: true, hint: CREDENTIAL_HINT, when: function (v) { return v.auth === "basic"; } },
				{ k: "cert", kind: "text", req: true, ph: "kv://repoio/hana-client-cert", hint: CREDENTIAL_HINT, when: function (v) { return v.auth === "x509"; } } ] },
			{ t: "cp.sec.ingestion", f: [
				{ k: "mode", kind: "select", o: opts("cp.mode.", ["pull"]), d: "pull" },
				{ k: "schedule", kind: "select", o: opts("cp.schedule.", SCHEDULES), d: "daily_0130" },
				{ k: "writeback", kind: "switch", d: false, hint: "cp.writebackHint" } ] }
		],
		c4c: [
			{ t: "cp.sec.details", f: [
				{ k: "url", kind: "text", req: true, ph: "https://myXXXXXX.crm.ondemand.com" },
				{ k: "service", kind: "select", o: opts("cp.service.", ["c4codataapi", "custom"]), d: "c4codataapi" },
				{ k: "servicePath", kind: "text", req: true, ph: "/sap/c4c/odata/cust/v1/...", when: function (v) { return v.service === "custom"; } } ] },
			{ t: "cp.sec.credentials", f: [
				{ k: "auth", kind: "select", o: opts("cp.auth.", ["oauth", "basic"]), d: "oauth" },
				{ k: "clientId", kind: "text", req: true, when: function (v) { return v.auth === "oauth"; } },
				{ k: "clientSecret", kind: "password", req: true, hint: CREDENTIAL_HINT, when: function (v) { return v.auth === "oauth"; } },
				{ k: "user", kind: "text", req: true, when: function (v) { return v.auth === "basic"; } },
				{ k: "password", kind: "password", req: true, hint: CREDENTIAL_HINT, when: function (v) { return v.auth === "basic"; } } ] },
			{ t: "cp.sec.ingestion", f: [
				{ k: "mode", kind: "select", o: opts("cp.mode.", ["push_pull", "pull"]), d: "push_pull" },
				{ k: "schedule", kind: "select", o: opts("cp.schedule.", SCHEDULES), d: "daily_0200" },
				{ k: "writeback", kind: "switch", d: false, hint: "cp.writebackHint" } ] }
		],
		mssql: [
			{ t: "cp.sec.details", f: [
				{ k: "server", kind: "text", req: true, ph: "sql-host.example.local" },
				{ k: "port", kind: "number", req: true, d: "1433" },
				{ k: "database", kind: "text", req: true },
				{ k: "version", kind: "select", o: opts("cp.version.", ["2016", "2017", "2019", "2022"]), d: "2019" } ] },
			{ t: "cp.sec.security", f: [
				{ k: "ssl", kind: "switch", d: true },
				{ k: "verify", kind: "switch", d: true, when: function (v) { return v.ssl; } } ] },
			{ t: "cp.sec.credentials", f: [
				{ k: "auth", kind: "select", o: opts("cp.auth.", ["sql", "windows"]), d: "sql" },
				{ k: "user", kind: "text", req: true },
				{ k: "password", kind: "password", req: true, hint: CREDENTIAL_HINT } ] },
			{ t: "cp.sec.ingestion", f: [
				{ k: "mode", kind: "select", o: opts("cp.mode.", ["pull"]), d: "pull" },
				{ k: "cdc", kind: "select", o: opts("cp.cdc.", ["cdc", "timestamp", "full"]), d: "timestamp" },
				{ k: "tsColumn", kind: "text", req: true, ph: "ModifiedAt", when: function (v) { return v.cdc === "timestamp"; } },
				{ k: "schedule", kind: "select", o: opts("cp.schedule.", SCHEDULES), d: "daily_0200" } ] }
		],
		file: [
			{ t: "cp.sec.file", f: [
				{ k: "format", kind: "select", o: opts("cp.format.", ["csv", "xlsx"]), d: "csv" },
				{ k: "delimiter", kind: "select", o: opts("cp.delimiter.", ["comma", "semicolon", "tab", "pipe"]), d: "comma", when: function (v) { return v.format === "csv"; } },
				{ k: "encoding", kind: "select", o: opts("cp.encoding.", ["utf8", "cp1256"]), d: "utf8", when: function (v) { return v.format === "csv"; } },
				{ k: "sheet", kind: "text", ph: "Sheet1", when: function (v) { return v.format === "xlsx"; } },
				{ k: "header", kind: "switch", d: true },
				{ k: "dateFormat", kind: "select", o: opts("cp.dateFormat.", ["iso", "dmy"]), d: "iso" } ] },
			{ t: "cp.sec.upload", f: [
				{ k: "method", kind: "select", o: opts("cp.method.", ["console", "sftp"]), d: "console" },
				{ k: "folder", kind: "text", req: true, ph: "/inbound/customers", when: function (v) { return v.method === "sftp"; } },
				{ k: "maxSize", kind: "select", o: opts("cp.maxSize.", ["10", "50", "100"]), d: "50" } ] }
		]
	};

	/* SAP Datasphere "Connections" layout + "Create Connection" three-step dialog (J9). */
	return BaseController.extend("repoio.proto.controller.Connections", {
		onInit: function () {
			this.viewModel().setProperty("/lang", this.lang());
			this.viewModel().setProperty("/conn", { items: [], count: 0, selected: 0, canPause: false, canResume: false });
			this.router().getRoute("connections").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this, sConn = oEvent.getParameter("arguments").conn;
			this.data().dataLoaded().then(function () {
				if (!that._all) { that._all = JSON.parse(JSON.stringify(that.data().getProperty("/connections"))); }
				that._refresh();
				// Deep link from a failed run (e.g. AUTH_TOKEN_EXPIRED): open that connection to fix it.
				var e = sConn && that._entry(sConn);
				if (e) { that._openDialog(e); that.router().navTo("connections", {}, true); }
			});
		},

		_type: function (k) { return TYPES.filter(function (t) { return t.key === k; })[0]; },

		/* Table rows, derived from the registry entries. */
		_refresh: function () {
			var that = this, q = (this._q || "").toLowerCase(), ar = this.lang() === "ar";
			var rows = this._all.map(function (c) {
				var t = that._type(c.type), p = c.props, feats = [];
				if (p.mode === "push_pull") { feats.push("push", "pull"); } else if (p.mode === "pull") { feats.push("pull"); }
				if (c.type === "file") { feats.push("upload"); }
				if (p.writeback) { feats.push("writeback"); }
				var cat = c.type === "hana" ? p.category : t.categories[0];
				return Object.assign({}, c, {
					title: ar ? c.name : c.nameEn, logo: t.logo, icon: t.icon, typeText: t.name,
					categoryText: that.text("conn.cat." + cat),
					featureText: feats.map(function (f) { return that.text("conn.feat." + f); }).join(" · "),
					stateText: that.text("conn.state." + c.state),
					stateState: c.state === "active" ? "Success" : c.state === "paused" ? "None" : "Error",
					stateIcon: c.state === "active" ? "sap-icon://sys-enter-2" : c.state === "paused" ? "sap-icon://pause" : "sap-icon://error"
				});
			}).filter(function (r) { return !q || [r.title, r.id, r.typeText, r.owner].join(" ").toLowerCase().indexOf(q) > -1; });
			this._rows = rows.sort(function (a, b) { return a.changed < b.changed ? 1 : a.changed > b.changed ? -1 : 0; });
			this.viewModel().setProperty("/conn/count", rows.length);
			this.viewModel().setProperty("/conn/page", 1);
			if (!this.viewModel().getProperty("/conn/size")) { this.viewModel().setProperty("/conn/size", 25); }
			this._slice();
			this.byId("connTable").removeSelections(true);
			this.onSelect();
		},

		/* One page of connections (Previous / Next instead of "More"). */
		_slice: function () {
			var vm = this.viewModel(), p = vm.getProperty("/conn/page"), n = vm.getProperty("/conn/size");
			vm.setProperty("/conn/items", (this._rows || []).slice((p - 1) * n, p * n));
		},
		onPage: function (oEvent) {
			var vm = this.viewModel();
			vm.setProperty("/conn/page", oEvent.getParameter("page"));
			vm.setProperty("/conn/size", oEvent.getParameter("pageSize"));
			this._slice();
			this.byId("connTable").removeSelections(true);
			this.onSelect();
		},

		onSearch: function (e) { this._q = e.getParameter("newValue"); this._refresh(); },

		_selected: function () {
			return this.byId("connTable").getSelectedItems().map(function (i) { return i.getBindingContext("view").getObject(); });
		},
		onSelect: function () {
			var s = this._selected(), V = this.viewModel();
			V.setProperty("/conn/selected", s.length);
			V.setProperty("/conn/canPause", s.length > 0 && s.some(function (c) { return c.state === "active" && c.type !== "file"; }));
			V.setProperty("/conn/canResume", s.length > 0 && s.some(function (c) { return c.state === "paused"; }));
			V.setProperty("/conn/canUpload", s.length === 1 && s[0].type === "file" && s[0].state === "active");
		},
		_entry: function (id) { return this._all.filter(function (c) { return c.id === id; })[0]; },

		/* CSV / Excel connection: upload a file with a Datasphere-style data preview and column mapping. */
		onUpload: function () {
			var that = this, c = this._entry(this._selected()[0].id);
			sap.ui.require(["repoio/proto/util/ImportDialog"], function (ImportDialog) {
				ImportDialog.open(that, c, function () {
					var now = new Date(), pad = function (n) { return (n < 10 ? "0" : "") + n; };
					c.lastSync = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes());
					c.syncState = "Success";
					that._refresh();
				});
			});
		},

		onPause: function () { this._setState("active", "paused", "conn.paused"); },
		onResume: function () { this._setState("paused", "active", "conn.resumed"); },
		_setState: function (from, to, msg) {
			var that = this, n = 0;
			this._selected().forEach(function (c) { var e = that._entry(c.id); if (e.state === from && e.type !== "file") { e.state = to; n++; } });
			MessageToast.show(this.text(msg, [n]));
			this._refresh();
		},

		onDelete: function () {
			var that = this, sel = this._selected();
			MessageBox.warning(this.text("conn.deleteConfirm", [sel.length]), {
				title: this.text("common.delete"),
				actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL], emphasizedAction: MessageBox.Action.DELETE,
				onClose: function (a) {
					if (a !== MessageBox.Action.DELETE) { return; }
					var ids = sel.map(function (c) { return c.id; });
					that._all = that._all.filter(function (c) { return ids.indexOf(c.id) < 0; });
					MessageToast.show(that.text("conn.deleted", [ids.length]));
					that._refresh();
				}
			});
		},

		/* Validate: what the backend health check would report (reachability, auth, features). */
		onValidate: function () {
			var c = this._selected()[0], t = this._type(c.type), that = this;
			if (c.type === "file") { MessageBox.information(this.text("conn.validateFile"), { title: c.title }); return; }
			var lines = [this.text("conn.v.reach"), this.text("conn.v.auth")];
			if (c.props.ssl || c.type === "c4c") { lines.push(this.text("conn.v.tls")); }
			t.features.filter(function (f) { return f !== "profiling"; }).forEach(function (f) {
				var on = f === "writeback" ? !!c.props.writeback : f === "push" ? c.props.mode === "push_pull" : true;
				lines.push(that.text("conn.feat." + f) + ": " + that.text(on ? "conn.v.available" : "conn.v.off"));
			});
			MessageBox.success(this.text("conn.valid", [c.title]), { title: this.text("dsp.validate"), details: lines.map(function (l) { return "• " + l; }).join("<br/>") });
		},

		/* ---------- Create / edit dialog ---------- */
		onCreate: function () { this._openDialog(null); },
		onEditSelected: function () { this._openDialog(this._entry(this._selected()[0].id)); },
		onOpen: function (e) { this._openDialog(this._entry(e.getSource().getBindingContext("view").getProperty("id"))); },

		_openDialog: function (entry) {
			var that = this, ar = this.lang() === "ar";
			var wiz = {
				edit: !!entry, step: 1, q: "", sortDesc: false, type: entry ? entry.type : "", typeObj: entry ? this._type(entry.type) : {},
				props: entry ? JSON.parse(JSON.stringify(entry.props)) : {}, propsValid: false,
				bizName: entry ? (ar ? entry.name : entry.nameEn) : "", techName: entry ? entry.id : "", techTouched: !!entry,
				owner: entry ? entry.owner : "محمد", desc: entry ? (ar ? entry.descAr : entry.desc) : "",
				people: people.names().map(function (n) { var p = people.get(n); return { key: n, text: ar ? n : p.en }; })
			};
			this._sel = { features: {}, categories: {}, sources: {} };
			this.viewModel().setProperty("/wiz", wiz);
			this._editId = entry ? entry.id : null;
			this._applyTypes();
			this._validateName();
			var open = function (oDialog) {
				var oWiz = that.byId("connWizard");
				oWiz.discardProgress(that.byId("stepType"));
				oDialog.open();
				if (entry) { that._buildProps(); oWiz.nextStep(); that.viewModel().setProperty("/wiz/step", 2); }
			};
			if (this._dialog) { open(this._dialog); return; }
			Fragment.load({ id: this.getView().getId(), name: "repoio.proto.fragment.CreateConnection", controller: this }).then(function (oDialog) {
				that._dialog = oDialog;
				that.getView().addDependent(oDialog);
				open(oDialog);
			});
		},

		/* Step 1: type tiles filtered by the facets (OR inside a facet, AND across facets), like Datasphere. */
		_applyTypes: function () {
			var that = this, V = this.viewModel(), q = (V.getProperty("/wiz/q") || "").toLowerCase(), sel = this._sel;
			var has = function (t, facet, v) { return facet === "features" ? t.features.indexOf(v) > -1 : facet === "categories" ? t.categories.indexOf(v) > -1 : t.source === v; };
			var match = function (t, skip) {
				if (q && t.name.toLowerCase().indexOf(q) < 0) { return false; }
				return Object.keys(sel).every(function (f) {
					var vals = Object.keys(sel[f]);
					return f === skip || !vals.length || vals.some(function (v) { return has(t, f, v); });
				});
			};
			var types = TYPES.filter(function (t) { return match(t); }).slice()
				.sort(function (a, b) { return (a.name < b.name ? -1 : 1) * (V.getProperty("/wiz/sortDesc") ? -1 : 1); });
			var facets = {};
			Object.keys(FACETS).forEach(function (f) {
				facets[f] = FACETS[f].map(function (v) {
					return { key: v, text: that.text((f === "categories" ? "conn.cat." : f === "sources" ? "conn.src." : "conn.feat.") + v),
						selected: !!sel[f][v], count: TYPES.filter(function (t) { return match(t, f) && has(t, f, v); }).length };
				});
			});
			V.setProperty("/wiz/types", types);
			V.setProperty("/wiz/facets", facets);
			V.setProperty("/wiz/activeFilters", Object.keys(sel).reduce(function (n, f) { return n + Object.keys(sel[f]).length; }, 0));
		},
		onTypeSearch: function () { this._applyTypes(); },
		onTypeSort: function () { this.viewModel().setProperty("/wiz/sortDesc", !this.viewModel().getProperty("/wiz/sortDesc")); this._applyTypes(); },
		onTypeFacet: function (e) {
			var sel = this._sel[e.getSource().data("facet")];
			e.getParameter("listItems").forEach(function (li) {
				var v = li.getBindingContext("view").getProperty("key");
				if (li.getSelected()) { sel[v] = true; } else { delete sel[v]; }
			});
			this._applyTypes();
		},
		onClearTypeFilters: function () { this._sel = { features: {}, categories: {}, sources: {} }; this._applyTypes(); },
		onTypePick: function (e) {
			var item = e.getParameter("listItem"), k = item.getBindingContext("view").getProperty("key"), V = this.viewModel();
			if (k !== V.getProperty("/wiz/type")) { V.setProperty("/wiz/props", {}); }
			V.setProperty("/wiz/type", k);
			V.setProperty("/wiz/typeObj", this._type(k));
		},

		/* Step 2: build the property sheet for the chosen type. */
		_buildProps: function () {
			var that = this, V = this.viewModel(), type = V.getProperty("/wiz/type"), props = V.getProperty("/wiz/props"), box = this.byId("propsBox");
			box.destroyItems();
			var head = new VBox().addStyleClass("sapUiSmallMarginBottom");
			head.addItem(new Text({ text: this.text("conn.propsIntro", [this._type(type).name]) }));
			box.addItem(head);
			this._fields = [];
			PROPS[type].forEach(function (sec) {
				sec.f.forEach(function (f) { if (props[f.k] === undefined && f.d !== undefined) { props[f.k] = f.d; } });
			});
			V.setProperty("/wiz/props", props);
			PROPS[type].forEach(function (sec) {
				var form = new SimpleForm({ editable: true, layout: "ColumnLayout", columnsM: 1, columnsL: 1, columnsXL: 1, labelSpanL: 4, labelSpanM: 4 });
				form.addContent(new CoreTitle({ text: that.text(sec.t) }));
				sec.f.forEach(function (f) {
					/* Editing: a stored secret is never shown; leaving the field empty keeps it. */
					if (V.getProperty("/wiz/edit") && f.kind === "password") { f = Object.assign({}, f, { req: false, ph: that.text("cp.keepSecret") }); }
					var path = "view>/wiz/props/" + f.k, ctl, lbl = new Label({ text: that.text("cp." + f.k), required: !!f.req });
					if (f.kind === "select") {
						ctl = new Select({ selectedKey: "{" + path + "}", width: "100%", change: that._onPropChange.bind(that) });
						f.o.forEach(function (o) { ctl.addItem(new Item({ key: o.k, text: that.text(o.t) })); });
					} else if (f.kind === "switch") {
						ctl = new Switch({ state: "{" + path + "}", type: "AcceptReject", change: that._onPropChange.bind(that) });
					} else {
						ctl = new Input({ value: "{" + path + "}", type: f.kind === "password" ? "Password" : f.kind === "number" ? "Number" : "Text",
							placeholder: f.ph || "", liveChange: that._onPropChange.bind(that), valueLiveUpdate: true });
					}
					lbl.setLabelFor(ctl);
					form.addContent(lbl);
					form.addContent(ctl);
					var hint = f.hint ? new Text({ text: that.text(f.hint) }).addStyleClass("repoioFieldHint") : null, hintLbl = null;
					if (hint) { hintLbl = new Label({ text: "" }); form.addContent(hintLbl); form.addContent(hint); }
					that._fields.push({ def: f, label: lbl, ctl: ctl, hint: hint, hintLbl: hintLbl });
				});
				box.addItem(form);
			});
			this._checkProps();
		},
		_onPropChange: function (e) {
			var V = this.viewModel(), src = e.getSource();
			if (src.getMetadata().getName() === "sap.m.Select" && V.getProperty("/wiz/type") === "hana" && src.getSelectedKey && src.getBinding("selectedKey").getPath() === "/wiz/props/category") {
				V.setProperty("/wiz/props/port", src.getSelectedKey() === "cloud" ? "443" : "30015");
			}
			this._checkProps();
		},
		_checkProps: function () {
			var V = this.viewModel(), v = V.getProperty("/wiz/props"), ok = true, that = this;
			(this._fields || []).forEach(function (x) {
				var vis = !x.def.when || x.def.when(v);
				x.label.setVisible(vis); x.ctl.setVisible(vis); if (x.hint) { x.hint.setVisible(vis); x.hintLbl.setVisible(vis); }
				if (vis && x.def.req) {
					var val = String(v[x.def.k] === undefined ? "" : v[x.def.k]).trim();
					var bad = !val || (x.def.k === "url" && !/^https:\/\/.+/.test(val)) || (x.def.kind === "number" && !/^\d{2,5}$/.test(val));
					if (bad) { ok = false; }
					if (x.ctl.setValueState) {
						x.ctl.setValueState(bad && val ? "Error" : "None");
						x.ctl.setValueStateText(x.def.k === "url" ? that.text("conn.err.url") : that.text("conn.err.invalid"));
					}
				}
			});
			V.setProperty("/wiz/propsValid", ok);
		},

		/* Step 3: business name drives the technical name until the user edits it. */
		onNameChange: function () {
			var V = this.viewModel();
			if (!V.getProperty("/wiz/techTouched")) {
				var t = (V.getProperty("/wiz/bizName") || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
				V.setProperty("/wiz/techName", t);
			}
			this._validateName();
		},
		onTechChange: function () {
			var V = this.viewModel();
			V.setProperty("/wiz/techTouched", true);
			V.setProperty("/wiz/techName", (V.getProperty("/wiz/techName") || "").toUpperCase());
			this._validateName();
		},
		_validateName: function () {
			var V = this.viewModel(), biz = (V.getProperty("/wiz/bizName") || "").trim(), tech = V.getProperty("/wiz/techName") || "", that = this;
			var taken = !V.getProperty("/wiz/edit") && (this._all || []).some(function (c) { return c.id === tech; });
			var techOk = /^[A-Z][A-Z0-9_]{2,39}$/.test(tech) && !taken;
			V.setProperty("/wiz/techState", !tech ? "None" : techOk ? "Success" : "Error");
			V.setProperty("/wiz/techStateText", taken ? that.text("conn.err.taken") : that.text("conn.err.tech"));
			V.setProperty("/wiz/bizNameErr", false);
			V.setProperty("/wiz/nameValid", !!biz && techOk);
		},

		onNext: function () {
			var V = this.viewModel(), step = V.getProperty("/wiz/step"), oWiz = this.byId("connWizard");
			if (step === 1) { this._buildProps(); }
			oWiz.nextStep();
			V.setProperty("/wiz/step", step + 1);
			if (step + 1 === 3) { this._validateName(); }
		},
		onPrev: function () {
			var V = this.viewModel();
			this.byId("connWizard").previousStep();
			V.setProperty("/wiz/step", V.getProperty("/wiz/step") - 1);
		},
		onCancel: function () { this._dialog.close(); },
		onDialogClosed: function () { this.viewModel().setProperty("/wiz/step", 1); },

		onFinish: function () {
			var V = this.viewModel(), w = V.getProperty("/wiz"), ar = this.lang() === "ar", now = "2026-11-08 " + new Date().toTimeString().slice(0, 5);
			var props = JSON.parse(JSON.stringify(w.props));
			["password", "clientSecret"].forEach(function (k) { if (props[k]) { props[k] = "kv://repoio/connections/" + w.techName + "/" + k; } });
			if (w.edit) {
				var e = this._entry(this._editId);
				["password", "clientSecret"].forEach(function (k) { if (!props[k] && e.props[k]) { props[k] = e.props[k]; } });
				e.props = props; e.owner = w.owner; e.changed = now;
				if (ar) { e.name = w.bizName; e.descAr = w.desc; } else { e.nameEn = w.bizName; e.desc = w.desc; }
				MessageToast.show(this.text("conn.saved", [w.bizName]));
			} else {
				this._all.push({ id: w.techName, name: w.bizName, nameEn: w.bizName, type: w.type, owner: w.owner, changed: now,
					state: "active", lastSync: "—", syncState: "None", props: props, desc: w.desc, descAr: w.desc });
				MessageToast.show(this.text("conn.created", [w.bizName]));
			}
			this._dialog.close();
			this._refresh();
		}
	});
});
