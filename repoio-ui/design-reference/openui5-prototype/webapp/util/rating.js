sap.ui.define([
	"sap/m/ResponsivePopover",
	"sap/m/VBox",
	"sap/m/HBox",
	"sap/m/Text",
	"sap/m/Label",
	"sap/m/ObjectStatus",
	"sap/m/RatingIndicator",
	"sap/m/Button"
], function (ResponsivePopover, VBox, HBox, Text, Label, ObjectStatus, RatingIndicator, Button) {
	"use strict";

	/* Golden record rating (stars 0-5 in half steps, score 0-100). Computed by the pipeline and returned by the golden
	   records API; the console only shows it and explains it (SAP "Advanced Skill Match" popover pattern). */
	return {
		/* Popover: the score, the checks that are met and those that are not, the rule version. */
		open: function (ctrl, r, oBy) {
			var T = ctrl.text.bind(ctrl);
			var chips = function (met) {
				return new HBox({ wrap: "Wrap", renderType: "Bare", items: r.factors.filter(function (f) { return f.met === met; }).map(function (f) {
					return new ObjectStatus({ text: T("rt.f." + f.key), state: met ? "Information" : "None", inverted: true, icon: met ? "" : "sap-icon://less" }).addStyleClass("repoioRtChip");
				}) }).addStyleClass("repoioRtChips");
			};
			var nMet = r.factors.filter(function (f) { return f.met; }).length;
			var pop = new ResponsivePopover({ title: T("rt.title"), placement: "Auto", contentWidth: "19rem",
				content: [new VBox({ renderType: "Bare", items: [
					new HBox({ alignItems: "Center", renderType: "Bare", items: [
						new RatingIndicator({ value: r.stars, maxValue: 5, displayOnly: true, iconSize: "1rem" }),
						new Text({ text: T("rt.score", [r.score]) }).addStyleClass("sapUiSmallMarginBegin")
					] }),
					new Text({ text: T("rt.intro") }).addStyleClass("sapUiSmallMarginTop"),
					new Label({ text: T("rt.met", [nMet]) }).addStyleClass("sapUiSmallMarginTop"), chips(true),
					new Label({ text: T("rt.notMet", [r.factors.length - nMet]), visible: nMet < r.factors.length }).addStyleClass("sapUiSmallMarginTop"),
					chips(false).setVisible(nMet < r.factors.length),
					new Text({ text: T("rt.footer", [r.ruleVersion, r.computed]) }).addStyleClass("repoioUmMuted sapUiSmallMarginTop")
				] }).addStyleClass("repoioRtPop")],
				endButton: new Button({ text: T("go.close"), press: function () { pop.close(); } }),
				afterClose: function () { pop.destroy(); } });
			ctrl.getView().addDependent(pop);
			pop.openBy(oBy);
		},
		/* Distribution for a header bar: count of records per whole star (1-5). */
		buckets: function (rows) {
			var b = [0, 0, 0, 0, 0];
			rows.forEach(function (r) { if (r.rating) { b[Math.max(0, Math.min(4, Math.ceil(r.rating.stars) - 1))]++; } });
			return b;
		}
	};
});
