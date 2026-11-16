"""Sample data for the stewardship pages (J5 Match detection, J10 Quarantine).

Writes webapp/model/stewardship.json. Match probabilities follow Splink's model: the match weight is the prior plus the
partial weight of every comparison level, and probability = 2^W / (1 + 2^W). Sample values only.
Usage: python3 tools/gen-stewardship-sample.py
"""
import json, math, random, os

random.seed(23)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "webapp", "model", "stewardship.json")

PRIOR = -13.2
# comparison -> {level: partial match weight}; levels follow the Customer master model (rules.json)
W = {
    "name": {"exact": 9.6, "jw95": 9.0, "jw90": 6.2, "else": -5.1},
    "phones": {"share": 11.4, "none": -3.2},
    "national_id": {"exact": 14.2, "else": -12.0},
    "parent_name": {"jw95": 4.6, "jw90": 3.1, "else": -2.0},
    "state_id": {"exact": 3.1, "else": -4.5},
    "main_territory_id": {"exact": 2.3, "else": -1.1},
    "territory_1_id": {"exact": 2.0, "else": -0.6},
    "final_subject": {"exact": 2.0, "else": -1.0},
    "final_stages": {"share": 1.6, "none": -0.5},
}
FIRST = ["أحمد", "محمد", "محمود", "مصطفى", "خالد", "يوسف", "عمر", "حسن", "إبراهيم", "كريم", "منى", "مريم", "سلمى", "هالة", "نور", "فاطمة", "سارة", "هدى"]
MID = ["محمود", "عبد الرحمن", "إبراهيم", "حسن", "علي", "عبد العزيز", "سيد", "فتحي", "أحمد"]
LAST = ["السيد", "خليل", "سالم", "عبد الله", "فتحي", "النجار", "الشريف", "حسين", "منصور"]
GOV = {"01": ["CAI-N", "CAI-E", "CAI-W"], "02": ["GIZ-H", "GIZ-D", "GIZ-6O"], "03": ["ALX-E", "ALX-W"], "12": ["DAK-M"], "13": ["SHR-Z"]}
SUBJ = ["رياضيات", "علوم", "لغة عربية", "لغة إنجليزية", "فيزياء"]
STEWARDS = ["سارة عادل", "أحمد ناصر", "هالة سمير", "كريم فؤاد"]
SRC = ["c4c", "s4", "csv"]
SEG_BANDS = {"teacher": (0.80, 0.95), "callCenter": (0.80, 0.95), "retailer": (0.80, 0.95), "student": (0.85, 0.97), "charityStudent": (0.85, 0.97)}


def mob():
    return random.choice(["010", "011", "012", "015"]) + "".join(random.choice("0123456789") for _ in range(8))


def variant(name):
    v = random.choice(["alef", "ya", "drop", "space", "same"])
    if v == "alef": return name.replace("أ", "ا").replace("إ", "ا")
    if v == "ya": return name.replace("ي", "ى", 1) if "ي" in name else name + "ى"
    if v == "drop":
        p = name.split(); return " ".join([p[0], p[-1]]) if len(p) > 2 else name
    if v == "space": return name.replace("عبد ", "عبد")
    return name


def record(seg, rid, src):
    gov = random.choice(list(GOV))
    r = {"id": rid, "source": src, "name": " ".join([random.choice(FIRST), random.choice(MID), random.choice(LAST)]),
         "mobile_1": mob(), "mobile_2": mob() if random.random() < 0.3 else "", "whatsapp": "", "email": "",
         "account_type": {"teacher": "01", "retailer": "02", "callCenter": "03", "student": "03-1", "charityStudent": "03-2"}[seg],
         "state_id": gov, "main_territory_id": random.choice(GOV[gov]), "territory_1_id": random.choice(GOV[gov]) if random.random() < 0.6 else "", "final_subject": "", "final_stages": "",
         "parent_name": "", "national_id": "", "changed": "2026-%02d-%02d" % (random.randint(7, 11), random.randint(1, 28))}
    if seg == "retailer": r["name"] = "مكتبة " + random.choice(["الشروق", "النور", "الأمل", "الفجر", "السلام", "الرواد", "المعرفة"])
    if seg == "teacher":
        r["final_subject"] = random.choice(SUBJ); r["final_stages"] = random.choice(["إعدادي", "ثانوي", "إعدادي، ثانوي"])
    if seg in ("student", "charityStudent"): r["parent_name"] = random.choice(FIRST[:10]) + " " + random.choice(LAST)
    if seg == "charityStudent": r["national_id"] = "30%d…%04d" % (random.randint(10, 99), random.randint(1000, 9999))
    return r


