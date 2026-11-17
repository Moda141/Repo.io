import json, random, sys
random.seed(11)
out = sys.argv[1]
FIRST = ["أحمد","محمد","محمود","مصطفى","خالد","يوسف","عمر","حسن","إبراهيم","كريم","منى","مريم","سلمى","هالة","نور","فاطمة","سارة","ياسمين","هدى","رانيا"]
MID = ["محمود","عبد الرحمن","إبراهيم","حسن","علي","عبد العزيز","سيد","فتحي","أحمد","مصطفى"]
LAST = ["السيد","خليل","سالم","عبد الله","فتحي","النجار","الشريف","حسين","منصور","عطية"]
STORES = ["مكتبة الشروق","مكتبة النور الحديثة","مكتبة الأمل","مكتبة دار المعارف","مكتبة الفجر","مكتبة السلام","مكتبة المستقبل","مكتبة الرواد"]
GOV = [("01","القاهرة"),("02","الجيزة"),("03","الإسكندرية"),("12","الدقهلية"),("13","الشرقية"),("25","أسيوط"),("26","سوهاج"),("24","المنيا")]
TERR = {"01":["CAI-N","CAI-E","CAI-W"],"02":["GIZ-H","GIZ-D","GIZ-6O"],"03":["ALX-E","ALX-W"],"12":["DAK-M"],"13":["SHR-Z"],"25":["ASY-C"],"26":["SOH-C"],"24":["MIN-C"]}
SEGS = [("teacher","01",0.46),("retailer","02",0.12),("callCenter","03",0.22),("student","03-1",0.15),("charityStudent","03-2",0.05)]
SUBJ = ["رياضيات","علوم","لغة عربية","لغة إنجليزية","دراسات اجتماعية","فيزياء","كيمياء"]
STAGES = ["ابتدائي","إعدادي","ثانوي"]
STEWARDS = ["سارة عادل","أحمد ناصر","هالة سمير","كريم فؤاد"]
SRC = {"c4c": ("SAP C4C", "sales.Customer"), "s4": ("SAP S/4HANA", "I_Customer"), "csv": ("رفع ملفات CSV", "teachers_2026.xlsx")}

def mob():
    return random.choice(["010","011","012","015"]) + "".join(random.choice("0123456789") for _ in range(8))

def pick_seg():
    r = random.random(); a = 0
    for s in SEGS:
        a += s[2]
        if r <= a: return s
    return SEGS[0]

fixed = {
    "GR-C-004512": ("teacher", "أحمد محمود السيد", "02", ["01001234567","01122334455"]),
    "GR-C-007731": ("callCenter", "خالد ابراهيم فتحي", "01", ["01555987654"]),
    "GR-C-010220": ("student", "مريم أحمد علي", "13", ["01011112222"]),
    "GR-C-008804": ("teacher", "محمد عبدالعزيز سالم", "02", ["01077889900"]),
    "GR-C-002217": ("retailer", "مكتبه الامل", "01", ["0225551111", "01099001122"]),
    "GR-C-000184": ("retailer", "مكتبة الشروق", "01", ["0223334444", "01233445566"]),
}
ids = list(fixed.keys())
while len(ids) < 64:
    i = "GR-C-%06d" % random.randint(1000, 950000)
    if i not in ids: ids.append(i)
ids.sort()

