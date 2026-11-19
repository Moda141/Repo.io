#!/usr/bin/env python3
"""Generate webapp/model/dq.json: sample data for Data Quality (Test cases and Alerts, J10).

Sample values only. In the product:
- test definitions come from the DQ API (control plane: dq_test, dq_test_version); builder tests are stored as
  Great Expectations expectation configurations, Python tests as reviewed source that runs in the isolated
  Python workers (CLAUDE.md rule 8), never in the UI or the service;
- results come from dq.results (Iceberg) written by the DQ step of the stream and by the nightly DQ DAG;
- reference lists come from the reference data API; alert rules and fired alerts from the alerts API.

Deterministic: rerunning gives the same file. Inputs: model/tables.json (source-table tests) and
model/stewardship.json (the repository gate rules the Quarantine page uses).
"""
import datetime
import json
import os
import random

ROOT = os.path.join(os.path.dirname(__file__), "..", "webapp", "model")
# Aligned with model/runs.json ("now" 2026-11-10): the results of each day come from that night's dq_nightly_suite run
NOW = "2026-11-10 02:15"
DAYS = [(datetime.date(2026, 11, 10) - datetime.timedelta(days=13 - i)).isoformat() for i in range(14)]  # 14 nightly runs, oldest first
WEEK = datetime.timedelta(days=7)


def back7(s):
    """The alert sample was written for a week later; move it onto the runs timeline."""
    if not s:
        return s
    d = datetime.datetime.strptime(s, "%Y-%m-%d %H:%M") - WEEK
    return d.strftime("%Y-%m-%d %H:%M")

# Check types offered by the builder palette (Great Expectations expectations), grouped by quality dimension.
CHECKS = [
    {"key": "notNull", "ge": "expect_column_values_to_not_be_null", "dim": "completeness", "icon": "sap-icon://border", "params": [], "level": "column"},
    {"key": "requiredWhen", "ge": "expect_column_values_to_not_be_null + row_condition", "dim": "completeness", "icon": "sap-icon://chain-link",
     "params": ["whenCol", "whenVal"], "level": "column"},
    {"key": "rowCount", "ge": "expect_table_row_count_to_be_between", "dim": "completeness", "icon": "sap-icon://table-view", "params": ["min", "max"], "level": "table"},
    {"key": "unique", "ge": "expect_column_values_to_be_unique", "dim": "uniqueness", "icon": "sap-icon://key", "params": [], "level": "column"},
    {"key": "inList", "ge": "expect_column_values_to_be_in_set", "dim": "validity", "icon": "sap-icon://list", "params": ["list"], "level": "column"},
    {"key": "pattern", "ge": "expect_column_values_to_match_regex", "dim": "validity", "icon": "sap-icon://text-formatting", "params": ["preset", "regex"], "level": "column"},
    {"key": "length", "ge": "expect_column_value_lengths_to_be_between", "dim": "validity", "icon": "sap-icon://text-align-justified", "params": ["min", "max"], "level": "column"},
    {"key": "range", "ge": "expect_column_values_to_be_between", "dim": "accuracy", "icon": "sap-icon://measure", "params": ["min", "max"], "level": "column"},
    {"key": "notFuture", "ge": "expect_column_values_to_be_between (max = today)", "dim": "accuracy", "icon": "sap-icon://appointment-2", "params": [], "level": "column"},
    {"key": "fresh", "ge": "expect_column_max_to_be_between (changed date)", "dim": "timeliness", "icon": "sap-icon://history", "params": ["hours"], "level": "table"},
    {"key": "python", "ge": "custom expectation (Python)", "dim": "consistency", "icon": "sap-icon://syntax", "params": [], "level": "any"},
]
DIMS = ["completeness", "uniqueness", "validity", "accuracy", "consistency", "timeliness"]

PRESETS = [
    {"key": "egPhone", "regex": "^01[0125][0-9]{8}$"},
    {"key": "egLandline", "regex": "^0[2-9][0-9]{7,8}$"},
    {"key": "email", "regex": "^[^@ ]+@[^@ ]+\\.[^@ ]+$"},
    {"key": "tax9", "regex": "^[0-9]{9}$"},
    {"key": "isbn13", "regex": "^97[89][0-9]{10}$"},
    {"key": "custom", "regex": ""},
]

