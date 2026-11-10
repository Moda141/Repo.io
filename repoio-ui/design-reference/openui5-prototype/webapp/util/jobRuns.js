/*
 * Shared helpers for the job runs pages (J10): formatting, status colours, the
 * "Open in Airflow" popover and the governed replay request dialog.
 * In the product these read the runs API; here they read model/runs.json.
 */
sap.ui.define([
	"sap/m/Popover", "sap/m/VBox", "sap/m/HBox", "sap/m/Label", "sap/m/Text", "sap/m/Button", "sap/m/MessageStrip",
	"sap/m/MessageToast", "sap/m/Dialog", "sap/m/RadioButtonGroup", "sap/m/RadioButton", "sap/m/Input", "sap/m/TextArea",
	"sap/ui/layout/form/SimpleForm", "sap/ui/core/Title", "repoio/proto/util/people"
], function (Popover, VBox, HBox, Label, Text, Button, MessageStrip, MessageToast, Dialog, RadioButtonGroup, RadioButton,
	Input, TextArea, SimpleForm, CoreTitle, people) {
	"use strict";

	var MONTHS = {
		en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
		ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
	};
	var STATE = {
		succeeded: ["Success", "sap-icon://sys-enter-2"], completed: ["Success", "sap-icon://sys-enter-2"],
		succeededWithFailures: ["Warning", "sap-icon://alert"], retrying: ["Warning", "sap-icon://synchronize"],
		failed: ["Error", "sap-icon://error"], timedOut: ["Error", "sap-icon://time-overtime"], upstreamFailed: ["Error", "sap-icon://chain-link"],
		running: ["Information", "sap-icon://in-progress"], active: ["Information", "sap-icon://in-progress"],
		queued: ["None", "sap-icon://pending"], pending: ["None", "sap-icon://pending"],
		skipped: ["None", "sap-icon://media-forward"], canceled: ["None", "sap-icon://cancel"]
	};
	var KIND_ICON = { ingest: "sap-icon://download-from-cloud", push: "sap-icon://upload-to-cloud", stream: "sap-icon://process", dq: "sap-icon://quality-issue", hk: "sap-icon://wrench" };
	// Soft Quartz tints, the same family as BaseController.colors.
	var COLOR = { succeeded: "#5fae7c", succeededWithFailures: "#e3a256", failed: "#df7a7a", timedOut: "#df7a7a", running: "#89b4e3", queued: "#b4bac0", skipped: "#d5dadd", canceled: "#b4bac0" };

	function parse(s) { return s ? new Date(s.replace(" ", "T")) : null; }
	function pad(n) { return (n < 10 ? "0" : "") + n; }

	var H = {
		COLOR: COLOR,
		parse: parse,
		date: function (s, lang) {
			var d = parse(s);
			if (!d) { return "—"; }
			var t = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
			return lang === "ar" ? d.getDate() + " " + MONTHS.ar[d.getMonth()] + " " + d.getFullYear() + " " + t
				: MONTHS.en[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() + " " + t;
		},
		short: function (d, lang) {
			return (lang === "ar" ? d.getDate() + " " + MONTHS.ar[d.getMonth()] : MONTHS.en[d.getMonth()] + " " + d.getDate()) + " " + pad(d.getHours()) + ":00";
		},
		dur: function (sec) {
			if (sec === null || sec === undefined) { return "—"; }
			return pad(Math.floor(sec / 3600)) + ":" + pad(Math.floor(sec % 3600 / 60)) + ":" + pad(sec % 60);
		},
		state: function (s) { return (STATE[s] || STATE.pending)[0]; },
		icon: function (s) { return (STATE[s] || STATE.pending)[1]; },
		kindIcon: function (k) { return KIND_ICON[k] || "sap-icon://process"; },
		kindText: function (c, k) { return c.text("jr.kind." + (k === "push" ? "push" : k)); },
		finished: function (s) { return ["running", "queued"].indexOf(s) < 0; },
		person: function (n, lang) { var p = people.get(n); return p && lang === "en" ? p.en : n; },
		params: function (o) { return Object.keys(o || {}).map(function (k) { return k + "=" + o[k]; }).join(", "); },
		msg: function (c, key, args, lang) {
			return c.text(key, (args || []).map(function (a) { return H.person(a, lang); }));
		},

		/* Airflow deep link. The base URL belongs to the Airflow connection (Connections, J9);
		   the prototype has none, so it shows the link template instead of opening it. */
		airflowPath: function (job, run, task) {
			var p = "${AIRFLOW_BASE_URL}/dags/" + job.dagId + "/runs/" + encodeURIComponent(run.dagRunId);
			return task ? p + "/tasks/" + task : p;
		},
		openAirflow: function (c, oSource, job, run, task) {
			if (job.orch !== "airflow") {
				MessageToast.show(c.text("jr.af.notAirflow", [c.text("jr.orch." + job.orch)]));
				return;
			}
			var sPath = H.airflowPath(job, run, task),
				fnRow = function (l, v) {
					return new VBox({ items: [new Label({ text: l }), new Text({ textDirection: "LTR" }).setText(v).addStyleClass("repoioMono")] }).addStyleClass("sapUiTinyMarginBottom");
				},
				oPop = new Popover({
					title: c.text("jr.af.title"), placement: "Bottom", contentWidth: "26rem",
					content: [new VBox({ items: [
						fnRow(c.text("jr.af.dag"), job.dagId),
						fnRow(c.text("jr.af.run"), run.dagRunId),
						task ? fnRow(c.text("jr.af.task"), task) : new Text({ visible: false }),
						fnRow(c.text("jr.af.url"), sPath),
						new MessageStrip({ text: c.text("jr.af.note"), type: "Information", showIcon: true }).addStyleClass("sapUiTinyMarginTop")
					] }).addStyleClass("sapUiSmallMargin")],
					endButton: new Button({ text: c.text("jr.af.copy"), icon: "sap-icon://copy", press: function () {
						try { navigator.clipboard.writeText(sPath); } catch (e) { /* clipboard blocked */ }
						MessageToast.show(c.text("jr.af.copied")); oPop.close();
					} }),
					afterClose: function () { oPop.destroy(); }
				});
			c.getView().addDependent(oPop);
			oPop.openBy(oSource);
		},

		/* Replay is governed (J10 edge case): it creates a request the job owner approves
		   and carries an idempotency key; it is never a plain "run it again" button. */
		requestReplay: function (c, job, run, lang) {
			if (!H.finished(run.status)) { MessageToast.show(c.text("jr.rp.notFailed")); return; }
			var bFailed = ["failed", "timedOut", "succeededWithFailures", "canceled"].indexOf(run.status) > -1,
				oScope = new RadioButtonGroup({ buttons: [
					new RadioButton({ text: c.text("jr.rp.scopeFailed"), enabled: bFailed }),
					new RadioButton({ text: c.text("jr.rp.scopeAll") }),
					new RadioButton({ text: c.text("jr.rp.scopeQ"), enabled: run.quarantined > 0 })
				], selectedIndex: bFailed ? 0 : 1 }),
				oKey = new Input({ value: run.id + "-replay-1", editable: false, textDirection: "LTR" }),
				oReason = new TextArea({ rows: 3, width: "100%", placeholder: c.text("jr.rp.reasonPh"), required: true, liveChange: function (e) {
					oSend.setEnabled(!!e.getParameter("value").trim());
				} }),
				sOwner = H.person(job.owner, lang),
				oSend = new Button({ text: c.text("jr.rp.submit"), type: "Emphasized", enabled: false, press: function () {
					var sReq = "RQ-" + (7300 + Math.floor(Math.random() * 600));
					MessageToast.show(c.text("jr.rp.sent", [sReq, sOwner]));
					oDlg.close();
				} }),
				oDlg = new Dialog({
					title: c.text("jr.rp.title", [run.id]), contentWidth: "32rem",
					content: [
						new MessageStrip({ text: c.text("jr.rp.intro"), type: "Information", showIcon: true }).addStyleClass("sapUiSmallMargin"),
						new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", labelSpanL: 4, labelSpanM: 4, content: [
							new Label({ text: c.text("jr.rp.scope") }), oScope,
							new Label({ text: c.text("jr.rp.key") }), oKey,
							new Label({ text: c.text("jr.rp.approver") }), new Text({ text: sOwner }),
							new Label({ text: c.text("jr.rp.reason"), required: true }), oReason
						] })
					],
					beginButton: oSend,
					endButton: new Button({ text: c.text("common.cancel"), press: function () { oDlg.close(); } }),
					afterClose: function () { oDlg.destroy(); }
				});
			c.getView().addDependent(oDlg);
			oDlg.open();
		}
	};
	return H;
});