rows, details = [], {}
for n, gid in enumerate(ids):
    if gid in fixed:
        segk, name, gov, phones = fixed[gid]
        seg = [s for s in SEGS if s[0] == segk][0]
    else:
        seg = pick_seg()
        name = random.choice(STORES) if seg[0] == "retailer" else " ".join([random.choice(FIRST), random.choice(MID), random.choice(LAST)])
        gov = random.choice(GOV)[0]
        phones = [mob()] + ([mob()] if random.random() < 0.4 else [])
    govname = dict(GOV)[gov]
    terr = random.choice(TERR[gov])
    srcs = ["c4c"] + (["s4"] if random.random() < 0.55 or seg[0] == "retailer" else []) + (["csv"] if seg[0] == "teacher" and random.random() < 0.5 else [])
    if gid == "GR-C-004512": srcs = ["c4c", "s4", "csv"]
    q = round(random.uniform(72, 99), 1)
    status = "review" if random.random() < 0.08 else "openCr" if random.random() < 0.12 else "unchanged"
    if gid == "GR-C-007731": status = "review"
    if gid == "GR-C-004512": status = "openCr"
    day = random.randint(1, 15); mon = random.choice([9, 10, 11]) if day > 0 else 11
    changed = "2026-%02d-%02d" % (mon, min(day, 16 if mon == 11 else 28))
    by = random.choice(STEWARDS)
    acct = seg[1]
    vals = {
        "name": name, "account_type": acct, "mobile_1": phones[0], "mobile_2": phones[1] if len(phones) > 1 else "",
        "mobile_3": "", "phone": phones[1] if seg[0] == "retailer" and len(phones) > 1 else "", "whatsapp": phones[0] if random.random() < 0.6 else "",
        "contact_mobile": mob() if seg[0] == "retailer" else "", "email": "", "state_id": gov, "main_territory_id": terr,
        "territory_1_id": terr if random.random() < 0.5 else "", "territory_2_id": "", "sales_district": "SD-" + gov,
        "final_stages": "، ".join(random.sample(STAGES, random.randint(1, 2))) if seg[0] == "teacher" else "",
        "final_subject": random.choice(SUBJ) if seg[0] == "teacher" else "",
        "promotion_group": "دروس ومدارس" if seg[0] == "teacher" else "", "classification_group": random.choice(["مدرس", "موجّه"]) if seg[0] == "teacher" else "",
        "parent_name": " ".join([random.choice(FIRST[:10]), random.choice(LAST)]) if seg[0] in ("student", "charityStudent") else "",
        "national_id": ("30%d…%04d" % (random.randint(10, 99), random.randint(1000, 9999))) if seg[0] == "charityStudent" else "",
        "linked_account_id": "ACC-%05d" % random.randint(10000, 99999) if seg[0] == "charityStudent" else "",
        "wholesaler_id": "", "distributor_id": "DST-%03d" % random.randint(100, 999) if seg[0] == "retailer" else ""}
    if gid == "GR-C-010220": vals["parent_name"] = "أحمد علي"
    if gid == "GR-C-004512":
        vals.update({"email": "ahmed.m@example.com", "final_stages": "إعدادي، ثانوي", "final_subject": "رياضيات", "national_id": "2850…1187",
                     "state_id": "02", "main_territory_id": "GIZ-H", "territory_1_id": "GIZ-D", "whatsapp": "01001234567"})
    rows.append({"id": gid, "name": name, "segment": seg[0], "accountType": acct, "mobile": phones[0], "state": gov, "stateName": govname,
                 "territory": vals["main_territory_id"], "sources": srcs, "quality": q, "prob": round(random.uniform(0.9, 0.995), 3),
                 "status": status, "changed": changed, "changedBy": by, "since": "2025-%02d-%02d" % (random.randint(1, 12), random.randint(1, 28))})
    # detail
    rule = {"name": "sourcePriority", "email": "recent", "final_stages": "union", "contact_mobile": "recent", "parent_name": "complete", "final_subject": "frequent"}
    group = {c: "address" for c in ["state_id", "main_territory_id", "territory_1_id", "territory_2_id", "sales_district"]}
    group.update({c: "phones" for c in ["mobile_1", "mobile_2", "mobile_3", "phone", "whatsapp"]})
    prov = []
    for c, v in vals.items():
        if not v: continue
        win = srcs[0] if rule.get(c, "sourcePriority") == "sourcePriority" else random.choice(srcs)
        if c == "email" and "s4" in srcs: win = "s4"
        if c == "national_id" and "csv" in srcs: win = "csv"
        prov.append({"col": c, "value": v, "source": win, "rule": group.get(c) and ("group:" + group[c]) or rule.get(c, "sourcePriority"),
                     "version": "4", "at": changed, "locked": (c == "name" and gid == "GR-C-000184"), "candidates": len(srcs)})
    srows = []
    for s in srcs:
        sv = dict(vals)
        if s == "s4": sv["name"] = name.replace("أ", "ا").replace("إ", "ا"); sv["mobile_1"] = phones[0][:-1] if gid == "GR-C-004512" else phones[0]
        if s == "csv": sv["name"] = " ".join(name.split()[:2])
        srows.append({"source": s, "table": SRC[s][1], "key": {"c4c": "100%06d" % random.randint(0, 999999), "s4": "%010d" % random.randint(1, 9999999),
                      "csv": "row %d" % random.randint(2, 4000)}[s], "prob": 1.0 if s == srcs[0] else round(random.uniform(0.88, 0.99), 2),
                      "synced": "2026-11-%02d %02d:00" % (random.randint(10, 16), random.choice([1, 2, 6])), "values": sv})
    hist = []
    for k in range(random.randint(3, 7)):
        c = random.choice([p["col"] for p in prov])
        hist.append({"at": "2026-%02d-%02d %02d:%02d" % (random.randint(6, 11), random.randint(1, 28), random.randint(0, 23), random.randint(0, 59)),
                     "col": c, "old": "" if random.random() < 0.3 else (vals[c][:-1] + "…" if vals[c] else ""), "new": vals[c],
                     "source": random.choice(srcs), "rule": rule.get(c, "sourcePriority"), "version": random.choice(["3", "4"]),
                     "cr": "CR-2026-%04d" % random.randint(100, 590) if random.random() < 0.4 else ""})
    hist.sort(key=lambda h: h["at"], reverse=True)
    hist.append({"at": rows[-1]["since"] + " 02:06", "col": "*", "old": "", "new": "", "source": srcs[0], "rule": "create", "version": "1", "cr": ""})
    rel = []
    if seg[0] in ("student", "charityStudent"):
        rel.append({"type": "child_of", "target": "GR-C-%06d" % random.randint(1000, 950000), "targetName": vals["parent_name"], "since": rows[-1]["since"]})
    if seg[0] == "charityStudent":
        rel.append({"type": "member_of", "target": vals["linked_account_id"], "targetName": "جمعية رعاية الطلاب", "since": rows[-1]["since"]})
    if seg[0] == "retailer":
        rel.append({"type": "supplied_by", "target": vals["distributor_id"], "targetName": "شركة التوزيع المتحدة", "since": rows[-1]["since"]})
    if seg[0] == "teacher":
        rel.append({"type": "teaches_at", "target": "GR-S-%05d" % random.randint(1000, 30000), "targetName": "مدرسة " + random.choice(["النيل", "الحرية", "طه حسين"]) + " " + random.choice(STAGES), "since": rows[-1]["since"]})
    if len(srcs) > 1:
        rel.append({"type": "same_as", "target": srcs[1].upper() + ":" + srows[1]["key"], "targetName": SRC[srcs[1]][0], "since": rows[-1]["since"]})
    dq = [{"key": "phone_format", "ok": True}, {"key": "governorate_ref", "ok": True}, {"key": "name_present", "ok": True},
          {"key": "territory_ref", "ok": random.random() > 0.15}, {"key": "email_format", "ok": not vals["email"] or random.random() > 0.1}]
    if seg[0] == "charityStudent": dq.append({"key": "national_id_check", "ok": random.random() > 0.2})
    if gid == "GR-C-004512": dq[3]["ok"] = True
    reqs = []
    if status == "openCr":
        reqs.append({"id": "CR-2026-%04d" % random.randint(600, 700), "template": "TPL_CUSTOMER_CHANGE", "what": random.choice(["mobile_2", "main_territory_id", "email"]),
                     "by": random.choice(STEWARDS), "at": "2026-11-%02d" % random.randint(10, 16), "step": random.choice(["approval", "writeBack"])})
    review = None
    if status == "review":
        review = {"pair": "GR-C-%06d" % random.randint(1000, 950000), "prob": round(random.uniform(0.81, 0.94), 2), "since": "2026-11-%02d" % random.randint(10, 16)}
    details[gid] = {"prov": prov, "sourceRows": srows, "history": hist, "relationships": rel, "dq": dq, "requests": reqs, "review": review}