REF_LISTS = [
    {"key": "governorates", "en": "Egyptian governorates", "ar": "محافظات مصر", "count": 27, "systems": ["C4C", "ERP"]},
    {"key": "territories", "en": "Sales territories", "ar": "المناطق البيعية", "count": 64, "systems": ["C4C"]},
    {"key": "accountTypes", "en": "Account types", "ar": "أنواع الحسابات", "count": 6, "systems": ["C4C"]},
    {"key": "schoolStages", "en": "School stages", "ar": "المراحل الدراسية", "count": 5, "systems": ["C4C"]},
    {"key": "customerGroups", "en": "Customer groups (ERP)", "ar": "مجموعات العملاء (ERP)", "count": 9, "systems": ["ERP"]},
    {"key": "bookFormats", "en": "Book formats", "ar": "أشكال الكتاب", "count": 7, "systems": ["ERP"]},
]

ENTITY = {"customers": "customer", "products": "product", "vendors": "vendor", "authors": "author", "employees": "employee", "stores": "store"}
PEOPLE = ["سارة عادل", "أحمد ناصر", "منى فاروق", "محمد"]

PY_TERRITORY = '''import great_expectations as gx
from repoio_dq import column_pair_check  # Repo.io helper: wraps a row check as a custom expectation


@column_pair_check(name="expect_territory_in_governorate", columns=["main_territory_id", "state_id"])
def territory_in_governorate(territory, governorate, ref):
    """A sales territory must belong to the record's governorate."""
    if territory is None:
        return True  # completeness is checked by another test
    return ref.territories.get(territory, {}).get("governorate") == governorate
'''

PY_NATIONAL_ID = '''from repoio_dq import column_check


@column_check(name="expect_national_id_check_digit", column="national_id")
def national_id_valid(value, ref):
    """Egyptian national ID: 14 digits, a valid birth date and a check digit."""
    if value is None:
        return True
    if len(value) != 14 or not value.isdigit():
        return False
    century = {"2": 1900, "3": 2000}.get(value[0])
    month, day = int(value[3:5]), int(value[5:7])
    if century is None or not (1 <= month <= 12 and 1 <= day <= 31):
        return False
    weights = [2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    check = (11 - sum(int(d) * w for d, w in zip(value[:13], weights)) % 11) % 10
    return check == int(value[13])
'''

PY_ISBN = '''from repoio_dq import column_check


@column_check(name="expect_isbn13_check_digit", column="isbn")
def isbn13_valid(value, ref):
    """ISBN-13 check digit (weights 1 and 3)."""
    if value is None or len(value) != 13 or not value.isdigit():
        return False
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(value[:12]))
    return (10 - total % 10) % 10 == int(value[12])
'''

PY_PRICE = '''from repoio_dq import table_check


@table_check(name="expect_digital_price_not_above_print", tables=["digital", "catalog"])
def digital_not_above_print(df, ref):
    """A digital edition is never priced above its printed book. Returns the failing rows."""
    joined = df["digital"].join(df["catalog"], on="isbn", how="inner", rsuffix="_print")
    return joined[joined["price"] > joined["price_print"]]
'''

