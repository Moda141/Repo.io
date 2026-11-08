/*
 * PersonLink — a person shown as an Avatar only (the name is in the tooltip and the quick view). Hovering (or focusing) opens a
 * sap.m.QuickView business card with role, team and contact details; clicking
 * pins it open. Usable inside forms (IFormContent).
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/m/Avatar",
	"sap/m/Link",
	"sap/m/QuickView",
	"sap/m/QuickViewPage",
	"sap/m/QuickViewGroup",
	"sap/m/QuickViewGroupElement",
	"repoio/proto/util/people"
], function (Control, Avatar, Link, QuickView, QuickViewPage, QuickViewGroup, QuickViewGroupElement, people) {
	"use strict";

	var isAr = function () { return sap.ui.getCore().getConfiguration().getLanguage().indexOf("ar") === 0; };
	var T = {
		ar: { contact: "بيانات الاتصال", email: "البريد الإلكتروني", phone: "الهاتف", team: "الفريق", org: "المؤسسة" },
		en: { contact: "Contact details", email: "Email", phone: "Phone", team: "Team", org: "Organization" }
	};

	var PersonLink = Control.extend("repoio.proto.control.PersonLink", {
		metadata: {
			interfaces: ["sap.ui.core.IFormContent"],
			properties: { name: { type: "string", defaultValue: "" } },
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
			this.getAggregation("_link").setText(label).setEnabled(false).setVisible(!p);
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
			var q = this._qv, d = q && q.getDomRef && document.querySelector("#" + q.getId() + "-quickView-popover");
			if (q && !this._pinned && !(d && d.matches(":hover"))) { q.close(); }
		},

		_open: function (bPinned) {
			var n = this.getName(), p = people.get(n); if (!p) { return; }
			var t = isAr() ? T.ar : T.en, ar = isAr();
			this._pinned = bPinned;
			if (this._qv) { this._qv.destroy(); }
			this._qv = new QuickView({
				afterClose: function () { this._pinned = false; }.bind(this),
				pages: [new QuickViewPage({
					header: ar ? "بطاقة الشخص" : "Person", title: ar ? n : p.en, description: ar ? p.role_ar : p.role_en,
					avatar: new Avatar({ initials: p.initials }),
					groups: [new QuickViewGroup({ heading: t.contact, elements: [
						new QuickViewGroupElement({ label: t.email, value: p.email, type: "email", emailSubject: "Repo.io" }),
						new QuickViewGroupElement({ label: t.phone, value: p.phone, type: "phone" }),
						new QuickViewGroupElement({ label: t.team, value: ar ? p.team_ar : p.team_en }),
						new QuickViewGroupElement({ label: t.org, value: ar ? "مجموعة نهضة مصر للنشر" : "Nahdet Misr Publishing Group" })
					] })]
				})]
			});
			this.addDependent(this._qv);
			this._qv.openBy(this.getAggregation("_avatar").getVisible() ? this.getAggregation("_avatar") : this);
			var that = this;
			setTimeout(function () {
				var d = document.getElementById(that._qv.getId() + "-quickView-popover");
				if (d) { d.addEventListener("mouseleave", function () { that._t = setTimeout(that._closeIfAway.bind(that), 300); }); d.addEventListener("mouseenter", function () { clearTimeout(that._t); }); }
			}, 0);
		},

		exit: function () { clearTimeout(this._t); }
	});
	return PersonLink;
});