lineage = {
 "repo": "customer-master",
 "nodes": [
  {"key": "c4c_customer", "level": -3, "type": "table", "system": "c4c", "path": ["SAP C4C", "sales"], "name": "Customer", "dq": "ok",
   "cols": [["CustomerID", "text"], ["Name", "text"], ["Mobile", "text"], ["Mobile2", "text"], ["Phone", "text"], ["WhatsApp", "text"], ["Email", "text"],
            ["AccountType", "code"], ["StateID", "code"], ["MainTerritoryID", "code"], ["Territory1ID", "code"], ["FinalStages", "text"], ["FinalSubject", "code"],
            ["ParentName", "text"], ["NationalID", "text"], ["LinkedAccountID", "code"], ["ChangedOn", "date"]]},
  {"key": "c4c_address", "level": -3, "type": "table", "system": "c4c", "path": ["SAP C4C", "sales"], "name": "CustomerAddress", "dq": "warn",
   "cols": [["AddressID", "text"], ["CustomerID", "text"], ["StateID", "code"], ["City", "text"], ["Street", "text"], ["SalesDistrict", "code"]]},
  {"key": "s4_customer", "level": -3, "type": "view", "system": "s4", "path": ["SAP S/4HANA", "CDS"], "name": "I_Customer", "dq": "ok",
   "cols": [["Customer", "text"], ["OrganizationBPName1", "text"], ["MobilePhoneNumber", "text"], ["PhoneNumber", "text"], ["EmailAddress", "text"],
            ["Region", "code"], ["CustomerAccountGroup", "code"], ["LastChangeDateTime", "date"]]},
  {"key": "csv_teachers", "level": -3, "type": "file", "system": "csv", "path": ["File upload", "teachers"], "name": "teachers_2026.xlsx", "dq": "warn",
   "cols": [["name", "text"], ["mobile", "text"], ["governorate", "text"], ["subject", "text"], ["stages", "text"], ["national_id", "text"]]},
  {"key": "t_ingest", "level": -2.5, "type": "step", "name": "ingest", "engine": "FastAPI · Kafka raw.customer"},
  {"key": "raw_customer", "level": -2, "type": "table", "system": "iceberg", "path": ["Iceberg", "raw"], "name": "raw_customer", "dq": "ok",
   "cols": [["source_system", "code"], ["source_id", "text"], ["name", "text"], ["mobile_1", "text"], ["mobile_2", "text"], ["phone", "text"], ["whatsapp", "text"],
            ["email", "text"], ["account_type", "code"], ["state_id", "code"], ["main_territory_id", "code"], ["territory_1_id", "code"], ["sales_district", "code"],
            ["final_stages", "text"], ["final_subject", "code"], ["parent_name", "text"], ["national_id", "text"], ["linked_account_id", "code"], ["changed_on", "date"]]},
  {"key": "t_std", "level": -1.5, "type": "step", "name": "standardise", "engine": "Spark · Great Expectations"},
  {"key": "staged_customer", "level": -1, "type": "table", "system": "iceberg", "path": ["Iceberg", "staged"], "name": "staged_customer", "dq": "ok",
   "cols": [["record_id", "text"], ["name", "text"], ["name_std", "text"], ["name_first_token", "text"], ["mobile_1", "text"], ["mobile_2", "text"], ["phone", "text"],
            ["whatsapp", "text"], ["phones", "array"], ["email", "text"], ["account_type", "code"], ["state_id", "code"], ["main_territory_id", "code"],
            ["territory_1_id", "code"], ["sales_district", "code"], ["final_stages", "array"], ["final_subject", "code"], ["parent_name_std", "text"],
            ["national_id", "text"], ["linked_account_id", "code"], ["dq_passed", "bool"]]},
  {"key": "t_match", "level": -0.5, "type": "step", "name": "match", "engine": "Splink · survivorship v4"},
  {"key": "golden_customer", "level": 0, "type": "table", "system": "iceberg", "path": ["Iceberg", "golden"], "name": "golden_customer", "dq": "ok", "home": True,
   "cols": [["master_id", "text"], ["name", "text"], ["mobile_1", "text"], ["mobile_2", "text"], ["mobile_3", "text"], ["phone", "text"], ["whatsapp", "text"],
            ["contact_mobile", "text"], ["email", "text"], ["account_type", "code"], ["state_id", "code"], ["main_territory_id", "code"], ["territory_1_id", "code"],
            ["territory_2_id", "code"], ["sales_district", "code"], ["final_stages", "array"], ["final_subject", "code"], ["promotion_group", "code"],
            ["classification_group", "code"], ["parent_name", "text"], ["national_id", "text"], ["linked_account_id", "code"], ["source_ids", "array"],
            ["model_version", "text"], ["changed_at", "date"]]},
  {"key": "v_customer", "level": 1, "type": "view", "system": "trino", "path": ["Trino", "golden"], "name": "v_customer", "dq": "ok",
   "cols": [["master_id", "text"], ["name", "text"], ["mobile_1", "text"], ["account_type", "code"], ["governorate", "text"], ["main_territory_id", "code"], ["final_subject", "code"]]},
  {"key": "changes_customer", "level": 1, "type": "topic", "system": "kafka", "path": ["Kafka", "changes"], "name": "changes.customer", "dq": "ok",
   "cols": [["master_id", "text"], ["field", "text"], ["old_value", "text"], ["new_value", "text"], ["source_system", "code"], ["rule_version", "text"]]},
  {"key": "c4c_writeback", "level": 2, "type": "writeback", "system": "c4c", "path": ["Workflow", "write-back"], "name": "C4C customer write-back", "dq": "ok",
   "cols": [["Name", "text"], ["Mobile", "text"], ["Mobile2", "text"], ["MainTerritoryID", "code"]]},
  {"key": "pbi_customer360", "level": 2, "type": "report", "system": "powerbi", "path": ["Power BI", "Sales"], "name": "Customer 360", "dq": "ok",
   "cols": [["v_customer.name", "text"], ["v_customer.governorate", "text"], ["v_customer.account_type", "code"], ["v_customer.final_subject", "code"]]},
  {"key": "rpt_teachers", "level": 2, "type": "report", "system": "repoio", "path": ["Reports", "Customers"], "name": "Teachers by governorate", "dq": "ok",
   "cols": [["governorate", "text"], ["final_subject", "code"], ["teachers", "number"]]},
  {"key": "mcp_lookup", "level": 2, "type": "api", "system": "mcp", "path": ["MCP", "tools"], "name": "customer_lookup", "dq": "ok",
   "cols": [["master_id", "text"], ["name", "text"], ["mobile_1", "text"], ["account_type", "code"]]}
 ],
 "edges": []
}
E = lineage["edges"]
def e(a, ac, b, bc, via=None): E.append({"from": [a, ac], "to": [b, bc], "via": via})
for sc, rc in [("CustomerID", "source_id"), ("Name", "name"), ("Mobile", "mobile_1"), ("Mobile2", "mobile_2"), ("Phone", "phone"), ("WhatsApp", "whatsapp"),
               ("Email", "email"), ("AccountType", "account_type"), ("StateID", "state_id"), ("MainTerritoryID", "main_territory_id"), ("Territory1ID", "territory_1_id"),
               ("FinalStages", "final_stages"), ("FinalSubject", "final_subject"), ("ParentName", "parent_name"), ("NationalID", "national_id"),
               ("LinkedAccountID", "linked_account_id"), ("ChangedOn", "changed_on")]:
    e("c4c_customer", sc, "raw_customer", rc, "t_ingest")
