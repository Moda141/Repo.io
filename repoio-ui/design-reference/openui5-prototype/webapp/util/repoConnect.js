sap.ui.define([
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"repoio/proto/util/folders"
], function (MessageToast, Fragment, Fld) {
	"use strict";

	/* Repository connection details (ADR-0006): JDBC / ODBC / Python / Databricks / Snowflake values and snippets to read one
	   repository's golden table in place. Mixed into the controllers that open the RepoConnect fragment (Domain management,
	   Repository). Hosts are deployment placeholders; a token always comes from an administrator (J16). */
	return {
		_openRepoConnect: function (sRepo) {
			var that = this, r = this.data().getProperty("/repos/" + sRepo), v = this.getView();
			this._rc = { repo: r, table: Fld.repoFolder(r) };
			this.viewModel().setProperty("/rc", {
				title: this.text("rc.title", [r.name]), tab: this.store("repoio-rc-tab") || "jdbc",
				tabs: [["jdbc", "sap-icon://database"], ["odbc", "sap-icon://chain-link"], ["python", "sap-icon://source-code"],
					["databricks", "sap-icon://cloud"], ["snowflake", "sap-icon://it-system"]].map(function (x) { return { key: x[0], icon: x[1], text: that.text("rc.tab." + x[0]) }; })
			});
			this._rcFill();
			var open = function () { v.byId("repoConnDlg").open(); };
			if (this._rcDlg) { open(); return; }
			Fragment.load({ id: v.getId(), name: "repoio.proto.fragment.RepoConnect", controller: this }).then(function (d) { that._rcDlg = d; v.addDependent(d); open(); });
		},
		_rcFill: function () {
			var T = this.text.bind(this), vm = this.viewModel(), k = vm.getProperty("/rc/tab"), t = this._rc.table,
				HOST = "${REPOIO_SQL_HOST}", PORT = "${REPOIO_SQL_PORT}", CAT = "${REPOIO_CATALOG_URL}", f = [], code = "";
			var F = function (key, val) { f.push({ label: T("rc.f." + key), value: val }); };
			if (k === "jdbc" || k === "odbc" || k === "python") {
				F("host", HOST); F("port", PORT); F("catalog", "iceberg"); F("schema", "golden"); F("table", t);
			}
			if (k === "jdbc") {
				F("url", "jdbc:trino://" + HOST + ":" + PORT + "/iceberg/golden?SSL=true&externalAuthentication=true");
				code = "SELECT *\nFROM iceberg.golden." + t + "\nLIMIT 100;";
			} else if (k === "odbc") {
				F("driver", T("rc.v.odbcDriver")); F("auth", T("rc.v.auth"));
				code = "[Repo.io " + t + "]\nDriver=Trino\nHost=" + HOST + "\nPort=" + PORT + "\nCatalog=iceberg\nSchema=golden\nSSL=1\nAuthenticationType=OAuth 2.0";
			} else if (k === "python") {
				code = "# pip install trino   (pin the version in your requirements)\nimport os\nfrom trino.dbapi import connect\nfrom trino.auth import JWTAuthentication\n\n" +
					"conn = connect(\n    host=os.environ[\"REPOIO_SQL_HOST\"],\n    port=int(os.environ[\"REPOIO_SQL_PORT\"]),\n    http_scheme=\"https\",\n" +
					"    auth=JWTAuthentication(os.environ[\"REPOIO_TOKEN\"]),  # token issued by an administrator\n    catalog=\"iceberg\",\n    schema=\"golden\",\n)\n" +
					"cur = conn.cursor()\ncur.execute(\"SELECT * FROM " + t + " LIMIT 100\")\nrows = cur.fetchall()";
			} else if (k === "databricks") {
				F("catalogUri", CAT); F("warehouse", "repoio"); F("namespace", "golden"); F("table", t); F("auth", T("rc.v.authCatalog"));
				code = "# Cluster Spark config — reads the golden table in place (Iceberg REST catalog), no copy\n" +
					"spark.sql.catalog.repoio            org.apache.iceberg.spark.SparkCatalog\nspark.sql.catalog.repoio.type       rest\n" +
					"spark.sql.catalog.repoio.uri        " + CAT + "\nspark.sql.catalog.repoio.warehouse  repoio\n" +
					"spark.sql.catalog.repoio.token      {{secrets/repoio/token}}\n\n-- then, in a notebook\nSELECT * FROM repoio.golden." + t + ";";
			} else {
				F("catalogUri", CAT); F("warehouse", "repoio"); F("namespace", "golden"); F("table", t); F("auth", T("rc.v.authSnowflake"));
				code = "-- Catalog integration over the Repo.io Iceberg REST catalog (read in place, no copy)\n" +
					"CREATE CATALOG INTEGRATION repoio_catalog\n  CATALOG_SOURCE = ICEBERG_REST\n  TABLE_FORMAT = ICEBERG\n  CATALOG_NAMESPACE = 'golden'\n" +
					"  REST_CONFIG = (CATALOG_URI = '" + CAT + "' WAREHOUSE = 'repoio')\n" +
					"  REST_AUTHENTICATION = (TYPE = OAUTH OAUTH_CLIENT_ID = '${ENTRA_CLIENT_ID_SNOWFLAKE}'\n" +
					"    OAUTH_CLIENT_SECRET = '<from your secret store>' OAUTH_ALLOWED_SCOPES = ('repoio.read'))\n  ENABLED = TRUE;\n\n" +
					"CREATE ICEBERG TABLE " + t + "\n  CATALOG = 'repoio_catalog'\n  CATALOG_TABLE_NAME = '" + t + "';";
			}
			vm.setProperty("/rc/fields", f);
			vm.setProperty("/rc/code", code);
			vm.setProperty("/rc/codeTitle", T("rc.code." + k));
			vm.setProperty("/rc/intro", T("rc.intro." + k));
		},
		onRcTab: function (oEvent) { this.store("repoio-rc-tab", oEvent.getParameter("key")); this._rcFill(); },
		_copy: function (s) {
			var that = this;
			try { navigator.clipboard.writeText(s).then(function () { MessageToast.show(that.text("api.t.copied")); }, function () { MessageToast.show(that.text("api.t.copyFail")); }); } catch (e) { MessageToast.show(this.text("api.t.copyFail")); }
		},
		onRcCopy: function (oEvent) { this._copy(oEvent.getSource().getBindingContext("view").getProperty("value")); },
		onRcCopyCode: function () { this._copy(this.viewModel().getProperty("/rc/code")); },
		onRcClose: function () { this.byId("repoConnDlg").close(); },
		onRcToken: function () {
			this.byId("repoConnDlg").close();
			this.store("repoio-api-tab", "tokens");
			this.router().navTo("apiManagement");
		}
	};
});
