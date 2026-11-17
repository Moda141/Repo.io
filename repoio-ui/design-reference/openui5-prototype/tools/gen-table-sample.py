#!/usr/bin/env python3
"""Generate webapp/model/tables.json: sample details for every source table of the Domain management catalog
(columns, associations, business purpose, data quality, sample rows and rows that fail a check).

Sample values only. In the product, columns and profiling come from OpenMetadata, quality from the Great Expectations
results and sample rows from the last profiling run, all read through the API with the caller's grants.
Also aligns the column counts in model/sample-data.json with the generated column lists.
Deterministic: the same input gives the same output."""
import json, random, os

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "..", "webapp", "model")
SAMPLE = os.path.join(WEB, "sample-data.json")
OUT = os.path.join(WEB, "tables.json")

# column: (technical, English label, Arabic label, data type, kind, key, notNull, PII, glossary term key)
C = lambda *a: a
SPECS = {
    "c4c.sales.customer": dict(
        en="Customer accounts from SAP C4C (BusinessPartner in the Customer role): the reference source for customer name, group and main contact data.",
        ar="حسابات العملاء من SAP C4C (كيان BusinessPartner بدور Customer): المصدر المعتمد لاسم العميل وتصنيفه وبيانات الاتصال الأساسية.",
        usage="dimension", storage="remote", delta=True,
        cols=[C("CustomerID", "Customer ID", "كود العميل", "String(10)", "id:C-00", True, True, False, "customerId"),
              C("CustomerName", "Customer name", "اسم العميل", "String(80)", "org", False, True, False, "customerName"),
              C("CustomerGroup", "Customer group", "مجموعة العملاء", "String(4)", "code:01,02,03", False, False, False, "customerGroup"),
              C("City", "City", "المدينة", "String(40)", "city", False, False, False, ""),
              C("Phone", "Phone", "الهاتف", "String(20)", "phone", False, True, True, ""),
              C("Email", "Email", "البريد الإلكتروني", "String(80)", "email", False, True, True, ""),
              C("TaxID", "Tax number", "الرقم الضريبي", "String(11)", "tax", False, False, False, "taxNumber"),
              C("Status", "Status", "الحالة", "String(2)", "code:A,B", False, True, False, "activeCustomer"),
              C("CreatedOn", "Created on", "تاريخ الإنشاء", "Date", "date", False, True, False, "")],
        assoc=[("to_Address", "c4c.sales.customer_address", "CustomerID = CustomerID"), ("to_Contacts", "c4c.sales.contact_person", "CustomerID = CustomerID"),
               ("to_SalesArea", "c4c.master.sales_area", "SalesOrg = SalesOrg")]),
    "c4c.sales.customer_address": dict(
        en="Postal addresses of C4C customers, one row per address and validity period.", ar="عناوين عملاء C4C، صف لكل عنوان وفترة صلاحية.",
        usage="relational", storage="remote", delta=True,
        cols=[C("AddressID", "Address ID", "كود العنوان", "String(10)", "id:AD-", True, True, False, ""),
              C("CustomerID", "Customer ID", "كود العميل", "String(10)", "id:C-00", False, True, False, "customerId"),
              C("Street", "Street", "الشارع", "String(60)", "street", False, False, True, ""),
              C("City", "City", "المدينة", "String(40)", "city", False, True, False, ""),
              C("Governorate", "Governorate", "المحافظة", "String(3)", "code:CAI,GIZ,ALX,DKH,AST", False, True, False, ""),
              C("PostalCode", "Postal code", "الرمز البريدي", "String(6)", "num:11511-61111", False, False, False, ""),
              C("ValidFrom", "Valid from", "صالح من", "Date", "date", False, True, False, "")],
        assoc=[("to_Customer", "c4c.sales.customer", "CustomerID = CustomerID")]),
    "c4c.sales.contact_person": dict(
        en="Contact people of customer accounts (owners, purchasing, accounting).", ar="جهات الاتصال لحسابات العملاء (المالك والمشتريات والحسابات).",
        usage="relational", storage="remote", delta=True,
        cols=[C("ContactID", "Contact ID", "كود جهة الاتصال", "String(10)", "id:CP-", True, True, False, ""),
              C("CustomerID", "Customer ID", "كود العميل", "String(10)", "id:C-00", False, True, False, "customerId"),
              C("FirstName", "First name", "الاسم الأول", "String(40)", "first", False, True, True, ""),
              C("LastName", "Last name", "اسم العائلة", "String(40)", "last", False, False, True, ""),
              C("Mobile", "Mobile", "الموبايل", "String(20)", "phone", False, True, True, ""),
              C("Email", "Email", "البريد الإلكتروني", "String(80)", "email", False, False, True, ""),
              C("Role", "Role", "الدور", "String(4)", "code:OWN,PUR,ACC", False, False, False, "")],
        assoc=[("to_Customer", "c4c.sales.customer", "CustomerID = CustomerID")]),
    "c4c.master.sales_area": dict(
        en="Sales organisation, distribution channel and division combinations used in C4C.", ar="تركيبات منظمة المبيعات وقناة التوزيع والقسم المستخدمة في C4C.",
        usage="text", storage="remote", delta=False,
        cols=[C("SalesOrg", "Sales organisation", "منظمة المبيعات", "String(4)", "code:1000,2000", True, True, False, ""),
              C("DistributionChannel", "Distribution channel", "قناة التوزيع", "String(2)", "code:10,20,30", True, True, False, ""),
              C("Division", "Division", "القسم", "String(2)", "code:01,02", True, True, False, ""),
              C("Description", "Description", "الوصف", "String(60)", "area", False, True, False, "")],
        assoc=[]),
    "c4c.master.territory": dict(
        en="Sales territories and their parent territory. Not used by a repository yet.", ar="مناطق البيع والمنطقة الأم. لسه مش مستخدم في أي مستودع.",
        usage="hierarchy", storage="remote", delta=False,
        cols=[C("TerritoryID", "Territory ID", "كود المنطقة", "String(8)", "code:CAI-N,CAI-S,GIZ-1,ALX-E,DKH-1", True, True, False, ""),
              C("Name", "Name", "الاسم", "String(40)", "area", False, True, False, ""),
              C("ParentID", "Parent territory", "المنطقة الأم", "String(8)", "code:CAI,GIZ,ALX,DKH", False, False, False, ""),
              C("Governorate", "Governorate", "المحافظة", "String(3)", "code:CAI,GIZ,ALX,DKH", False, True, False, ""),
              C("Manager", "Manager", "المسؤول", "String(40)", "person", False, False, True, "")],
        assoc=[("to_Parent", "c4c.master.territory", "ParentID = TerritoryID")]),
    "s4.sd.kna1": dict(
        en="General customer data in SAP S/4HANA (CDS view over KNA1).", ar="بيانات العميل العامة في SAP S/4HANA (CDS view على KNA1).",
        usage="dimension", storage="remote", delta=True,
        cols=[C("KUNNR", "Customer", "العميل", "String(10)", "id:00", True, True, False, "customerId"),
              C("NAME1", "Name", "الاسم", "String(35)", "org", False, True, False, "customerName"),
              C("ORT01", "City", "المدينة", "String(35)", "city", False, False, False, ""),
              C("REGIO", "Region", "المنطقة", "String(3)", "code:01,02,03,12", False, False, False, ""),
              C("TELF1", "Telephone", "التليفون", "String(16)", "phone", False, False, True, ""),
              C("STCD1", "Tax number 1", "الرقم الضريبي 1", "String(16)", "tax", False, False, False, "taxNumber"),
              C("KTOKD", "Account group", "مجموعة الحساب", "String(4)", "code:Z001,Z002,Z003", False, True, False, "customerGroup"),
              C("ERDAT", "Created on", "تاريخ الإنشاء", "Date", "date", False, True, False, "")],
        assoc=[("to_SalesData", "s4.sd.knvv", "KUNNR = KUNNR")]),
    "s4.sd.knvv": dict(
        en="Customer sales data per sales area in SAP S/4HANA (KNVV).", ar="بيانات مبيعات العميل لكل منطقة مبيعات في SAP S/4HANA (KNVV).",
        usage="relational", storage="remote", delta=True,
        cols=[C("KUNNR", "Customer", "العميل", "String(10)", "id:00", True, True, False, "customerId"),
              C("VKORG", "Sales organisation", "منظمة المبيعات", "String(4)", "code:1000,2000", True, True, False, ""),
              C("VTWEG", "Distribution channel", "قناة التوزيع", "String(2)", "code:10,20", True, True, False, ""),
              C("SPART", "Division", "القسم", "String(2)", "code:01,02", True, True, False, ""),
              C("KDGRP", "Customer group", "مجموعة العملاء", "String(2)", "code:01,02,03", False, False, False, "customerGroup"),
              C("ZTERM", "Payment terms", "شروط الدفع", "String(4)", "code:Z030,Z060,Z000", False, False, False, ""),
              C("WAERS", "Currency", "العملة", "String(5)", "code:EGP", False, True, False, "")],
        assoc=[("to_Customer", "s4.sd.kna1", "KUNNR = KUNNR")]),
    "s4.mm.mara": dict(
        en="General material data for books and products in SAP S/4HANA (MARA).", ar="بيانات المواد العامة للكتب والمنتجات في SAP S/4HANA (MARA).",
        usage="dimension", storage="remote", delta=True,
        cols=[C("MATNR", "Material", "المادة", "String(18)", "id:BK-", True, True, False, ""),
              C("MAKTX", "Description", "الوصف", "String(40)", "book", False, True, False, ""),
              C("MTART", "Material type", "نوع المادة", "String(4)", "code:FERT,HAWA", False, True, False, ""),
              C("MATKL", "Material group", "مجموعة المادة", "String(9)", "code:SCH-AR,SCH-EN,KIDS", False, False, False, ""),
              C("EAN11", "ISBN / EAN", "ISBN / EAN", "String(18)", "isbn", False, False, False, "isbn"),
              C("BRGEW", "Gross weight (kg)", "الوزن (كجم)", "Decimal(13,3)", "dec", False, False, False, ""),
              C("ERSDA", "Created on", "تاريخ الإنشاء", "Date", "date", False, True, False, "")],
        assoc=[]),
    "s4.mm.lfa1": dict(
        en="Vendor master data in SAP S/4HANA (LFA1): printers, paper suppliers and service vendors.", ar="بيانات الموردين في SAP S/4HANA (LFA1): المطابع وموردي الورق ومقدمي الخدمات.",
        usage="dimension", storage="remote", delta=True,
        cols=[C("LIFNR", "Vendor", "المورد", "String(10)", "id:V-", True, True, False, ""),
              C("NAME1", "Name", "الاسم", "String(35)", "org", False, True, False, ""),
              C("ORT01", "City", "المدينة", "String(35)", "city", False, False, False, ""),
              C("STCD1", "Tax number 1", "الرقم الضريبي 1", "String(16)", "tax", False, True, False, "taxNumber"),
              C("TELF1", "Telephone", "التليفون", "String(16)", "phone", False, False, True, ""),
              C("KTOKK", "Account group", "مجموعة الحساب", "String(4)", "code:PRNT,PAPR,SERV", False, True, False, ""),
              C("ERDAT", "Created on", "تاريخ الإنشاء", "Date", "date", False, True, False, "")],
        assoc=[]),
    "csv.uploads.school_list": dict(
        en="School list uploaded by the schools team for 2026.", ar="قائمة المدارس اللي رفعها فريق المدارس لسنة 2026.",
        usage="relational", storage="file", delta=False,
        cols=[C("school_code", "School code", "كود المدرسة", "String(10)", "id:SC-", True, True, False, ""),
              C("school_name", "School name", "اسم المدرسة", "String(80)", "school", False, True, False, ""),
              C("governorate", "Governorate", "المحافظة", "String(20)", "city", False, True, False, ""),
              C("stage", "Stage", "المرحلة", "String(12)", "code:primary,prep,secondary", False, False, False, ""),
              C("phone", "Phone", "الهاتف", "String(20)", "phone", False, False, True, ""),
              C("ministry_code", "Ministry code", "كود الوزارة", "String(8)", "num:10000000-99999999", False, False, False, "")],
        assoc=[]),
    "csv.uploads.new_customers": dict(
        en="New customers collected by the sales team in Q3, uploaded as a file.", ar="عملاء جدد جمعهم فريق المبيعات في الربع الثالث، اترفعوا كملف.",
        usage="relational", storage="file", delta=False,
        cols=[C("customer_ref", "Reference", "المرجع", "String(10)", "id:NC-", True, True, False, ""),
              C("name", "Name", "الاسم", "String(80)", "org", False, True, False, "customerName"),
              C("mobile", "Mobile", "الموبايل", "String(20)", "phone", False, True, True, ""),
              C("governorate", "Governorate", "المحافظة", "String(20)", "city", False, False, False, ""),
              C("customer_type", "Customer type", "نوع العميل", "String(2)", "code:01,02,03", False, True, False, "customerGroup"),
              C("created", "Created", "تاريخ الإدخال", "Date", "date", False, False, False, "")],
        assoc=[]),
    "csv.uploads.book_list": dict(
        en="Book list for 2026 with prices and availability, uploaded by the catalog team.", ar="قائمة كتب 2026 بالأسعار والإتاحة، رفعها فريق الكتالوج.",
        usage="relational", storage="file", delta=False,
        cols=[C("isbn", "ISBN", "ISBN", "String(17)", "isbn", True, True, False, "isbn"),
              C("title", "Title", "العنوان", "String(120)", "book", False, True, False, ""),
              C("subject", "Subject", "المادة", "String(20)", "code:math,science,arabic,english", False, False, False, ""),
              C("stage", "Stage", "المرحلة", "String(12)", "code:primary,prep,secondary", False, False, False, ""),
              C("price", "Price (EGP)", "السعر (جنيه)", "Decimal(9,2)", "price", False, True, False, ""),
              C("available", "Available", "متاح", "Boolean", "bool", False, False, False, "")],
        assoc=[]),
    "csv.uploads.digital_skus": dict(
        en="Digital products: e-books, apps and subscriptions.", ar="المنتجات الرقمية: كتب إلكترونية وتطبيقات واشتراكات.",
        usage="relational", storage="file", delta=False,
        cols=[C("sku", "SKU", "SKU", "String(12)", "id:DG-", True, True, False, ""),
              C("title", "Title", "العنوان", "String(120)", "book", False, True, False, ""),
              C("platform", "Platform", "المنصة", "String(10)", "code:ios,android,web", False, False, False, ""),
              C("price", "Price (EGP)", "السعر (جنيه)", "Decimal(9,2)", "price", False, False, False, ""),
              C("launch_date", "Launch date", "تاريخ الإطلاق", "Date", "date", False, False, False, "")],
        assoc=[]),
    "csv.uploads.authors_csv": dict(
        en="Archive of authors and rights holders.", ar="أرشيف المؤلفين وأصحاب الحقوق.",
        usage="relational", storage="file", delta=False,
        cols=[C("author_id", "Author ID", "كود المؤلف", "String(8)", "id:AU-", True, True, False, ""),
              C("name", "Name", "الاسم", "String(80)", "person", False, True, True, ""),
              C("national_id", "National ID", "الرقم القومي", "String(14)", "nid", False, False, True, ""),
              C("phone", "Phone", "الهاتف", "String(20)", "phone", False, False, True, ""),
              C("last_royalty", "Last royalty", "آخر حقوق", "Date", "date", False, False, False, "")],
        assoc=[]),
}