e("c4c_address", "StateID", "raw_customer", "state_id", "t_ingest"); e("c4c_address", "SalesDistrict", "raw_customer", "sales_district", "t_ingest")
for sc, rc in [("Customer", "source_id"), ("OrganizationBPName1", "name"), ("MobilePhoneNumber", "mobile_1"), ("PhoneNumber", "phone"), ("EmailAddress", "email"),
               ("Region", "state_id"), ("CustomerAccountGroup", "account_type"), ("LastChangeDateTime", "changed_on")]:
    e("s4_customer", sc, "raw_customer", rc, "t_ingest")
for sc, rc in [("name", "name"), ("mobile", "mobile_1"), ("governorate", "state_id"), ("subject", "final_subject"), ("stages", "final_stages"), ("national_id", "national_id")]:
    e("csv_teachers", sc, "raw_customer", rc, "t_ingest")
for rc, sc in [("source_id", "record_id"), ("name", "name"), ("name", "name_std"), ("name", "name_first_token"), ("mobile_1", "mobile_1"), ("mobile_2", "mobile_2"),
               ("phone", "phone"), ("whatsapp", "whatsapp"), ("mobile_1", "phones"), ("mobile_2", "phones"), ("phone", "phones"), ("whatsapp", "phones"),
               ("email", "email"), ("account_type", "account_type"), ("state_id", "state_id"), ("main_territory_id", "main_territory_id"),
               ("territory_1_id", "territory_1_id"), ("sales_district", "sales_district"), ("final_stages", "final_stages"), ("final_subject", "final_subject"),
               ("parent_name", "parent_name_std"), ("national_id", "national_id"), ("linked_account_id", "linked_account_id"), ("changed_on", "dq_passed")]:
    e("raw_customer", rc, "staged_customer", sc, "t_std")
