sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Label",
	"sap/m/Input",
	"sap/m/Select",
	"sap/m/CheckBox",
	"sap/m/TextArea",
	"sap/ui/core/Item",
	"sap/ui/layout/form/SimpleForm"
], function (BaseController, MessageToast, MessageBox, Dialog, Button, Label, Input, Select, CheckBox, TextArea, Item, SimpleForm) {
	"use strict";

	var ME = "محمد",
		SECTIONS = [["auth", "sap-icon://shield"], ["mail", "sap-icon://email"], ["regional", "sap-icon://globe"], ["props", "sap-icon://tag"], ["retention", "sap-icon://history"]],
		EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, NAME = /^[a-z][a-zA-Z0-9]{2,39}$/,
		TYPES = ["string", "number", "date", "enum", "boolean", "user"], APPLIES = ["domain", "repository", "source", "table"];

	var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

	/* System configuration — platform-wide settings. The product reads and writes them through the settings API, which
	   also audits each change; the console edits a working copy and saves one section at a time. */
	return BaseController.extend("repoio.proto.controller.SystemConfig", {
		onInit: function () {
			this.viewModel().setProperty("/sc", { sec: "auth", dirty: false, w: {}, vs: {}, sections: [] });
			this.viewModel().setProperty("/lang", this.lang());
			this.router().getRoute("system").attachPatternMatched(this._onMatched, this);
			this.viewModel().attachPropertyChange(this._onChange, this);
		},
		_onMatched: function (oEvent) {
			var that = this, oM = this.getOwnerComponent().getModel("admin"), sec = oEvent.getParameter("arguments").section;
			oM.dataLoaded().then(function () {
				that._d = oM.getData();
				if (!that.viewModel().getProperty("/sc/dirty")) { that._load(); }
				if (sec && SECTIONS.some(function (s) { return s[0] === sec; })) { that.viewModel().setProperty("/sc/sec", sec); }
				that._sections();
			});
		},
		_load: function () {
			var vm = this.viewModel();
			vm.setProperty("/sc/w", clone(this._d.system));
			vm.setProperty("/sc/vs", {});
			this._setDirty(false);
			this._mailTest();
			this._propsTitle();
		},
		_sections: function () {
			var that = this, cur = this.viewModel().getProperty("/sc/sec"), dirty = this._dirtySecs();
			this.viewModel().setProperty("/sc/sections", SECTIONS.map(function (s) {
				return { key: s[0], text: that.text("sc.sec." + s[0]), icon: s[1], selected: s[0] === cur, info: dirty.indexOf(s[0]) > -1 ? that.text("sc.unsaved") : "" };
			}));
		},
		_key: function (s) { return s === "props" ? "customProps" : s; },
		_dirtySecs: function () {
			var that = this, w = this.viewModel().getProperty("/sc/w");
			if (!this._d || !w) { return []; }
			return SECTIONS.map(function (s) { return s[0]; }).filter(function (s) { var k = that._key(s); return JSON.stringify(w[k]) !== JSON.stringify(that._d.system[k]); });
		},
		_onChange: function (oEvent) {
			if (!this._d || this._busy) { return; }
			var p = oEvent.getParameter("path") || "", ctx = oEvent.getParameter("context");
			var full = ctx ? ctx.getPath() + "/" + p : p;
			if (full.indexOf("/sc/w") !== 0) { return; }
			this._setDirty(this._dirtySecs().length > 0);
		},
		_setDirty: function (b) {
			var vm = this.viewModel(), n = this._dirtySecs();
			vm.setProperty("/sc/dirty", b);
			vm.setProperty("/sc/dirtyText", b ? this.text("sc.dirty", [n.map(function (s) { return this.text("sc.sec." + s); }, this).join(", ")]) : "");
			this._sections();
		},
		_mailTest: function () {
			var m = this._d.system.mail, vm = this.viewModel();
			vm.setProperty("/sc/mailTest", m.lastTest ? this.text(m.lastTestOk ? "sc.mail.lastOk" : "sc.mail.lastFail", [m.lastTest.replace("T", " ").slice(0, 16)]) : this.text("sc.mail.never"));
			vm.setProperty("/sc/mailTestState", m.lastTestOk ? "Success" : "Error");
			vm.setProperty("/sc/mailTestIcon", m.lastTestOk ? "sap-icon://message-success" : "sap-icon://message-error");
		},
		_propsTitle: function () { this.viewModel().setProperty("/sc/propsTitle", this.text("sc.props.title", [(this.viewModel().getProperty("/sc/w/customProps") || []).length])); },
		_audit: function (sObject, en, ar, before, after) {
			this._d.audit.unshift({ at: this._d.now.slice(0, 16) + ":00", actor: ME, area: "system", action: "update", type: "setting", object: sObject, en: en, ar: ar, before: before, after: after });
		},

		onSection: function (oEvent) {
			this.viewModel().setProperty("/sc/sec", oEvent.getParameter("listItem").getBindingContext("view").getProperty("key"));
			this._sections();
		},
		typeText: function (s) { return s ? this.text("sc.type." + s) : ""; },
		appliesText: function (s) { return s ? this.text("sc.applies." + s) : ""; },

		/* Save every changed section; each becomes one audited change with before / after. */
		onSave: function () {
			var that = this, vm = this.viewModel(), w = vm.getProperty("/sc/w"), secs = this._dirtySecs(), m = w.mail;
			var vs = { from: EMAIL.test(m.from || "") ? "None" : "Error", replyTo: !m.replyTo || EMAIL.test(m.replyTo) ? "None" : "Error" };
			vm.setProperty("/sc/vs", vs);
			if (vs.from === "Error" || vs.replyTo === "Error") { vm.setProperty("/sc/sec", "mail"); this._sections(); MessageBox.error(this.text("sc.v.email")); return; }
			if (!String(w.auth.allowedDomains || "").split(",").every(function (x) { return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(x.trim()); })) { vm.setProperty("/sc/sec", "auth"); this._sections(); MessageBox.error(this.text("sc.v.domains")); return; }
			secs.forEach(function (s) {
				var k = that._key(s), before = {}, after = {};
				if (k === "customProps") { before = { count: that._d.system[k].length }; after = { count: w[k].length }; }
				else { Object.keys(w[k]).forEach(function (f) { if (JSON.stringify(w[k][f]) !== JSON.stringify(that._d.system[k][f])) { before[f] = that._d.system[k][f]; after[f] = w[k][f]; } }); }
				that._audit(that.text("sc.sec." + s), "System setting changed: " + s, "تغيير إعداد النظام: " + that.text("sc.sec." + s), before, after);
				that._d.system[k] = clone(w[k]);
			});
			this._setDirty(false);
			MessageToast.show(this.text("sc.t.saved", [secs.length]));
		},
		onDiscard: function () { this._busy = true; this._load(); this._busy = false; MessageToast.show(this.text("sc.t.discarded")); },

		onTestMail: function () {
			var that = this, oIn = new Input({ value: "mohamed@example.com", type: "Email", textDirection: "LTR", width: "100%" });
			var oDlg = new Dialog({ title: this.text("sc.mail.test"), contentWidth: "26rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, content: [new Label({ text: this.text("sc.mail.to"), required: true }), oIn] })],
				beginButton: new Button({ text: this.text("sc.mail.send"), type: "Emphasized", press: function () {
					if (!EMAIL.test(oIn.getValue())) { oIn.setValueState("Error"); return; }
					var m = that._d.system.mail;
					m.lastTest = that._d.now; m.lastTestOk = true;
					that._d.audit.unshift({ at: that._d.now.slice(0, 16) + ":00", actor: ME, area: "system", action: "test", type: "setting", object: "Email · SMTP relay", en: "Test email sent to " + oIn.getValue(), ar: "إرسال إيميل تجريبي إلى " + oIn.getValue() });
					oDlg.close(); that._mailTest();
					MessageToast.show(that.text("sc.t.testSent", [oIn.getValue()]));
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); } });
			this.getView().addDependent(oDlg);
			oDlg.open();
		},

		/* Custom properties extend catalog objects (domains, repositories, sources, tables) — never golden-record attributes,
		   which repoio-spec owns. Changes join the working copy and are saved with the section. */
		onAddProp: function () { this._prop(null); },
		onEditProp: function (oEvent) { this._prop(oEvent.getSource().getBindingContext("view").getObject()); },
		_prop: function (oEdit) {
			var that = this, vm = this.viewModel(), list = vm.getProperty("/sc/w/customProps"), o = oEdit ? clone(oEdit) : { name: "", en: "", ar: "", type: "string", appliesTo: "repository", required: false, values: "", desc_en: "", desc_ar: "" };
			var opt = function (k, pre) { return new Item({ key: k, text: that.text(pre + k) }); };
			var c = {
				name: new Input({ value: o.name, textDirection: "LTR", editable: !oEdit, placeholder: "costCenter" }).addStyleClass("repoioMono"),
				en: new Input({ value: o.en, textDirection: "LTR" }), ar: new Input({ value: o.ar, textDirection: "RTL" }),
				type: new Select({ selectedKey: o.type, width: "100%", items: TYPES.map(function (k) { return opt(k, "sc.type."); }), enabled: !oEdit }),
				applies: new Select({ selectedKey: o.appliesTo, width: "100%", items: APPLIES.map(function (k) { return opt(k, "sc.applies."); }), enabled: !oEdit }),
				required: new CheckBox({ selected: o.required, text: this.text("sc.props.requiredText") }),
				values: new Input({ value: o.values, placeholder: "A, B, C" }),
				den: new TextArea({ value: o.desc_en, rows: 2, width: "100%", textDirection: "LTR" }), dar: new TextArea({ value: o.desc_ar, rows: 2, width: "100%", textDirection: "RTL" })
			};
			var lbl = function (k, req) { return new Label({ text: that.text(k), required: !!req }); };
			var oDlg = new Dialog({ title: this.text(oEdit ? "sc.props.edit" : "sc.props.add"), contentWidth: "34rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanL: 4, labelSpanM: 4, columnsL: 1, columnsM: 1, content: [
					lbl("sc.props.col.name", true), c.name, lbl("sc.props.labelEn", true), c.en, lbl("sc.props.labelAr", true), c.ar,
					lbl("sc.props.col.type", true), c.type, lbl("sc.props.col.applies", true), c.applies, lbl("sc.props.col.values"), c.values,
					new Label({ text: "" }), c.required, lbl("sc.props.descEn"), c.den, lbl("sc.props.descAr"), c.dar
				] })],
				beginButton: new Button({ text: this.text(oEdit ? "common.save" : "sc.props.addBtn"), type: "Emphasized", press: function () {
					var name = c.name.getValue().trim(), err = [];
					if (!NAME.test(name)) { err.push(that.text("sc.v.propName")); c.name.setValueState("Error"); }
					else if (!oEdit && list.some(function (p) { return p.name === name; })) { err.push(that.text("sc.v.propDup")); c.name.setValueState("Error"); }
					if (!c.en.getValue().trim() || !c.ar.getValue().trim()) { err.push(that.text("sc.v.propLabel")); }
					if (c.type.getSelectedKey() === "enum" && c.values.getValue().split(",").filter(function (x) { return x.trim(); }).length < 2) { err.push(that.text("sc.v.propEnum")); c.values.setValueState("Error"); }
					if (err.length) { MessageBox.error(err.join("\n")); return; }
					var n = { id: oEdit ? oEdit.id : "cp" + Date.now(), name: name, en: c.en.getValue().trim(), ar: c.ar.getValue().trim(), type: c.type.getSelectedKey(), appliesTo: c.applies.getSelectedKey(),
						required: c.required.getSelected(), values: c.type.getSelectedKey() === "enum" ? c.values.getValue().split(",").map(function (x) { return x.trim(); }).filter(Boolean).join(", ") : "",
						desc_en: c.den.getValue().trim(), desc_ar: c.dar.getValue().trim() };
					vm.setProperty("/sc/w/customProps", oEdit ? list.map(function (p) { return p.id === oEdit.id ? n : p; }) : list.concat([n]));
					oDlg.close(); that._propsTitle(); that._setDirty(true);
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); } });
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		onDeleteProp: function (oEvent) {
			var that = this, vm = this.viewModel(), p = oEvent.getSource().getBindingContext("view").getObject();
			MessageBox.confirm(this.text("sc.props.delConfirm", [this.lang() === "ar" ? p.ar : p.en]), { onClose: function (a) {
				if (a !== MessageBox.Action.OK) { return; }
				vm.setProperty("/sc/w/customProps", vm.getProperty("/sc/w/customProps").filter(function (x) { return x.id !== p.id; }));
				that._propsTitle(); that._setDirty(true);
			} });
		}
	});
});
