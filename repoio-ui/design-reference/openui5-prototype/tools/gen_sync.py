"""Sample data for the Data sync prototype pages (model/sync.json)."""
import json, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'webapp', 'model', 'sync.json')

def F(name, type_="string", key=False, req=False, codeList=False, label=None):
    return dict(name=name, type=type_, key=key, req=req, codeList=codeList, label=label or name)

# Target entity fields (from the repository's model version; read-only here).
ENT = {
 "customer": [F("source_key", key=True, req=True), F("name", req=True), F("name_ar"), F("tax_id"), F("business_line", codeList=True, req=True),
              F("region", codeList=True), F("city"), F("phone"), F("email"), F("sales_org", codeList=True), F("status", codeList=True), F("changed_at", "date")],
 "customer_address": [F("source_key", key=True, req=True), F("address_type", codeList=True, req=True), F("street"), F("city", req=True), F("governorate", codeList=True), F("postal_code"), F("country", codeList=True)],
 "customer_contact": [F("source_key", key=True, req=True), F("first_name"), F("last_name", req=True), F("role", codeList=True), F("phone"), F("email")],
 "vendor": [F("source_key", key=True, req=True), F("name", req=True), F("name_ar"), F("tax_id", req=True), F("country", codeList=True), F("city"), F("payment_terms", codeList=True), F("status", codeList=True)],
 "product": [F("source_key", key=True, req=True), F("isbn", req=True), F("title", req=True), F("title_ar"), F("series"), F("edition", "integer"), F("author_ref"), F("list_price", "decimal"), F("status", codeList=True)],
 "author": [F("source_key", key=True, req=True), F("name", req=True), F("name_ar"), F("pen_name"), F("nationality", codeList=True), F("contract_status", codeList=True)],
}
SRC = {
 "customer": [("AccountID", "Account ID", "string", True), ("Name", "Name", "string"), ("AdditionalName", "Additional name", "string"), ("TaxNumber", "Tax number", "string"),
              ("RoleCode", "Role", "code"), ("IndustryCode", "Industry", "code"), ("SalesTerritoryID", "Territory", "code"), ("City", "City", "string"), ("Phone", "Phone", "string"),
              ("Email", "E-mail", "string"), ("SalesOrganisationID", "Sales organisation", "code"), ("LifeCycleStatusCode", "Status", "code"), ("LastChangeDateTime", "Last changed", "date"), ("CreatedBy", "Created by", "string")],
 "customer_address": [("AccountID", "Account ID", "string", True), ("AddressUsageCode", "Address usage", "code"), ("StreetName", "Street", "string"), ("City", "City", "string"),
              ("RegionCode", "Region", "code"), ("PostalCode", "Postal code", "string"), ("CountryCode", "Country", "code"), ("LastChangeDateTime", "Last changed", "date")],
 "contact_person": [("ContactID", "Contact ID", "string", True), ("FirstName", "First name", "string"), ("LastName", "Last name", "string"), ("JobTitle", "Job title", "string"),
              ("ContactFunctionCode", "Function", "code"), ("Phone", "Phone", "string"), ("Email", "E-mail", "string"), ("LastChangeDateTime", "Last changed", "date")],
 "kna1": [("KUNNR", "Customer", "string", True), ("NAME1", "Name 1", "string"), ("NAME2", "Name 2", "string"), ("STCD1", "Tax number 1", "string"), ("KTOKD", "Account group", "code"),
              ("ORT01", "City", "string"), ("REGIO", "Region", "code"), ("TELF1", "Telephone", "string"), ("LOEVM", "Deletion flag", "code"), ("AEDAT", "Changed on", "date")],
 "knvv": [("KUNNR", "Customer", "string", True), ("VKORG", "Sales org.", "code"), ("VTWEG", "Distribution channel", "code"), ("SPART", "Division", "code"), ("KDGRP", "Customer group", "code"), ("AUFSD", "Order block", "code")],
 "lfa1": [("LIFNR", "Supplier", "string", True), ("NAME1", "Name 1", "string"), ("NAME2", "Name 2", "string"), ("STCD1", "Tax number 1", "string"), ("LAND1", "Country", "code"),
              ("ORT01", "City", "string"), ("ZTERM", "Payment terms", "code"), ("SPERR", "Posting block", "code"), ("ERDAT", "Created on", "date")],
 "mara": [("MATNR", "Material", "string", True), ("EAN11", "EAN / ISBN", "string"), ("MAKTX", "Description", "string"), ("MATKL", "Material group", "code"), ("ZZSERIES", "Series", "string"),
              ("ZZEDITION", "Edition", "integer"), ("ZZAUTHOR", "Author no.", "string"), ("MSTAE", "Status", "code"), ("LAEDA", "Last change", "date")],
 "school_list": [("school_code", "School code", "string", True), ("school_name", "School name", "string"), ("school_name_ar", "School name (Arabic)", "string"), ("governorate", "Governorate", "code"),
              ("city", "City", "string"), ("phone", "Phone", "string"), ("email", "E-mail", "string"), ("segment", "Segment", "code")],
 "authors_csv": [("author_no", "Author no.", "string", True), ("full_name", "Full name", "string"), ("full_name_ar", "Full name (Arabic)", "string"), ("pen_name", "Pen name", "string"),
              ("nationality", "Nationality", "code"), ("contract", "Contract", "code")],
 "dbo.Titles": [("TitleID", "Title ID", "integer", True), ("ISBN13", "ISBN-13", "string"), ("TitleEn", "Title (English)", "string"), ("TitleAr", "Title (Arabic)", "string"),
              ("SeriesName", "Series", "string"), ("ListPrice", "List price", "decimal"), ("ModifiedOn", "Modified on", "date")],
 "dbo.Editions": [("EditionID", "Edition ID", "integer", True), ("TitleID", "Title ID", "integer"), ("EditionNo", "Edition no.", "integer"), ("PrintYear", "Print year", "integer"), ("ModifiedOn", "Modified on", "date")],
}
def src(t): return [dict(name=c[0], label=c[1], type=c[2], key=len(c) > 3 and c[3]) for c in SRC[t]]

