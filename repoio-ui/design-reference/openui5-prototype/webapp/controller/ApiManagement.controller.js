sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/people",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, People, Fragment, Filter, MessageToast, MessageBox) {
	"use strict";

	var TODAY = "2026-11-12", ME = "محمد", SOON_DAYS = 14,
		KIND = { rest: ["REST", "sap-icon://chain-link"], graphql: ["GraphQL", "sap-icon://overview-chart"], sql: ["SQL", "sap-icon://syntax"], mcp: ["MCP", "sap-icon://da"] },
		TOK = { active: ["Success", "sap-icon://status-positive"], expiring: ["Warning", "sap-icon://past"], expired: ["None", "sap-icon://history"], revoked: ["Error", "sap-icon://status-negative"] },
		METHOD = { GET: "Information", POST: "Success", QUERY: "Information", SQL: "Indication05", TOOL: "Indication06" };

	var days = function (a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); };

	/* API management (J16): the inbound side of the Integration hub. Admin-only.
	   Lists come from the admin API in the product; token values and signing secrets never leave the secret store. */
	return BaseController.extend("repoio.proto.controller.ApiManagement", {
		onInit: function () {
			this.viewModel().setProperty("/api", { tab: this.store("repoio-api-tab") || "catalog", kind: "all", tq: "", tstate: "all", n: {}, mcp: {},
				f: { cq: "", cdom: "", cst: "all", otype: "all", scope: "all", wq: "", wev: "", wst: "all", mq: "", mkind: "all", uk: "all", near: false, lq: "", lc: "", lk: "all", lr: "all" }, lpage: 1, lsize: 10 });
			this.router().getRoute("apiManagement").attachPatternMatched(this._onMatched, this);
		},

		_onMatched: function () {
			var that = this, oM = this.getOwnerComponent().getModel("api");
			Promise.all([oM.dataLoaded(), this.data().dataLoaded()]).then(function () {
				that._d = oM.getData();
				if (!that._mcp0) { that._mcp0 = JSON.stringify(that._d.mcp.tools); }
				that._refresh();
			});
		},

		_refresh: function () { this._catalog(); this._tokens(); this._apps(); this._webhooks(); this._mcp(); this._usage(); this._lists(); },

		_t: function (o) { return this.lang() === "ar" ? o.ar : o.en; },
		_dom: function (id) {
			var d = (this.data().getProperty("/domains") || []).filter(function (x) { return x.id === id; })[0];
			return d ? this.domainName(d) : this.text("api.allDomains");
		},
		_person: function (name) { var p = People.get(name); return p ? (this.lang() === "ar" ? name : p.en) : name; },
		_app: function (id) { return (this._d.apps || []).filter(function (a) { return a.id === id; })[0]; },
		_owner: function (id, type) { if (type === "app") { var a = this._app(id); return a ? a.name : id; } return this._person(id); },
		_scopes: function (a) { var that = this; return a.map(function (s) { return that.text("api.scopeShort." + s); }).join(" · "); },

		/* 1. Catalog */
		_catalog: function () {
			var that = this, vm = this.viewModel(), k = vm.getProperty("/api/kind"), f = vm.getProperty("/api/f"), q = (f.cq || "").toLowerCase();
			var rows = this._d.apis.filter(function (a) {
				return (k === "all" || a.kind === k) && (!f.cdom || a.domain === f.cdom || !a.domain) && (f.cst === "all" || a.status === f.cst) &&
					(!q || [a.en, a.ar, a.base, a.version].join(" ").toLowerCase().indexOf(q) > -1);
			}).map(function (a) {
				var dep = a.status === "deprecated";
				return Object.assign({}, a, {
					title: that._t(a), kindText: KIND[a.kind][0], icon: KIND[a.kind][1], domainText: a.domain ? that._dom(a.domain) : that.text("api.allDomains"),
					statusText: dep ? that.text("api.st.deprecatedUntil", [a.sunset]) : that.text("api.st.active"),
					statusState: dep ? "Warning" : "Success", statusIcon: dep ? "sap-icon://past" : "sap-icon://status-positive"
				});
			});
			vm.setProperty("/api/apis", rows);
			vm.setProperty("/api/catTitle", this.text("api.catalog.titleN", [rows.length]));
			this.viewModel().setProperty("/api/n/catalog", this._d.apis.length);
		},
		onKind: function () { this._catalog(); },
		onFilter: function () { this._catalog(); this._webhooks(); },

		/* 2. Tokens */
		_tokState: function (t) {
			if (t.status !== "active") { return t.status; }
			if (days(TODAY, t.expires) < 0) { return "expired"; }
			return days(TODAY, t.expires) <= SOON_DAYS ? "expiring" : "active";
		},
		_tokens: function () {
			var that = this, vm = this.viewModel(), q = (vm.getProperty("/api/tq") || "").toLowerCase(), f = vm.getProperty("/api/tstate"), ff = vm.getProperty("/api/f");
			var rows = this._d.tokens.map(function (t) {
				var st = that._tokState(t), left = days(TODAY, t.expires);
				return Object.assign({}, t, {
					st: st, ownerText: that._owner(t.owner, t.ownerType), scopeText: that._scopes(t.scopes),
					createdText: that.text("api.tok.created", [t.created, that._person(t.createdBy)]), createdShort: t.created,
					statusText: st === "expiring" ? that.text("api.st.expiresIn", [left]) : that.text("api.st." + st),
					statusState: TOK[st][0], statusIcon: TOK[st][1], highlight: st === "expiring" ? "Warning" : "None",
					canRevoke: st === "active" || st === "expiring"
				});
			}).filter(function (r) {
				if (f !== "all" && r.st !== f) { return false; }
				if (ff.otype !== "all" && r.ownerType !== ff.otype) { return false; }
				if (ff.scope !== "all" && r.scopes.indexOf(ff.scope) < 0) { return false; }
				return !q || [r.name, r.ownerText, r.hint].join(" ").toLowerCase().indexOf(q) > -1;
			});
			vm.setProperty("/api/tokens", rows);
			vm.setProperty("/api/tokTitle", this.text("api.tok.titleN", [rows.length]));
			vm.setProperty("/api/n/tokens", this._d.tokens.length);
		},
		onTokSearch: function () { this._tokens(); },
		onRevoke: function (oEvent) {
			var that = this, r = oEvent.getSource().getBindingContext("view").getObject(),
				t = this._d.tokens.filter(function (x) { return x.id === r.id; })[0];
			MessageBox.warning(this.text("api.tok.revokeConfirm", [t.name, r.ownerText]), {
				actions: [this.text("api.a.revoke"), MessageBox.Action.CANCEL], emphasizedAction: this.text("api.a.revoke"),
				onClose: function (a) {
					if (a !== that.text("api.a.revoke")) { return; }
					t.status = "revoked";
					that._tokens();
					MessageToast.show(that.text("api.t.revoked", [t.name]));
				}
			});
		},

		_apps: function () {
			var that = this;
			this.viewModel().setProperty("/api/apps", this._d.apps.map(function (a) {
				var p = a.status === "pending";
				return Object.assign({}, a, {
					grantText: a.roles.join(", ") + " — " + a.domains.map(function (d) { return that._dom(d); }).join("، "),
					approvedText: p ? that.text("api.app.awaiting") : a.approved,
					statusText: that.text(p ? "api.st.pending" : "api.st.active"), statusState: p ? "Warning" : "Success",
					statusIcon: p ? "sap-icon://pending" : "sap-icon://status-positive"
				});
			}));
		},
		/* An app owner has no person card; its avatar shows the app name. */
		onOwnerApp: function (oEvent) {
			MessageToast.show(oEvent.getSource().getTooltip());
		},
		onApproveApp: function (oEvent) {
			var id = oEvent.getSource().getBindingContext("view").getProperty("id"), a = this._app(id);
			a.status = "active"; a.approvedBy = ME; a.approved = TODAY;
			this._apps(); this._lists();
			MessageToast.show(this.text("api.t.appApproved", [a.name]));
		},

		/* 3. Webhooks */
		_webhooks: function () {
			var that = this, vm = this.viewModel(), f = vm.getProperty("/api/f"), q = (f.wq || "").toLowerCase();
			var rows = this._d.webhooks.filter(function (w) {
				return (f.wst === "all" || w.status === f.wst) && (!f.wev || w.events.indexOf(f.wev) > -1) &&
					(!q || [w.name, w.url, that._person(w.owner)].join(" ").toLowerCase().indexOf(q) > -1);
			}).map(function (w) {
				var ok = w.lastCode >= 200 && w.lastCode < 300, paused = w.status === "paused";
				return Object.assign({}, w, {
					domainText: that._dom(w.domain), ownerText: that._person(w.owner), eventText: w.events.join(", "),
					lastText: w.last ? w.last.slice(5) + " · " + w.lastCode : that.text("api.wh.never"), lastState: !w.last ? "None" : ok ? "Success" : "Error",
					rateText: w.rate.toFixed(1) + "%",
					statusText: that.text(paused ? "api.st.paused" : "api.st.active"), statusState: paused ? "Error" : "Success",
					statusIcon: paused ? "sap-icon://media-pause" : "sap-icon://status-positive", highlight: paused ? "Error" : "None"
				});
			});
			vm.setProperty("/api/webhooks", rows);
			vm.setProperty("/api/whTitle", this.text("api.wh.titleN", [rows.length]));
			this.viewModel().setProperty("/api/n/webhooks", this._d.webhooks.length);
		},
		_wh: function (oEvent) { var id = oEvent.getSource().getBindingContext("view").getProperty("id"); return this._d.webhooks.filter(function (w) { return w.id === id; })[0]; },
		onTestWebhook: function (oEvent) {
			var w = this._wh(oEvent), ok = w.status !== "paused" && w.rate > 80, code = ok ? 200 : 500;
			w.deliveries.unshift({ at: TODAY + " 13:10", event: w.events[0] + " (test)", code: code, attempts: 1, ms: ok ? 131 : 0 });
			MessageToast.show(this.text(ok ? "api.t.testOk" : "api.t.testFail", [w.name, code]));
		},
		onToggleWebhook: function (oEvent) {
			var w = this._wh(oEvent);
			w.status = w.status === "paused" ? "active" : "paused";
			this._webhooks();
			MessageToast.show(this.text(w.status === "paused" ? "api.t.paused" : "api.t.resumed", [w.name]));
		},
		onWebhookLog: function (oEvent) {
			var that = this, w = this._wh(oEvent);
			this.viewModel().setProperty("/api/log", { title: this.text("api.log.title", [w.name]), rows: w.deliveries.map(function (d) {
				var ok = d.code >= 200 && d.code < 300;
				return Object.assign({}, d, { state: ok ? "Success" : "Error", msText: ok ? d.ms + " ms" : that.text("common.none") });
			}) });
			this._open("apiLogDlg");
		},

		/* 4. MCP exposure */
		_mcp: function () {
			var that = this, m = this._d.mcp, vm = this.viewModel();
			vm.setProperty("/api/mcp/rows", m.tools.map(function (t) { return { id: t.id, write: t.write, show: true, desc: that.text("api.tool." + t.id), grants: Object.assign({}, t.grants) }; }));
			this.onMcpFilter();
			vm.setProperty("/api/mcp/sessions", m.sessions);
			vm.setProperty("/api/mcp/versionText", this.text("api.mcp.version", [m.version, m.changed, this._person(m.changedBy)]));
			vm.setProperty("/api/mcp/dirty", false);
		},
		onMcpChange: function () {
			var rows = this.viewModel().getProperty("/api/mcp/rows"), cur = this._d.mcp.tools;
			this.viewModel().setProperty("/api/mcp/dirty", rows.some(function (r, i) { return JSON.stringify(r.grants) !== JSON.stringify(cur[i].grants); }));
		},
		onMcpReset: function () { this._mcp(); },
		onMcpFilter: function () {
			var vm = this.viewModel(), f = vm.getProperty("/api/f"), q = (f.mq || "").toLowerCase();
			(vm.getProperty("/api/mcp/rows") || []).forEach(function (r) {
				r.show = (f.mkind === "all" || (f.mkind === "write") === r.write) && (!q || (r.id + " " + r.desc).toLowerCase().indexOf(q) > -1);
			});
			vm.refresh(true);
			var b = this.byId("mcpTable").getBinding("items");
			if (b) { b.filter(new Filter("show", "EQ", true)); }
		},
		onMcpSave: function () {
			var m = this._d.mcp, rows = this.viewModel().getProperty("/api/mcp/rows");
			m.tools.forEach(function (t, i) { t.grants = Object.assign({}, rows[i].grants); });
			m.version++; m.changed = TODAY; m.changedBy = ME;
			this._mcp();
			MessageToast.show(this.text("api.t.mcpSaved", [m.version]));
		},

		/* 5. Usage and limits */
		_usage: function () {
			var that = this, u = this._d.usage, c = this.colors, rtl = this.isRtl(), pal = [c.brand, c.pos, c.crit, c.info];
			var rows = u.clients.map(function (x) {
				var app = that._app(x.id), total = x.calls.reduce(function (a, b) { return a + b; }, 0), pct = Math.round(x.today / x.limit * 100);
				return {
					id: x.id, isApp: !!app, clientText: app ? app.name : that._person(x.id), totalText: total.toLocaleString("en-US"),
					errText: x.errors.toFixed(1) + "%", errState: x.errors >= 2 ? "Warning" : "None", p95Text: x.p95 + " ms",
					pct: pct, quotaText: x.today.toLocaleString("en-US") + " / " + x.limit.toLocaleString("en-US"),
					quotaState: pct >= 80 ? "Warning" : "Success", quotaHint: pct >= 80 ? that.text("api.use.near", [pct]) : "", highlight: pct >= 80 ? "Warning" : "None"
				};
			});
			this._usageRows = rows;
			this.onUsageFilter();
			this.viewModel().setProperty("/api/clientFilter", [{ key: "", text: this.text("api.f.allClients") }].concat(rows.map(function (r) { return { key: r.id, text: r.clientText }; })));
			this._calls(true);
			this.byId("apiChart").setOption({
				animation: false, color: pal,
				grid: { left: rtl ? 12 : 44, right: rtl ? 44 : 12, top: 30, bottom: 22 },
				legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11, color: c.label } },
				tooltip: { trigger: "axis" },
				xAxis: { type: "category", inverse: rtl, data: u.days, axisTick: { show: false }, axisLabel: { fontSize: 10, color: c.label }, axisLine: { lineStyle: { color: c.grid } } },
				yAxis: { type: "value", position: rtl ? "right" : "left", splitLine: { lineStyle: { color: c.grid } }, axisLabel: { fontSize: 10, color: c.label } },
				series: u.clients.map(function (x, i) { return { name: rows[i].clientText, type: "line", smooth: false, symbolSize: 5, data: x.calls }; })
			});
		},

		onUsageFilter: function () {
			var vm = this.viewModel(), f = vm.getProperty("/api/f");
			vm.setProperty("/api/usage", (this._usageRows || []).filter(function (r) {
				return (f.uk === "all" || (f.uk === "app") === r.isApp) && (!f.near || r.pct >= 80);
			}));
		},

		/* Call log: metadata of each call (who, what, result, timing), never payloads. */
		_result: function (code) { return code < 300 ? "ok" : code === 403 || code === 401 ? "denied" : code === 429 ? "limited" : "error"; },
		_calls: function (bReset) {
			var that = this, vm = this.viewModel(), f = vm.getProperty("/api/f"), q = (f.lq || "").toLowerCase(),
				RES = { ok: ["Success", "sap-icon://status-positive"], denied: ["Error", "sap-icon://locked"], limited: ["Warning", "sap-icon://pending"], error: ["Error", "sap-icon://status-negative"] };
			var rows = (this._d.usage.log || []).filter(function (c) {
				return (!f.lc || c.client === f.lc) && (f.lk === "all" || c.kind === f.lk) && (f.lr === "all" || that._result(c.code) === f.lr) &&
					(!q || [c.p, c.req, c.token, c.code].join(" ").toLowerCase().indexOf(q) > -1);
			}).map(function (c) {
				var r = that._result(c.code), app = that._app(c.client);
				return Object.assign({}, c, {
					isApp: !!app, clientText: app ? app.name : that._person(c.client), kindText: KIND[c.kind][0], mState: METHOD[c.m] || "None",
					codeText: c.code + " · " + that.text("api.log." + r), codeState: RES[r][0], codeIcon: RES[r][1],
					note: r === "ok" ? "" : that.text("api.log.note." + c.code), highlight: r === "ok" ? "None" : RES[r][0],
					msText: c.ms ? c.ms + " ms" : that.text("common.none"), rowsText: c.code < 300 ? c.rows.toLocaleString("en-US") : that.text("common.none")
				});
			});
			this._callRows = rows;
			if (bReset) { vm.setProperty("/api/lpage", 1); }
			vm.setProperty("/api/callCount", rows.length);
			vm.setProperty("/api/callTitle", this.text("api.log.titleN", [rows.length]));
			this._callSlice();
		},
		_callSlice: function () {
			var vm = this.viewModel(), p = vm.getProperty("/api/lpage"), n = vm.getProperty("/api/lsize");
			vm.setProperty("/api/calls", (this._callRows || []).slice((p - 1) * n, p * n));
		},
		onLogPage: function (oEvent) {
			var vm = this.viewModel();
			vm.setProperty("/api/lpage", oEvent.getParameter("page"));
			vm.setProperty("/api/lsize", oEvent.getParameter("pageSize"));
			this._callSlice();
		},
		onLogFilter: function () { this._calls(true); },
		onClientLog: function (oEvent) {
			var id = oEvent.getSource().getBindingContext("view").getProperty("id"), that = this;
			this.viewModel().setProperty("/api/f/lc", id);
			this._calls(true);
			setTimeout(function () { var t = that.byId("apiLogTable"); if (t && t.getDomRef()) { t.getDomRef().scrollIntoView({ behavior: "smooth", block: "start" }); } }, 50);
		},
		onLogExport: function () { MessageToast.show(this.text("api.t.logExport", [this.viewModel().getProperty("/api/callCount")])); },

		/* Picker lists for the dialogs and filters. */
		_lists: function () {
			var that = this, vm = this.viewModel(), doms = (this.data().getProperty("/domains") || []).map(function (d) { return { key: d.id, text: that.domainName(d) }; });
			vm.setProperty("/api/domainItems", [{ key: "", text: this.text("api.allDomains") }].concat(doms));
			vm.setProperty("/api/domainPick", doms);
			vm.setProperty("/api/domainFilter", [{ key: "", text: this.text("api.f.allDomains") }].concat(doms));
			vm.setProperty("/api/eventFilter", [{ key: "", text: this.text("api.f.allEvents") }].concat(this._d.events.map(function (e) { return { key: e, text: e }; })));
			vm.setProperty("/api/eventItems", this._d.events.map(function (e) { return { key: e }; }));
			vm.setProperty("/api/userItems", People.names().map(function (n) { return { key: n, text: that._person(n) }; }));
			vm.setProperty("/api/appItems", this._d.apps.filter(function (a) { return a.status === "active"; }).map(function (a) { return { key: a.id, text: a.name }; }));
		},

		onTab: function (oEvent) { this.store("repoio-api-tab", oEvent.getParameter("key")); },

		/* Dialogs */
		_open: function (sId) {
			var that = this, v = this.getView();
			var go = function () { v.byId(sId).open(); };
			if (this._frag) { go(); return; }
			Fragment.load({ id: v.getId(), name: "repoio.proto.fragment.ApiDialogs", controller: this }).then(function (a) {
				that._frag = a;
				a.forEach(function (d) { v.addDependent(d); });
				go();
			});
		},
		onDlgClose: function (oEvent) {
			var p = oEvent.getSource();
			while (p && !p.close) { p = p.getParent(); }
			if (p) { p.close(); }
		},

		onNewToken: function () {
			this.viewModel().setProperty("/api/d", { ownerType: "user", owner: "", name: "", scopes: { read: true, sql: false, mcp: false }, days: "90", valid: false, grantHint: "" });
			this.onDlgOwnerType();
			this._open("apiTokDlg");
		},
		onDlgOwnerType: function () {
			var vm = this.viewModel(), t = vm.getProperty("/api/d/ownerType");
			vm.setProperty("/api/d/owners", vm.getProperty(t === "app" ? "/api/appItems" : "/api/userItems"));
			vm.setProperty("/api/d/owner", "");
			this.onDlgCheck();
		},
		onDlgCheck: function () {
			var vm = this.viewModel(), d = vm.getProperty("/api/d"), sc = d.scopes;
			vm.setProperty("/api/d/valid", !!d.owner && !!(d.name || "").trim() && (sc.read || sc.sql || sc.mcp));
			vm.setProperty("/api/d/grantHint", d.owner ? this.text("api.tok.grantHint", [this._owner(d.owner, d.ownerType)]) : "");
		},
		onGenerate: function () {
			var vm = this.viewModel(), d = vm.getProperty("/api/d"), a = new Uint8Array(20), hex = "";
			(window.crypto || window.msCrypto).getRandomValues(a);
			a.forEach(function (b) { hex += ("0" + b.toString(16)).slice(-2); });
			var exp = new Date(TODAY); exp.setDate(exp.getDate() + Number(d.days));
			var scopes = ["read", "sql", "mcp"].filter(function (s) { return d.scopes[s]; });
			this._d.tokens.unshift({ id: "tok-" + Date.now(), name: d.name.trim(), owner: d.owner, ownerType: d.ownerType, scopes: scopes, created: TODAY, createdBy: ME,
				expires: exp.toISOString().slice(0, 10), lastUsed: this.text("api.tok.neverUsed"), hint: "rpio_…" + hex.slice(-4), status: "active" });
			this.byId("apiTokDlg").close();
			vm.setProperty("/api/shown", { value: "rpio_pat_" + hex, meta: this.text("api.shown.meta", [this._owner(d.owner, d.ownerType), this._scopes(scopes), exp.toISOString().slice(0, 10)]) });
			this._tokens();
			this._open("apiShownDlg");
		},
		onCopyToken: function () {
			var v = this.viewModel().getProperty("/api/shown/value"), that = this;
			try { navigator.clipboard.writeText(v).then(function () { MessageToast.show(that.text("api.t.copied")); }); } catch (e) { MessageToast.show(this.text("api.t.copyFail")); }
		},
		onShownClose: function () {
			this.viewModel().setProperty("/api/shown", { value: "", meta: "" }); // the value is gone for good
			this.byId("apiShownDlg").close();
		},

		onNewWebhook: function () {
			var vm = this.viewModel();
			vm.setProperty("/api/w", { name: "", owner: "", url: "", events: [], domain: "", valid: false, owners: vm.getProperty("/api/userItems") });
			this._open("apiWhDlg");
		},
		onWhCheck: function () {
			var vm = this.viewModel(), w = vm.getProperty("/api/w");
			vm.setProperty("/api/w/valid", !!(w.name || "").trim() && !!w.owner && !!(w.url || "").trim() && w.events.length > 0);
		},
		onCreateWebhook: function () {
			var w = this.viewModel().getProperty("/api/w");
			this._d.webhooks.push({ id: "wh-" + Date.now(), name: w.name.trim(), owner: w.owner, url: w.url.trim(), events: w.events.slice(), domain: w.domain, status: "active", last: "", lastCode: 0, rate: 100, deliveries: [] });
			this.byId("apiWhDlg").close();
			this._webhooks();
			MessageToast.show(this.text("api.t.whCreated", [w.name.trim()]));
		},

		onNewApp: function () {
			this.viewModel().setProperty("/api/a", { name: "", clientId: "", domains: [], valid: false });
			this._open("apiAppDlg");
		},
		onAppCheck: function () {
			var vm = this.viewModel(), a = vm.getProperty("/api/a");
			vm.setProperty("/api/a/valid", !!(a.name || "").trim() && !!(a.clientId || "").trim() && a.domains.length > 0);
		},
		onRegisterApp: function () {
			var a = this.viewModel().getProperty("/api/a");
			this._d.apps.push({ id: "app-" + Date.now(), name: a.name.trim(), clientId: a.clientId.trim(), roles: ["Requester"], domains: a.domains.slice(), approvedBy: "", approved: "", status: "pending" });
			this.byId("apiAppDlg").close();
			this._apps();
			MessageToast.show(this.text("api.t.appRegistered", [a.name.trim()]));
		},

		onSpec: function (oEvent) {
			var that = this, a = oEvent.getSource().getBindingContext("view").getObject();
			this._specApi = a;
			this.viewModel().setProperty("/api/spec", {
				title: a.title, base: a.base, statusText: a.statusText, statusState: a.statusState, statusIcon: a.statusIcon,
				meta: a.kindText + " · " + a.version + " · " + a.domainText,
				sunsetText: a.status === "deprecated" ? this.text("api.spec.sunset", [a.sunset]) : "",
				ops: a.ops.map(function (o) { return { m: o.m, p: o.p, summary: that._t(o), state: METHOD[o.m] || "None" }; })
			});
			this._open("apiSpecDlg");
		},
		onDownloadSpec: function (oEvent) {
			var ctx = oEvent.getSource().getBindingContext("view"), a = ctx && ctx.getProperty("ops") ? ctx.getObject() : this._specApi;
			MessageToast.show(this.text("api.t.download", [a.id + "-" + a.version + ".openapi.json"]));
		},
		onTry: function () { MessageToast.show(this.text("api.t.try")); }
	});
});