def level(comp, a, b):
    if comp == "name":
        if a["name"] == b["name"]: return "exact"
        sim = jw(a["name"], b["name"])
        return "jw95" if sim >= 0.95 else "jw90" if sim >= 0.90 else "else", sim
    if comp == "phones":
        pa = {x for x in [a["mobile_1"], a["mobile_2"], a["whatsapp"]] if x}; pb = {x for x in [b["mobile_1"], b["mobile_2"], b["whatsapp"]] if x}
        if not pa or not pb: return None
        return "share" if pa & pb else "none"
    va, vb = a.get(comp, ""), b.get(comp, "")
    if not va or not vb: return None
    if comp == "parent_name":
        s = jw(va, vb); return "jw95" if s >= 0.95 else "jw90" if s >= 0.9 else "else"
    if comp == "final_stages": return "share" if set(va.split("، ")) & set(vb.split("، ")) else "none"
    return "exact" if va == vb else "else"


def jw(s1, s2):
    """Jaro-Winkler similarity (the measure Splink's JaroWinklerAtThresholds uses)."""
    if s1 == s2: return 1.0
    l1, l2 = len(s1), len(s2)
    if not l1 or not l2: return 0.0
    md = max(l1, l2) // 2 - 1
    m1, m2 = [False] * l1, [False] * l2
    m = 0
    for i in range(l1):
        for j in range(max(0, i - md), min(i + md + 1, l2)):
            if not m2[j] and s1[i] == s2[j]:
                m1[i] = m2[j] = True; m += 1; break
    if not m: return 0.0
    t, k = 0, 0
    for i in range(l1):
        if m1[i]:
            while not m2[k]: k += 1
            if s1[i] != s2[k]: t += 1
            k += 1
    j = (m / l1 + m / l2 + (m - t / 2) / m) / 3
    p = 0
    for a, b in zip(s1[:4], s2[:4]):
        if a != b: break
        p += 1
    return j + p * 0.1 * (1 - j)


def score(a, b):
    parts, total = [], PRIOR
    for comp in ["name", "phones", "national_id", "parent_name", "state_id", "main_territory_id", "territory_1_id", "final_subject", "final_stages"]:
        lv = level(comp, a, b)
        sim = None
        if isinstance(lv, tuple): lv, sim = lv
        if lv is None:
            parts.append({"comp": comp, "level": "null", "w": 0.0}); continue
        w = W[comp][lv]; total += w
        parts.append({"comp": comp, "level": lv, "w": w, "sim": round(sim, 3) if sim is not None else None})
    p = 2 ** total / (1 + 2 ** total)
    return round(p, 3), round(total, 2), parts


def pair_for(seg):
    lo, hi = SEG_BANDS[seg]
    for _ in range(400):
        a = record(seg, "", "c4c")
        b = dict(a)
        b["source"] = random.choice(["s4", "csv", "c4c"])
        b["name"] = variant(a["name"])
        if random.random() < 0.5: b["mobile_1"] = mob()
        if random.random() < 0.4: b["main_territory_id"] = random.choice(GOV[a["state_id"]])
        if random.random() < 0.3: b["territory_1_id"] = random.choice(GOV[a["state_id"]] + [""])
        if random.random() < 0.35: b["mobile_2"] = a["mobile_1"]; b["mobile_1"] = mob()
        if random.random() < 0.15: b["state_id"] = random.choice(list(GOV)); b["main_territory_id"] = random.choice(GOV[b["state_id"]])
        if seg == "teacher" and random.random() < 0.3: b["final_subject"] = random.choice(SUBJ)
        if seg == "charityStudent" and random.random() < 0.25:
            b["national_id"] = "30%d…%04d" % (random.randint(10, 99), random.randint(1000, 9999))
        p, w, parts = score(a, b)
        if lo <= p < hi: return a, b, p, w, parts
    return None


