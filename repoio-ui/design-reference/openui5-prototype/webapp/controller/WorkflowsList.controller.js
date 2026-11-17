sap.ui.define([
	"repoio/proto/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"repoio/proto/util/semantic"
], function (BaseController, MessageToast, MessageBox, Sem) {
	"use strict";

	var FAV_KEY = "repoio-proto-wf-favs",
		ME = "محمد",
		STATUS = Sem.GROUPS.lifecycle,
		COLL = [["all", "sap-icon://world"], ["mine", "sap-icon://employee"], ["shared", "sap-icon://share-2"], ["recent", "sap-icon://history"], ["fav", "sap-icon://favorite"]];

	/* Diagram preview for a workflow card: begin, its steps as tasks (a gateway when it writes back), end. Generated from the
	   step count only; the designer holds the real flow. */
	var thumb = function (w, rtl) {
		var n = Math.max(2, Math.min(w.steps - 2, 6)), W = 260, H = 96, gap = (W - 40) / (n + 1), y = 48, parts = [], x0 = 20,
			X = function (x) { return rtl ? W - x : x; };
		parts.push('<circle cx="' + X(x0) + '" cy="' + y + '" r="7" fill="#fff" stroke="#256f3a" stroke-width="2"/>');
		var prev = x0 + 7;
		for (var i = 1; i <= n; i++) {
			var cx = x0 + i * gap, gw = w.writeback && i === n;
			parts.push('<line x1="' + X(prev) + '" y1="' + y + '" x2="' + X(cx - (gw ? 9 : 14)) + '" y2="' + y + '" stroke="#8396a8" stroke-width="1.2"/>');
			parts.push(gw ? '<path d="M' + X(cx) + ' ' + (y - 9) + 'L' + X(cx + 9) + ' ' + y + 'L' + X(cx) + ' ' + (y + 9) + 'L' + X(cx - 9) + ' ' + y + 'Z" fill="#fff3b8" stroke="#c35500" stroke-width="1.2"/>'
				: '<rect x="' + (X(cx) - 14) + '" y="' + (y - 9 - (i % 2 ? 0 : 0)) + '" width="28" height="18" rx="3" fill="#fff" stroke="#0064d9" stroke-width="1.2"/>');
			prev = cx + (gw ? 9 : 14);
		}
		parts.push('<line x1="' + X(prev) + '" y1="' + y + '" x2="' + X(W - 27) + '" y2="' + y + '" stroke="#8396a8" stroke-width="1.2"/>');
		parts.push('<circle cx="' + X(W - 20) + '" cy="' + y + '" r="7" fill="#fff" stroke="#aa0808" stroke-width="3"/>');
		return '<div class="repoioHubThumb"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-hidden="true">' +
			'<defs><pattern id="g" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="#dbe7f3" stroke-width="0.6"/></pattern></defs>' +
			'<rect width="' + W + '" height="' + H + '" fill="#f1f6fb"/><rect width="' + W + '" height="' + H + '" fill="url(#g)"/>' + parts.join("") + '</svg></div>';
	};

	/* Workflows list (J7), laid out like the SAP Signavio Process Collaboration Hub. */
	return BaseController.extend("repoio.proto.controller.WorkflowsList", {
		onInit: function () {
			this.viewModel().setProperty("/wl", { q: "", coll: "all", fdom: "all", fst: "all", rows: [], suggested: [], selected: 0, page: 1, size: 25, me: {} });
			this.router().getRoute("workflows").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			var that = this, oM = this.getOwnerComponent().getModel("workflows"), oU = this.getOwnerComponent().getModel("users");
			Promise.all([oM.dataLoaded(), this.data().dataLoaded(), oU.dataLoaded()]).then(function () {
				that._me(oU.getData());
				var favs = that.store(FAV_KEY) || {};
				that._doms = that.data().getProperty("/domains");
				that._all = oM.getProperty("/workflows").map(function (w) { return Object.assign({}, w, { fav: !!favs[w.id] }); });
				that._apply(true);
			});
		},

		_dom: function (id) { return this._doms.filter(function (d) { return d.id === id; })[0]; },

		_inColl: function (w, c) {
			return c === "all" || (c === "recent" && w.changed >= "2026-11-03") || (c === "mine" && w.owner === ME) ||
				(c === "shared" && w.shared) || (c === "fav" && w.fav);
		},

		/* The signed-in user (E-1001 in the prototype) and their roles, as on the shell user card. */
		_me: function (d) {
			var ar = this.lang() === "ar", e = d.employees.filter(function (x) { return x.id === "E-1001"; })[0] || {},
				u = d.users.filter(function (x) { return x.employee === e.id; })[0] || { direct: [] };
			this.viewModel().setProperty("/wl/me", { name: e.name, initials: "MM", title: ar ? e.title_ar : e.title_en,
				roles: u.direct.map(function (k) { var r = d.roles.filter(function (x) { return x.id === k; })[0]; return { text: r ? (ar ? r.ar || r.en : r.en || r.ar) : k }; }) });
		},
		_myRoles: function (w) {
			var out = [];
			if (w.owner === ME) { out.push(this.text("hub.role.owner")); }
			if (w.shared && w.owner !== ME) { out.push(this.text("hub.role.contributor")); }
			if (!out.length) { out.push(this.text("hub.role.reader")); }
			return out.map(function (t) { return { text: t }; });
		},

		_apply: function (bResetPage) {
			var that = this, vm = this.viewModel(), ar = this.lang() === "ar", rtl = this.isRtl(), c = vm.getProperty("/wl/coll"),
				q = (vm.getProperty("/wl/q") || "").trim().toLowerCase(), fdom = vm.getProperty("/wl/fdom"), fst = vm.getProperty("/wl/fst");
			var match = function (w) {
				if (!that._inColl(w, c)) { return false; }
				if (q && [w.id, w.en, w.ar, w.tpl_en, w.tpl_ar, w.template].join(" ").toLowerCase().indexOf(q) < 0) { return false; }
				return (fdom === "all" || w.domain === fdom) && (fst === "all" || w.status === fst);
			};
			var view = function (w) {
				var d = that._dom(w.domain), st = STATUS[w.status];
				return Object.assign({}, w, {
					title: ar ? w.ar : w.en, domIcon: d.icon, domText: that.domainName(d), tplText: ar ? w.tpl_ar : w.tpl_en,
					statusText: that.text("wl.st." + w.status), statusState: st[0], statusIcon: st[1], stepsText: that.text("hub.steps", [w.steps]),
					wbText: w.writeback ? that.text("wl.wb." + w.writeback) : "", runs: w.status === "published" || w.status === "retired" ? that.fmt.num(w.runs30) : "—",
					roles: that._myRoles(w), changedText: that.text("hub.changed", [w.changed]), thumb: thumb(w, rtl)
				});
			};
			var rows = this._all.filter(match).sort(function (a, b) { return a.changed < b.changed ? 1 : -1; }).map(view);
			this._rows = rows;
			vm.setProperty("/wl/count", rows.length);
			if (bResetPage) { vm.setProperty("/wl/page", 1); }
			this._slice();
			vm.setProperty("/wl/allTitle", this.text("hub.all", [rows.length]));
			// Suggested: the most used published workflows and the latest drafts of this collection
			vm.setProperty("/wl/suggested", this._all.filter(function (w) { return that._inColl(w, c) && w.status !== "retired"; })
				.sort(function (a, b) { return (b.runs30 || 0) - (a.runs30 || 0) || (a.changed < b.changed ? 1 : -1); }).slice(0, 5).map(view));
			vm.setProperty("/wl/collections", COLL.map(function (x) {
				return { key: x[0], icon: x[1], text: that.text("wl.coll." + x[0]), count: String(that._all.filter(function (w) { return that._inColl(w, x[0]); }).length) };
			}));
			vm.setProperty("/wl/domOpts", [{ key: "all", text: this.text("hub.allDomains") }].concat(this._doms.map(function (d) { return { key: d.id, text: that.domainName(d) }; })));
			vm.setProperty("/wl/stOpts", [{ key: "all", text: this.text("api.st.allStates") }].concat(["published", "draft", "inReview", "retired"].map(function (k) { return { key: k, text: that.text("wl.st." + k) }; })));
			this.byId("wlTable").removeSelections(true);
			this.onSelect();
		},

		_slice: function () {
			var vm = this.viewModel(), p = vm.getProperty("/wl/page"), n = vm.getProperty("/wl/size");
			vm.setProperty("/wl/rows", (this._rows || []).slice((p - 1) * n, p * n));
		},
		onPage: function (oEvent) {
			var vm = this.viewModel();
			vm.setProperty("/wl/page", oEvent.getParameter("page"));
			vm.setProperty("/wl/size", oEvent.getParameter("pageSize"));
			this._slice();
		},

		onSearch: function () { this._apply(true); },
		onCollectionTab: function (oEvent) {
			this.viewModel().setProperty("/wl/coll", oEvent.getParameter("key"));
			this._apply(true);
		},
		onQuickFilter: function () { this._apply(true); },

		_selected: function () { return this.byId("wlTable").getSelectedItems().map(function (i) { return i.getBindingContext("view").getObject(); }); },
		onSelect: function () {
			var s = this._selected(), vm = this.viewModel();
			vm.setProperty("/wl/selected", s.length);
			vm.setProperty("/wl/canDelete", s.length > 0 && s.every(function (w) { return w.status === "draft"; }));
			vm.setProperty("/wl/canRetire", s.length > 0 && s.every(function (w) { return w.status === "published"; }));
		},

		onOpen: function () { this.router().navTo("workflow"); },
		onNewBlank: function () { this.router().navTo("workflow"); },
		onNewCopy: function () {
			MessageToast.show(this.text("wl.t.copy", [this._selected()[0].title]));
			this.router().navTo("workflow");
		},
		onEdit: function () {
			var w = this._selected()[0];
			if (w.status === "published") { MessageToast.show(this.text("wl.t.newVersion", [w.title])); }
			this.router().navTo("workflow");
		},
		onExport: function () { MessageToast.show(this.text("wl.t.export", [this._selected()[0].id])); },

		/* Drafts can be deleted; published workflows are retired (running instances finish on their version). */
		onDelete: function () {
			var that = this, s = this._selected();
			MessageBox.warning(this.text("wl.deleteConfirm", [s.length]), {
				actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL], emphasizedAction: MessageBox.Action.DELETE,
				onClose: function (a) {
					if (a !== MessageBox.Action.DELETE) { return; }
					var ids = s.map(function (w) { return w.id; });
					that._all = that._all.filter(function (w) { return ids.indexOf(w.id) < 0; });
					MessageToast.show(that.text("wl.t.deleted", [ids.length]));
					that._apply(false);
				}
			});
		},
		onRetire: function () {
			var that = this, s = this._selected();
			MessageBox.confirm(this.text("wl.retireConfirm", [s.length]), {
				onClose: function (a) {
					if (a !== MessageBox.Action.OK) { return; }
					s.forEach(function (x) { that._all.filter(function (w) { return w.id === x.id; })[0].status = "retired"; });
					MessageToast.show(that.text("wl.t.retired", [s.length]));
					that._apply(false);
				}
			});
		},

		onFav: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(), favs = this.store(FAV_KEY) || {},
				w = this._all.filter(function (x) { return x.id === o.id; })[0];
			w.fav = !w.fav;
			if (w.fav) { favs[w.id] = true; } else { delete favs[w.id]; }
			this.store(FAV_KEY, favs);
			MessageToast.show(this.text(w.fav ? "cat.favAdded" : "cat.favRemoved", [o.title]));
			this._apply(false);
		}
	});
});