ORGS = ["مكتبة الشروق", "مدارس النيل الدولية", "دار المعارف للتوزيع", "مكتبة ديوان", "مكتبة الأجيال الجديدة", "دار المعرفة للنشر", "مدرسة الأورمان التجريبية",
        "مكتبة الأسرة", "شركة الأمل للأدوات المكتبية", "أكاديمية المستقبل", "مطبعة الهلال", "ورق مصر الحديثة"]
SCHOOLS = ["مدرسة النصر", "مدرسة طه حسين", "مدرسة الشهيد أحمد", "مدرسة المستقبل الخاصة", "مدرسة الحرية", "مدرسة السلام"]
CITIES = ["القاهرة", "الجيزة", "الإسكندرية", "المنصورة", "أسيوط", "طنطا", "الزقازيق"]
FIRST = ["أحمد", "منى", "محمود", "سارة", "كريم", "هبة", "يوسف", "إيمان"]
LAST = ["عادل", "فوزي", "سعيد", "ناصر", "عبد الله", "حسن", "شريف"]
BOOKS = ["الرياضيات للصف الرابع", "العلوم للصف الأول الإعدادي", "Gem English 5", "اللغة العربية للصف الثاني", "سلاح التلميذ رياضيات", "Kids Club Science"]
STREETS = ["شارع التحرير", "شارع الهرم", "طريق الحرية", "شارع الجمهورية", "شارع النصر"]
AREAS = ["القاهرة الشمالية", "الجيزة 1", "الإسكندرية الشرقية", "الدقهلية", "Direct sales Cairo", "Distributors"]


