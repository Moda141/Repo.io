"""Golden record rating used by the prototype sample generators.

In the product the rating is computed by the pipeline after survivorship (with the Great Expectations results and the
match probabilities) and returned by the golden records API; the console only shows it. This module is the sample
version of that rule so the generated data stays consistent: five checks with weights, a 0-100 score and 0-5 stars
in half steps."""
from datetime import date

TODAY = date(2026, 11, 16)
RULE_VERSION = "1"
# key, weight
FACTORS = [("quality", 30), ("agreement", 25), ("sources", 15), ("fresh", 15), ("clear", 15)]


def rating(quality, prob, sources, changed, clear):
    """quality 0-100, prob 0-1, sources count, changed 'YYYY-MM-DD...', clear: no open request or review."""
    d = date.fromisoformat(changed[:10])
    met = {"quality": quality >= 85, "agreement": prob >= 0.93, "sources": sources >= 2, "fresh": (TODAY - d).days <= 90, "clear": bool(clear)}
    score = sum(w for k, w in FACTORS if met[k])
    return {"stars": round(score / 20 * 2) / 2, "score": score, "ruleVersion": RULE_VERSION, "computed": "2026-11-16 02:10",
            "factors": [{"key": k, "met": met[k]} for k, _ in FACTORS]}
