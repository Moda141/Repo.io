/*
 * "Import CSV / Excel file" dialog — SAP Datasphere "Import CSV File" layout:
 * file picker, upload options, delimiter, and a data preview whose column headers carry the
 * source name and a target-field mapping. Import sends one batch to raw.<entity>; the server
 * validates every row (rejected rows never enter the batch) — the browser only previews.
 */
sap.ui.define([
	"sap/m/Dialog", "sap/m/Button", "sap/m/Label", "sap/m/Input", "sap/m/Select", "sap/m/CheckBox", "sap/m/Text",
	"sap/m/HBox", "sap/m/VBox", "sap/m/Table", "sap/m/Column", "sap/m/ColumnListItem", "sap/m/ScrollContainer",
	"sap/m/MessageStrip", "sap/m/MessageBox", "sap/ui/core/Item", "sap/ui/unified/FileUploader", "sap/ui/model/json/JSONModel",
	"repoio/proto/util/tabular"
], function (Dialog, Button, Label, Input, Select, CheckBox, Text, HBox, VBox, Table, Column, ColumnListItem, ScrollContainer,
	MessageStrip, MessageBox, Item, FileUploader, JSONModel, tabular) {
	"use strict";

	var PREVIEW_ROWS = 50;
	var DOMAINS = ["Customer", "Vendor", "Product", "Author", "Employee", "Store"];
	/* A few common header spellings, so typical files map without clicks. Anything else maps by normalised name. */
	var SYNONYMS = { name: "business_name", customername: "business_name", accountname: "business_name", vendorname: "business_name",
		title: "business_name", partnerid: "customer_id", accountid: "customer_id", customerno: "customer_id", supplierid: "vendor_id",
		vat: "tax_number", taxid: "tax_number", taxno: "tax_number", countrycode: "country", sku: "product_id", itemcode: "product_id" };
	var norm = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); };

	/**
	 * @param {sap.ui.core.mvc.Controller} oCtrl  page controller (text(), lang(), data(), getView())
	 * @param {object} oConn  the file connection entry
	 * @param {function} fnDone  called with the import summary after a successful import
	 */
	function open(oCtrl, oConn, fnDone) {
		var T = oCtrl.text.bind(oCtrl), ar = oCtrl.lang() === "ar";
		var concepts = oCtrl.data().getProperty("/ontology/concepts") || [];
		var concept = function (id) { return concepts.filter(function (c) { return c.id === id; })[0]; };
		var maxMb = parseInt((oConn.props || {}).maxSize, 10) || 25;

		/* Target fields: the business name plus the domain concept's data properties (master_id is assigned by Repo.io). */
		var targetFields = function (domain) {
			var c = concept(domain);
			return [{ key: "business_name", req: true }].concat((c ? c.props : []).filter(function (p) { return p.name !== "master_id"; })
				.map(function (p) { return { key: p.name, req: !!p.req }; }));
		};

		var m = new JSONModel({
			fileName: "", kind: "", replace: false, header: true, missing: "null", delimiter: "auto", other: "", encoding: "utf-8",
			sheets: [], sheet: "", domain: "Customer", table: "raw.customer", showing: "", detected: "", total: 0, cols: [], rows: [], targets: [], ready: false, issues: "", busy: false
		});
		var state = { buffer: null, text: "", xlsx: null, matrix: [] };

		var oTable = new Table({ fixedLayout: true, noDataText: T("imp.noFile"), growing: false, alternateRowColors: true })
			.addStyleClass("repoioImpTable");
		oTable.setModel(m, "imp");

		var rebuildTable = function () {
			var cols = m.getProperty("/cols"), targets = m.getProperty("/targets");
			oTable.destroyColumns(); oTable.unbindItems();
			oTable.setWidth(Math.max(cols.length, 1) * 11 + "rem");
			cols.forEach(function (c, i) {
				var oSel = new Select({ width: "100%", selectedKey: "{imp>/cols/" + i + "/map}", change: validate,
					items: [new Item({ key: "", text: T("imp.skip") })].concat(targets.map(function (t) {
						return new Item({ key: t.key, text: t.key + (t.req ? " *" : "") });
					})) });
				oTable.addColumn(new Column({ width: "11rem", header: new VBox({ items: [
					new Input({ value: c.name, editable: false, width: "100%" }).addStyleClass("repoioImpSrc"),
					oSel
				] }).addStyleClass("repoioImpHead") }));
			});
			oTable.bindItems({ path: "imp>/rows", template: new ColumnListItem({ cells: cols.map(function (c, i) {
				return new Text({ text: "{imp>c" + i + "}", wrapping: false, tooltip: "{imp>c" + i + "}" });
			}) }) });
		};

		var validate = function () {
			var cols = m.getProperty("/cols"), targets = m.getProperty("/targets"), used = {}, dup = [];
			cols.forEach(function (c) { if (c.map) { if (used[c.map]) { dup.push(c.map); } used[c.map] = true; } });
			var missing = targets.filter(function (t) { return t.req && !used[t.key]; }).map(function (t) { return t.key; });
			var issues = [];
			if (missing.length) { issues.push(T("imp.missingReq", [missing.join(", ")])); }
			if (dup.length) { issues.push(T("imp.dupMap", [dup.join(", ")])); }
			m.setProperty("/issues", issues.join(" "));
			m.setProperty("/ready", cols.length > 0 && m.getProperty("/total") > 0 && !issues.length);
		};

		/* Turn the parsed matrix into header + preview rows, and auto-map columns to target fields. */
		var applyMatrix = function () {
			var mx = state.matrix, header = m.getProperty("/header"), width = mx.reduce(function (n, r) { return Math.max(n, r.length); }, 0);
			var head = header && mx.length ? mx[0] : [], body = header ? mx.slice(1) : mx, targets = targetFields(m.getProperty("/domain"));
			var taken = {};
			var cols = [];
			for (var i = 0; i < width; i++) {
				var name = header ? (String(head[i] || "").trim() || T("imp.column", [i + 1])) : T("imp.column", [i + 1]);
				var n = norm(name), hit = targets.filter(function (t) { return norm(t.key) === n; })[0];
				var map = hit ? hit.key : (SYNONYMS[n] && targets.some(function (t) { return t.key === SYNONYMS[n]; }) ? SYNONYMS[n] : "");
				if (map && taken[map]) { map = ""; }
				if (map) { taken[map] = true; }
				cols.push({ name: name, map: map });
			}
			var nul = m.getProperty("/missing") === "null" ? "NULL" : "";
			m.setProperty("/targets", targets);
			m.setProperty("/cols", cols);
			m.setProperty("/total", body.length);
			m.setProperty("/table", "raw." + m.getProperty("/domain").toLowerCase());
			m.setProperty("/showing", body.length ? T("imp.showing", [Math.min(body.length, PREVIEW_ROWS), body.length]) : "");
			m.setProperty("/rows", body.slice(0, PREVIEW_ROWS).map(function (r) {
				var o = {};
				for (var k = 0; k < width; k++) { var v = r[k]; o["c" + k] = v === undefined || v === "" ? nul : v; }
				return o;
			}));
			rebuildTable();
			validate();
		};

		var parse = function () {
			if (!state.buffer) { return; }
			m.setProperty("/busy", true);
			var done = function () { m.setProperty("/busy", false); applyMatrix(); };
			var fail = function () {
				m.setProperty("/busy", false);
				state.matrix = []; applyMatrix();
				MessageBox.error(T("imp.unreadable", [m.getProperty("/fileName")]));
			};
			if (m.getProperty("/kind") === "xlsx") {
				var go = function () { state.xlsx.read(m.getProperty("/sheet")).then(function (rows) { state.matrix = rows; done(); }, fail); };
				if (state.xlsx) { go(); return; }
				tabular.openXlsx(state.buffer).then(function (x) {
					state.xlsx = x;
					m.setProperty("/sheets", x.sheets.map(function (s) { return { key: s }; }));
					m.setProperty("/sheet", x.sheets[0]);
					go();
				}, fail);
				return;
			}
			try {
				state.text = tabular.decode(state.buffer, m.getProperty("/encoding"));
				var dk = m.getProperty("/delimiter"), d;
				if (dk === "auto") { dk = tabular.detectDelimiter(state.text); m.setProperty("/detected", T("imp.delim." + dk)); } else { m.setProperty("/detected", ""); }
				d = dk === "other" ? (m.getProperty("/other") || ",").charAt(0) : tabular.DELIMS[dk];
				state.matrix = tabular.parseCsv(state.text, d);
				done();
			} catch (e) { fail(); }
		};

		var oUploader = new FileUploader({
			name: "file", width: "24rem", buttonText: T("imp.choose"), fileType: ["csv", "txt", "xlsx"], maximumFileSize: maxMb, sameFilenameAllowed: true,
			placeholder: T("imp.noFileShort"),
			typeMissmatch: function () { MessageBox.warning(T("imp.badType")); },
			fileSizeExceed: function () { MessageBox.warning(T("imp.tooBig", [maxMb])); },
			change: function (e) {
				var f = (e.getParameter("files") || [])[0];
				if (!f) { return; }
				var kind = /\.xlsx$/i.test(f.name) ? "xlsx" : "csv";
				m.setProperty("/fileName", f.name); m.setProperty("/kind", kind);
				state.xlsx = null; state.buffer = null;
				f.arrayBuffer().then(function (b) { state.buffer = b; parse(); });
			}
		});

		var lbl = function (k, ctl) { return new Label({ text: T(k), labelFor: ctl, showColon: true, wrapping: false }).addStyleClass("repoioImpLbl"); };
		var oMissing = new Select({ width: "9rem", selectedKey: "{imp>/missing}", change: applyMatrix,
			items: [new Item({ key: "null", text: "NULL" }), new Item({ key: "empty", text: T("imp.empty") })] });
		var oDelim = new Select({ width: "10rem", selectedKey: "{imp>/delimiter}", change: parse,
			items: ["auto", "space", "tab", "dot", "comma", "colon", "semicolon", "dash", "pipe", "other"].map(function (k) {
				return new Item({ key: k, text: T("imp.delim." + k) });
			}) });
		var oOther = new Input({ width: "3rem", maxLength: 1, value: "{imp>/other}", visible: "{= ${imp>/delimiter} === 'other' }", change: parse });
		var oEnc = new Select({ width: "11rem", selectedKey: "{imp>/encoding}", change: parse,
			items: [new Item({ key: "utf-8", text: "UTF-8" }), new Item({ key: "windows-1256", text: "Windows-1256 (Arabic)" }),
				new Item({ key: "iso-8859-1", text: "ISO-8859-1" })] });
		var oSheet = new Select({ width: "11rem", selectedKey: "{imp>/sheet}", items: { path: "imp>/sheets", template: new Item({ key: "{imp>key}", text: "{imp>key}" }) },
			change: parse });
		var oDomain = new Select({ width: "11rem", selectedKey: "{imp>/domain}", change: applyMatrix,
			items: DOMAINS.map(function (d) { var c = concept(d); return new Item({ key: d, text: c ? (ar ? c.nameAr : c.nameEn) : d }); }) });

		var oDlg = new Dialog({
			title: T("imp.title"), contentWidth: "64rem", resizable: true, draggable: true, busy: "{imp>/busy}", busyIndicatorDelay: 0,
			content: [new VBox({ items: [
				new Label({ text: T("imp.file", [maxMb]), labelFor: oUploader }),
				new HBox({ alignItems: "Center", items: [oUploader] }),
				new HBox({ wrap: "Wrap", items: [
					new CheckBox({ text: T("imp.replace"), selected: "{imp>/replace}", tooltip: T("imp.replaceHint") }).addStyleClass("sapUiMediumMarginEnd"),
					new CheckBox({ text: T("imp.header"), selected: "{imp>/header}", select: applyMatrix })
				] }).addStyleClass("sapUiTinyMarginTop"),
				new HBox({ wrap: "Wrap", alignItems: "Center", items: [
					new HBox({ alignItems: "Center", items: [lbl("imp.missing", oMissing), oMissing] }).addStyleClass("repoioImpOpt"),
					new HBox({ alignItems: "Center", visible: "{= ${imp>/kind} !== 'xlsx' }", items: [lbl("imp.delimiter", oDelim), oDelim, oOther,
						new Text({ text: "{imp>/detected}", visible: "{= !!${imp>/detected} }" }).addStyleClass("repoioHint sapUiTinyMarginBegin")] }).addStyleClass("repoioImpOpt"),
					new HBox({ alignItems: "Center", visible: "{= ${imp>/kind} !== 'xlsx' }", items: [lbl("imp.encoding", oEnc), oEnc] }).addStyleClass("repoioImpOpt"),
					new HBox({ alignItems: "Center", visible: "{= ${imp>/kind} === 'xlsx' }", items: [lbl("imp.sheet", oSheet), oSheet] }).addStyleClass("repoioImpOpt"),
					new HBox({ alignItems: "Center", items: [lbl("imp.target", oDomain), oDomain,
						new Text({ text: "→ {imp>/table}" }).addStyleClass("repoioMono sapUiTinyMarginBegin")] }).addStyleClass("repoioImpOpt")
				] }).addStyleClass("sapUiSmallMarginTop"),
				new HBox({ alignItems: "Center", justifyContent: "SpaceBetween", items: [
					new Label({ text: T("imp.preview"), showColon: true }),
					new Text({ text: "{imp>/showing}" }).addStyleClass("repoioHint")
				] }).addStyleClass("sapUiSmallMarginTop"),
				new ScrollContainer({ horizontal: true, vertical: true, height: "19rem", width: "100%", content: [oTable] }).addStyleClass("repoioImpScroll"),
				new MessageStrip({ text: "{imp>/issues}", type: "Warning", showIcon: true, visible: "{= !!${imp>/issues} }" }).addStyleClass("sapUiTinyMarginTop"),
				new Text({ text: T("imp.serverNote") }).addStyleClass("repoioHint sapUiTinyMarginTop")
			] }).addStyleClass("sapUiSmallMargin repoioImp")],
			beginButton: new Button({ text: T("imp.import"), type: "Emphasized", enabled: "{imp>/ready}", press: function () {
				var d = m.getProperty("/domain").toLowerCase(), n = m.getProperty("/total"), stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
				var batch = "B-" + stamp + "-" + String(Math.floor(Math.random() * 900) + 100);
				oDlg.close();
				MessageBox.success(T("imp.done", [n, "raw." + d, batch]), { title: T("imp.title") });
				if (fnDone) { fnDone({ rows: n, table: "raw." + d, batch: batch, file: m.getProperty("/fileName") }); }
			} }),
			endButton: new Button({ text: T("common.cancel"), press: function () { oDlg.close(); } }),
			afterClose: function () { oDlg.destroy(); }
		});
		oDlg.setModel(m, "imp");
		oCtrl.getView().addDependent(oDlg);
		oDlg.open();
		return oDlg;
	}

	return { open: open };
});