pairs, n = [], 0
plan = [("teacher", 11), ("callCenter", 6), ("retailer", 4), ("student", 4), ("charityStudent", 3)]
for seg, cnt in plan:
    for _ in range(cnt):
        r = pair_for(seg)
        if not r: continue
        a, b, p, w, parts = r
        n += 1
        a["id"] = "GR-C-%06d" % random.randint(1000, 950000)
        b["id"] = "SRC-%s-%06d" % (b["source"].upper(), random.randint(1000, 999999)) if random.random() < 0.6 else "GR-C-%06d" % random.randint(1000, 950000)
        age = random.randint(0, 6)
        risks = []
        if a["national_id"] and b["national_id"] and a["national_id"] != b["national_id"]: risks.append("idDiffers")
        if random.random() < 0.08: risks.append("openCr")
        pairs.append({"id": "MP-%05d" % (40100 + n), "kind": "pair", "repo": "customer-master", "segment": seg, "prob": p, "weight": w, "parts": parts,
                      "records": [a, b], "run": random.choice(["R-5666", "R-5672"]), "age": age, "since": "2026-11-%02d" % (16 - age),
                      "assigned": random.choice(["", "", "محمد", "سارة عادل", "أحمد ناصر"]), "risks": risks, "state": "open"})

# two clusters (3 records that match each other transitively)
for k in range(2):
    seg = "teacher"
    r = pair_for(seg)
    a, b, p, w, parts = r
    c = dict(b); c["source"] = "csv"; c["name"] = variant(a["name"]); c["mobile_1"] = a["mobile_1"]
    a["id"] = "GR-C-%06d" % random.randint(1000, 950000); b["id"] = "GR-C-%06d" % random.randint(1000, 950000); c["id"] = "SRC-CSV-%06d" % random.randint(1000, 99999)
    pbc, wbc, partsbc = score(b, c); pac, wac, partsac = score(a, c)
    pairs.append({"id": "MC-%04d" % (k + 1), "kind": "cluster", "repo": "customer-master", "segment": seg, "prob": min(p, pbc, pac), "weight": w, "parts": parts,
                  "records": [a, b, c], "links": [{"a": 0, "b": 1, "prob": p}, {"a": 1, "b": 2, "prob": pbc}, {"a": 0, "b": 2, "prob": pac}],
                  "run": "R-5672", "age": k + 1, "since": "2026-11-%02d" % (15 - k), "assigned": "", "risks": ["cluster"], "state": "open"})

# change requests stopped by the request check (the samples on Models & rules)
GOLD = {"GR-C-004512": ("أحمد محمود السيد", "01001234567", "02", "GIZ-H"), "GR-C-007731": ("خالد ابراهيم فتحي", "01555987654", "01", "CAI-E"),
        "CR-2026-0598": ("مكتبة النور", "01223344556", "01", "CAI-N"), "CR-2026-0590": ("سلمى حسن عبدالله", "01277665500", "13", "SHR-Z")}