def obj(table, entity, mapping, load="delta", filters=None, last=None, rows=None):
    return dict(id=table, source=table, entity=entity, load=load, truncate=False, projection=True, filters=filters or [], mapping=mapping, last=last or {}, rows=rows)

M_CUST_C4C = {"source_key": "AccountID", "name": "Name", "name_ar": "AdditionalName", "tax_id": "TaxNumber", "business_line": "IndustryCode", "region": "SalesTerritoryID",
              "city": "City", "phone": "Phone", "email": "Email", "sales_org": "SalesOrganisationID", "status": "LifeCycleStatusCode", "changed_at": "LastChangeDateTime"}
flows = [
 dict(id="SYNC_C4C_CUSTOMER", en="C4C customers to Customer Master", ar="عملاء C4C إلى Customer Master", conn="C4C_PROD", container="c4codataapi", repo="customer-master",
      status="deployed", interval="15m", owner="محمد", changed="2026-11-08 10:40", job="c4c_customer_pull", lastRun="2026-11-10 12:15", lastState="succeeded",
      objects=[obj("customer", "customer", M_CUST_C4C, filters=[{"col": "RoleCode", "op": "in", "val": "CRM000, BUP002"}], last={"initial": 951247, "delta": 1204}, rows=951247),
               obj("customer_address", "customer_address", {"source_key": "AccountID", "address_type": "AddressUsageCode", "street": "StreetName", "city": "City", "governorate": "RegionCode", "postal_code": "PostalCode", "country": "CountryCode"},
                   last={"initial": 1204511, "delta": 388}, rows=1204511),
               obj("contact_person", "customer_contact", {"source_key": "ContactID", "first_name": "FirstName", "last_name": "LastName", "role": "ContactFunctionCode", "phone": "Phone", "email": "Email"},
                   last={"initial": 310882, "delta": 95}, rows=310882)]),
 dict(id="SYNC_S4_CUSTOMER", en="S/4HANA customers to Customer Master", ar="عملاء S/4HANA إلى Customer Master", conn="S4_HANA", container="SAPHANADB", repo="customer-master",
      status="deployed", interval="1h", owner="كريم فوزي", changed="2026-11-02 09:12", job="", lastRun="2026-11-10 12:00", lastState="succeededWithFailures",
      objects=[obj("kna1", "customer", {"source_key": "KUNNR", "name": "NAME1", "name_ar": "NAME2", "tax_id": "STCD1", "business_line": "KTOKD", "region": "REGIO", "city": "ORT01", "phone": "TELF1", "status": "LOEVM", "changed_at": "AEDAT"},
                   filters=[{"col": "KTOKD", "op": "notIn", "val": "ZONE, CPD"}], last={"initial": 402118, "delta": 512, "rejected": 37}, rows=402118)]),
 dict(id="SYNC_S4_VENDOR", en="S/4HANA suppliers to Vendor Master", ar="موردو S/4HANA إلى Vendor Master", conn="S4_HANA", container="SAPHANADB", repo="vendor-master",
      status="deployed", interval="1h", owner="هالة سمير", changed="2026-10-30 14:05", job="erp_vendor_pull", lastRun="2026-11-10 11:00", lastState="failed",
      objects=[obj("lfa1", "vendor", {"source_key": "LIFNR", "name": "NAME1", "name_ar": "NAME2", "tax_id": "STCD1", "country": "LAND1", "city": "ORT01", "payment_terms": "ZTERM", "status": "SPERR"},
                   last={"initial": 3120, "delta": 0}, rows=3120)]),
 dict(id="SYNC_S4_BOOKS", en="S/4HANA materials to Book catalogue", ar="مواد S/4HANA إلى كتالوج الكتب", conn="S4_HANA", container="SAPHANADB", repo="catalog",
      status="deployed", interval="daily", at="01:30", owner="كريم فوزي", changed="2026-10-25 08:50", job="", lastRun="2026-11-10 01:30", lastState="succeeded",
      objects=[obj("mara", "product", {"source_key": "MATNR", "isbn": "EAN11", "title": "MAKTX", "series": "ZZSERIES", "edition": "ZZEDITION", "author_ref": "ZZAUTHOR", "status": "MSTAE"},
                   filters=[{"col": "MATKL", "op": "in", "val": "BOOK, EBOOK"}], last={"initial": 26340, "delta": 41}, rows=26340)]),
 dict(id="SYNC_FILE_SCHOOLS", en="School list uploads", ar="رفع قوائم المدارس", conn="FILE_UPLOADS", container="/uploads/schools", repo="schools",
      status="deployed", interval="upload", owner="سارة عادل", changed="2026-10-19 12:30", job="", lastRun="2026-11-06 09:41", lastState="succeeded",
      objects=[obj("school_list", "customer", {"source_key": "school_code", "name": "school_name", "name_ar": "school_name_ar", "region": "governorate", "city": "city", "phone": "phone", "email": "email", "business_line": "segment"},
                   load="initial", last={"initial": 4210}, rows=4210)]),
 dict(id="SYNC_FILE_AUTHORS", en="Author sheet uploads", ar="رفع ملفات المؤلفين", conn="FILE_UPLOADS", container="/uploads/authors", repo="authors",
      status="deployed", interval="upload", owner="نور الدين", changed="2026-10-12 10:05", job="author_sheet_push", lastRun="2026-11-09 16:20", lastState="succeeded",
      objects=[obj("authors_csv", "author", {"source_key": "author_no", "name": "full_name", "name_ar": "full_name_ar", "pen_name": "pen_name", "nationality": "nationality", "contract_status": "contract"},
                   load="initial", last={"initial": 1875}, rows=1875)]),
 dict(id="SYNC_SQL_TITLES", en="Legacy sales titles to Book catalogue", ar="عناوين نظام المبيعات القديم إلى كتالوج الكتب", conn="SQL_LEGACY_SALES", container="dbo", repo="catalog",
      status="draft", interval="daily", at="02:00", owner="محمد", changed="2026-11-10 17:20", job="", lastRun="", lastState="",
      objects=[obj("dbo.Titles", "product", {"source_key": "TitleID", "isbn": "ISBN13", "title": "TitleEn", "title_ar": "TitleAr", "series": "SeriesName", "list_price": "ListPrice"}, rows=18420),
               obj("dbo.Editions", "product", {"source_key": "TitleID", "edition": "EditionNo"}, rows=29115)]),
 dict(id="SYNC_C4C_SCHOOLS", en="C4C school accounts", ar="حسابات المدارس من C4C", conn="C4C_PROD", container="c4codataapi", repo="schools",
      status="changed", interval="1h", owner="سارة عادل", changed="2026-11-09 15:02", job="", lastRun="2026-11-10 12:00", lastState="succeeded",
      objects=[obj("customer", "customer", {"source_key": "AccountID", "name": "Name", "name_ar": "AdditionalName", "city": "City", "phone": "Phone", "email": "Email", "status": "LifeCycleStatusCode"},
                   filters=[{"col": "RoleCode", "op": "eq", "val": "Z_SCHOOL"}], last={"initial": 3980, "delta": 12}, rows=3980)]),
]
# Source objects available per connection container (for "Add source objects").
catalog = {
 "C4C_PROD": ["customer", "customer_address", "contact_person"],
 "S4_HANA": ["kna1", "knvv", "lfa1", "mara"],
 "FILE_UPLOADS": ["school_list", "authors_csv"],
 "SQL_LEGACY_SALES": ["dbo.Titles", "dbo.Editions"],
}
containers = {
 "C4C_PROD": [["c4codataapi", "OData service · customers, contacts"], ["c4codata/marketing", "OData service · marketing"]],
 "S4_HANA": [["SAPHANADB", "Database schema · ERP tables"], ["CDS", "CDS views"]],
 "SQL_LEGACY_SALES": [["dbo", "Schema · sales"], ["archive", "Schema · archive"]],
 "FILE_UPLOADS": [["/uploads/schools", "Folder"], ["/uploads/authors", "Folder"], ["/uploads/customers", "Folder"]],
}
ent_of_domain = {"customers": ["customer", "customer_address", "customer_contact"], "vendors": ["vendor"], "products": ["product"], "authors": ["author"]}
json.dump(dict(flows=flows, source=dict((k, src(k)) for k in SRC), entities=ENT, catalog=catalog, containers=containers, entitiesByDomain=ent_of_domain),
          open(OUT, "w"), ensure_ascii=False, indent=1)
print(len(flows))