for sc, gc in [("record_id", "master_id"), ("record_id", "source_ids"), ("name", "name"), ("name_std", "master_id"), ("phones", "master_id"), ("mobile_1", "mobile_1"),
               ("mobile_2", "mobile_2"), ("phone", "phone"), ("whatsapp", "whatsapp"), ("email", "email"), ("account_type", "account_type"),
               ("account_type", "promotion_group"), ("account_type", "classification_group"), ("state_id", "state_id"), ("main_territory_id", "main_territory_id"),
               ("territory_1_id", "territory_1_id"), ("sales_district", "sales_district"), ("final_stages", "final_stages"), ("final_subject", "final_subject"),
               ("parent_name_std", "parent_name"), ("national_id", "national_id"), ("linked_account_id", "linked_account_id"), ("dq_passed", "changed_at")]:
    e("staged_customer", sc, "golden_customer", gc, "t_match")
for gc, vc in [("master_id", "master_id"), ("name", "name"), ("mobile_1", "mobile_1"), ("account_type", "account_type"), ("state_id", "governorate"),
               ("main_territory_id", "main_territory_id"), ("final_subject", "final_subject")]:
    e("golden_customer", gc, "v_customer", vc)
for gc in ["name", "mobile_1", "mobile_2", "main_territory_id", "email", "state_id"]:
    e("golden_customer", gc, "changes_customer", "new_value")
