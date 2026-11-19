/*
 * PersonGroup — several people shown as one sap.f.AvatarGroup (groupType "Group": overlapping avatars, "+N" when they do
 * not fit). Pressing the group opens a popover "<title> (N)" listing every member with avatar, name and role, in two
 * columns from four members up; pressing a member opens that person's business card (PersonLink.openFor).
 * A single person is shown as a PersonLink. Every group of people in the console uses this control.
 */
sap.ui.define([
	"sap/ui/core/Control",
	"sap/f/AvatarGroup",
	"sap/f/AvatarGroupItem",
	"sap/m/Avatar",
	"sap/m/Popover",
	"sap/m/FlexBox",
	"sap/m/HBox",
	"sap/m/VBox",
	"sap/m/Text",
		"repoio/proto/control/PersonLink",
	"repoio/proto/util/people"
], function (Control, AvatarGroup, AvatarGroupItem, Avatar, Popover, FlexBox, HBox, VBox, Text, PersonLink, people) {
	"use strict";

	var isAr = function () { return sap.ui.getCore().getConfiguration().getLanguage().indexOf("ar") === 0; };

	return Control.extend("repoio.proto.control.PersonGroup", {
		metadata: {
			interfaces: ["sap.ui.core.IFormContent"],
			properties: {
				/* People keys (the sample directory is keyed by Arabic name) */
				names: { type: "string[]", defaultValue: [] },
				/* Popover title without the count, e.g. "Owners"; the count is added */
				title: { type: "string", defaultValue: "" },
				/* Avatar size: XS in tables and headers, S in roomier places */
				size: { type: "string", defaultValue: "XS" }
			},
			aggregations: {
				_group: { type: "sap.f.AvatarGroup", multiple: false, visibility: "hidden" },
				_single: { type: "repoio.proto.control.PersonLink", multiple: false, visibility: "hidden" }
			}
		},

		init: function () {
			this.setAggregation("_group", new AvatarGroup({ groupType: "Group", press: this._open.bind(this) }));
			this.setAggregation("_single", new PersonLink({ showName: true }));
		},

		_names: function () { return (this.getNames() || []).filter(Boolean); },
		_label: function (n) { var p = people.get(n); return p && !isAr() ? p.en : n; },

		onBeforeRendering: function () {
			var that = this, a = this._names(), g = this.getAggregation("_group");
			g.setAvatarDisplaySize(this.getSize()).destroyItems();
			a.forEach(function (n) {
				var p = people.get(n);
				g.addItem(new AvatarGroupItem(p ? { initials: p.initials } : { fallbackIcon: "sap-icon://person-placeholder" }));
			});
			g.setTooltip(this._title() + ": " + a.map(function (n) { return that._label(n); }).join(", "));
			g.setVisible(a.length > 1);
			this.getAggregation("_single").setName(a.length === 1 ? a[0] : "").setVisible(a.length === 1);
		},

		_title: function () {
			return (this.getTitle() || (isAr() ? "الأشخاص" : "People")) + " (" + this._names().length + ")";
		},

		renderer: {
			apiVersion: 2,
			render: function (oRm, oControl) {
				oRm.openStart("div", oControl).class("repoioPersonGroup").openEnd();
				oRm.renderControl(oControl.getAggregation("_group"));
				oRm.renderControl(oControl.getAggregation("_single"));
				oRm.close("div");
			}
		},

		_open: function () {
			var that = this, a = this._names(), two = a.length > 3, ar = isAr();
			if (this._pop) { this._pop.destroy(); }
			var rows = a.map(function (n, i) {
				/* A member row: avatar, name and role as plain content (no borders or focus rings on click). The row itself is the
				   control: click, or Tab + Enter/Space, opens the person's business card; focus shows only for keyboard use. */
				var p = people.get(n);
				var row = new HBox({ alignItems: "Center", renderType: "Bare", items: [
					new Avatar(Object.assign(p ? { initials: p.initials } : { fallbackIcon: "sap-icon://person-placeholder" },
						/* same colour as this member's avatar in the group (AvatarGroup colours items Accent1…10 in order) */
						{ displaySize: "S", showBorder: false, backgroundColor: "Accent" + ((i % 10) + 1) }))
						.addStyleClass("repoioPgAvatar"),
					new VBox({ renderType: "Bare", items: [new Text({ text: that._label(n), wrapping: false }).addStyleClass("repoioPgName"),
						new Text({ text: p ? (ar ? p.role_ar : p.role_en) : "", wrapping: false }).addStyleClass("repoioPcRole")] }).addStyleClass("repoioPgWho")
				] }).addStyleClass("repoioPgRow");
				if (p) {
					row.addEventDelegate({ onAfterRendering: function () {
						var d = row.getDomRef(); if (!d || d._pg) { return; }
						d._pg = true; d.tabIndex = 0; d.setAttribute("role", "button"); d.setAttribute("aria-label", that._label(n));
						d.addEventListener("click", function () { PersonLink.openFor(n, row); });
						d.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); PersonLink.openFor(n, row); } });
					} });
					row.addStyleClass("repoioPgActive");
				}
				return row;
			});
			this._pop = new Popover({
				title: this._title(), placement: "VerticalPreferredBottom", contentWidth: two ? "34rem" : "19rem",
				content: [new FlexBox({ wrap: "Wrap", renderType: "Bare", items: rows }).addStyleClass("repoioPgList" + (two ? " repoioPgTwo" : ""))]
			}).addStyleClass("repoioPersonGroupPop");
			this.addDependent(this._pop);
			this._pop.openBy(this.getAggregation("_group"));
		}
	});
});