def value(kind, i, rnd):
    if kind.startswith("id:"):
        return kind[3:] + str(10000 + i * 137 + rnd.randint(0, 99)).zfill(6)
    if kind.startswith("code:"):
        opts = kind[5:].split(",")
        return opts[(i + rnd.randint(0, 3)) % len(opts)]
    if kind.startswith("num:"):
        lo, hi = map(int, kind[4:].split("-"))
        return str(rnd.randint(lo, hi))
    return {
        "org": lambda: ORGS[(i + rnd.randint(0, 4)) % len(ORGS)],
        "school": lambda: SCHOOLS[i % len(SCHOOLS)],
        "city": lambda: CITIES[(i * 3 + rnd.randint(0, 2)) % len(CITIES)],
        "phone": lambda: "01" + str(rnd.choice([0, 1, 2, 5])) + str(rnd.randint(10000000, 99999999)),
        "email": lambda: "info%d@example.com" % (100 + i),
        "tax": lambda: "%03d-%03d-%03d" % (rnd.randint(100, 999), rnd.randint(100, 999), rnd.randint(100, 999)),
        "date": lambda: "20%02d-%02d-%02d" % (rnd.randint(15, 26), rnd.randint(1, 12), rnd.randint(1, 28)),
        "street": lambda: "%d %s" % (rnd.randint(2, 90), STREETS[i % len(STREETS)]),
        "first": lambda: FIRST[i % len(FIRST)],
        "last": lambda: LAST[(i + 2) % len(LAST)],
        "person": lambda: FIRST[i % len(FIRST)] + " " + LAST[(i + 3) % len(LAST)],
        "area": lambda: AREAS[i % len(AREAS)],
        "book": lambda: BOOKS[i % len(BOOKS)],
        "isbn": lambda: "978-977-%02d-%04d-%d" % (rnd.randint(10, 99), rnd.randint(1000, 9999), rnd.randint(0, 9)),
        "dec": lambda: "%.3f" % rnd.uniform(0.1, 1.5),
        "price": lambda: "%.2f" % rnd.choice([45, 60, 75, 90, 120, 150]),
        "bool": lambda: rnd.choice(["true", "true", "false"]),
        "nid": lambda: str(rnd.randint(2, 3)) + str(rnd.randint(10 ** 12, 10 ** 13 - 1)),
    }[kind]()


