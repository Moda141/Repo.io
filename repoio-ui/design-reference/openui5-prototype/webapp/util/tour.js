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

	/* First-login guided tour (OpenUI5 has no tour control, so this is a small wrapper: a dimmed page with a
	   spotlight on one shell element and a step card beside it). The tour shows once per user; the "seen" flag is a
	   per-user setting the profile API would keep — in the prototype it lives in localStorage. It can be replayed
	   from the user menu. Steps whose element is not on screen (side navigation collapsed, small screen) are skipped. */

	var KEY = "repoio-proto-tour-v1";

	// [step key, how to find the element]. null = centred card (welcome / done).
	var STEPS = [
		["welcome", null],
		["nav", function (app) { return app.byId("sideNavigation"); }],
		["search", function (app) { return app.byId("navSearch"); }],
		["domains", function (app) { return navItem(app, "domains"); }],
		["golden", function (app) { return navItem(app, "goldenRecords"); }],
		["stewardship", function (app) { return navItem(app, "stewardship"); }],
		["inbox", function (app) { return app.byId("inboxBtn"); }],
		["bell", function (app) { return app.byId("bellBtn"); }],
		["lang", function (app) { return app.byId("langBtn"); }],
		["user", function (app) { return app.byId("userAvatar"); }],
		["done", null]
	];

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
		seen: function () { try { return localStorage.getItem(KEY) === "done"; } catch (e) { return true; } },

		/* Start the tour. app = the App controller (shell), T = text function. */
		start: function (app, T) {
			var that = this;
			if (this._on) { return; }
			this._on = true;
			var steps = STEPS.filter(function (s) { return !s[1] || rectOf(s[1](app)); }),
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
			var oIll = new IllustratedMessage({ illustrationType: "sapIllus-SuccessHighFive", illustrationSize: "Dialog" });
			var oDlg = new Dialog({ showHeader: false, contentWidth: "26rem", draggable: false, escapeHandler: function (p) { p.resolve(); finish(); },
				content: [oIll], ariaLabelledBy: [oTitle] }).addStyleClass("repoioTourDlg");
			// Closing the card any other way (click outside, Escape) ends the tour; moving between steps does not.
			var moving = false;
			oPop.attachAfterClose(function () { if (!moving) { finish(); } });
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
				oBody.setText(T("tour." + key + ".d"));
				oDots.setContent("<div class=\"repoioTourDots\">" + steps.map(function (s, k) {
					return "<span class=\"" + (k === i ? "on" : "") + "\"></span>"; }).join("") + "</div>");
				oBack.setVisible(i > 0);
				oSkip.setVisible(i < total - 1);
				oNext.setText(i === total - 1 ? T("tour.finish") : i === 0 ? T("tour.start") : T("tour.next"));
				if (target && target.isA && target.isA("sap.tnt.NavigationListItem") && target.getParent() && target.getParent().setExpanded) {
					target.getParent().setExpanded(true);
				}
				var r = target ? rectOf(target) : null;
				place(r);
				moving = true;
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
					if (oPop.isOpen()) { oPop.close(); }
					oPop.openBy(spot);
				}
				setTimeout(function () { moving = false; oNext.focus(); }, 400);
			}
			function finish() {
				if (!that._on) { return; }
				that._on = false;
				try { localStorage.setItem(KEY, "done"); } catch (e) { /* private mode: the tour may show again */ }
				document.removeEventListener("keydown", onKey, true);
				window.removeEventListener("resize", onResize);
				mask.remove();
				spot.remove();
				oPop.close();
				oDlg.close();
				setTimeout(function () { oPop.destroy(); oDlg.destroy(); }, 300);
			}
			go(0);
		}
	};
});
