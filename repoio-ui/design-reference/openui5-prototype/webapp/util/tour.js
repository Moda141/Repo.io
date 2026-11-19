sap.ui.define([
	"sap/m/Popover",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Title",
	"sap/m/Text",
	"sap/m/VBox",
	"sap/m/HBox",
	"sap/m/IllustratedMessage",
	"sap/ui/core/HTML"
], function (Popover, Dialog, Button, Title, Text, VBox, HBox, IllustratedMessage, HTML) {
	"use strict";

	/* Guided tours (OpenUI5 has no tour control, so this is a small wrapper: a dimmed page with a hole around one
	   element and a step card beside it). Three tours:
	   - "platform": the shell, opened on the first login and adapted to the user's roles (stewards also see
	     stewardship and data quality, administrators the integration hub and administration, template authors and
	     requesters the change requests);
	   - "wf" and "onto": short page tours, opened the first time the workflow designer or the ontology explorer opens.
	   Each tour shows once per user; the "seen" flags are a per-user setting the profile API would keep — in the
	   prototype they live in localStorage. All of them can be replayed from the help menu (?) in the header.
	   Steps whose element is not on screen are skipped. */

	var KEY = "repoio-proto-tour-v2-";

	var ROLE_GROUP = { ADMIN: "admin", API_ADMIN: "admin", DATA_ENGINEER: "admin", TEMPLATE_AUTHOR: "author", REQUESTER: "author",
		STEWARD_CUSTOMER: "steward", STEWARD_VENDOR: "steward", STEWARD_PRODUCT: "steward", HR_STEWARD: "steward", STORE_STEWARD: "steward" };
	var byId = function (id) { return function (c) { return c.byId(id); }; };

	var TOURS = {
		platform: function (groups) {
			var has = function (g) { return groups.indexOf(g) > -1; };
			return [
				["welcome", null],
				["nav", byId("sideNavigation")],
				["search", byId("navSearch")],
				["domains", function (c) { return navItem(c, "domains"); }],
				["golden", function (c) { return navItem(c, "goldenRecords"); }]
			].concat(has("author") ? [["requests", function (c) { return navItem(c, "changeRequests"); }]] : [])
				.concat(has("steward") ? [["stewardship", function (c) { return navItem(c, "stewardship"); }],
					["quality", function (c) { return navItem(c, "dataQuality"); }]] : [])
				.concat(has("admin") ? [["integration", function (c) { return navItem(c, "integrationHub"); }],
					["admin", function (c) { return navItem(c, "administration"); }]] : [])
				.concat([
					["inbox", byId("inboxBtn")],
					["bell", byId("bellBtn")],
					["lang", byId("langBtn")],
					["help", byId("helpBtn")],
					["user", byId("userAvatar")],
					["done", null]
				]);
		},
		wf: function () {
			return [["wf.intro", null], ["wf.canvas", byId("canvas")], ["wf.details", byId("wfDetails")], ["wf.validate", byId("validateBtn")],
				["wf.test", byId("wfTest")], ["wf.mode", byId("wfMode")], ["wf.publish", byId("wfPublish")]];
		},
		onto: function () {
			return [["onto.intro", null], ["onto.toolbar", byId("ontoTb")], ["onto.side", byId("sideTabs")], ["onto.graph", byId("graph")],
				["onto.version", byId("versionSelect")], ["onto.details", byId("ontoDetails")], ["onto.submit", byId("ontoSubmit")]];
		}
	};

	function navItem(app, key) {
		var found = null, walk = function (items) {
			(items || []).forEach(function (it) {
				if (!found && it.getKey && it.getKey() === key) { found = it; }
				if (!found && it.getItems) { walk(it.getItems()); }
			});
		};
		walk(app.byId("navList").getItems());
		return found;
	}
	function rectOf(ctrl) {
		var d = ctrl && ctrl.getDomRef && ctrl.getDomRef();
		if (!d) { return null; }
		var r = d.getBoundingClientRect();
		return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight ? r : null;
	}

	return {
		ROLE_GROUP: ROLE_GROUP,
		has: function (id) { return !!TOURS[id]; },
		running: function () { return !!this._on; },
		seen: function (id) { try { return localStorage.getItem(KEY + id) === "done"; } catch (e) { return true; } },

		/* Start a tour. ctx = the controller whose byId finds the elements (the shell for "platform", the page for a
		   page tour), T = text function, id = tour id, groups = role groups for the platform tour, intro = extra text
		   for the first card (for example which roles the tour was adapted to), onEnd = called when the tour closes. */
		start: function (ctx, T, id, groups, intro, onEnd) {
			var that = this, app = ctx;
			if (this._on || !TOURS[id]) { return; }
			this._on = true;
			var steps = TOURS[id](groups || []).filter(function (s) { return !s[1] || rectOf(s[1](app)); }),
				total = steps.length, i = 0;

			var mask = document.createElement("div"), spot = document.createElement("div");
			mask.className = "repoioTourMask";
			spot.className = "repoioTourSpot";
			mask.setAttribute("aria-hidden", "true");
			document.body.appendChild(mask);
			document.body.appendChild(spot);

			var oCount = new Text().addStyleClass("repoioTourCount"),
				oTitle = new Title({ level: "H2", titleStyle: "H5", wrapping: true }),
				oBody = new Text({ wrapping: true }).addStyleClass("repoioTourText"),
				oDots = new HTML({ sanitizeContent: false, preferDOM: false }),
				oBack = new Button({ text: T("tour.back"), type: "Transparent", press: function () { go(i - 1); } }),
				oNext = new Button({ type: "Emphasized", press: function () { if (i === total - 1) { finish(); } else { go(i + 1); } } }),
				oSkip = new Button({ text: T("tour.skip"), type: "Transparent", press: function () { finish(); } });
			var content = new VBox({ renderType: "Bare", items: [
				oCount, oTitle, oBody,
				oDots,
				new HBox({ justifyContent: "End", alignItems: "Center", renderType: "Bare", items: [oSkip, oBack, oNext] }).addStyleClass("repoioTourBtns repoioTourFoot")
			] }).addStyleClass("repoioTourCard");

			var oPop = new Popover({ showHeader: false, placement: "Auto", modal: false, contentWidth: "22rem", horizontalScrolling: false, verticalScrolling: false,
				ariaLabelledBy: [oTitle], content: [content] }).addStyleClass("repoioTourPop");
			var oIll = new IllustratedMessage({ illustrationType: "sapIllus-SuccessHighFive", illustrationSize: "Dialog", visible: id === "platform" });
			var oDlg = new Dialog({ showHeader: false, contentWidth: "26rem", draggable: false, escapeHandler: function (p) { p.resolve(); finish(); },
				content: [oIll], ariaLabelledBy: [oTitle] }).addStyleClass("repoioTourDlg");
			// Only Skip, the last button and Escape end the tour. Any other close (a click on the dimmed page, a step
			// change while the card is still animating) reopens the card at the current step.
			var onPop = false;
			oPop.attachAfterClose(function () {
				setTimeout(function () { if (that._on && onPop && !oPop.isOpen()) { oPop.openBy(spot); } }, 0);
			});
			oPop.attachAfterOpen(function () { layer(); });
			oDlg.attachAfterOpen(function () { layer(); });
			app.getView().addDependent(oPop);
			app.getView().addDependent(oDlg);

			var onKey = function (e) {
				if (e.key === "Escape") { finish(); }
				else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
					var fwd = (e.key === "ArrowLeft") === (document.documentElement.dir === "rtl");
					if (fwd && i < total - 1) { go(i + 1); } else if (!fwd && i > 0) { go(i - 1); }
				}
			};
			// The mask dims the page; a clip-path hole leaves the highlighted element clear (one contour, even-odd).
			var place = function (r) {
				if (!r) { spot.style.display = "none"; mask.style.clipPath = "none"; return; }
				var pad = 6, x1 = r.left - pad, y1 = r.top - pad, x2 = r.right + pad, y2 = r.bottom + pad;
				mask.style.clipPath = "polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, " + x1 + "px " + y1 + "px, " + x1 + "px " + y2 + "px, " +
					x2 + "px " + y2 + "px, " + x2 + "px " + y1 + "px, " + x1 + "px " + y1 + "px)";
				Object.assign(spot.style, { display: "block", left: x1 + "px", top: y1 + "px", width: (x2 - x1) + "px", height: (y2 - y1) + "px" });
			};
			var onResize = function () { var f = steps[i][1]; place(f ? rectOf(f(app)) : null); };
			document.addEventListener("keydown", onKey, true);
			window.addEventListener("resize", onResize);

			function go(n) {
				i = Math.max(0, Math.min(total - 1, n));
				var key = steps[i][0], find = steps[i][1], target = find ? find(app) : null;
				oCount.setText(T("tour.count", [i + 1, total]));
				oTitle.setText(T("tour." + key + ".t"));
				oBody.setText(T("tour." + key + ".d") + (i === 0 && intro ? "\n\n" + intro : ""));
				oDots.setContent("<div class=\"repoioTourDots\">" + steps.map(function (s, k) {
					return "<span class=\"" + (k === i ? "on" : "") + "\"></span>"; }).join("") + "</div>");
				oBack.setVisible(i > 0);
				oSkip.setVisible(i < total - 1);
				oNext.setText(i === total - 1 ? T(id === "platform" ? "tour.finish" : "tour.gotIt") : i === 0 ? T("tour.start") : T("tour.next"));
				if (target && target.isA && target.isA("sap.tnt.NavigationListItem") && target.getParent() && target.getParent().setExpanded) {
					target.getParent().setExpanded(true);
				}
				var r = target ? rectOf(target) : null;
				place(r);
				onPop = !!r;
				if (!r) {
					// Centred card: welcome and done
					if (oPop.isOpen()) { oPop.close(); }
					oDlg.removeAllContent();
					oDlg.addContent(oIll);
					oIll.setIllustrationType(key === "done" ? "sapIllus-SuccessCheckMark" : "sapIllus-SuccessHighFive");
					oIll.setTitle(" ");
					oDlg.addContent(content);
					if (!oDlg.isOpen()) { oDlg.open(); }
				} else {
					if (oDlg.isOpen()) { oDlg.close(); }
					if (content.getParent() !== oPop) { oPop.removeAllContent(); oPop.addContent(content); }
					// The card moves by closing; the afterClose handler reopens it beside the new spot
					if (oPop.isOpen()) { oPop.close(); } else { oPop.openBy(spot); }
				}
				layer();
				setTimeout(function () { layer(); if (that._on) { oNext.focus(); } }, 400);
			}
			// UI5 gives every popup a rising z-index; the mask and the ring sit just under the open card
			function layer() {
				var d = (oPop.isOpen() ? oPop : oDlg).getDomRef(), z = d ? parseInt(window.getComputedStyle(d).zIndex, 10) : NaN;
				if (!isNaN(z)) { mask.style.zIndex = z - 2; spot.style.zIndex = z - 1; }
			}
			function finish() {
				if (!that._on) { return; }
				that._on = false;
				onPop = false;
				try { localStorage.setItem(KEY + id, "done"); } catch (e) { /* private mode: the tour may show again */ }
				document.removeEventListener("keydown", onKey, true);
				window.removeEventListener("resize", onResize);
				mask.remove();
				spot.remove();
				oPop.close();
				oDlg.close();
				setTimeout(function () { oPop.destroy(); oDlg.destroy(); }, 300);
				if (onEnd) { onEnd(); }
			}
			go(0);
		}
	};
});