# Repository gate tests: run on staged.<entity> in the stream (and nightly). "quarantine" holds the record,
# "flag" keeps it and marks the value for a steward.
REPO_TESTS = [
    # key, repo, column, check, params, severity, author, en, ar, base pass %, status, dimension override
    ("phone_format", "customer-master", "mobile_1", "pattern", {"preset": "egPhone", "regex": "^01[0125][0-9]{8}$"}, "quarantine", "builder",
     "Phone numbers are valid Egyptian numbers", "أرقام الهاتف أرقام مصرية صحيحة", 99.2, "active", None),
    ("governorate_ref", "customer-master", "state_id", "inList", {"list": "governorates"}, "quarantine", "builder",
     "Governorate is in the reference list", "المحافظة من القائمة المرجعية", 99.6, "active", None),
    ("name_present", "customer-master", "name", "notNull", {}, "quarantine", "builder",
     "Name is filled in", "الاسم غير فارغ", 99.9, "active", None),
    ("territory_ref", "customer-master", "main_territory_id", "python", {"code": PY_TERRITORY, "expectation": "expect_territory_in_governorate"}, "quarantine", "python",
     "Territories belong to the governorate", "المناطق تتبع المحافظة", 98.7, "active", "consistency"),
    ("email_format", "customer-master", "email", "pattern", {"preset": "email", "regex": "^[^@ ]+@[^@ ]+\\.[^@ ]+$"}, "flag", "builder",
     "Email is valid", "البريد الإلكتروني صحيح", 96.4, "active", None),
    ("national_id_check", "customer-master", "national_id", "python", {"code": PY_NATIONAL_ID, "expectation": "expect_national_id_check_digit"}, "quarantine", "python",
     "National ID check digit", "رقم التحقق في الرقم القومي", 99.4, "active", "validity"),
    ("tax_number_format", "customer-master", "tax_number", "length", {"min": 9, "max": 9}, "quarantine", "builder",
     "Tax number has 9 digits", "الرقم الضريبي من 9 أرقام", 99.1, "active", None),
    ("stages_when_school", "schools", "final_stages", "requiredWhen", {"whenCol": "account_type", "whenVal": "03"}, "flag", "builder",
     "Schools have their stages", "المدارس مسجل لها المراحل الدراسية", 88.5, "active", None),
    ("stages_ref", "schools", "final_stages", "inList", {"list": "schoolStages"}, "quarantine", "builder",
     "Stages are in the reference list", "المراحل من القائمة المرجعية", 97.8, "active", None),
    ("vendor_tax_unique", "vendor-master", "tax_number", "unique", {}, "quarantine", "builder",
     "No two vendors share a tax number", "لا يتكرر الرقم الضريبي بين الموردين", 99.97, "active", None),
    ("isbn_check", "catalog", "isbn", "python", {"code": PY_ISBN, "expectation": "expect_isbn13_check_digit"}, "quarantine", "python",
     "ISBN-13 check digit", "رقم التحقق في ISBN-13", 99.8, "active", "validity"),
    ("price_range", "catalog", "price", "range", {"min": 5, "max": 5000}, "flag", "builder",
     "Price between 5 and 5,000 EGP", "السعر بين 5 و5000 جنيه", 99.5, "active", None),
    ("digital_price", "digital", "price", "python", {"code": PY_PRICE, "expectation": "expect_digital_price_not_above_print"}, "flag", "python",
     "Digital price not above the printed book", "سعر النسخة الرقمية لا يزيد على المطبوعة", 93.1, "inReview", "consistency"),
    ("author_name", "authors", "name", "notNull", {}, "quarantine", "builder",
     "Author name is filled in", "اسم المؤلف غير فارغ", 100.0, "active", None),
    ("author_birth", "authors", "birth_date", "notFuture", {}, "flag", "builder",
     "Birth date is not in the future", "تاريخ الميلاد ليس في المستقبل", 99.9, "draft", None),
    ("distribution_fresh", "distribution", "", "fresh", {"hours": 24}, "flag", "builder",
     "Partners refreshed in the last 24 hours", "تحديث الشركاء خلال آخر 24 ساعة", 100.0, "disabled", None),
]

# Source-table checks from tables.json map onto builder check types (profiling: they never hold records).
TABLE_KEY = {"notNull": "notNull", "unique": "unique", "format": "pattern", "fresh": "fresh"}


def series(rnd, base, n=14, spread=0.8):
    out, v = [], base
    for i in range(n - 1):
        v = max(0.0, min(100.0, base + rnd.uniform(-spread, spread)))
        out.append(round(v, 2))
    out.append(round(base, 2))
    return out


RUNS = os.path.join(ROOT, "runs.json")
GEN = "tools/gen-dq.py"