reqs = [
    {"id": "CR-2026-0601", "segment": "teacher", "requester": "أحمد ناصر", "name": "أحمد محمود السيد", "mobile_1": "01001234567", "mobile_2": "01122334455",
     "state_id": "02", "main_territory_id": "GIZ-D", "check": "phoneGolden", "ref": "GR-C-004512", "prob": 0.97},
    {"id": "CR-2026-0602", "segment": "retailer", "requester": "سارة عادل", "name": "مكتبة النور الحديثة", "mobile_1": "01223344556", "mobile_2": "0225551234",
     "state_id": "01", "main_territory_id": "CAI-N", "check": "phoneOpenCr", "ref": "CR-2026-0598", "prob": 0.91},
    {"id": "CR-2026-0604", "segment": "callCenter", "requester": "كريم فؤاد", "name": "خالد إبراهيم فتحى", "mobile_1": "01555123456", "mobile_2": "",
     "state_id": "01", "main_territory_id": "CAI-E", "check": "similarGolden", "ref": "GR-C-007731", "prob": 0.96},
    {"id": "CR-2026-0606", "segment": "charityStudent", "requester": "محمد", "name": "سلمى حسن عبد الله", "mobile_1": "01277665544", "mobile_2": "",
     "state_id": "13", "main_territory_id": "SHR-Z", "check": "nationalId", "ref": "CR-2026-0590", "prob": 0.88},
]
requests = []
for i, r in enumerate(reqs):
    g = GOLD[r["ref"]]
    a = {"id": r["id"], "source": "request", "name": r["name"], "mobile_1": r["mobile_1"], "mobile_2": r["mobile_2"], "whatsapp": "", "email": "",
         "account_type": {"teacher": "01", "retailer": "02", "callCenter": "03", "charityStudent": "03-2"}[r["segment"]], "state_id": r["state_id"],
         "main_territory_id": r["main_territory_id"], "territory_1_id": "", "final_subject": "", "final_stages": "", "parent_name": "",
         "national_id": "3010…4521" if r["check"] == "nationalId" else "", "changed": "2026-11-%02d" % (14 + i % 3)}
    b = dict(a); b.update({"id": r["ref"], "source": "golden" if r["ref"].startswith("GR") else "request", "name": g[0], "mobile_1": g[1], "mobile_2": "",
                           "state_id": g[2], "main_territory_id": g[3], "changed": "2026-10-%02d" % (10 + i)})
    if r["check"] == "phoneGolden": b["mobile_2"] = r["mobile_1"]; b["mobile_1"] = "01099990000"
    p, w, parts = score(a, b)
    requests.append({"id": r["id"], "kind": "request", "repo": "customer-master", "segment": r["segment"], "prob": max(p, r["prob"]) if r["check"] == "similarGolden" else p,
                     "weight": w, "parts": parts, "records": [a, b], "check": r["check"], "ref": r["ref"], "requester": r["requester"],
                     "age": i % 3, "since": "2026-11-%02d" % (16 - i % 3), "assigned": "", "risks": ["numbers"] if r["check"] in ("phoneGolden", "phoneOpenCr", "nationalId") else [],
                     "state": "open"})

# first decisions waiting for a second steward (four-eyes)
second = []
for i, (src_idx, by, reason) in enumerate([(0, "سارة عادل", "cluster"), (3, "أحمد ناصر", "idDiffers"), (5, "محمد", "openCr")]):
    base = json.loads(json.dumps(pairs[src_idx if src_idx < len(pairs) else 0]))
    base["id"] = "MA-%04d" % (i + 1); base["state"] = "second"; base["first"] = {"by": by, "at": "2026-11-16 %02d:%02d" % (9 + i, 15 * i), "decision": "merge",
                                                                                   "survivor": 0, "note": ""}
    if reason not in base["risks"]: base["risks"] = base["risks"] + [reason]
    second.append(base)
if len(pairs) > 30:
    cl = [p for p in pairs if p["kind"] == "cluster"][0]
    second[0] = json.loads(json.dumps(cl)); second[0].update({"id": "MA-0001", "state": "second", "first": {"by": "سارة عادل", "at": "2026-11-16 09:12", "decision": "merge", "survivor": 0, "note": ""}})

decided = []
for i in range(14):
    d = random.choice(["merge", "merge", "distinct", "released", "rejected"])
    decided.append({"id": "MP-%05d" % (39000 + i), "kind": "request" if d in ("released", "rejected") else "pair", "decision": d,
                    "by": random.choice(STEWARDS + ["محمد"]), "at": "2026-11-%02d %02d:%02d" % (random.randint(12, 16), random.randint(8, 18), random.randint(0, 59)),
                    "names": random.choice(FIRST) + " " + random.choice(LAST), "prob": round(random.uniform(0.8, 0.96), 3), "segment": random.choice(list(SEG_BANDS)),
                    "note": random.choice(["", "", "نفس الموبايل والمدرسة", "أخوات، مش نفس الشخص", "اتأكدت من المندوب"])})
decided.sort(key=lambda x: x["at"], reverse=True)

