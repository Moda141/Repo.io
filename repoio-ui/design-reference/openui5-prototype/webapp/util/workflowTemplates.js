/*
 * Starter workflows for the designer — standard BPMN 2.0 with repoio:* extension attributes.
 * Sample content for the prototype; real templates come from the workflows API.
 */
sap.ui.define([], function () {
	"use strict";

	var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); };
	var TECH = { approvalWriteBack: "WF_CUSTOMER_CHANGE_C4C_WRITEBACK", twoLevel: "WF_TWO_LEVEL_APPROVAL", single: "WF_SINGLE_STEWARD_APPROVAL" };
	var head = function (name, domain, tech) {
		return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
			"<bpmn:definitions xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\" xmlns:bpmndi=\"http://www.omg.org/spec/BPMN/20100524/DI\" " +
			"xmlns:dc=\"http://www.omg.org/spec/DD/20100524/DC\" xmlns:di=\"http://www.omg.org/spec/DD/20100524/DI\" " +
			"xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:repoio=\"urn:repoio:workflow\" " +
			"id=\"Definitions_1\" targetNamespace=\"urn:repoio:workflow\">\n" +
			"<bpmn:process id=\"Process_1\" name=\"" + esc(name) + "\" isExecutable=\"true\" repoio:domain=\"" + domain + "\" repoio:techName=\"" + tech + "\" repoio:owner=\"محمد\">\n";
	};
	var shape = function (id, x, y, w, h, extra) {
		return "<bpmndi:BPMNShape id=\"" + id + "_di\" bpmnElement=\"" + id + "\"" + (extra || "") + "><dc:Bounds x=\"" + x + "\" y=\"" + y + "\" width=\"" + w + "\" height=\"" + h + "\" /></bpmndi:BPMNShape>\n";
	};
	var edge = function (id, pts) {
		return "<bpmndi:BPMNEdge id=\"" + id + "_di\" bpmnElement=\"" + id + "\">" + pts.map(function (p) {
			return "<di:waypoint x=\"" + p[0] + "\" y=\"" + p[1] + "\" />";
		}).join("") + "</bpmndi:BPMNEdge>\n";
	};
	var flow = function (id, from, to, name, cond) {
		return "<bpmn:sequenceFlow id=\"" + id + "\" sourceRef=\"" + from + "\" targetRef=\"" + to + "\"" + (name ? " name=\"" + esc(name) + "\"" : "") +
			(cond ? "><bpmn:conditionExpression xsi:type=\"bpmn:tFormalExpression\">" + esc(cond) + "</bpmn:conditionExpression></bpmn:sequenceFlow>\n" : " />\n");
	};
	var tail = function (di) {
		return "</bpmn:process>\n<bpmndi:BPMNDiagram id=\"BPMNDiagram_1\"><bpmndi:BPMNPlane id=\"BPMNPlane_1\" bpmnElement=\"Process_1\">\n" + di +
			"</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>\n</bpmn:definitions>\n";
	};
	var MAP_C4C = JSON.stringify([["business_name", "Name"], ["tax_number", "TaxNumber"], ["country", "CountryCode"], ["customer_group", "CustomerGroupCode"]]);

	return {
		keys: ["approvalWriteBack", "twoLevel", "single"],

		/* T(key) → localized text */
		build: function (key, T) {
			var n = function (k) { return esc(T("wf.tpl.n." + k)); };
			if (key === "single") {
				return head(T("wf.tpl.single"), "Customer", TECH.single) +
					"<bpmn:startEvent id=\"Start_1\" name=\"" + n("submitted") + "\" />\n" +
					"<bpmn:userTask id=\"Review_1\" name=\"" + n("stewardReview") + "\" repoio:taskType=\"approval\" repoio:approverType=\"team\" repoio:approverTeam=\"customer_stewards\" repoio:approvalRule=\"any\" repoio:dueIn=\"P2D\" />\n" +
					"<bpmn:endEvent id=\"End_done\" name=\"" + n("completed") + "\" repoio:outcome=\"completed\" />\n" +
					flow("Flow_1", "Start_1", "Review_1") + flow("Flow_2", "Review_1", "End_done") +
					tail(shape("Start_1", 152, 182, 36, 36) + shape("Review_1", 250, 160, 120, 80) + shape("End_done", 432, 182, 36, 36) +
						edge("Flow_1", [[188, 200], [250, 200]]) + edge("Flow_2", [[370, 200], [432, 200]]));
			}
			if (key === "twoLevel") {
				return head(T("wf.tpl.twoLevel"), "Customer", TECH.twoLevel) +
					"<bpmn:startEvent id=\"Start_1\" name=\"" + n("submitted") + "\" />\n" +
					"<bpmn:userTask id=\"Review_1\" name=\"" + n("stewardReview") + "\" repoio:taskType=\"approval\" repoio:approverType=\"team\" repoio:approverTeam=\"customer_stewards\" repoio:approvalRule=\"any\" repoio:dueIn=\"P2D\" />\n" +
					"<bpmn:exclusiveGateway id=\"Gw_ok\" name=\"" + n("approved") + "\" />\n" +
					"<bpmn:userTask id=\"Review_2\" name=\"" + n("financeApproval") + "\" repoio:taskType=\"approval\" repoio:approverType=\"users\" repoio:approvers=\"محمد,منى حسن\" repoio:approvalRule=\"all\" repoio:dueIn=\"P3D\" repoio:escalateTo=\"governance_board\" />\n" +
					"<bpmn:endEvent id=\"End_done\" name=\"" + n("completed") + "\" repoio:outcome=\"completed\" />\n" +
					"<bpmn:endEvent id=\"End_rej\" name=\"" + n("rejected") + "\" repoio:outcome=\"rejected\" />\n" +
					flow("Flow_1", "Start_1", "Review_1") + flow("Flow_2", "Review_1", "Gw_ok") +
					flow("Flow_3", "Gw_ok", "Review_2", T("wf.tpl.n.yes"), "${decision == 'approved'}") +
					flow("Flow_4", "Gw_ok", "End_rej", T("wf.tpl.n.no"), "${decision == 'rejected'}") + flow("Flow_5", "Review_2", "End_done") +
					tail(shape("Start_1", 152, 182, 36, 36) + shape("Review_1", 240, 160, 120, 80) + shape("Gw_ok", 415, 175, 50, 50, " isMarkerVisible=\"true\"") +
						shape("Review_2", 520, 160, 120, 80) + shape("End_done", 702, 182, 36, 36) + shape("End_rej", 422, 322, 36, 36) +
						edge("Flow_1", [[188, 200], [240, 200]]) + edge("Flow_2", [[360, 200], [415, 200]]) + edge("Flow_3", [[465, 200], [520, 200]]) +
						edge("Flow_4", [[440, 225], [440, 322]]) + edge("Flow_5", [[640, 200], [702, 200]]));
			}
			// approvalWriteBack (default)
			return head(T("wf.tpl.approvalWriteBack"), "Customer", TECH.approvalWriteBack) +
				"<bpmn:startEvent id=\"Start_1\" name=\"" + n("submitted") + "\" />\n" +
				"<bpmn:userTask id=\"Review_1\" name=\"" + n("stewardReview") + "\" repoio:taskType=\"approval\" repoio:approverType=\"team\" repoio:approverTeam=\"customer_stewards\" repoio:approvalRule=\"any\" repoio:dueIn=\"P2D\" repoio:escalateTo=\"governance_board\" />\n" +
				"<bpmn:exclusiveGateway id=\"Gw_ok\" name=\"" + n("approved") + "\" />\n" +
				"<bpmn:endEvent id=\"End_rej\" name=\"" + n("rejected") + "\" repoio:outcome=\"rejected\" />\n" +
				"<bpmn:parallelGateway id=\"Gw_fork\" name=\"" + n("all") + "\" />\n" +
				"<bpmn:serviceTask id=\"WriteBack_1\" name=\"" + n("writeBackC4c") + "\" repoio:taskType=\"writeBack\" repoio:connection=\"C4C_PROD\" repoio:targetSystem=\"c4c\" repoio:entity=\"Customer\" repoio:fieldMapping=\"" + esc(MAP_C4C) + "\" repoio:conflictPolicy=\"review\" repoio:retries=\"3\" repoio:backoff=\"exponential\" />\n" +
				"<bpmn:serviceTask id=\"Python_1\" name=\"" + n("segment") + "\" repoio:taskType=\"python\" repoio:scriptId=\"segment_customers\" repoio:scriptVersion=\"3\" repoio:retries=\"2\" repoio:timeoutMin=\"15\" />\n" +
				"<bpmn:parallelGateway id=\"Gw_join\" />\n" +
				"<bpmn:endEvent id=\"End_done\" name=\"" + n("completed") + "\" repoio:outcome=\"completed\" />\n" +
				flow("Flow_1", "Start_1", "Review_1") + flow("Flow_2", "Review_1", "Gw_ok") +
				flow("Flow_3", "Gw_ok", "Gw_fork", T("wf.tpl.n.yes"), "${decision == 'approved'}") +
				flow("Flow_4", "Gw_ok", "End_rej", T("wf.tpl.n.no"), "${decision == 'rejected'}") +
				flow("Flow_5", "Gw_fork", "WriteBack_1") + flow("Flow_6", "Gw_fork", "Python_1") +
				flow("Flow_7", "WriteBack_1", "Gw_join") + flow("Flow_8", "Python_1", "Gw_join") + flow("Flow_9", "Gw_join", "End_done") +
				tail(shape("Start_1", 152, 182, 36, 36) + shape("Review_1", 240, 160, 120, 80) + shape("Gw_ok", 415, 175, 50, 50, " isMarkerVisible=\"true\"") +
					shape("End_rej", 422, 322, 36, 36) + shape("Gw_fork", 520, 175, 50, 50) + shape("WriteBack_1", 630, 70, 120, 80) +
					shape("Python_1", 630, 250, 120, 80) + shape("Gw_join", 810, 175, 50, 50) + shape("End_done", 912, 182, 36, 36) +
					edge("Flow_1", [[188, 200], [240, 200]]) + edge("Flow_2", [[360, 200], [415, 200]]) + edge("Flow_3", [[465, 200], [520, 200]]) +
					edge("Flow_4", [[440, 225], [440, 322]]) + edge("Flow_5", [[545, 175], [545, 110], [630, 110]]) +
					edge("Flow_6", [[545, 225], [545, 290], [630, 290]]) + edge("Flow_7", [[750, 110], [835, 110], [835, 175]]) +
					edge("Flow_8", [[750, 290], [835, 290], [835, 225]]) + edge("Flow_9", [[860, 200], [912, 200]]));
		}
	};
});