def bad(kind, rnd):
    """A value that breaks the format check of the column."""
    return {"phone": "0" + str(rnd.randint(1000, 99999)), "email": "info@", "tax": str(rnd.randint(1000, 99999)),
            "isbn": "978-" + str(rnd.randint(100, 999)), "nid": str(rnd.randint(1000, 99999))}.get(kind)


TERMS = {"customerId": ("Customer ID", "معرّف العميل"), "customerName": ("Customer name", "اسم العميل"), "customerGroup": ("Customer group", "التصنيف التجاري"),
         "taxNumber": ("Tax number", "الرقم الضريبي"), "activeCustomer": ("Active customer", "عميل نشط"), "isbn": ("ISBN", "ISBN")}
FORMAT = {"phone": ("Egyptian phone format", "صيغة رقم مصري"), "email": ("Valid email address", "بريد إلكتروني صحيح"), "tax": ("Tax number ###-###-###", "رقم ضريبي ###-###-###"),
          "isbn": ("Valid ISBN-13", "ISBN-13 صحيح"), "nid": ("14-digit national ID", "رقم قومي 14 رقم")}
DIMS = [("accuracy", 30), ("completeness", 25), ("validity", 20), ("timeliness", 15), ("uniqueness", 10)]
OWNERS = {"c4c": ("محمد", "سارة عادل"), "s4": ("كريم فوزي", "إيمان سعيد"), "csv": ("سارة عادل", "طارق عبد الله")}


