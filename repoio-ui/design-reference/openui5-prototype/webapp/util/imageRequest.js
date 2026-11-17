sap.ui.define([
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Label",
	"sap/m/Input",
	"sap/m/TextArea",
	"sap/m/Text",
	"sap/m/VBox",
	"sap/m/HBox",
	"sap/m/Avatar",
	"sap/m/ObjectStatus",
	"sap/m/MessageStrip",
	"sap/ui/core/Icon"
], function (Dialog, Button, Label, Input, TextArea, Text, VBox, HBox, Avatar, ObjectStatus, MessageStrip, Icon) {
	"use strict";

	/* Record image from a URL, for any golden record (customer, product, vendor…). The console never changes a golden
	   record: the dialog checks the link in the browser (https, it is an image, big enough) and submits a change request
	   on the record's image. After approval the server downloads the image once (https only, PNG / JPEG / WebP, at most
	   5 MB, no internal addresses), re-encodes it without metadata and serves its own copy from the media store, so
	   the record never depends on the outside site (spec: type/recordImage.json). Pending requests are kept per browser in the prototype. */
	var KEY = "repoio-proto-image-requests", MIN = 64;

	function load() { try { return JSON.parse(window.localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
	function save(m) { try { window.localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* storage blocked */ } }

	return {
		pending: function (id) { return load()[id] || null; },

		/* o: { ctrl, id, name, current (image or ""), icon, onDone(request) } */
		open: function (o) {
			var T = o.ctrl.text.bind(o.ctrl), state = { url: "", ok: false, w: 0, h: 0, seq: 0 };
			var oUrl = new Input({ type: "Url", placeholder: "https://…", width: "100%", valueLiveUpdate: true }),
				oWhy = new TextArea({ rows: 2, width: "100%", placeholder: T("img.reasonPh"), valueLiveUpdate: true }),
				oNew = new Avatar({ displaySize: "XL", displayShape: "Square", fallbackIcon: "sap-icon://picture", showBorder: true }),
				oOld = new Avatar({ displaySize: "XL", displayShape: "Square", src: o.current || o.icon, showBorder: true }),
				chk = ["https", "type", "image", "size"].map(function (k) { return new ObjectStatus({ text: T("img.chk." + k), icon: "sap-icon://less", state: "None" }); }),
				oSubmit, oRemove, oDlg;
			var set = function (i, st) {
				chk[i].setState(st === true ? "Success" : st === false ? "Error" : "None");
				chk[i].setIcon(st === true ? "sap-icon://sys-enter-2" : st === false ? "sap-icon://error" : st === "wait" ? "sap-icon://pending" : "sap-icon://less");
			};
			var refresh = function () {
				oSubmit.setEnabled(state.ok && oWhy.getValue().trim().length > 2);
				if (oRemove) { oRemove.setEnabled(oWhy.getValue().trim().length > 2); }
			};
			var check = function () {
				var v = oUrl.getValue().trim(), u = null, seq = ++state.seq;
				state.ok = false; state.url = v;
				try { u = v ? new URL(v) : null; } catch (e) { u = null; }
				var svg = !!(u && /\.svgz?$/i.test(u.pathname));
				set(0, v ? !!(u && u.protocol === "https:") : null);
				set(1, v && u ? !svg : null); set(2, null); set(3, null);
				oNew.setSrc("");
				oUrl.setValueState(v && !(u && u.protocol === "https:") ? "Error" : "None");
				oUrl.setValueStateText(T("img.httpsOnly"));
				refresh();
				if (!u || u.protocol !== "https:" || svg) { return; }
				set(2, "wait");
				var img = new window.Image();
				img.referrerPolicy = "no-referrer";
				img.onload = function () {
					if (seq !== state.seq) { return; }
					var big = img.naturalWidth >= MIN && img.naturalHeight >= MIN;
					set(2, true); set(3, big);
					chk[3].setText(T("img.chk.sizeIs", [img.naturalWidth, img.naturalHeight, MIN]));
					oNew.setSrc(v);
					state.ok = big;
					refresh();
				};
				img.onerror = function () { if (seq === state.seq) { set(2, false); chk[2].setText(T("img.chk.noLoad")); refresh(); } };
				chk[2].setText(T("img.chk.image")); chk[3].setText(T("img.chk.size"));
				img.src = v;
			};
			oUrl.attachLiveChange(check);
			oWhy.attachLiveChange(refresh);
			var done = function (sAction) {
				var m = load(), cr = "CR-2026-" + String(Math.floor(10000 + Math.random() * 89999));
				m[o.id] = { cr: cr, action: sAction, url: sAction === "remove" ? "" : state.url, reason: oWhy.getValue().trim(), at: new Date().toISOString().slice(0, 16).replace("T", " ") };
				save(m);
				oDlg.close();
				if (o.onDone) { o.onDone(m[o.id]); }
			};
			oSubmit = new Button({ text: T("img.submit"), type: "Emphasized", enabled: false, press: function () { done("set"); } });
			if (o.current) { oRemove = new Button({ text: T("img.remove"), type: "Transparent", enabled: false, press: function () { done("remove"); } }); }
			var arrowIcon = o.ctrl.isRtl() ? "sap-icon://arrow-left" : "sap-icon://arrow-right";
			oDlg = new Dialog({
				title: T(o.current ? "img.titleChange" : "img.titleAdd", [o.name]), contentWidth: "32rem", resizable: true,
				content: [new VBox({ renderType: "Bare", items: [
					new HBox({ alignItems: "Center", renderType: "Bare", items: [
						new VBox({ renderType: "Bare", items: [new Label({ text: T("img.current") }), oOld] }).addStyleClass("repoioImgCol"),
						new Icon({ src: arrowIcon, decorative: true }).addStyleClass("repoioImgArrow"),
						new VBox({ renderType: "Bare", items: [new Label({ text: T("img.new") }), oNew] }).addStyleClass("repoioImgCol")
					] }).addStyleClass("repoioImgPair"),
					new Label({ text: T("img.url"), required: true, labelFor: oUrl }), oUrl,
					new VBox({ renderType: "Bare", items: chk }).addStyleClass("repoioImgChecks"),
					new Label({ text: T("img.reason"), required: true, labelFor: oWhy }), oWhy,
					new MessageStrip({ text: T("img.note"), type: "Information", showIcon: true }).addStyleClass("sapUiSmallMarginTop")
				] }).addStyleClass("repoioImgDlg")],
				buttons: (oRemove ? [oRemove] : []).concat([oSubmit, new Button({ text: T("common.cancel"), press: function () { oDlg.close(); } })]),
				afterClose: function () { oDlg.destroy(); }
			});
			o.ctrl.getView().addDependent(oDlg);
			oDlg.open();
		}
	};
});
