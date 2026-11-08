/*
 * EChart — OpenUI5 wrapper for Apache ECharts (README §7.2: third-party libraries
 * live inside a custom control and follow the UI5 rendering/destroy lifecycle).
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/ui/core/ResizeHandler",
	"repoio/proto/thirdparty/echarts.min"
], function (Control, ResizeHandler) {
	"use strict";

	var echartsLib = window.echarts;

	return Control.extend("repoio.proto.control.EChart", {
		metadata: {
			properties: {
				option: { type: "object" },
				height: { type: "sap.ui.core.CSSSize", defaultValue: "14rem" },
				width: { type: "sap.ui.core.CSSSize", defaultValue: "100%" },
				ariaLabel: { type: "string", defaultValue: "" }
			},
			events: {
				select: { parameters: { name: { type: "string" }, dataIndex: { type: "int" }, seriesName: { type: "string" }, data: { type: "any" } } }
			}
		},

		renderer: {
			apiVersion: 2,
			render: function (oRm, oControl) {
				oRm.openStart("div", oControl);
				oRm.class("repoioChart");
				oRm.style("height", oControl.getHeight());
				oRm.style("width", oControl.getWidth());
				oRm.attr("role", "img");
				if (oControl.getAriaLabel()) { oRm.attr("aria-label", oControl.getAriaLabel()); }
				oRm.openEnd();
				oRm.close("div");
			}
		},

		setOption: function (oOption) {
			this.setProperty("option", oOption, true);
			if (this._chart && oOption) { this._chart.setOption(oOption, true); }
			return this;
		},

		onBeforeRendering: function () {
			this._dispose();
		},

		onAfterRendering: function () {
			var oDom = this.getDomRef();
			if (!oDom || !echartsLib) { return; }
			this._chart = echartsLib.init(oDom, null, { renderer: "svg" });
			if (this.getOption()) { this._chart.setOption(this.getOption(), true); }
			this._chart.on("click", function (e) {
				this.fireSelect({ name: e.name, dataIndex: e.dataIndex, seriesName: e.seriesName, data: e.data });
			}.bind(this));
			this._resizeId = ResizeHandler.register(this, function () {
				if (this._chart) { this._chart.resize(); }
			}.bind(this));
		},

		_dispose: function () {
			if (this._resizeId) { ResizeHandler.deregister(this._resizeId); this._resizeId = null; }
			if (this._chart) { this._chart.dispose(); this._chart = null; }
		},

		exit: function () {
			this._dispose();
		}
	});
});
