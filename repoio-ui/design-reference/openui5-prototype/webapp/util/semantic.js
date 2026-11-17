sap.ui.define([], function () {
	"use strict";

	/* One place for SAP Fiori semantic colors in the console. Every status a page shows maps here to a
	   [ValueState, icon] pair, so the same meaning gets the same color and icon on every page.

	   Semantic colors (sap.ui.core.ValueState):
	     Success      Positive  – a good result or a healthy, normal end state (published, succeeded, passed)
	     Warning      Critical  – needs action from the user looking at it (needs review, expiring, partial result)
	     Error        Negative  – something failed or is blocked (failed, held, gate stopped)
	     Information  Informative – in progress or waiting on someone else (running, in review, scheduled, open request)
	     None         Neutral   – no judgement (draft, unchanged, retired, expired, revoked on purpose)

	   Rules:
	   - Management by exception: a normal record (unchanged golden record, passed check) is neutral or a plain
	     positive status, never a loud tag.
	   - A semantic color is never used for a category with no good/bad meaning (HTTP method, object type, role):
	     those use neutral text or the indication colors below.
	   - Color is never the only carrier: every state has a text and an icon.
	   - "Review" means two things: a golden record or a quality gate that needs the steward's review is Critical;
	     a definition that is in someone's approval queue is Information.

	   The quality thresholds are business rules of the data quality rule set. The API returns them with the
	   score; the prototype keeps a copy here so all pages color a score the same way. */

	var I = {
		ok: "sap-icon://sys-enter-2", warn: "sap-icon://alert", err: "sap-icon://error", run: "sap-icon://in-progress",
		pending: "sap-icon://pending", draft: "sap-icon://edit", locked: "sap-icon://locked", past: "sap-icon://past"
	};

	var GROUPS = {
		/* Life cycle of something people define and publish: workflows, reports, ontology versions,
		   announcements, broadcasts, sync jobs, API keys. */
		lifecycle: {
			draft: ["None", I.draft], inReview: ["Information", I.pending], review: ["Information", I.pending],
			scheduled: ["Information", "sap-icon://appointment"], running: ["Information", I.run],
			published: ["Success", I.ok], deployed: ["Success", I.ok], live: ["Success", "sap-icon://broadcast"],
			active: ["Success", "sap-icon://status-positive"], completed: ["Success", I.ok],
			changed: ["Warning", "sap-icon://edit-outside"], paused: ["Warning", "sap-icon://media-pause"], expiring: ["Warning", I.past],
			expired: ["None", I.past], retired: ["None", I.locked], revoked: ["None", "sap-icon://status-inactive"]
		},
		/* Result of one run, check, call or send. */
		outcome: {
			succeeded: ["Success", I.ok], completed: ["Success", I.ok], passed: ["Success", I.ok], pass: ["Success", I.ok],
			ok: ["Success", I.ok], sent: ["Success", I.ok],
			succeededWithFailures: ["Warning", I.warn], partial: ["Warning", I.warn], warn: ["Warning", I.warn],
			limited: ["Warning", I.pending], retrying: ["Warning", "sap-icon://synchronize"],
			failed: ["Error", I.err], fail: ["Error", I.err], error: ["Error", I.err], timedOut: ["Error", "sap-icon://time-overtime"],
			upstreamFailed: ["Error", "sap-icon://chain-link"], denied: ["Error", I.locked],
			running: ["Information", I.run], active: ["Information", I.run],
			queued: ["None", I.pending], pending: ["None", I.pending], skipped: ["None", "sap-icon://media-forward"],
			canceled: ["None", "sap-icon://cancel"]
		},
		/* A service that should keep running (streaming jobs). Running is the healthy state. */
		service: {
			running: ["Success", "sap-icon://process"], stopped: ["None", "sap-icon://stop"], failed: ["Error", I.err]
		},
		/* Golden record status: only exceptions get a color. */
		record: {
			unchanged: ["None", ""], openCr: ["Information", "sap-icon://request"], review: ["Warning", "sap-icon://inspect"]
		},
		/* Quality gate of a match model run. */
		gate: {
			passed: ["Success", "sap-icon://accept"], review: ["Warning", "sap-icon://flag"], stopped: ["Error", "sap-icon://stop"]
		},
		/* Quarantine queue. */
		quarantine: {
			held: ["Error", I.locked], ready: ["Information", "sap-icon://synchronize"],
			pendingWaive: ["Warning", "sap-icon://group"], pendingDiscard: ["Warning", "sap-icon://group"]
		}
	};

	/* Indication colors for categories with no good/bad meaning. Deliberately avoids the red, orange and
	   green indications (01, 02, 04) so a category never reads as a status. */
	var CATEGORY = {
		method: { GET: "Indication05", POST: "Indication06", QUERY: "Indication07", SQL: "Indication08", TOOL: "Indication10" }
	};

	var QUALITY = { good: 90, critical: 75 };

	return {
		GROUPS: GROUPS,
		QUALITY: QUALITY,
		/* [state, icon] for a status in a group; neutral when unknown. */
		of: function (group, key) { return (GROUPS[group] && GROUPS[group][key]) || ["None", ""]; },
		state: function (group, key) { return this.of(group, key)[0]; },
		icon: function (group, key) { return this.of(group, key)[1]; },
		/* Indication color for a category value; "None" when unknown. */
		category: function (kind, key) { return (CATEGORY[kind] && CATEGORY[kind][key]) || "None"; },
		/* Quality score (0–100) → semantic state, the same everywhere. */
		quality: function (v) {
			if (v === null || v === undefined || isNaN(v)) { return "None"; }
			return v >= QUALITY.good ? "Success" : v >= QUALITY.critical ? "Warning" : "Error";
		}
	};
});
