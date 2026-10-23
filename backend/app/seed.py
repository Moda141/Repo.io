"""Demo data: synthetic Arabic customers spread across several source systems with intentional duplicates.

Each record keeps a ground-truth entity id in payload["_truth_entity"], which lets us evaluate Splink
(and build labelled pairs) in M2. This is synthetic data only: no real customers.
"""
import hashlib
import json
import random

from sqlalchemy.orm import Session

from .models import SourceRecord

SYSTEMS = ["C4C", "S4HANA", "CRM"]
FIRST = ["محمد", "أحمد", "محمود", "مصطفى", "إبراهيم", "عبدالله", "علي", "حسن", "خالد", "يوسف",
         "فاطمة", "مريم", "نورهان", "آية", "هدى", "سارة", "منى", "إيمان", "عائشة", "ياسمين"]
LAST = ["السيد", "عبدالرحمن", "الشريف", "حجازي", "عثمان", "الجمل", "منصور", "فهمي", "الصاوي", "إسماعيل",
        "عبدالعزيز", "الدسوقي", "البنا", "رمضان", "جاد", "عيسى"]
CITIES = ["القاهرة", "الجيزة", "الإسكندرية", "المنصورة", "طنطا", "أسيوط", "الأقصر", "بورسعيد"]
COMPANIES = ["مكتبة", "دار", "مؤسسة", "شركة"]


def _normalize_ar(text: str) -> str:
    """Typical cross-system spelling drift in Arabic names."""
    table = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ة": "ه"})
    return text.translate(table)


def _typo(text: str, rng: random.Random) -> str:
    if len(text) < 5:
        return text
    i = rng.randrange(1, len(text) - 1)
    return text[:i] + text[i + 1:]


def _phone_variants(local: str) -> list[str]:
    # local looks like 01012345678
    return [local, f"+20 {local[1:4]} {local[4:7]} {local[7:]}", f"0020{local[1:]}", f"{local[:4]}-{local[4:]}"]


def _make_entities(rng: random.Random, n: int) -> list[dict]:
    entities = []
    for i in range(n):
        is_company = rng.random() < 0.25
        if is_company:
            name = f"{rng.choice(COMPANIES)} {rng.choice(LAST)} {rng.choice(['للنشر', 'للتوزيع', 'التجارية', 'الحديثة'])}"
        else:
            name = f"{rng.choice(FIRST)} {rng.choice(LAST)} {rng.choice(LAST)}"
        local = "01" + rng.choice("0125") + "".join(rng.choice("0123456789") for _ in range(8))
        email_id = f"cust{i}{rng.randrange(100, 999)}"
        entities.append({
            "entity": i,
            "name": name,
            "phone": local,
            "email": f"{email_id}@example.com",
            "city": rng.choice(CITIES),
            "tax_id": "".join(rng.choice("0123456789") for _ in range(9)) if is_company else "",
        })
    return entities


def _variant(entity: dict, rng: random.Random, noisy: bool) -> dict:
    name, phone, email, city = entity["name"], entity["phone"], entity["email"], entity["city"]
    if noisy:
        roll = rng.random()
        if roll < 0.4:
            name = _normalize_ar(name)
        elif roll < 0.7:
            name = _typo(name, rng)
        else:
            name = " ".join(reversed(name.split(" ", 1))) if " " in name and rng.random() < 0.5 else name
        phone = rng.choice(_phone_variants(phone))
        if rng.random() < 0.3:
            email = ""
        if rng.random() < 0.2:
            city = ""
    return {"name": name, "phone": phone, "email": email, "city": city, "tax_id": entity["tax_id"]}


def build_records(n_entities: int = 120, seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    records = []
    counters = {s: 0 for s in SYSTEMS}
    for entity in _make_entities(rng, n_entities):
        # ~55% of entities live in several systems; ~15% are duplicated within one system
        systems = rng.sample(SYSTEMS, k=rng.choices([1, 2, 3], weights=[45, 40, 15])[0])
        copies = []
        for system in systems:
            copies.append(system)
            if rng.random() < 0.15:
                copies.append(system)
        for j, system in enumerate(copies):
            counters[system] += 1
            variant = _variant(entity, rng, noisy=j > 0)
            records.append({
                "source_system": system,
                "source_id": f"{system[:3]}-{counters[system]:05d}",
                **variant,
                "payload": {"_truth_entity": entity["entity"]},
            })
    return records


def _hash(rec: dict) -> str:
    body = {k: rec[k] for k in ("name", "phone", "email", "city", "tax_id")}
    return hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def seed_demo_records(db: Session, n_entities: int = 120, seed: int = 42) -> int:
    records = build_records(n_entities, seed)
    for rec in records:
        db.add(SourceRecord(record_hash=_hash(rec), **rec))
    db.commit()
    return len(records)


if __name__ == "__main__":
    from .db import Base, SessionLocal, engine

    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        print(f"seeded {seed_demo_records(session)} source records")
