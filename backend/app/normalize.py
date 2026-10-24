"""Standardization of customer attributes (Arabic-aware). Pure functions, no I/O."""
from __future__ import annotations

import re
import unicodedata

_DIACRITICS = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭ]")
_LETTER_MAP = str.maketrans(
    {
        "أ": "ا",  # أ -> ا
        "إ": "ا",  # إ -> ا
        "آ": "ا",  # آ -> ا
        "ٱ": "ا",  # ٱ -> ا
        "ى": "ي",  # ى -> ي
        "ة": "ه",  # ة -> ه
        "ؤ": "و",  # ؤ -> و
        "ئ": "ي",  # ئ -> ي
        "ـ": "",  # tatweel
        "ء": "",  # standalone hamza
        "ک": "ك",  # Persian kaf -> ك
        "ی": "ي",  # Persian yeh -> ي
    }
)
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
_NON_WORD = re.compile(r"[\W_]+", re.UNICODE)


def ascii_digits(text: str) -> str:
    return text.translate(_DIGITS)


def normalize_name(value: str | None) -> str:
    """Unify alef/yeh/teh-marbuta variants, remove diacritics, tatweel and punctuation, convert Arabic-Indic
    digits to ASCII, lowercase latin and collapse whitespace. Word boundaries are kept: 'عبد الرحمن' and
    'عبدالرحمن' stay different (that is a matching concern for M2, not a normalization one)."""
    if not value:
        return ""
    text = unicodedata.normalize("NFKC", str(value))
    text = _DIACRITICS.sub("", text).translate(_LETTER_MAP)
    text = ascii_digits(text).lower()
    return _NON_WORD.sub(" ", text).strip()


def normalize_phone(value: str | None, default_country: str = "20") -> str:
    """Return +<digits> or '' when the value is not a plausible phone number.

    National numbers (leading 0, or a bare 10-digit mobile starting with 1) get the default country code.
    """
    if not value:
        return ""
    raw = ascii_digits(str(value)).strip()
    has_plus = raw.startswith("+")
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    if digits.startswith("00"):
        digits, has_plus = digits[2:], True
    if not has_plus:
        if digits.startswith("0"):
            digits = default_country + digits[1:]
        elif digits.startswith("1") and len(digits) == 10:
            digits = default_country + digits
    if digits.startswith(default_country + "0"):  # "+20 010..." : drop the trunk zero
        digits = default_country + digits[len(default_country) + 1 :]
    if not 8 <= len(digits) <= 15:
        return ""
    return "+" + digits


def normalize_email(value: str | None) -> str:
    text = (value or "").strip().lower()
    return text if "@" in text and " " not in text else ""


def normalize_tax_id(value: str | None) -> str:
    return re.sub(r"[^0-9A-Za-z]", "", ascii_digits(value or "")).upper()


def standardize(fields: dict) -> dict:
    """Canonical fields -> standardized values."""
    return {
        "name": normalize_name(fields.get("name")),
        "phone": normalize_phone(fields.get("phone")),
        "email": normalize_email(fields.get("email")),
        "city": normalize_name(fields.get("city")),
        "tax_id": normalize_tax_id(fields.get("tax_id")),
    }
