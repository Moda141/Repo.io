sap.ui.define([
	"sap/ui/table/Table",
	"sap/ui/table/Column",
	"sap/ui/table/rowmodes/Auto",
	"sap/ui/model/json/JSONModel",
	"sap/m/Label",
	"sap/m/OverflowToolbar",
	"sap/m/Title",
	"sap/m/ToolbarSpacer",
	"sap/m/Button",
	"sap/m/Text",
	"repoio/proto/control/TokenCell",
	"sap/ui/table/menus/LegacyColumnMenuAdapter" // loaded lazily by the column header menu; listed so the self-contained bundle has it
], function (Table, Column, AutoRowMode, JSONModel, Label, OverflowToolbar, Title, ToolbarSpacer, Button, Text, TokenCell) {
	"use strict";

	/* Grid table for data previews (SAP Fiori grid table look: "Title (n)", bordered columns that can be resized,
	   fixed header, own scrollbar, multi-value columns as tokens). Used by the table data preview and the ontology
	   record links preview. Read only.
	   o: { title, columns: [{ key, label, sub, width, tokens, mono, dir, bad }], rows, itemsText, onExport, rowPress } */
	return {
		create: function (o) {
			var oModel = new JSONModel({ rows: o.rows || [] });
			oModel.setSizeLimit(5000);
			var oTitle = new Title({ text: o.title || "", level: "H3", titleStyle: "H6" });
			var tb = new OverflowToolbar({ style: "Clear", content: [oTitle, new ToolbarSpacer()].concat(o.onExport ? [
				new Button({ icon: "sap-icon://excel-attachment", type: "Transparent", tooltip: o.exportText || "Export", press: o.onExport })] : []) });
			var oTable = new Table({
				extension: [tb], selectionMode: o.rowPress ? "Single" : "None", selectionBehavior: "RowOnly", enableColumnReordering: true,
				rowMode: new AutoRowMode({ minRowCount: 4 }), fixedColumnCount: o.fixed || 0, alternateRowColors: false,
				rows: { path: "g>/rows" }, noData: o.noData || "—"
			}).addStyleClass("repoioGrid");
			oTable.setModel(oModel, "g");
			oTable.data("title", oTitle);
			// Few columns share the full width; many columns keep their width and scroll sideways.
			var fill = (o.columns || []).length <= 8;
			(o.columns || []).forEach(function (c) {
				var tpl;
				if (c.tokens) {
					tpl = new TokenCell({ values: "{g>" + c.key + "}", itemsText: o.itemsText || "{0} Items", title: c.label });
				} else {
					tpl = new TokenCell({ values: "{g>" + c.key + "}", state: c.bad ? "{= ${g>_bad} === '" + c.key + "' ? 'Error' : 'None' }" : "None" });
					if (c.mono) { tpl.addStyleClass("repoioMono"); }
				}
				oTable.addColumn(new Column({
					width: fill ? undefined : (c.width || "11rem"), minWidth: fill ? 110 : 60, resizable: true, sortProperty: c.tokens ? undefined : c.key,
					label: c.sub ? new Label({ text: c.label, tooltip: c.sub + " · " + c.label, wrapping: false }) : new Label({ text: c.label, wrapping: false }),
					template: tpl
				}));
			});
			if (o.rowPress) {
				oTable.attachRowSelectionChange(function (e) {
					var ctx = e.getParameter("rowContext");
					if (ctx && e.getParameter("userInteraction")) { o.rowPress(ctx.getObject()); }
				});
			}
			return oTable;
		},
		/* Replace the rows and the title of a table made by create(). */
		update: function (oTable, rows, title) {
			oTable.getModel("g").setProperty("/rows", rows || []);
			if (title !== undefined) { oTable.data("title").setText(title); }
		}
	};
});