def nightly_runs(tests):
    """One dq_nightly_suite run per day in model/runs.json (the runs the results come from). Runs that already exist
    are kept; the missing ones are added (marked "gen") from the shape of an existing run. Returns {date: run id}."""
    data = json.load(open(RUNS, encoding="utf-8"))
    runs = [r for r in data["runs"] if r.get("gen-dq") is None]
    have = {r["start"][:10]: r for r in runs if r["job"] == "dq_nightly_suite"}
    tpl = sorted(have.values(), key=lambda r: r["start"])[0]
    rnd, out = random.Random(4242), {}
    for i, d in enumerate(DAYS):
        if d in have:
            out[d] = have[d]["id"]
            continue
        failing = any(t["level"] == "repository" and t["severity"] == "quarantine" and r["d"] == d and r["pass"] < t["threshold"]
                      for t in tests for r in t["runs"])
        start = datetime.datetime.strptime(d + " 02:00:0" + str(i % 6), "%Y-%m-%d %H:%M:%S")
        secs = [rnd.randint(170, 250) for _ in range(4)]
        run = json.loads(json.dumps(tpl))
        run.update({"id": "R-55%02d" % (10 + i), "start": start.strftime("%Y-%m-%d %H:%M:%S"),
                    "end": (start + datetime.timedelta(seconds=sum(secs))).strftime("%Y-%m-%d %H:%M:%S"), "sec": sum(secs),
                    "status": "succeededWithFailures" if failing else "succeeded",
                    "dagRunId": "scheduled__%sT%s+02:00" % (d, start.strftime("%H:%M:%S")), "gen": GEN})
        t0 = start
        for task, sec in zip(run["tasks"], secs):
            task.update({"status": "succeeded", "start": t0.strftime("%Y-%m-%d %H:%M:%S"), "sec": sec})
            t0 += datetime.timedelta(seconds=sec)
        for o in run.get("objects", []):
            o.update({"status": "completed", "last": run["end"], "initOps": rnd.randint(8000, 30000)})
        runs.append(run)
        out[d] = run["id"]
    # Existing runs keep their order; the added (older) runs follow them
    # Write by text so the hand-formatted parts of runs.json stay as they are: drop the runs added last time, then
    # append the new ones at the end of the "runs" array.
    text = open(RUNS, encoding="utf-8").read()
    head, sep, tail = text.partition('\n ],\n\t"streams"')
    assert sep, "runs.json layout changed"
    mark = ',\n  {\n   "gen-dq": "added by ' + GEN + '"'
    head = head.split(mark)[0]
    added = [r for r in runs if r.get("gen") == GEN]
    for r in added:
        r.pop("gen", None)
        body = json.dumps(r, ensure_ascii=False, indent=1)
        body = "\n".join("  " + line for line in body.split("\n"))
        head += mark + ",\n" + body.split("\n", 1)[1]
    with open(RUNS, "w", encoding="utf-8") as f:
        f.write(head + sep + tail)
    return out


