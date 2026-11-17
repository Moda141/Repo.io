#!/usr/bin/env python3
"""Add the rating (tools/rating_rule.py) to the sample golden records of model/sample-data.json (repository pages).
Idempotent: the rating is recomputed from the record's own sample values."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rating_rule import rating

p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "webapp", "model", "sample-data.json")
d = json.load(open(p, encoding="utf-8"))
n = 0
for r in d["repos"].values():
    for g in r.get("goldenRecords", []):
        g["rating"] = rating(g["quality"], g["prob"], len(g["sources"]), g["lastMerge"], g["state"] == "Success")
        n += 1
open(p, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=1))
print("rated", n)
