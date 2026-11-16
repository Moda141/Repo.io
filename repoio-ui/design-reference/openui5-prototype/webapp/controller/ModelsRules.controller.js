sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/audit",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Label",
	"sap/m/Select",
	"sap/m/Input",
	"sap/m/Text",
	"sap/m/TextArea",
	"sap/m/MultiComboBox",
	"sap/m/MessageStrip",
	"sap/ui/core/Item",
	"sap/ui/layout/form/SimpleForm"
], function (BaseController, Audit, MessageToast, MessageBox, Dialog, Button, Label, Select, Input, Text, TextArea, MultiComboBox, MessageStrip,
	Item, SimpleForm) {
	"use strict";

	var DEFAULT_LEVELS = { jw: [0.95, 0.9], lev: [1, 2] },
		DOMAIN_ICON = { Customer: "sap-icon://customer", Vendor: "sap-icon://supplier", Product: "sap-icon://course-book", Author: "sap-icon://user-edit",
			Employee: "sap-icon://employee", Store: "sap-icon://retail-store" },
		DISPLAY = ["cmpCount", "text", "sub", "info", "infoState", "selected", "desc", "meta", "statusText", "statusState", "statusIcon", "canDelete"];

	/* J5: Models & rules. A steward creates match models and defines the rules inside each one. The page edits a working
	   copy; "Submit for approval" hands the changed models to the rules API as new versions. Nothing here runs the rules:
	   Splink scores matches and the request service runs the duplicate check when a change request is submitted. */
	return BaseController.extend("repoio.proto.controller.ModelsRules", {
		onInit: function () {
			this.viewModel().setProperty("/mr", { tab: "match", q: "", dirtyCount: 0 });
			this.router().getRoute("models").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this, sKey = (oEvent.getParameter("arguments") || {}).model, oM = this.getOwnerComponent().getModel("rules");
			oM.dataLoaded().then(function () {
				that._src = oM.getData();
				if (!that._w) { that._reset(); }
				var ok = that._w.models.some(function (m) { return m.key === sKey; });
				that._sel = ok ? sKey : that._sel || that._w.models[0].key;
				that._refresh();
			});
		},

		/* ---------- working copy ---------- */
		_reset: function () {
			this._w = { models: JSON.parse(JSON.stringify(this._src.models)) };
			if (this._sel && !this._w.models.some(function (m) { return m.key === this._sel; }.bind(this))) { this._sel = this._w.models[0].key; }
		},
		_ar: function () { return this.lang() === "ar"; },
		_t: function (o) { return o ? (this._ar() ? o.ar || o.en : o.en || o.ar) : ""; },
		_field: function (k) { return this._src.fields[k] || { en: k, ar: k, col: k, kind: "text" }; },
		_model: function () { var k = this._sel; return this._w.models.filter(function (m) { return m.key === k; })[0]; },

		_refresh: function () {
			var that = this, vm = this.viewModel(), q = (vm.getProperty("/mr/q") || "").trim().toLowerCase();
			vm.setProperty("/mr/models", this._w.models.filter(function (m) {
				return !q || [m.en, m.ar, m.domain].join(" ").toLowerCase().indexOf(q) > -1;
			}).map(function (m) {
				return { key: m.key, text: that._t(m), sub: that.text("mr.dom." + m.domain), icon: m.icon || DOMAIN_ICON[m.domain] || "sap-icon://database",
					info: m.dirty ? that.text("mr.st.changed") : m.pending ? that.text("mr.st.pending") : that.text("mr.st." + m.status, [m.version]),
					infoState: m.dirty || m.pending ? "Warning" : m.status === "active" ? "Success" : "None", selected: m.key === that._sel };
			}));
			this._show();
			var n = this._w.models.filter(function (m) { return m.dirty; }).length;
			vm.setProperty("/mr/dirtyCount", n);
			vm.setProperty("/mr/dirtyText", this.text("mr.dirtyText", [n]));
		},

		_show: function () {
			var that = this, m = this._model(), vm = this.viewModel();
			if (!m) { vm.setProperty("/mr/m", null); return; }
			m.text = this._t(m);
			m.desc = this._ar() ? m.descAr || m.descEn : m.descEn || m.descAr;
			m.meta = this.text("mr.meta", [this.text("mr.dom." + m.domain), m.owner, m.changed]);
			var next = m.status === "active" ? Number(m.version) + 1 : m.version;
			m.statusText = m.dirty ? this.text("mr.st.changedLong", [next]) : m.pending ? this.text("mr.st.pendingLong", [next, m.status === "active" ? m.version : "—"])
				: this.text("mr.st." + m.status + "Long", [m.version]);
			m.statusState = m.dirty || m.pending ? "Warning" : m.status === "active" ? "Success" : "Information";
			m.statusIcon = m.dirty ? "sap-icon://edit" : m.pending ? "sap-icon://pending" : m.status === "active" ? "sap-icon://accept" : "sap-icon://document";
			m.canDelete = m.status === "draft" && !m.templates.length;
			m.templates.forEach(function (t) { t.text = that._t(t) + " · " + t.key; });
			m.comparisons.forEach(function (c) { that._decorateCmp(c); });
			m.cmpCount = m.comparisons.length;
			m.blocking.forEach(function (b) { that._decorateBlk(b); });
			m.exceptions.forEach(function (e) { e.text = that.text("mr.exc." + e.key); e.desc = that.text("mr.exc." + e.key + ".d"); });
			var fields = this._src.domainFields[m.domain] || [];
			m.checks.forEach(function (c) {
				var cat = that._src.checkCatalog.filter(function (x) { return x.key === c.key; })[0] || {};
				c.text = that.text("mr.chk." + c.key);
				c.desc = that.text("mr.chk." + c.key + ".d");
				c.againstText = that.text("mr.against." + cat.against);
				c.available = !cat.needs || fields.indexOf(cat.needs) > -1;
				c.unavailable = c.available ? "" : that.text("mr.chk.needs", [that._t(that._field(cat.needs))]);
				if (!c.available) { c.on = false; }
			});
			vm.setProperty("/mr/m", m);
			this._samples();
		},
		_decorateCmp: function (c) {
			var f = this._field(c.field), mt = this._src.methods[c.method];
			c.fieldText = this._t(f);
			c.col = f.col;
			c.hint = this._ar() ? f.hintAr || "" : f.hintEn || "";
			c.methodText = this._t(mt);
			c.splink = "cl." + mt.splink;
			c.levelsText = this._levelsText(c);
			c.weightText = c.weight === undefined || c.weight === null ? this.text("mr.cmp.untrained") : "+" + Number(c.weight).toFixed(1);
		},
		_levelsText: function (c) {
			if (c.method === "exact") { return this.text("mr.lv.exact"); }
			if (c.method === "array") { return this.text("mr.lv.array"); }
			var lv = c.levels || DEFAULT_LEVELS[c.method];
			return lv.map(function (v) { return (c.method === "lev" ? "≤ " : "≥ ") + v; }).join(" · ") + " · " + this.text("mr.lv.else");
		},
		_decorateBlk: function (b) {
			var that = this, eq = b.fields.filter(function (k) { return that._field(k).kind !== "array"; }),
				arr = b.fields.filter(function (k) { return that._field(k).kind === "array"; }), parts = [];
			if (eq.length) { parts.push(this.text("mr.blk.same", [eq.map(function (k) { return that._t(that._field(k)); }).join(this._ar() ? " و" : " and ")])); }
			arr.forEach(function (k) { parts.push(that.text("mr.blk.share", [that._t(that._field(k))])); });
			b.text = parts.join(this._ar() ? "، و" : ", and ");
			// Equal values use Splink's block_on; a value in common needs a SQL condition (DuckDB list functions).
			b.sql = !arr.length ? "block_on(" + eq.map(function (k) { return "\"" + that._field(k).col + "\""; }).join(", ") + ")"
				: "\"" + eq.map(function (k) { var c = that._field(k).col; return "l." + c + " = r." + c; })
					.concat(arr.map(function (k) { var c = that._field(k).col; return "array_length(list_intersect(l." + c + ", r." + c + ")) >= 1"; })).join(" AND ") + "\"";
		},
		cmpTitle: function (n) { return this.text("mr.cmp.title", [n || 0]); },

		onModel: function (oEvent) {
			var k = oEvent.getParameter("listItem").getBindingContext("view").getProperty("key");
			this.router().navTo("models", { model: k }, true);
		},
		onSearch: function () { this._refresh(); },
		onEdit: function () {
			var m = this._model();
			if (m) { m.dirty = true; m.pending = false; }
			this._refresh();
		},

		/* ---------- create, edit and delete a model ---------- */
		onCreate: function () { this._modelDialog(null); },
		onEditModel: function () { this._modelDialog(this._model()); },
		_modelDialog: function (oModel) {
			var that = this, S = this._src, oSrcSel,
				oEn = new Input({ width: "100%", value: oModel ? oModel.en : "", placeholder: this.text("mr.f.nameEnPh") }),
				oAr = new Input({ width: "100%", value: oModel ? oModel.ar : "", placeholder: this.text("mr.f.nameArPh") }),
				oDomain = new Select({ width: "100%", selectedKey: oModel ? oModel.domain : "Customer", enabled: !oModel,
					items: S.domains.map(function (d) { return new Item({ key: d, text: that.text("mr.dom." + d) }); }) }),
				oDesc = new TextArea({ width: "100%", rows: 2, value: oModel ? (this._ar() ? oModel.descAr : oModel.descEn) : "" }),
				content = [
					new Label({ text: this.text("mr.f.nameEn"), required: true }), oEn,
					new Label({ text: this.text("mr.f.nameAr"), required: true }), oAr,
					new Label({ text: this.text("mr.f.domain"), required: true }), oDomain,
					new Label({ text: this.text("mr.f.desc") }), oDesc
				];
			if (!oModel) {
				oSrcSel = new Select({ width: "100%" });
				var fill = function () {
					var d = oDomain.getSelectedKey();
					oSrcSel.destroyItems();
					oSrcSel.addItem(new Item({ key: "", text: that.text("mr.f.blank") }));
					that._w.models.filter(function (m) { return m.domain === d; }).forEach(function (m) {
						oSrcSel.addItem(new Item({ key: m.key, text: that.text("mr.f.copyOf", [that._t(m)]) }));
					});
					oSrcSel.setSelectedKey("");
				};
				oDomain.attachChange(fill);
				fill();
				content.push(new Label({ text: this.text("mr.f.start") }), oSrcSel, new Text({ text: this.text("mr.f.startHint") }).addStyleClass("repoioUmMuted"));
			}
			var oDlg = new Dialog({
				title: this.text(oModel ? "mr.editTitle" : "mr.createTitle"), contentWidth: "30rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1, content: content })],
				beginButton: new Button({ text: this.text(oModel ? "common.save" : "mr.createBtn"), type: "Emphasized", press: function () {
					var en = oEn.getValue().trim(), ar = oAr.getValue().trim(), bad = false;
					[[oEn, en], [oAr, ar]].forEach(function (x) { x[0].setValueState(x[1] ? "None" : "Error").setValueStateText(that.text("mr.v.required")); bad = bad || !x[1]; });
					var clash = that._w.models.some(function (m) { return m !== oModel && (m.en.toLowerCase() === en.toLowerCase() || m.ar === ar); });
					if (!bad && clash) { oEn.setValueState("Error").setValueStateText(that.text("mr.v.unique")); bad = true; }
					if (bad) { return; }
					var desc = oDesc.getValue().trim();
					if (oModel) {
						oModel.en = en; oModel.ar = ar;
						if (that._ar()) { oModel.descAr = desc; } else { oModel.descEn = desc; }
						oModel.dirty = true; oModel.pending = false;
					} else {
						oModel = that._newModel(en, ar, oDomain.getSelectedKey(), desc, oSrcSel.getSelectedKey());
						that._w.models.push(oModel);
						that._sel = oModel.key;
						that.viewModel().setProperty("/mr/tab", "match");
						MessageToast.show(that.text("mr.t.created", [that._t(oModel)]));
					}
					oDlg.close();
					that.router().navTo("models", { model: oModel.key }, true);
					that._refresh();
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		_newModel: function (en, ar, domain, desc, fromKey) {
			var src = this._w.models.filter(function (m) { return m.key === fromKey; })[0], base = (en || "model").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "model",
				key = base, i = 2, keys = this._w.models.map(function (m) { return m.key; }), fields = this._src.domainFields[domain] || [];
			while (keys.indexOf(key) > -1) { key = base + "-" + i++; }
			var strip = function (a) { return JSON.parse(JSON.stringify(a, function (k, v) { return DISPLAY.indexOf(k) > -1 || ["fieldText", "col", "hint", "methodText", "splink", "levelsText", "weightText", "sql", "againstText", "available", "unavailable"].indexOf(k) > -1 ? undefined : v; })); };
			return {
				key: key, en: en, ar: ar, domain: domain, descEn: this._ar() ? "" : desc, descAr: this._ar() ? desc : "",
				status: "draft", version: "1", changed: this._src.now || "2026-11-16", owner: "محمد", icon: DOMAIN_ICON[domain], dirty: true,
				threshold: src ? src.threshold : 0.9, templates: [],
				comparisons: src ? strip(src.comparisons).map(function (c) { c.weight = null; return c; }) : [],
				blocking: src ? strip(src.blocking) : (fields.indexOf("firstToken") > -1 ? [{ fields: ["firstToken"] }] : []),
				exceptions: src ? strip(src.exceptions) : [],
				checks: this._src.checkCatalog.map(function (c) {
					var s = src && src.checks.filter(function (x) { return x.key === c.key; })[0];
					return { key: c.key, on: s ? s.on : c.key !== "similarOpenCr" && (!c.needs || fields.indexOf(c.needs) > -1) };
				})
			};
		},
		onDeleteModel: function () {
			var that = this, m = this._model();
			MessageBox.confirm(this.text("mr.delConfirm", [this._t(m)]), { actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL], emphasizedAction: MessageBox.Action.DELETE,
				onClose: function (a) {
					if (a !== MessageBox.Action.DELETE) { return; }
					that._w.models.splice(that._w.models.indexOf(m), 1);
					that._sel = that._w.models[0] && that._w.models[0].key;
					MessageToast.show(that.text("mr.t.deleted", [that._t(m)]));
					that.router().navTo("models", { model: that._sel }, true);
					that._refresh();
				} });
		},

		/* ---------- comparisons ---------- */
		onAddCmp: function () { this._cmpDialog(null); },
		onEditCmp: function (oEvent) { this._cmpDialog(oEvent.getSource().getBindingContext("view").getObject()); },
		onDelCmp: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(), m = this._model();
			m.comparisons.splice(m.comparisons.indexOf(o), 1);
			this.onEdit();
		},
		_cmpDialog: function (oCmp) {
			var that = this, m = this._model(), F = this._src.fields, M = this._src.methods,
				used = m.comparisons.filter(function (c) { return c !== oCmp; }).map(function (c) { return c.field; }),
				fieldKeys = (this._src.domainFields[m.domain] || []).filter(function (k) { return k !== "firstToken" && used.indexOf(k) < 0; });
			if (!fieldKeys.length) { MessageToast.show(this.text("mr.cmp.allUsed")); return; }
			var oField = new Select({ width: "100%", selectedKey: oCmp ? oCmp.field : fieldKeys[0],
					items: fieldKeys.map(function (k) { return new Item({ key: k, text: that._t(F[k]) }); }) }),
				oMethod = new Select({ width: "100%" }),
				oLevels = new Input({ width: "100%", textDirection: "LTR" }),
				oLvLabel = new Label({ text: this.text("mr.cmp.levelsIn") }),
				oHint = new Text({ text: "" }).addStyleClass("repoioUmMuted"),
				syncLv = function (bKeep) {
					var k = oMethod.getSelectedKey(), show = !!M[k].levels;
					oLevels.setVisible(show); oLvLabel.setVisible(show);
					if (show) { oLevels.setValue(((bKeep && oCmp && oCmp.method === k && oCmp.levels) || DEFAULT_LEVELS[k]).join(", ")); }
					oLvLabel.setText(that.text(k === "lev" ? "mr.cmp.levelsLev" : "mr.cmp.levelsIn"));
				},
				sync = function (bKeep) {
					var f = F[oField.getSelectedKey()], kinds = Object.keys(M).filter(function (x) { return M[x].kinds.indexOf(f.kind) > -1; }),
						cur = bKeep && oCmp ? oCmp.method : oMethod.getSelectedKey();
					oMethod.destroyItems();
					kinds.forEach(function (x) { oMethod.addItem(new Item({ key: x, text: that._t(M[x]) + " · " + M[x].splink })); });
					oMethod.setSelectedKey(kinds.indexOf(cur) > -1 ? cur : kinds[0]);
					oHint.setText(that._ar() ? f.hintAr || "" : f.hintEn || "");
					syncLv(bKeep);
				};
			oField.attachChange(function () { sync(false); });
			oMethod.attachChange(function () { syncLv(false); });
			sync(true);
			var oDlg = new Dialog({
				title: this.text(oCmp ? "mr.cmp.editTitle" : "mr.cmp.addTitle", [this._t(m)]), contentWidth: "30rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1, content: [
					new Label({ text: this.text("mr.cmp.field"), required: true }), oField, oHint,
					new Label({ text: this.text("mr.cmp.method"), required: true }), oMethod,
					oLvLabel, oLevels
				] }), new MessageStrip({ text: this.text("mr.cmp.retrain"), type: "Information", showIcon: true }).addStyleClass("sapUiSmallMargin")],
				beginButton: new Button({ text: this.text("common.save"), type: "Emphasized", press: function () {
					var k = oMethod.getSelectedKey(), lv = null;
					if (M[k].levels) {
						lv = oLevels.getValue().split(/[,،\s]+/).filter(Boolean).map(Number);
						var ok = lv.length && lv.every(function (v) { return k === "lev" ? v >= 0 && v === Math.round(v) : v > 0 && v < 1; });
						if (!ok) { oLevels.setValueState("Error").setValueStateText(that.text(k === "lev" ? "mr.v.levelsLev" : "mr.v.levels")); return; }
						lv.sort(function (a, b) { return k === "lev" ? a - b : b - a; });
					}
					var o = oCmp || { on: true };
					if (!oCmp || oCmp.field !== oField.getSelectedKey() || oCmp.method !== k) { o.weight = null; } // learned at the next training run
					o.field = oField.getSelectedKey(); o.method = k; o.levels = lv;
					if (!oCmp) { m.comparisons.push(o); }
					oDlg.close();
					that.onEdit();
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},

		/* ---------- blocking rules: which pairs Splink scores at all ---------- */
		onAddBlk: function () {
			var that = this, m = this._model(), F = this._src.fields,
				oFields = new MultiComboBox({ width: "100%", items: (this._src.domainFields[m.domain] || []).map(function (k) { return new Item({ key: k, text: that._t(F[k]) }); }) });
			var oDlg = new Dialog({
				title: this.text("mr.blk.addTitle", [this._t(m)]), contentWidth: "28rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1, content: [
					new Label({ text: this.text("mr.blk.fields"), required: true }), oFields,
					new Text({ text: this.text("mr.blk.fieldsHint") }).addStyleClass("repoioUmMuted")
				] })],
				beginButton: new Button({ text: this.text("mr.blk.add"), type: "Emphasized", press: function () {
					var a = oFields.getSelectedKeys();
					if (!a.length) { oFields.setValueState("Error").setValueStateText(that.text("mr.v.blk")); return; }
					m.blocking.push({ fields: a });
					oDlg.close();
					that.onEdit();
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		onDelBlk: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(), m = this._model();
			m.blocking.splice(m.blocking.indexOf(o), 1);
			this.onEdit();
		},

		/* ---------- the Splink settings the matching service builds from this model (read-only preview) ---------- */
		_splinkText: function (m) {
			var that = this,
				cmp = m.comparisons.filter(function (c) { return c.on; }).map(function (c) {
					var f = that._field(c.field), mt = that._src.methods[c.method], args = "\"" + f.col + "\"";
					if (c.method === "jw" || c.method === "lev") { args += ", [" + (c.levels || DEFAULT_LEVELS[c.method]).join(", ") + "]"; }
					if (c.method === "array") { args += ", [1]"; }
					return "        cl." + mt.splink + "(" + args + "),";
				}),
				blk = m.blocking.map(function (b) { that._decorateBlk(b); return "        " + b.sql + ","; }),
				exc = m.exceptions.filter(function (e) { return e.on; }).map(function (e) { return "# " + that.text("mr.exc." + e.key + ".code"); });
			return ["# " + this._t(m) + " · " + m.domain + " · " + this.text("mr.ver.short", [m.dirty && m.status === "active" ? Number(m.version) + 1 : m.version]),
				"from splink import SettingsCreator, block_on",
				"import splink.comparison_library as cl",
				"",
				"settings = SettingsCreator(",
				"    link_type=\"link_only\",  # change request <-> golden records",
				"    unique_id_column_name=\"record_id\",",
				"    blocking_rules_to_generate_predictions=[",
				blk.join("\n"),
				"    ],",
				"    comparisons=[",
				cmp.join("\n"),
				"    ],",
				")",
				"# Stop the change request when match_probability >= " + Number(m.threshold).toFixed(2)].concat(exc).join("\n");
		},
		onSplink: function () {
			var that = this, m = this._model(), s = this._splinkText(m);
			var oDlg = new Dialog({
				title: this.text("mr.splinkTitle", [this._t(m)]), contentWidth: "44rem",
				content: [new MessageStrip({ text: this.text("mr.splinkNote"), type: "Information", showIcon: true }).addStyleClass("sapUiSmallMargin"),
					new TextArea({ value: s, editable: false, width: "100%", rows: 22, textDirection: "LTR" }).addStyleClass("repoioMrCode")],
				beginButton: new Button({ text: this.text("mr.copy"), icon: "sap-icon://copy", press: function () {
					try { navigator.clipboard.writeText(s).catch(function () { /* clipboard blocked */ }); } catch (e) { /* clipboard blocked */ }
					MessageToast.show(that.text("mr.t.copied"));
				} }),
				endButton: new Button({ text: this.text("common.close"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},

		/* ---------- sample results for the selected model ---------- */
		_samples: function () {
			var that = this, ar = this._ar(), m = this._model();
			this.viewModel().setProperty("/mr/samples", this._src.samples.filter(function (s) { return m && s.model === m.key; }).map(function (s) {
				return {
					id: s.id, by: s.by, name: s.name, template: s.template, phonesText: s.phones.join(" · "), result: s.result,
					resultText: that.text("mr.res." + s.result),
					why: s.result === "stopped" ? s.reasons.map(function (r) { return "• " + that.text("mr.chk." + r.check) + ": " + (ar ? r.ar : r.en); }).join("\n")
						: that.text("mr.res.none", [s.best.toFixed(2)]),
					note: ar ? s.noteAr || "" : s.noteEn || ""
				};
			}));
		},

		/* ---------- draft ---------- */
		onDiscard: function () {
			this._reset();
			MessageToast.show(this.text("mr.t.discarded"));
			this.router().navTo("models", { model: this._sel }, true);
			this._refresh();
		},
		onSubmit: function () {
			var that = this, changed = this._w.models.filter(function (m) { return m.dirty; }),
				bad = changed.filter(function (m) { return !m.comparisons.some(function (c) { return c.on; }) || !m.blocking.length; })[0];
			if (bad) {
				this._sel = bad.key;
				this.router().navTo("models", { model: bad.key }, true);
				this.viewModel().setProperty("/mr/tab", "match");
				this._refresh();
				MessageBox.error(this.text("mr.v.submit", [this._t(bad)]));
				return;
			}
			changed.forEach(function (m) {
				var v = m.status === "active" ? Number(m.version) + 1 : Number(m.version);
				Audit.log(that, { area: "data", action: m.status === "active" ? "update" : "create", type: "setting", object: that._t(m) + " · " + that.text("mr.ver.short", [v]),
					en: "Match model submitted for approval", ar: "إرسال نموذج المطابقة للموافقة", ref: { route: "models", args: { model: m.key } } });
				m.dirty = false;
				m.pending = true;
			});
			MessageToast.show(this.text("mr.t.submitted", [changed.length]));
			this._refresh();
		}
	});
});
