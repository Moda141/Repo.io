sap.ui.define([
	"repoio/proto/controller/BaseController",
	"repoio/proto/util/people",
	"sap/ui/core/Fragment",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, People, Fragment, MessageToast, MessageBox) {
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
			this.viewModel().setProperty("/api", { tab: this.store("repoio-api-tab") || "catalog", kind: "all", tq: "", tstate: "all", n: {}, mcp: {} });
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
			var that = this, k = this.viewModel().getProperty("/api/kind");
			var rows = this._d.apis.filter(function (a) { return k === "all" || a.kind === k; }).map(function (a) {
				var dep = a.status === "deprecated";
				return Object.assign({}, a, {
					title: that._t(a), kindText: KIND[a.kind][0], icon: KIND[a.kind][1], domainText: a.domain ? that._dom(a.domain) : that.text("api.allDomains"),
					statusText: dep ? that.text("api.st.deprecatedUntil", [a.sunset]) : that.text("api.st.active"),
					statusState: dep ? "Warning" : "Success", statusIcon: dep ? "sap-icon://past" : "sap-icon://status-positive"
				});
			});
			this.viewModel().setProperty("/api/apis", rows);
			this.viewModel().setProperty("/api/n/catalog", this._d.apis.length);
		},
		onKind: function () { this._catalog(); },

		/* 2. Tokens */
		_tokState: function (t) {
			if (t.status !== "active") { return t.status; }
			if (days(TODAY, t.expires) < 0) { return "expired"; }
			return days(TODAY, t.expires) <= SOON_DAYS ? "expiring" : "active";
		},
		_tokens: function () {
			var that = this, vm = this.viewModel(), q = (vm.getProperty("/api/tq") || "").toLowerCase(), f = vm.getProperty("/api/tstate");
			var rows = this._d.tokens.map(function (t) {
				var st = that._tokState(t), left = days(TODAY, t.expires);
				return Object.assign({}, t, {
					st: st, ownerText: that._owner(t.owner, t.ownerType), scopeText: that._scopes(t.scopes),
					createdText: that.text("api.tok.created", [t.created, that._person(t.createdBy)]),
					statusText: st === "expiring" ? that.text("api.st.expiresIn", [left]) : that.text("api.st." + st),
					statusState: TOK[st][0], statusIcon: TOK[st][1], highlight: st === "expiring" ? "Warning" : "None",
					canRevoke: st === "active" || st === "expiring"
				});
			}).filter(function (r) {
				if (f !== "all" && r.st !== f) { return false; }
				return !q || [r.name, r.ownerText, r.hint].join(" ").toLowerCase().indexOf(q) > -1;
			});
			vm.setProperty("/api/tokens", rows);
			vm.setProperty("/api/n/tokens", this._d.tokens.filter(function (t) { var s = that._tokState(t); return s === "active" || s === "expiring"; }).length);
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
		onApproveApp: function (oEvent) {
			var id = oEvent.getSource().getBindingContext("view").getProperty("id"), a = this._app(id);
			a.status = "active"; a.approvedBy = ME; a.approved = TODAY;
			this._apps(); this._lists();
			MessageToast.show(this.text("api.t.appApproved", [a.name]));
		},

		/* 3. Webhooks */
		_webhooks: function () {
			var that = this;
			this.viewModel().setProperty("/api/webhooks", this._d.webhooks.map(function (w) {
				var ok = w.lastCode >= 200 && w.lastCode < 300, paused = w.status === "paused";
				return Object.assign({}, w, {
					domainText: that._dom(w.domain), ownerText: that._person(w.owner), eventText: w.events.join(", "),
					lastText: w.last ? w.last.slice(5) + " · " + w.lastCode : that.text("api.wh.never"), lastState: !w.last ? "None" : ok ? "Success" : "Error",
					rateText: w.rate.toFixed(1) + "%",
					statusText: that.text(paused ? "api.st.paused" : "api.st.active"), statusState: paused ? "Error" : "Success",
					statusIcon: paused ? "sap-icon://media-pause" : "sap-icon://status-positive", highlight: paused ? "Error" : "None"
				});
			}));
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
			vm.setProperty("/api/mcp/rows", m.tools.map(function (t) { return { id: t.id, write: t.write, desc: that.text("api.tool." + t.id), grants: Object.assign({}, t.grants) }; }));
			vm.setProperty("/api/mcp/sessions", m.sessions);
			vm.setProperty("/api/mcp/versionText", this.text("api.mcp.version", [m.version, m.changed, this._person(m.changedBy)]));
			vm.setProperty("/api/mcp/dirty", false);
		},
		onMcpChange: function () {
			var rows = this.viewModel().getProperty("/api/mcp/rows"), cur = this._d.mcp.tools;
			this.viewModel().setProperty("/api/mcp/dirty", rows.some(function (r, i) { return JSON.stringify(r.grants) !== JSON.stringify(cur[i].grants); }));
		},
		onMcpReset: function () { this._mcp(); },
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
			this.viewModel().setProperty("/api/usage", rows);
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

		/* Picker lists for the dialogs. */
		_lists: function () {
			var that = this, vm = this.viewModel(), doms = (this.data().getProperty("/domains") || []).map(function (d) { return { key: d.id, text: that.domainName(d) }; });
			vm.setProperty("/api/domainItems", [{ key: "", text: this.text("api.allDomains") }].concat(doms));
			vm.setProperty("/api/domainPick", doms);
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
