/*
 * PersonLink — a person shown as an Avatar (the name is in the tooltip and the quick view), or as Avatar + name with
 * showName="true" for places where the name is the content (forms, headers, "assigned to …"). Hovering (or focusing) opens a
 * compact business card (sap.m.Popover, fixed width, flips instead of shrinking near an edge) with role, team and contact
 * details; clicking pins it open. Usable inside forms (IFormContent).
 * PersonLink.openFor(name, oOpener) opens the same card from another control (FeedListItem sender, card header).
 * Every person in the console is shown this way: never as plain text.
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/m/Avatar",
	"sap/m/Link",
	"sap/m/Popover",
	"sap/m/VBox",
	"sap/m/HBox",
	"sap/m/Text",
	"sap/m/Title",
	"sap/ui/core/Icon",
	"repoio/proto/util/people"
], function (Control, Avatar, Link, Popover, VBox, HBox, Text, Title, Icon, people) {
	"use strict";

	var isAr = function () { return sap.ui.getCore().getConfiguration().getLanguage().indexOf("ar") === 0; };
	var T = {
		ar: { contact: "بيانات الاتصال", email: "البريد الإلكتروني", phone: "الهاتف", team: "الفريق", org: "المؤسسة" },
		en: { contact: "Contact details", email: "Email", phone: "Phone", team: "Team", org: "Organization" }
	};

	/* The business card for one person (shared by PersonLink and PersonLink.openFor). */
	function card(n, fnAfterClose) {
		var p = people.get(n), ar = isAr(), t = ar ? T.ar : T.en;
		var row = function (sIcon, sTip, oValue) {
			return new HBox({ alignItems: "Center", renderType: "Bare", items: [new Icon({ src: sIcon, tooltip: sTip, decorative: false }).addStyleClass("repoioPcIcon"), oValue] }).addStyleClass("repoioPcRow");
		};
		return new Popover({
			showHeader: false, contentWidth: "16rem", placement: "VerticalPreferredBottom", showArrow: true,
			afterClose: fnAfterClose,
			content: [new VBox({ renderType: "Bare", items: [
				new HBox({ alignItems: "Center", renderType: "Bare", items: [
					new Avatar({ initials: p.initials, displaySize: "S" }),
					new VBox({ renderType: "Bare", items: [
						new Title({ text: ar ? n : p.en, level: "H5", wrapping: true }),
						new Text({ text: ar ? p.role_ar : p.role_en, maxLines: 2 }).addStyleClass("repoioPcRole")
					] }).addStyleClass("repoioPcWho")
				] }).addStyleClass("repoioPcHead"),
				row("sap-icon://email", t.email, new Link({ text: p.email, href: "mailto:" + p.email + "?subject=Repo.io", wrapping: false, textDirection: "LTR" }).addStyleClass("repoioPcVal")),
				row("sap-icon://call", t.phone, new Link({ text: "\u2066" + p.phone + "\u2069", href: "tel:" + p.phone.replace(/\s/g, ""), wrapping: false, textDirection: "LTR" }).addStyleClass("repoioPcVal")),
				row("sap-icon://group", t.team, new Text({ text: ar ? p.team_ar : p.team_en, wrapping: false }).addStyleClass("repoioPcVal")),
				row("sap-icon://building", t.org, new Text({ text: ar ? "مجموعة نهضة مصر للنشر" : "Nahdet Misr Publishing Group", wrapping: false }).addStyleClass("repoioPcVal"))
			] }).addStyleClass("repoioPcBody")]
		}).addStyleClass("repoioPersonCard");
	}

	var PersonLink = Control.extend("repoio.proto.control.PersonLink", {
		metadata: {
			interfaces: ["sap.ui.core.IFormContent"],
			properties: {
				name: { type: "string", defaultValue: "" },
				/* Show the name next to the avatar */
				showName: { type: "boolean", defaultValue: false }
			},
			aggregations: {
				_avatar: { type: "sap.m.Avatar", multiple: false, visibility: "hidden" },
				_link: { type: "sap.m.Link", multiple: false, visibility: "hidden" }
			}
		},

		init: function () {
			this.setAggregation("_avatar", new Avatar({ displaySize: "Custom", customDisplaySize: "1.5rem", customFontSize: "0.625rem", showBorder: false, press: this._open.bind(this, true) }));
			this.setAggregation("_link", new Link({ press: this._open.bind(this, true) }));
		},

		onBeforeRendering: function () {
			var n = this.getName(), p = people.get(n);
			var label = n && p && !isAr() ? p.en : n;
			this.getAggregation("_avatar").setInitials(p ? p.initials : "").setVisible(!!p).setTooltip(label);
			this.getAggregation("_link").setText(label).setEnabled(!!p).setVisible(!p || this.getShowName());
			this.toggleStyleClass("repoioPersonNamed", !!p && this.getShowName());
		},

		renderer: {
			apiVersion: 2,
			render: function (oRm, oControl) {
				oRm.openStart("span", oControl).class("repoioPerson").openEnd();
				oRm.renderControl(oControl.getAggregation("_avatar"));
				oRm.renderControl(oControl.getAggregation("_link"));
				oRm.close("span");
			}
		},

		onAfterRendering: function () {
			var oDom = this.getDomRef(); if (!oDom || !people.get(this.getName())) { return; }
			oDom.addEventListener("mouseenter", function () { clearTimeout(this._t); this._t = setTimeout(this._open.bind(this, false), 350); }.bind(this));
			oDom.addEventListener("mouseleave", function () { clearTimeout(this._t); this._t = setTimeout(this._closeIfAway.bind(this), 300); }.bind(this));
		},

		_closeIfAway: function () {
			var q = this._qv, d = q && q.getDomRef();
			if (q && !this._pinned && !(d && d.matches(":hover"))) { q.close(); }
		},

		_open: function (bPinned) {
			var n = this.getName(); if (!people.get(n)) { return; }
			this._pinned = bPinned;
			if (this._qv) { this._qv.destroy(); }
			this._qv = card(n, function () { this._pinned = false; }.bind(this));
			this.addDependent(this._qv);
			this._qv.openBy(this.getAggregation("_avatar").getVisible() ? this.getAggregation("_avatar") : this);
			var that = this;
			setTimeout(function () {
				var d = that._qv.getDomRef();
				if (d) { d.addEventListener("mouseleave", function () { that._t = setTimeout(that._closeIfAway.bind(that), 300); }); d.addEventListener("mouseenter", function () { clearTimeout(that._t); }); }
			}, 0);
		},

		exit: function () { clearTimeout(this._t); }
	});
	/* Open the card for a person from any control (e.g. a FeedListItem sender or a card header). */
	PersonLink.openFor = function (sName, oOpener) {
		if (!people.get(sName) || !oOpener) { return; }
		var q = card(sName, function () { q.destroy(); });
		oOpener.addDependent(q);
		q.openBy(oOpener);
	};
	/* The display name of a person in the current language (plain text, for tooltips and sorting only). */
	PersonLink.label = function (sName) { var p = people.get(sName); return p && !isAr() ? p.en : sName; };
	return PersonLink;
});
