sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/audit",
	"sap/m/MessageToast",
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
], function (BaseController, Audit, MessageToast, Dialog, Button, Label, Select, Input, Text, TextArea, MultiComboBox, MessageStrip, Item, SimpleForm) {
	"use strict";

	var DEFAULT_LEVELS = { jw: [0.95, 0.9], lev: [1, 2] };

	/* J5: Models & rules. The page edits a working copy (draft) of the model's rules; "Submit for approval" hands it to the
	   rules API as a new version. Nothing here runs the rules: Splink scores matches and the request service runs the
	   duplicate check when a change request is submitted. */
	return BaseController.extend("repoio.proto.controller.ModelsRules", {
		onInit: function () {
			this.viewModel().setProperty("/mr", { tab: "match", dirty: false, pending: false, testType: "all", profileKey: "teacher" });
			this.router().getRoute("models").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this, sTab = (oEvent.getParameter("arguments") || {}).tab, oM = this.getOwnerComponent().getModel("rules");
			this.viewModel().setProperty("/mr/tab", ["match", "gate", "test"].indexOf(sTab) > -1 ? sTab : "match");
			oM.dataLoaded().then(function () {
				that._src = oM.getData();
				if (!that._w) { that._reset(); } else { that._refresh(); }
			});
		},

		/* ---------- working copy ---------- */
		_reset: function () {
			this._w = JSON.parse(JSON.stringify({ profiles: this._src.profiles, checks: this._src.checks }));
			var vm = this.viewModel();
			vm.setProperty("/mr/dirty", false);
			this._refresh();
		},
		_ar: function () { return this.lang() === "ar"; },
		_t: function (o) { return o ? (this._ar() ? o.ar : o.en) : ""; },
		_field: function (k) { return this._src.fields[k] || { en: k, ar: k, col: k, kind: "text" }; },

		_refresh: function () {
			var that = this, vm = this.viewModel(), sKey = vm.getProperty("/mr/profileKey");
			vm.setProperty("/mr/profiles", this._w.profiles.map(function (p) {
				return { key: p.key, text: that._t(p), icon: p.icon, code: p.code, selected: p.key === sKey };
			}));
			var types = this._w.profiles.map(function (p) { return { key: p.key, text: that._t(p) }; });
			vm.setProperty("/mr/typeItems", types);
			vm.setProperty("/mr/typeItemsAll", [{ key: "all", text: this.text("mr.test.allTypes") }].concat(types));
			this._showProfile(sKey);
			this._checks();
			this._samples();
			this._version();
		},
		_version: function () {
			var vm = this.viewModel(), m = this._src.model;
			vm.setProperty("/mr/versionText", vm.getProperty("/mr/dirty") ? this.text("mr.ver.draft", [this._t(m), m.draft])
				: vm.getProperty("/mr/pending") ? this.text("mr.ver.pending", [this._t(m), m.draft])
				: this.text("mr.ver.active", [this._t(m), m.active, m.activeDate]));
		},

		/* ---------- match rules ---------- */
		_profile: function () {
			var k = this.viewModel().getProperty("/mr/profileKey");
			return this._w.profiles.filter(function (p) { return p.key === k; })[0];
		},
		_showProfile: function (sKey) {
			var that = this, p = this._w.profiles.filter(function (x) { return x.key === sKey; })[0] || this._w.profiles[0];
			p.text = this._t(p);
			p.typeText = this.text("mr.typeText", ["\u200e" + p.code + "\u200e", "\u200e" + p.accountTypes + "\u200e"]);
			p.templates.forEach(function (t) { t.text = that._t(t) + " · " + t.key; });
			p.comparisons.forEach(function (c) { that._decorateCmp(c); });
			p.blocking.forEach(function (b) { that._decorateBlk(b); });
			p.exceptions.forEach(function (e) { e.text = that.text("mr.exc." + e.key); e.desc = that.text("mr.exc." + e.key + ".d"); });
			this.viewModel().setProperty("/mr/p", p);
		},
		_decorateCmp: function (c) {
			var f = this._field(c.field), m = this._src.methods[c.method];
			c.fieldText = this._t(f);
			c.col = f.col;
			c.hint = this._ar() ? f.hintAr || "" : f.hintEn || "";
			c.methodText = this._t(m);
			c.splink = "cl." + m.splink;
			c.levelsText = this._levelsText(c);
			c.weightText = c.weight === undefined || c.weight === null ? this.text("mr.cmp.untrained") : "+" + Number(c.weight).toFixed(1);
		},
		_levelsText: function (c) {
			var that = this;
			if (c.method === "exact") { return this.text("mr.lv.exact"); }
			if (c.method === "array") { return this.text("mr.lv.array"); }
			var lv = c.levels || DEFAULT_LEVELS[c.method];
			return lv.map(function (v) { return (c.method === "lev" ? "≤ " : "≥ ") + v; }).join(" · ") + " · " + that.text("mr.lv.else");
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
		cmpTitle: function (a) { return this.text("mr.cmp.title", [(a || []).length]); },

		onProfile: function (oEvent) {
			var k = oEvent.getParameter("listItem").getBindingContext("view").getProperty("key");
			this.viewModel().setProperty("/mr/profileKey", k);
			this._refresh();
		},
		onTab: function (oEvent) { this.router().navTo("models", { tab: oEvent.getParameter("key") }, true); },
		onEdit: function () {
			this.viewModel().setProperty("/mr/dirty", true);
			this.viewModel().setProperty("/mr/pending", false);
			this._version();
		},

		/* Add or edit one comparison: field, how to compare, and the similarity levels. */
		onAddCmp: function () { this._cmpDialog(null); },
		onEditCmp: function (oEvent) { this._cmpDialog(oEvent.getSource().getBindingContext("view").getObject()); },
		onDelCmp: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(), p = this._profile();
			p.comparisons.splice(p.comparisons.indexOf(o), 1);
			this.onEdit();
			this._showProfile(p.key);
		},
		_cmpDialog: function (oCmp) {
			var that = this, p = this._profile(), F = this._src.fields, M = this._src.methods,
				used = p.comparisons.filter(function (c) { return c !== oCmp; }).map(function (c) { return c.field; }),
				fieldKeys = Object.keys(F).filter(function (k) { return k !== "firstToken" && used.indexOf(k) < 0; });
			if (!fieldKeys.length) { MessageToast.show(this.text("mr.cmp.allUsed")); return; }
			var oField = new Select({ width: "100%", selectedKey: oCmp ? oCmp.field : fieldKeys[0],
					items: fieldKeys.map(function (k) { return new Item({ key: k, text: that._t(F[k]) }); }) }),
				oMethod = new Select({ width: "100%" }),
				oLevels = new Input({ width: "100%", textDirection: "LTR" }),
				oLvLabel = new Label({ text: this.text("mr.cmp.levelsIn") }),
				oHint = new Text({ text: "" }).addStyleClass("repoioUmMuted"),
				sync = function (bKeep) {
					var f = F[oField.getSelectedKey()], kinds = Object.keys(M).filter(function (m) { return M[m].kinds.indexOf(f.kind) > -1; }),
						cur = bKeep && oCmp ? oCmp.method : oMethod.getSelectedKey();
					oMethod.destroyItems();
					kinds.forEach(function (m) { oMethod.addItem(new Item({ key: m, text: that._t(M[m]) + " · " + M[m].splink })); });
					oMethod.setSelectedKey(kinds.indexOf(cur) > -1 ? cur : kinds[0]);
					oHint.setText(that._ar() ? f.hintAr || "" : f.hintEn || "");
					syncLv(bKeep);
				},
				syncLv = function (bKeep) {
					var m = oMethod.getSelectedKey(), show = !!M[m].levels;
					oLevels.setVisible(show); oLvLabel.setVisible(show);
					if (show) { oLevels.setValue(((bKeep && oCmp && oCmp.levels) || DEFAULT_LEVELS[m]).join(", ")); }
					oLvLabel.setText(that.text(m === "lev" ? "mr.cmp.levelsLev" : "mr.cmp.levelsIn"));
				};
			oField.attachChange(function () { sync(false); });
			oMethod.attachChange(function () { syncLv(false); });
			sync(true);
			var oDlg = new Dialog({
				title: this.text(oCmp ? "mr.cmp.editTitle" : "mr.cmp.addTitle", [this._t(p)]), contentWidth: "30rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1, content: [
					new Label({ text: this.text("mr.cmp.field"), required: true }), oField, oHint,
					new Label({ text: this.text("mr.cmp.method"), required: true }), oMethod,
					oLvLabel, oLevels
				] }), new MessageStrip({ text: this.text("mr.cmp.retrain"), type: "Information", showIcon: true }).addStyleClass("sapUiSmallMargin")],
				beginButton: new Button({ text: this.text("common.save"), type: "Emphasized", press: function () {
					var m = oMethod.getSelectedKey(), lv = null;
					if (M[m].levels) {
						lv = oLevels.getValue().split(/[,،\s]+/).filter(Boolean).map(Number);
						var ok = lv.length && lv.every(function (v) { return m === "lev" ? v >= 0 && v === Math.round(v) : v > 0 && v < 1; });
						if (!ok) { oLevels.setValueState("Error").setValueStateText(that.text(m === "lev" ? "mr.v.levelsLev" : "mr.v.levels")); return; }
						lv.sort(function (a, b) { return m === "lev" ? a - b : b - a; });
					}
					var o = oCmp || { on: true };
					o.field = oField.getSelectedKey(); o.method = m; o.levels = lv;
					if (!oCmp || oCmp.field !== o.field || oCmp.method !== m) { o.weight = null; } // re-estimated at the next training run
					if (!oCmp) { p.comparisons.push(o); }
					that.onEdit();
					that._showProfile(p.key);
					oDlg.close();
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},

		/* Blocking rules decide which pairs Splink scores at all: same values, or a phone number in common. */
		onAddBlk: function () {
			var that = this, p = this._profile(), F = this._src.fields,
				oFields = new MultiComboBox({ width: "100%", items: Object.keys(F).map(function (k) { return new Item({ key: k, text: that._t(F[k]) }); }) });
			var oDlg = new Dialog({
				title: this.text("mr.blk.addTitle", [this._t(p)]), contentWidth: "28rem",
				content: [new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanM: 12, labelSpanL: 12, columnsL: 1, columnsM: 1, content: [
					new Label({ text: this.text("mr.blk.fields"), required: true }), oFields,
					new Text({ text: this.text("mr.blk.fieldsHint") }).addStyleClass("repoioUmMuted")
				] })],
				beginButton: new Button({ text: this.text("mr.blk.add"), type: "Emphasized", press: function () {
					var a = oFields.getSelectedKeys();
					if (!a.length) { oFields.setValueState("Error").setValueStateText(that.text("mr.v.blk")); return; }
					p.blocking.push({ fields: a });
					that.onEdit();
					that._showProfile(p.key);
					oDlg.close();
				} }),
				endButton: new Button({ text: this.text("common.cancel"), press: function () { oDlg.close(); } }),
				afterClose: function () { oDlg.destroy(); }
			});
			this.getView().addDependent(oDlg);
			oDlg.open();
		},
		onDelBlk: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(), p = this._profile();
			if (p.blocking.length === 1) { MessageToast.show(this.text("mr.blk.keepOne")); return; }
			p.blocking.splice(p.blocking.indexOf(o), 1);
			this.onEdit();
			this._showProfile(p.key);
		},

		/* The Splink settings the matching service builds from this draft (read-only preview). */
		_splinkText: function (p) {
			var that = this, on = p.comparisons.filter(function (c) { return c.on; }),
				cmp = on.map(function (c) {
					var f = that._field(c.field), m = that._src.methods[c.method], args = "\"" + f.col + "\"";
					if (c.method === "jw" || c.method === "lev") { args += ", [" + (c.levels || DEFAULT_LEVELS[c.method]).join(", ") + "]"; }
					if (c.method === "array") { args += ", [1]"; }
					return "        cl." + m.splink + "(" + args + "),";
				}),
				blk = p.blocking.map(function (b) { that._decorateBlk(b); return "        " + b.sql + ","; }),
				exc = p.exceptions.filter(function (e) { return e.on; }).map(function (e) { return "# " + that.text("mr.exc." + e.key + ".code"); });
			return ["# " + this._t(p) + " (" + p.code + ") · " + this._t(this._src.model) + " " + this.text("mr.ver.short", [this._src.model.draft]),
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
				"# Stop the change request when match_probability >= " + Number(p.threshold).toFixed(2)].concat(exc).join("\n");
		},
		onSplink: function () {
			var that = this, p = this._profile(), s = this._splinkText(p);
			var oDlg = new Dialog({
				title: this.text("mr.splinkTitle", [this._t(p)]), contentWidth: "44rem",
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

		/* ---------- duplicate check on change requests ---------- */
		_checks: function () {
			var that = this;
			this._w.checks.forEach(function (c) {
				c.text = that.text("mr.chk." + c.key);
				c.desc = that.text("mr.chk." + c.key + ".d");
				c.againstText = that.text("mr.against." + c.against);
			});
			this.viewModel().setProperty("/mr/checks", this._w.checks);
		},

		/* ---------- sample results ---------- */
		_samples: function () {
			var that = this, ar = this._ar(), t = this.viewModel().getProperty("/mr/testType"),
				names = {};
			this._w.profiles.forEach(function (p) { names[p.key] = that._t(p); });
			this.viewModel().setProperty("/mr/samples", this._src.samples.filter(function (s) { return t === "all" || s.type === t; }).map(function (s) {
				return {
					id: s.id, by: s.by, name: s.name, typeText: names[s.type] + " · " + s.template, phonesText: s.phones.join(" · "), result: s.result,
					resultText: that.text("mr.res." + s.result),
					why: s.result === "stopped" ? s.reasons.map(function (r) { return "• " + that.text("mr.chk." + r.check) + ": " + (ar ? r.ar : r.en); }).join("\n")
						: that.text("mr.res.none", [s.best.toFixed(2)]),
					note: ar ? s.noteAr || "" : s.noteEn || ""
				};
			}));
		},
		onTestType: function () { this._samples(); },

		/* ---------- draft ---------- */
		onDiscard: function () { this._reset(); MessageToast.show(this.text("mr.t.discarded")); },
		onSubmit: function () {
			var vm = this.viewModel(), m = this._src.model;
			Audit.log(this, { area: "data", action: "update", type: "setting", object: this._t(m) + " · " + this.text("mr.ver.short", [m.draft]),
				en: "Match rules and duplicate check submitted for approval", ar: "إرسال قواعد المطابقة وفحص التكرار للموافقة",
				ref: { route: "models", args: {} } });
			vm.setProperty("/mr/dirty", false);
			vm.setProperty("/mr/pending", true);
			this._version();
			MessageToast.show(this.text("mr.t.submitted", [m.draft, m.active]));
		}
	});
});
