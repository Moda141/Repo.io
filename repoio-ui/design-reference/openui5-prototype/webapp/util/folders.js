sap.ui.define([], function () {
	"use strict";

	/* DAG folders (ADR-0005): dags/<domain>/<repository>/<kind>/, plus analytics/ and platform/.
	   The console groups jobs and data sync flows by the same folders as the Airflow Folders panel. */
	var KIND_ICON = {
		sync: "sap-icon://synchronize", stream: "sap-icon://process", dq: "sap-icon://quality-issue",
		housekeeping: "sap-icon://wrench", health: "sap-icon://heart", broadcasts: "sap-icon://email"
	};

	var F = {
		/* Folder names are technical: lowercase, singular domain, repository code in snake case. */
		domFolder: function (sDomainId) { return String(sDomainId || "").replace(/s$/, ""); },
		repoFolder: function (oRepo) { return String(oRepo.code || oRepo.id).toLowerCase().replace(/[^a-z0-9]+/g, "_"); },

		/* Folder segments for a job: repository jobs live under their repository, others under platform/. */
		path: function (c, sRepoId, sKind) {
			if (!sRepoId) { return ["platform", sKind]; }
			var oRepo = c.data().getProperty("/repos/" + sRepoId) || { id: sRepoId, code: sRepoId, domainId: "customers" };
			return [F.domFolder(oRepo.domainId), F.repoFolder(oRepo), sKind];
		},
		key: function (aSeg) { return aSeg.join("/"); },
		dagId: function (aSeg, sFile) { return aSeg.concat([String(sFile).toLowerCase()]).join("__"); },
		file: function (aSeg, sFile) { return "dags/" + aSeg.join("/") + "/" + String(sFile).toLowerCase() + ".py"; },
		inFolder: function (aSeg, sKey) { return !sKey || (F.key(aSeg) + "/").indexOf(sKey + "/") === 0; },

		/* Business name of a folder, shown as its tooltip (domain or repository). */
		_label: function (c, aSeg, i) {
			if (aSeg[0] === "platform" || i === 2 || (i === 1 && aSeg[0] === "platform")) { return ""; }
			var doms = c.data().getProperty("/domains") || [], repos = c.data().getProperty("/repos") || {};
			if (i === 0) {
				var d = doms.filter(function (x) { return F.domFolder(x.id) === aSeg[0]; })[0];
				return d ? c.domainName(d) : "";
			}
			var r = Object.keys(repos).map(function (k) { return repos[k]; }).filter(function (x) { return F.repoFolder(x) === aSeg[1]; })[0];
			return r ? r.name : "";
		},

		/* Tree nodes for a list of folder paths: a root "all" node, then folders to any depth. */
		tree: function (c, aPaths, sRootText, sSelected) {
			var root = { key: "", text: sRootText, icon: "sap-icon://folder-full", count: aPaths.length, nodes: [], selected: !sSelected };
			aPaths.forEach(function (aSeg) {
				var level = root;
				aSeg.forEach(function (s, i) {
					var k = F.key(aSeg.slice(0, i + 1)), n = level.nodes.filter(function (x) { return x.key === k; })[0];
					if (!n) {
						n = { key: k, text: s, tip: F._label(c, aSeg, i), count: 0, nodes: [], selected: k === sSelected,
							icon: i === aSeg.length - 1 && KIND_ICON[s] ? KIND_ICON[s] : "sap-icon://folder-blank" };
						level.nodes.push(n);
					}
					n.count++;
					level = n;
				});
			});
			var sort = function (n) {
				n.nodes.sort(function (a, b) { return (a.text === "platform") - (b.text === "platform") || (a.text < b.text ? -1 : 1); });
				n.nodes.forEach(sort);
			};
			sort(root);
			return [root];
		},

		/* Breadcrumb links for the selected folder: dags / customer / customer_master. */
		crumbs: function (sKey) {
			var a = sKey ? sKey.split("/") : [], out = [{ key: "", text: "dags" }];
			a.slice(0, -1).forEach(function (s, i) { out.push({ key: a.slice(0, i + 1).join("/"), text: s }); });
			return { links: sKey ? out : [], current: sKey ? a[a.length - 1] : "dags" };
		},

		/* Expand the tree to show the selected folder after the model is (re)bound. */
		reveal: function (oTree, sKey) {
			oTree.expandToLevel(1);
			if (!sKey) { return; }
			var parts = sKey.split("/");
			for (var i = 1; i < parts.length; i++) {
				var k = parts.slice(0, i).join("/");
				var idx = oTree.getItems().map(function (it) { return it.getBindingContext("view").getProperty("key"); }).indexOf(k);
				if (idx > -1 && !oTree.getItems()[idx].getExpanded()) { oTree.expand(idx); }
			}
		}
	};
	return F;
});