# quarantine: records held by data quality checks (Great Expectations), never dropped
RULES = [
    {"key": "phone_format", "ge": "expect_column_values_to_match_regex", "col": "mobile_1", "severity": "error", "expect": "^01[0125][0-9]{8}$"},
    {"key": "governorate_ref", "ge": "expect_column_values_to_be_in_set", "col": "state_id", "severity": "error", "expect": "governorates (27 codes)"},
    {"key": "name_present", "ge": "expect_column_values_to_not_be_null", "col": "name", "severity": "error", "expect": "not null"},
    {"key": "territory_ref", "ge": "expect_territory_in_governorate", "col": "main_territory_id", "severity": "error", "expect": "a territory of the governorate"},
    {"key": "email_format", "ge": "expect_column_values_to_match_regex", "col": "email", "severity": "warning", "expect": "^[^@ ]+@[^@ ]+\\.[^@ ]+$"},
    {"key": "national_id_check", "ge": "expect_national_id_check_digit", "col": "national_id", "severity": "error", "expect": "14 digits, valid check digit"},
    {"key": "tax_number_format", "ge": "expect_column_value_lengths_to_equal", "col": "tax_number", "severity": "error", "expect": "9 digits"},
]
BAD = {"phone_format": ["0100123456", "+2010012", "01x00123456", "2010012345"], "governorate_ref": ["99", "CAIRO", "00"], "name_present": [""],
       "territory_ref": ["ALX-E", "GIZ-H", "DAK-M"], "email_format": ["ahmed@", "mona.example.com", "khaled @mail.com"],
       "national_id_check": ["2850…1180", "3010…452"], "tax_number_format": ["12345", "1234567890"]}
quarantine = []
for i in range(46):
    rule = random.choices(RULES, weights=[10, 4, 2, 6, 3, 2, 2])[0]
    vendor = rule["key"] == "tax_number_format"
    src = "s4" if vendor else random.choice(["c4c", "c4c", "s4", "csv"])
    rec = record(random.choice(["teacher", "callCenter", "retailer", "student", "charityStudent"]), "", src)
    bad = random.choice(BAD[rule["key"]])
    if rule["key"] == "territory_ref":
        rec["state_id"] = "03" if bad != "ALX-E" else "01"
    rec[rule["col"]] = bad
    if vendor: rec = {"name": random.choice(["مطبعة الشروق", "دار الورق", "شركة الأحبار", "مصنع الكرتون"]), "tax_number": bad, "city": "القاهرة"}
    also = []
    if rule["key"] != "email_format" and random.random() < 0.15 and not vendor:
        rec["email"] = random.choice(BAD["email_format"]); also.append("email_format")
    status = random.choices(["held", "held", "held", "ready", "pendingWaive", "pendingDiscard"], weights=[6, 6, 6, 2, 1, 1])[0]
    q = {"id": "Q-%05d" % (8100 + i), "repo": "vendor-master" if vendor else "customer-master", "source": src,
         "sourceKey": {"c4c": "100%06d" % random.randint(0, 999999), "s4": "%010d" % random.randint(1, 9999999), "csv": "teachers_2026.xlsx · row %d" % random.randint(2, 4000)}[src],
         "rule": rule["key"], "also": also, "record": rec, "run": "R-5757" if src == "csv" else ("R-5776" if random.random() < 0.5 else "R-5672"),
         "held": "2026-11-%02d %02d:%02d" % (random.randint(9, 16), random.randint(0, 6), random.randint(0, 59)), "status": status, "attempts": random.randint(1, 3) if status != "held" else 1}
    if status in ("pendingWaive", "pendingDiscard"):
        q["first"] = {"by": random.choice(["سارة عادل", "محمد"]), "at": "2026-11-16 %02d:%02d" % (random.randint(8, 12), random.randint(0, 59)),
                      "note": random.choice(["العميل مسجل كده في C4C ومحتاج تصحيح من المندوب", "سجل تجريبي اتسحب بالغلط"])}
    quarantine.append(q)
quarantine.sort(key=lambda x: x["held"], reverse=True)

data = {"_comment": "Stewardship queues (J5 Match detection, J10 Quarantine), sample values only. In the product the match queue comes from matched_pairs (Splink, review band) and the request check, decisions go to the match review API and become labelled pairs; quarantine comes from the DQ dead-letter path (Great Expectations results).",
        "me": "محمد", "slaDays": 3, "batch": {"minProb": 0.93, "max": 50}, "prior": PRIOR, "weights": W,
        "training": {"last": "2026-10-01", "since": 120, "model": "customer-master"},
        "pairs": pairs, "requests": requests, "second": second, "decided": decided, "rules": RULES, "quarantine": quarantine}
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(pairs), len(requests), len(second), len(quarantine), os.path.getsize(OUT))