def build():
    data = json.load(open(SAMPLE, encoding="utf-8"))
    out, repos = {}, data["repos"]
    for sid, src in data["sources"].items():
        for t in src["tables"]:
            key = "%s.%s.%s" % (sid, t["schema"], t["id"])
            sp = SPECS[key]
            rnd = random.Random(key)
            t["cols"] = len(sp["cols"])
            rows, q = t["rows"], t["quality"]
            cols = []
            for (tech, en, ar, dtype, kind, isKey, notNull, pii, term) in sp["cols"]:
                if isKey:
                    null = 0.0
                elif kind in ("email",):
                    null = round(rnd.uniform(20, 38), 1)
                elif kind in ("phone", "tax", "nid", "street"):
                    null = round(rnd.uniform(3, 29), 1)
                else:
                    null = round(rnd.choice([0, 0, 0.1, 0.4, 1.2, 6.2]), 1)
                use = [{"repoId": u["id"], "repo": u["name"]} for u in t["usedIn"]]
                cols.append({"name": tech, "en": en, "ar": ar, "type": dtype, "key": isKey, "notNull": notNull, "pii": pii,
                             "term": term, "termEn": TERMS.get(term, ("", ""))[0], "termAr": TERMS.get(term, ("", ""))[1],
                             "nullPct": null, "kind": kind.split(":")[0], "usedIn": use})
            # quality tests: unique key, not null on required columns, formats, freshness
            tests = []
            keyc = [c for c in cols if c["key"]]
            tests.append({"key": "unique", "column": "+".join(c["name"] for c in keyc), "en": "No duplicate key", "ar": "مفيش مفتاح مكرر", "failed": 0 if q > 85 else rnd.randint(3, 40)})
            for c in cols:
                if c["notNull"] and not c["key"]:
                    f = int(rows * c["nullPct"] / 100)
                    tests.append({"key": "notNull", "column": c["name"], "en": "%s is not empty" % c["en"], "ar": "%s مش فاضي" % c["ar"], "failed": f})
                if c["kind"] in FORMAT:
                    f = int(rows * rnd.uniform(0.001, 0.009))
                    tests.append({"key": "format", "column": c["name"], "en": FORMAT[c["kind"]][0], "ar": FORMAT[c["kind"]][1], "failed": f})
            tests.append({"key": "fresh", "column": "", "en": "Refreshed in the last 24 hours", "ar": "اتحدّث في آخر 24 ساعة", "failed": 0 if sid != "csv" else -1})
            for x in tests:
                x["result"] = "pass" if x["failed"] == 0 else "warn" if x["failed"] == -1 or x["failed"] < rows * 0.01 else "fail"
                x["pct"] = round(max(x["failed"], 0) / rows * 100, 1) if x["failed"] > 0 else 0
                x["date"] = t["profiled"]
            # dimensions around the table score, weighted sum = score
            vals = [min(99.9, max(40, q + rnd.uniform(-9, 9))) for _ in DIMS]
            shift = (q * 100 - sum(v * w for v, (_, w) in zip(vals, DIMS))) / 100
            vals = [round(min(99.9, max(40, v + shift)), 1) for v in vals]
            dims = [{"key": k, "weight": w, "value": v} for (k, w), v in zip(DIMS, vals)]
            trend = [round(q + rnd.uniform(-1.5, 2.5) - i * 0.15, 1) for i in range(8)][::-1]
            trend[-1] = q
            # sample rows: 12 good rows and 3 rows that fail a check
            sample, errors = [], []
            for i in range(15):
                row = {c["name"]: value(sp["cols"][j][4], i, rnd) for j, c in enumerate(cols)}
                if i >= 12:
                    fc = [c for c in cols if c["kind"] in FORMAT] or [c for c in cols if c["notNull"] and not c["key"]]
                    c = fc[(i - 12) % len(fc)] if fc else None
                    if c is not None:
                        b = bad(c["kind"], rnd) if c["kind"] in FORMAT else None
                        row[c["name"]] = b
                        rule = next((x for x in tests if x["column"] == c["name"] and x["key"] == ("format" if b is not None else "notNull")), None)
                        errors.append({"row": row, "column": c["name"], "en": rule["en"] if rule else "", "ar": rule["ar"] if rule else ""})
                        continue
                for c in cols:
                    if not c["key"] and c["nullPct"] > 15 and rnd.random() < c["nullPct"] / 100:
                        row[c["name"]] = None
                sample.append(row)
            assoc = [{"name": n, "target": tk, "on": on} for (n, tk, on) in sp["assoc"]]
            ow = OWNERS[sid]
            pii = any(c["pii"] for c in cols)
            out[key] = {
                "descEn": sp["en"], "descAr": sp["ar"], "usage": sp["usage"], "storage": sp["storage"], "delta": sp["delta"],
                "deltaTable": (t["id"].upper() + "_Delta") if sp["delta"] else "", "owner": ow[0], "steward": ow[1],
                "sensitivity": "confidential" if pii else "internal", "retention": "7y" if sid != "csv" else "2y",
                "terms": sorted({c["term"] for c in cols if c["term"]}), "columns": cols, "associations": assoc,
                "tests": tests, "dims": dims, "trend": trend, "sample": sample, "errors": errors, "descUpdated": "2026-10-20"}
    open(SAMPLE, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=1))
    payload = {"_comment": "Generated by tools/gen-table-sample.py. Sample values only: in the product, columns and profiling come from OpenMetadata, quality from Great Expectations results and sample rows from the last profiling run, read through the API with the caller's grants.",
               "terms": {k: {"en": v[0], "ar": v[1]} for k, v in TERMS.items()}, "tables": out}
    json.dump(payload, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent="\t")
    open(OUT, "a").write("\n")
    print("tables:", len(out))


if __name__ == "__main__":
    build()