e("golden_customer", "master_id", "changes_customer", "master_id"); e("golden_customer", "model_version", "changes_customer", "rule_version")
for cc, wc in [("new_value", "Name"), ("new_value", "Mobile"), ("new_value", "Mobile2"), ("new_value", "MainTerritoryID")]:
    e("changes_customer", cc, "c4c_writeback", wc)
for vc, pc in [("name", "v_customer.name"), ("governorate", "v_customer.governorate"), ("account_type", "v_customer.account_type"), ("final_subject", "v_customer.final_subject")]:
    e("v_customer", vc, "pbi_customer360", pc)
e("v_customer", "governorate", "rpt_teachers", "governorate"); e("v_customer", "final_subject", "rpt_teachers", "final_subject"); e("v_customer", "master_id", "rpt_teachers", "teachers")
for c in ["master_id", "name", "mobile_1", "account_type"]:
    e("v_customer", c, "mcp_lookup", c)
# table-level link keys (repo column each source column feeds), for record values in the lineage
srcmap = {"c4c_customer": "c4c", "c4c_address": "c4c", "s4_customer": "s4", "csv_teachers": "csv"}
for nd in lineage["nodes"]:
    if nd["key"] in srcmap: nd["source"] = srcmap[nd["key"]]
# image_url: an approved image for some bookshop records (local sample pictures; in the product a stored copy in the media store)
ri = 0
for r in rows:
    if r["segment"] == "retailer":
        r["image"] = "img/records/store-%d.svg" % (ri % 4 + 1)
        ri += 1
data = {"_comment": "Golden records (J2) and column lineage, sample values only. In the product the list and the record come from the golden records API (Iceberg golden_customer through Trino), provenance from change_log, and lineage from the catalog (OpenLineage events).",
        "repos": {"customer-master": {"total": 951247, "rows": rows, "details": details, "lineage": lineage}},
        "editingStatus": ["unchanged", "openCr", "review"],
        "variants": ["standard", "teachers", "review", "lowQuality"]}
json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(rows), len(E))
