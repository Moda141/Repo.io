/*
 * CodeEditor — OpenUI5 wrapper for CodeMirror 6 (README §7.2: third-party libraries live inside a custom
 * control and follow the UI5 rendering and destroy lifecycle). The bundle is built from
 * tools/codemirror (pinned versions) into thirdparty/codemirror/codemirror6.min.js.
 *
 * The control only edits text. Running code is never done in the browser: scripts run in the isolated
 * Python workers (CLAUDE.md rule 8), SQL runs read-only through Trino with the user's grants.
 */
sap.ui.define([
	"sap/ui/core/Control",
	"repoio/proto/thirdparty/codemirror/codemirror6.min"
], function (Control) {
	"use strict";

	var CM = window.RepoioCM;

	return Control.extend("repoio.proto.control.CodeEditor", {
		metadata: {
			properties: {
				value: { type: "string", defaultValue: "" },
				language: { type: "string", defaultValue: "python" },   // python | sql
				/* Names offered by autocomplete, e.g. the template's fields: [{ name, type, label }] */
				fields: { type: "object", defaultValue: [] },
				editable: { type: "boolean", defaultValue: true },
				height: { type: "sap.ui.core.CSSSize", defaultValue: "16rem" }
			},
			events: { change: { parameters: { value: { type: "string" } } } }
		},

		renderer: {
			apiVersion: 2,
			render: function (oRm, oControl) {
				oRm.openStart("div", oControl);
				oRm.class("repoioCode");
				oRm.attr("dir", "ltr");
				oRm.style("height", oControl.getHeight());
				oRm.openEnd();
				oRm.close("div");
			}
		},

		/* Programmatic updates keep the editor instance (and cursor) instead of re-rendering. */
		setValue: function (s) {
			this.setProperty("value", s || "", true);
			if (this._view && this._view.state.doc.toString() !== (s || "")) {
				this._silent = true;
				this._view.dispatch({ changes: { from: 0, to: this._view.state.doc.length, insert: s || "" } });
				this._silent = false;
			}
			return this;
		},
		setLanguage: function (s) { this.setProperty("language", s, true); this._reconf(); return this; },
		setFields: function (a) { this.setProperty("fields", a || [], true); this._reconf(); return this; },
		setEditable: function (b) { this.setProperty("editable", b, true); this._reconf(); return this; },

		/* Insert text at the cursor (used by the "template fields" chips). */
		insertText: function (s) {
			var v = this._view; if (!v) { return; }
			var r = v.state.selection.main;
			v.dispatch({ changes: { from: r.from, to: r.to, insert: s }, selection: { anchor: r.from + s.length } });
			v.focus();
		},

		_extensions: function () {
			var that = this, fields = this.getFields() || [], sqlMode = this.getLanguage() === "sql";
			var complete = function (ctx) {
				var w = ctx.matchBefore(/[\w"'\[]*/);
				if (!w || (w.from === w.to && !ctx.explicit)) { return null; }
				return {
					from: w.from,
					options: fields.map(function (f) {
						return { label: sqlMode ? f.name : "record[\"" + f.name + "\"]", displayLabel: f.name, detail: f.type, info: f.label, type: "variable" };
					}),
					validFor: /^[\w"'\[]*$/
				};
			};
			return [
				CM.basicSetup,
				sqlMode ? CM.sql({ dialect: CM.StandardSQL, upperCaseKeywords: true }) : CM.python(),
				CM.autocompletion({ override: [complete] }),
				CM.EditorView.editable.of(this.getEditable()),
				CM.EditorState.readOnly.of(!this.getEditable()),
				CM.EditorView.updateListener.of(function (u) {
					if (u.docChanged && !that._silent) {
						var s = u.state.doc.toString();
						that.setProperty("value", s, true);
						that.fireChange({ value: s });
					}
				}),
				CM.EditorView.theme({ "&": { height: "100%", fontSize: "12.5px" }, ".cm-scroller": { fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', monospace" } })
			];
		},

		_reconf: function () {
			if (this._view) { this._view.dispatch({ effects: this._comp.reconfigure(this._extensions()) }); }
		},

		onBeforeRendering: function () { this._dispose(); },

		onAfterRendering: function () {
			var oDom = this.getDomRef();
			if (!oDom || !CM) { return; }
			this._comp = new CM.Compartment();
			this._view = new CM.EditorView({
				parent: oDom,
				state: CM.EditorState.create({ doc: this.getValue(), extensions: [this._comp.of(this._extensions())] })
			});
		},

		_dispose: function () { if (this._view) { this._view.destroy(); this._view = null; } },
		exit: function () { this._dispose(); }
	});
});
