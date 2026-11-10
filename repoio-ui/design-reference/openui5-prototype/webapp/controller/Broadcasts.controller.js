sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/people",
	"sap/ui/core/Fragment",
	"sap/m/Token",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, people, Fragment, Token, MessageToast, MessageBox) {
	"use strict";

	var ME = "محمد",
		NOW = new Date(2026, 10, 10, 17, 45),
		ST = { active: ["Information", "sap-icon://play"], paused: ["Warning", "sap-icon://media-pause"], completed: ["Success", "sap-icon://sys-enter-2"], draft: ["None", "sap-icon://edit"] },
		LAST = { sent: ["Success", "sap-icon://sys-enter-2"], partial: ["Warning", "sap-icon://alert"], failed: ["Error", "sap-icon://error"] },
		DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
		COLL = [["all", "sap-icon://world"], ["mine", "sap-icon://employee"], ["attention", "sap-icon://alert"]],
		/* Sample role→domain grants. In the product these come from the access API (Entra ID groups → domains). */
		GRANTS = { "محمد": "*", "أحمد ناصر": "*", "سارة عادل": ["customers"], "هالة سمير": ["vendors", "customers"], "عمر طارق": ["vendors"],
			"كريم فوزي": ["products", "authors"], "نور الدين": ["products", "authors", "customers"], "منى حسن": ["employees"], "ياسر جمال": ["stores"] },
		VIEWS = { RPT_CUSTOMER_GOLDEN: ["standard", "cairoSchools", "lowDq"], RPT_OPEN_CR: ["standard", "byDomain"], RPT_WRITEBACK_LOG: ["standard", "failedOnly"] };

	function pad(n) { return (n < 10 ? "0" : "") + n; }
	function stamp(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }

	/* J14: broadcasts. The broadcast runs per recipient with that recipient's own grants: a recipient without
	   access to the report's domain is skipped (and reported), never sent data they cannot see in the console. */
	return BaseController.extend("repoio.proto.controller.Broadcasts", {
		onInit: function () {
			this.viewModel().setProperty("/bc", { q: "", coll: "all", showFilters: true, rows: [], facets: [], active: 0, selected: 0, page: 1, size: 25 });
			this._sel = { objType: {}, schedule: {}, status: {} };
			this.router().getRoute("broadcasts").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function (oEvent) {
			var that = this, q = oEvent.getParameter("arguments")["?query"] || {}, oM = this.getOwnerComponent().getModel("analytics");
			Promise.all([oM.dataLoaded(), this.data().dataLoaded()]).then(function () {
				that._reports = oM.getProperty("/reports");
				if (!that._all) { that._all = JSON.parse(JSON.stringify(oM.getProperty("/broadcasts"))); }
				that._doms = that.data().getProperty("/domains");
				that.viewModel().setProperty("/bc/people", people.names().map(function (n) {
					var p = people.get(n), en = that.lang() === "en";
					return { key: n, text: en ? p.en : n, role: en ? p.role_en : p.role_ar };
				}));
				that._apply(true);
				if (q.report) {
					that.router().navTo("broadcasts", {}, true);
					that._openDialog(null, q.report);
				}
			});
		},

		_report: function (id) { return this._reports.filter(function (r) { return r.id === id; })[0]; },
		_pname: function (n) { var p = people.get(n); return p && this.lang() === "en" ? p.en : n; },
		_dayText: function (sched, day) {
			return sched === "weekly" ? this.text("bc.day." + day) : this.text("bc.dayOfMonth", [day]);
		},
		_schedText: function (b) {
			if (b.schedule === "none") { return this.text("bc.s.none"); }
			var parts = (b.at || "").split(" "), time = parts.pop(), day = parts[0];
			day = b.schedule === "weekly" ? String(day).toLowerCase().slice(0, 3) : parseInt(day, 10);
			return this.text("bc.s." + b.schedule) + " · " + (b.schedule === "daily" ? "" : this._dayText(b.schedule, day) + " ") + time;
		},
		_date: function (s) {
			if (!s) { return "—"; }
			var d = new Date(s.replace(" ", "T")), ar = this.lang() === "ar",
				m = ar ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"][d.getMonth()]
					: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
			return (ar ? d.getDate() + " " + m + "، " : m + " " + d.getDate() + ", ") + pad(d.getHours()) + ":" + pad(d.getMinutes());
		},
		/* Recipients the report cannot be sent to (no grant on its domain). Stories are rendered per recipient instead. */
		_skipped: function (b) {
			var r = this._report(b.object);
			if (!r || b.objType === "story") { return []; }
			return b.recipients.filter(function (n) { var g = GRANTS[n]; return !(g === "*" || (g || []).indexOf(r.domain) > -1); });
		},
		_attention: function (b) { return b.last === "failed" || b.last === "partial" || b.status === "paused"; },

		_apply: function (bResetPage) {
			var that = this, vm = this.viewModel(), ar = this.lang() === "ar", c = vm.getProperty("/bc/coll"),
				q = (vm.getProperty("/bc/q") || "").trim().toLowerCase(), sel = this._sel;
			var inColl = function (b) { return c === "all" || (c === "mine" && b.owner === ME) || (c === "attention" && that._attention(b)); };
			var match = function (b, skip) {
				if (!inColl(b)) { return false; }
				if (q && [b.id, b.en, b.ar, b.object].join(" ").toLowerCase().indexOf(q) < 0) { return false; }
				return Object.keys(sel).every(function (k) { return k === skip || !Object.keys(sel[k]).length || sel[k][b[k]]; });
			};
			var rows = this._all.filter(function (b) { return match(b); }).sort(function (a, b) { return a.id < b.id ? 1 : -1; }).map(function (b) {
				var r = that._report(b.object), st = ST[b.status], la = LAST[b.last], sk = that._skipped(b).length;
				return Object.assign({}, b, {
					title: ar ? b.ar : b.en, objText: r ? (ar ? r.ar : r.en) : b.object,
					objIcon: b.objType === "story" ? "sap-icon://business-objects-experience" : "sap-icon://table-chart",
					fmtText: b.format.toUpperCase(), schedText: that._schedText(b),
					rcpText: that.text("bc.rcpCount", [b.recipients.length]),
					lastText: la ? (b.last === "partial" ? that.text("bc.last.partial", [sk]) : that.text("bc.last." + b.last)) : "—",
					lastState: la ? la[0] : "None", lastIcon: la ? la[1] : "", lastRunText: that._date(b.lastRun), nextRunText: b.status === "active" ? that._date(b.nextRun) : "—",
					statusText: that.text("bc.st." + b.status), statusState: st[0], statusIcon: st[1]
				});
			});
			var facet = function (key, values) {
				return { key: key, title: that.text("bc.facet." + key), values: values.map(function (v) {
					return { key: v[0], text: v[1], icon: v[2], selected: !!sel[key][v[0]], count: that._all.filter(function (b) { return match(b, key) && b[key] === v[0]; }).length };
				}) };
			};
			this._rows = rows;
			vm.setProperty("/bc/count", rows.length);
			if (bResetPage) { vm.setProperty("/bc/page", 1); }
			this._slice();
			vm.setProperty("/bc/collections", COLL.map(function (x) { return { key: x[0], icon: x[1], text: that.text("bc.coll." + x[0]), selected: x[0] === c }; }));
			vm.setProperty("/bc/collIcon", COLL.filter(function (x) { return x[0] === c; })[0][1]);
			vm.setProperty("/bc/scopeText", this.text("bc.coll." + c) + " (" + rows.length + ")");
			vm.setProperty("/bc/searchPh", this.text("wl.searchPh", [this.text("bc.coll." + c)]));
			vm.setProperty("/bc/active", Object.keys(sel).reduce(function (n, k) { return n + Object.keys(sel[k]).length; }, 0));
			vm.setProperty("/bc/facets", [
				facet("objType", [["report", this.text("bc.ot.report"), "sap-icon://table-chart"], ["story", this.text("bc.ot.story"), "sap-icon://business-objects-experience"]]),
				facet("schedule", ["none", "daily", "weekly", "monthly"].map(function (k) { return [k, that.text("bc.s." + k), k === "none" ? "sap-icon://less" : "sap-icon://appointment-2"]; })),
				facet("status", Object.keys(ST).map(function (k) { return [k, that.text("bc.st." + k), ST[k][1]]; }))
			]);
			this.byId("bcTable").removeSelections(true);
			this.onSelect();
		},
		_slice: function () {
			var vm = this.viewModel(), p = vm.getProperty("/bc/page"), n = vm.getProperty("/bc/size");
			vm.setProperty("/bc/rows", (this._rows || []).slice((p - 1) * n, p * n));
		},
		onPage: function (oEvent) {
			var vm = this.viewModel();
			vm.setProperty("/bc/page", oEvent.getParameter("page"));
			vm.setProperty("/bc/size", oEvent.getParameter("pageSize"));
			this._slice();
		},
		onSearch: function () { this._apply(true); },
		onCollection: function (oEvent) {
			this.viewModel().setProperty("/bc/coll", oEvent.getParameter("listItem").getBindingContext("view").getProperty("key"));
			this._apply(true);
		},
		onFacetChange: function (oEvent) {
			var sel = this._sel[oEvent.getSource().data("facet")];
			oEvent.getParameter("listItems").forEach(function (li) {
				var v = li.getBindingContext("view").getProperty("key");
				if (li.getSelected()) { sel[v] = true; } else { delete sel[v]; }
			});
			this._apply(true);
		},
		onClearFacets: function () { this._sel = { objType: {}, schedule: {}, status: {} }; this._apply(true); },

		_selected: function () {
			var all = this._all;
			return this.byId("bcTable").getSelectedItems().map(function (i) { var id = i.getBindingContext("view").getProperty("id"); return all.filter(function (b) { return b.id === id; })[0]; });
		},
		onSelect: function () {
			var s = this._selected(), vm = this.viewModel();
			vm.setProperty("/bc/selected", s.length);
			vm.setProperty("/bc/canStart", s.length > 0 && s.every(function (b) { return b.recipients.length > 0; }));
			vm.setProperty("/bc/canPause", s.length > 0 && s.every(function (b) { return b.status === "active" && b.schedule !== "none"; }));
			vm.setProperty("/bc/canResume", s.length > 0 && s.every(function (b) { return b.status === "paused"; }));
		},

		/* ---------- list actions (C4C: Start Now, Pause, Resume, Edit, Remove) ---------- */
		_next: function (b) {
			if (b.schedule === "none") { return ""; }
			var parts = (b.at || "").split(" "), hm = parts.pop().split(":"), d = new Date(NOW.getTime());
			d.setHours(+hm[0], +hm[1], 0, 0);
			if (b.schedule === "daily") { if (d <= NOW) { d.setDate(d.getDate() + 1); } }
			else if (b.schedule === "weekly") {
				var w = DAYS.indexOf(parts[0].toLowerCase().slice(0, 3));
				d.setDate(d.getDate() + ((w - d.getDay() + 7) % 7));
				if (d <= NOW) { d.setDate(d.getDate() + 7); }
			} else {
				d.setDate(parseInt(parts[0], 10));
				if (d <= NOW) { d.setMonth(d.getMonth() + 1); }
			}
			return stamp(d);
		},
		onStart: function () {
			var that = this, s = this._selected();
			s.forEach(function (b) {
				b.lastRun = stamp(NOW);
				b.last = that._skipped(b).length ? "partial" : "sent";
				if (b.schedule === "none") { b.status = "completed"; } else if (b.status === "draft") { b.status = "active"; b.nextRun = that._next(b); }
			});
			MessageToast.show(this.text("bc.t.started", [s.length]));
			this._apply(false);
		},
		onPause: function () {
			var s = this._selected();
			s.forEach(function (b) { b.status = "paused"; });
			MessageToast.show(this.text("bc.t.paused", [s.length]));
			this._apply(false);
		},
		onResume: function () {
			var that = this, s = this._selected();
			s.forEach(function (b) { b.status = "active"; b.nextRun = that._next(b); });
			MessageToast.show(this.text("bc.t.resumed", [s.length]));
			this._apply(false);
		},
		onDelete: function () {
			var that = this, s = this._selected();
			MessageBox.warning(this.text("bc.deleteConfirm", [s.length]), {
				actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL], emphasizedAction: MessageBox.Action.DELETE,
				onClose: function (a) {
					if (a !== MessageBox.Action.DELETE) { return; }
					that._all = that._all.filter(function (b) { return s.indexOf(b) < 0; });
					MessageToast.show(that.text("bc.t.deleted", [s.length]));
					that._apply(false);
				}
			});
		},
		onLast: function (oEvent) {
			var o = oEvent.getSource().getBindingContext("view").getObject(), b = this._all.filter(function (x) { return x.id === o.id; })[0], that = this;
			if (b.last === "failed") { MessageBox.error(this.text("bc.last.failedMsg", [this._date(b.lastRun)])); return; }
			var r = this._report(b.object), d = this._doms.filter(function (x) { return x.id === r.domain; })[0];
			MessageBox.warning(this.text("bc.last.partialMsg", [this._skipped(b).map(function (n) { return that._pname(n); }).join("، "), this.domainName(d)]));
		},
		onRecipients: function (oEvent) {
			var that = this, b = oEvent.getSource().getBindingContext("view").getObject(), sk = this._skipped(b);
			MessageBox.information(b.recipients.map(function (n) { return "• " + that._pname(n) + (sk.indexOf(n) > -1 ? "  (" + that.text("bc.noAccess") + ")" : ""); }).join("\n"),
				{ title: this.text("bc.d.recipients") });
		},
		onObject: function (oEvent) {
			var b = oEvent.getSource().getBindingContext("view").getObject();
			if (b.objType === "story") { this.router().navTo("studio", { id: b.object, mode: "view" }); } else { this.router().navTo("report", { id: b.object }); }
		},
		onNew: function () { this._openDialog(null); },
		onEdit: function () { this._openDialog(this._selected()[0]); },
		onOpen: function (oEvent) {
			var id = oEvent.getSource().getBindingContext("view").getProperty("id");
			this._openDialog(this._all.filter(function (b) { return b.id === id; })[0]);
		},

		/* ---------- new / edit dialog ---------- */
		_openDialog: function (b, sReport) {
			var that = this, vm = this.viewModel(), r = sReport ? this._report(sReport) : null, ar = this.lang() === "ar";
			this._editing = b;
			var objType = b ? b.objType : r ? (r.type === "story" ? "story" : "report") : "report",
				parts = b && b.at ? b.at.split(" ") : [], time = parts.length ? parts.pop() : "07:00", day = parts[0];
			vm.setProperty("/bc/d", {
				dlgTitle: b ? this.text("bc.d.editTitle", [b.id]) : this.text("bc.d.newTitle"),
				objType: objType, name: b ? (ar ? b.ar : b.en) : r ? (ar ? r.ar : r.en) : "", object: b ? b.object : r ? r.id : "",
				view: b ? b.view : "", subject: b ? (ar ? b.ar : b.en) : r ? this.text("bc.d.subjectDefault", [ar ? r.ar : r.en]) : "", message: b ? "" : this.text("bc.d.messageDefault"),
				recipients: b ? b.recipients.slice() : [], format: b ? b.format : "", zip: b ? b.zip : false, link: true,
				sched: b ? b.schedule : "none", day: day ? (b.schedule === "weekly" ? day.toLowerCase().slice(0, 3) : String(parseInt(day, 10))) : "sun", time: time, start: "2026-11-11"
			});
			this._dlgObjects(true);
			var open = function (oDlg) {
				var oMI = that.byId("bcRecipients");
				oMI.removeAllTokens();
				vm.getProperty("/bc/d/recipients").forEach(function (n) { oMI.addToken(new Token({ key: n, text: that._pname(n) })); });
				if (!oMI._repoioValidator) {
					oMI.addValidator(function (args) { return args.suggestedToken || null; });
					oMI._repoioValidator = true;
				}
				that._dlgCheck();
				oDlg.open();
			};
			if (this._dlg) { open(this._dlg); return; }
			Fragment.load({ id: this.getView().getId(), name: "repoio.proto.fragment.Broadcast", controller: this }).then(function (oDlg) {
				that._dlg = oDlg;
				that.getView().addDependent(oDlg);
				open(oDlg);
			});
		},
		/* Objects of the chosen type (published only), the views/pages of the chosen object and its formats. */
		_dlgObjects: function (bKeep) {
			var that = this, vm = this.viewModel(), d = vm.getProperty("/bc/d"), ar = this.lang() === "ar",
				objs = this._reports.filter(function (r) { return (r.type === "story") === (d.objType === "story") && r.status === "published"; });
			vm.setProperty("/bc/d/objects", objs.map(function (r) { return { key: r.id, text: ar ? r.ar : r.en }; }));
			if (!bKeep || !objs.some(function (r) { return r.id === d.object; })) { vm.setProperty("/bc/d/object", objs[0] ? objs[0].id : ""); }
			this._dlgViews(bKeep);
			var fm = d.objType === "story" ? ["pdf", "pptx"] : ["xlsx", "csv", "pdf"];
			vm.setProperty("/bc/d/formats", fm.map(function (k) { return { key: k, text: that.text("bc.fmt." + k) }; }));
			if (fm.indexOf(vm.getProperty("/bc/d/format")) < 0) { vm.setProperty("/bc/d/format", fm[0]); }
		},
		_dlgViews: function (bKeep) {
			var that = this, vm = this.viewModel(), d = vm.getProperty("/bc/d"),
				vs = d.objType === "story" ? ["overview", "changeRequests", "dataQuality", "allPages"] : (VIEWS[d.object] || ["standard"]);
			vm.setProperty("/bc/d/viewLabel", this.text(d.objType === "story" ? "bc.d.page" : "bc.d.view"));
			vm.setProperty("/bc/d/views", vs.map(function (k) { return { key: k, text: that.text("bc.v." + k) }; }));
			if (!bKeep || vs.indexOf(d.view) < 0) { vm.setProperty("/bc/d/view", vs[0]); }
			vm.setProperty("/bc/d/days", vm.getProperty("/bc/d/sched") === "monthly"
				? [1, 5, 10, 15, 20, 25, 28].map(function (n) { return { key: String(n), text: that.text("bc.dayOfMonth", [n]) }; })
				: DAYS.map(function (k) { return { key: k, text: that.text("bc.day." + k) }; }));
		},
		onDlgObjType: function () { this._dlgObjects(false); this._dlgCheck(); },
		onDlgObject: function () { this._dlgViews(false); this._dlgCheck(); },
		onDlgTokens: function () { var that = this; setTimeout(function () { that._dlgCheck(); }, 0); },
		onDlgCheck: function () { this._dlgCheck(); },
		onDlgSched: function () {
			var vm = this.viewModel(), sc = vm.getProperty("/bc/d/sched");
			vm.setProperty("/bc/d/day", sc === "monthly" ? "1" : "sun");
			this._dlgViews(true);
		},
		_dlgCheck: function () {
			var that = this, vm = this.viewModel(), oMI = this.byId("bcRecipients"),
				rc = oMI ? oMI.getTokens().map(function (t) { return t.getKey(); }) : vm.getProperty("/bc/d/recipients");
			vm.setProperty("/bc/d/recipients", rc);
			var d = vm.getProperty("/bc/d"), sk = this._skipped({ objType: d.objType, object: d.object, recipients: rc }),
				r = this._report(d.object), dom = r && this._doms.filter(function (x) { return x.id === r.domain; })[0];
			vm.setProperty("/bc/d/accessWarn", sk.length ? this.text("bc.d.accessWarn", [sk.map(function (n) { return that._pname(n); }).join("، "), this.domainName(dom)]) : "");
			vm.setProperty("/bc/d/valid", !!(d.name || "").trim() && !!d.object && !!(d.subject || "").trim() && rc.length > 0);
		},
		onDlgSave: function (oEvent) {
			var vm = this.viewModel(), d = vm.getProperty("/bc/d"), bStart = oEvent.getSource().data("start") === "yes", ar = this.lang() === "ar",
				at = d.sched === "none" ? "" : (d.sched === "daily" ? "" : (d.sched === "weekly" ? d.day.charAt(0).toUpperCase() + d.day.slice(1) : d.day) + " ") + d.time,
				b = this._editing || { id: "BC-" + pad(13 + this._all.length - 8).replace(/^/, "00"), owner: ME, status: "draft", last: "", lastRun: "", nextRun: "" };
			Object.assign(b, { objType: d.objType, object: d.object, view: d.view, format: d.format, zip: d.zip, schedule: d.sched, at: at, recipients: d.recipients.slice() });
			b[ar ? "ar" : "en"] = d.name;
			if (!b[ar ? "en" : "ar"]) { b[ar ? "en" : "ar"] = d.name; }
			if (!this._editing) { b.status = d.sched === "none" ? "draft" : "active"; this._all.push(b); }
			if (b.status === "active") { b.nextRun = this._next(b); }
			this._dlg.close();
			if (bStart) {
				b.lastRun = stamp(NOW);
				b.last = this._skipped(b).length ? "partial" : "sent";
				if (b.schedule === "none") { b.status = "completed"; }
				MessageToast.show(this.text("bc.t.savedStarted", [d.name]));
			} else { MessageToast.show(this.text("bc.t.saved", [d.name])); }
			this._apply(false);
		},
		onDlgCancel: function () { this._dlg.close(); }
	});
});