def main():
    tables = json.load(open(os.path.join(ROOT, "tables.json"), encoding="utf-8"))["tables"]
    stew = json.load(open(os.path.join(ROOT, "stewardship.json"), encoding="utf-8"))
    sample = json.load(open(os.path.join(ROOT, "sample-data.json"), encoding="utf-8"))
    repos = sample["repos"]
    held = {}
    for q in stew["quarantine"]:
        for r in [q["rule"]] + q.get("also", []):
            held[r] = held.get(r, 0) + 1

    tests, rnd = [], random.Random(20261117)
    for i, (key, repo, col, chk, params, sev, author, en, ar, base, status, dim) in enumerate(REPO_TESTS):
        meta = next(c for c in CHECKS if c["key"] == chk)
        # The stream checks the records that arrive in each run (the day's batch), not the whole table
        batch = max(40, int((repos[repo]["golden"] or 1000) * 0.0022))
        hist = series(rnd, base, spread=0.6 if base > 99 else 1.5) if status not in ("draft",) else []
        runs = []
        for d, p in zip(DAYS, hist):
            checked = int(batch * rnd.uniform(0.7, 1.3))
            runs.append({"d": d, "pass": p, "checked": checked, "failed": int(round(checked * (100 - p) / 100))})
        rows = batch
        tests.append({
            "id": "DQ-%03d" % (101 + i), "key": key, "level": "repository", "repo": repo, "table": "staged." + ENTITY[repos[repo]["domainId"]],
            "column": col, "check": chk, "dim": dim or meta["dim"], "params": params, "threshold": 99.0 if sev == "quarantine" else 95.0,
            "severity": sev, "author": author, "status": status, "en": en, "ar": ar,
            "owner": PEOPLE[i % 3], "reviewer": PEOPLE[(i + 1) % 3] if author == "python" else "",
            "schedule": "stream", "version": 1 if status in ("draft", "inReview") else 2 + i % 3,
            "changed": "2026-11-%02d" % (2 + i % 14), "held": held.get(key, 0), "runs": runs, "rows": rows,
        })

    n = len(tests)
    for tkey, t in tables.items():
        src, schema, tid = tkey.split(".")
        for j, x in enumerate(t["tests"]):
            chk = TABLE_KEY[x["key"]]
            meta = next(c for c in CHECKS if c["key"] == chk)
            last = 100.0 - x["pct"] if x["result"] != "fail" or x["pct"] else 100.0
            if x["result"] == "fail" and not x["pct"]:
                last = 0.0  # freshness: the table was not refreshed
            hist = series(rnd, last, spread=0.4 if last > 99 else 1.2)
            if chk == "fresh":
                hist = [100.0 if p > 50 else 0.0 for p in hist]
            total = x["failed"] * 100 / x["pct"] if x["pct"] else 0
            checked = int(total) if total else 0
            runs = [{"d": d, "pass": p, "checked": checked, "failed": int(round(total * (100 - p) / 100)) if total else 0} for d, p in zip(DAYS, hist)]
            params = {"preset": "egPhone", "regex": "^01[0125][0-9]{8}$"} if chk == "pattern" and "phone" in x["en"].lower() else \
                {"preset": "custom", "regex": ".+"} if chk == "pattern" else {"hours": 24} if chk == "fresh" else {}
            n += 1
            tests.append({
                "id": "DQ-%03d" % (200 + n), "key": x["key"], "level": "source", "repo": "", "source": src, "schema": schema, "table": tid,
                "column": x["column"], "check": chk, "dim": meta["dim"], "params": params, "threshold": 95.0, "severity": "warn",
                "author": "builder", "status": "active", "en": x["en"], "ar": "", "owner": PEOPLE[n % 3], "reviewer": "",
                "schedule": "nightly", "version": 1, "changed": "2026-10-%02d" % (10 + n % 18), "held": 0, "runs": runs,
                "rows": int(total) if total else 0,
            })

    alert_rules = [
        {"id": "AL-01", "event": "testFailed", "scope": {"kind": "repo", "id": "customer-master"}, "cond": {"severity": "quarantine"},
         "sev": "high", "channels": ["inapp", "email"], "to": [{"kind": "team", "id": "t-mdm"}], "quiet": "", "repeat": "once", "on": True,
         "owner": "سارة عادل", "fired7": 9, "last": "2026-11-16 06:26"},
        {"id": "AL-02", "event": "scoreBelow", "scope": {"kind": "all"}, "cond": {"value": 85}, "sev": "high",
         "channels": ["inapp", "email", "teams"], "to": [{"kind": "team", "id": "t-mdm"}, {"kind": "role", "id": "DATA_OWNER"}],
         "quiet": "22:00-07:00", "repeat": "daily", "on": True, "owner": "محمد", "fired7": 3, "last": "2026-11-17 06:05"},
        {"id": "AL-03", "event": "quarantineGrowth", "scope": {"kind": "repo", "id": "customer-master"}, "cond": {"value": 50, "hours": 24},
         "sev": "medium", "channels": ["inapp"], "to": [{"kind": "team", "id": "t-mdm"}], "quiet": "", "repeat": "once", "on": True,
         "owner": "سارة عادل", "fired7": 1, "last": "2026-11-15 09:40"},
        {"id": "AL-04", "event": "runFailed", "scope": {"kind": "jobKind", "id": "ingest"}, "cond": {"attempts": 2}, "sev": "high",
         "channels": ["inapp", "email", "teams"], "to": [{"kind": "team", "id": "t-eng"}], "quiet": "", "repeat": "every", "on": True,
         "owner": "أحمد ناصر", "fired7": 4, "last": "2026-11-16 03:12"},
        {"id": "AL-05", "event": "streamLag", "scope": {"kind": "jobKind", "id": "stream"}, "cond": {"minutes": 10}, "sev": "medium",
         "channels": ["teams"], "to": [{"kind": "team", "id": "t-eng"}], "quiet": "", "repeat": "hourly", "on": True,
         "owner": "أحمد ناصر", "fired7": 2, "last": "2026-11-14 17:20"},
        {"id": "AL-06", "event": "approvalOverdue", "scope": {"kind": "all"}, "cond": {"days": 3}, "sev": "low",
         "channels": ["inapp", "email"], "to": [{"kind": "role", "id": "approvers"}], "quiet": "18:00-08:00", "repeat": "daily", "on": True,
         "owner": "محمد", "fired7": 6, "last": "2026-11-17 08:00"},
        {"id": "AL-07", "event": "pythonError", "scope": {"kind": "all"}, "cond": {}, "sev": "medium",
         "channels": ["inapp"], "to": [{"kind": "team", "id": "t-eng"}], "quiet": "", "repeat": "once", "on": True,
         "owner": "أحمد ناصر", "fired7": 0, "last": "2026-11-02 02:14"},
        {"id": "AL-08", "event": "sourceStale", "scope": {"kind": "source", "id": "c4c"}, "cond": {"hours": 6}, "sev": "medium",
         "channels": ["inapp", "email"], "to": [{"kind": "team", "id": "t-eng"}], "quiet": "", "repeat": "once", "on": False,
         "owner": "أحمد ناصر", "fired7": 0, "last": ""},
    ]
    fired = [
        ("AL-02", "2026-11-17 06:05", "open", "", {"repo": "schools", "value": 72.5}),
        ("AL-02", "2026-11-17 06:05", "open", "", {"repo": "digital", "value": 68.0}),
        ("AL-06", "2026-11-17 08:00", "open", "", {"count": 4}),
        ("AL-01", "2026-11-16 06:26", "ack", "سارة عادل", {"test": "DQ-102", "count": 12}),
        ("AL-01", "2026-11-16 06:26", "ack", "سارة عادل", {"test": "DQ-101", "count": 8}),
        ("AL-04", "2026-11-16 03:12", "resolved", "أحمد ناصر", {"job": "erp_vendor_pull", "run": "R-5731"}),
        ("AL-02", "2026-11-16 06:05", "resolved", "محمد", {"repo": "authors", "value": 81.0}),
        ("AL-03", "2026-11-15 09:40", "resolved", "سارة عادل", {"repo": "customer-master", "count": 63}),
        ("AL-01", "2026-11-15 06:20", "resolved", "منى فاروق", {"test": "DQ-104", "count": 5}),
        ("AL-05", "2026-11-14 17:20", "resolved", "أحمد ناصر", {"job": "customer_standardise", "minutes": 14}),
        ("AL-04", "2026-11-13 03:05", "resolved", "أحمد ناصر", {"job": "c4c_customer_pull", "run": "R-5702"}),
        ("AL-06", "2026-11-13 08:00", "resolved", "محمد", {"count": 2}),
    ]
    alerts = [{"id": "A-%04d" % (3120 - i), "rule": r, "at": back7(at), "status": st, "by": by, "ctx": ctx} for i, (r, at, st, by, ctx) in enumerate(fired)]
    for r in alert_rules:
        r["last"] = back7(r["last"]) if r["last"] >= "2026-11-08" else r["last"]
    run_ids = nightly_runs(tests)
    for t in tests:
        for r in t["runs"]:
            r["run"] = run_ids[r["d"]]

    out = {
        "_comment": __doc__.strip().split("\n\n")[1].replace("\n", " "),
        "now": NOW, "days": DAYS, "dims": DIMS, "checks": CHECKS, "presets": PRESETS, "refLists": REF_LISTS,
        "pythonTemplate": '''from repoio_dq import column_check


@column_check(name="expect_my_rule", column="COLUMN")
def my_rule(value, ref):
    """Describe the rule in one line. Return True when the value passes."""
    return value is not None
''',
        "allowedPackages": ["great_expectations==1.3.5", "pandas==2.2.3", "python-stdnum==1.20", "repoio_dq (platform helper)"],
        "tests": tests, "alertRules": alert_rules, "alerts": alerts,
    }
    with open(os.path.join(ROOT, "dq.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("dq.json:", len(tests), "tests,", len(alert_rules), "alert rules,", len(alerts), "alerts")


if __name__ == "__main__":
    main()
