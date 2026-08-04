"""Blockliste für Freitextfelder (Adresse, Beschreibung) gegen Hassrede,
Extremismus-Bezüge und einschlägige Codes/Symbole.

Wortgrenzen-Matching (nicht Teilstring), damit z.B. "Sieger" nicht wegen
"sieg" blockiert wird. Reine Zahlencodes (z.B. "88") werden NUR in
`beschreibung` geprüft, nie in `adresse` - dort sind kurze Zahlenfolgen
als Hausnummern (oder Preisangaben) alltäglich und würden sonst massenhaft
falsch blockiert. Das ist ein bewusster Kompromiss: die verbleibende
False-Positive-Rate in `beschreibung` (z.B. "88 Cent") ist klein gegenüber
dem, was in `adresse` entstünde.

Kein Ersatz für menschliche Moderation - fängt offensichtlichen Missbrauch
ab, bevor ein Stand automatisch live geht (siehe "erster Login schaltet
frei" in app/routes/stands.py). Admins können zusätzlich per
content_locked/content_lock_message einen Stand nach manueller Korrektur
gegen erneute Bearbeitung durch den Inhaber sperren.
"""

import re

# Wortbasierte Begriffe - gelten für Adresse UND Beschreibung.
_WORD_TERMS = [
    "nazi", "nazis", "hitler", "hakenkreuz", "swastika",
    "sieg heil", "heil hitler", "kauft nicht bei juden",
    "judenverrecken", "judensau", "reichsbürger",
    "acab", "1312",
    "kanake", "kanaken", "kümmelt", "negerkuss",
    "wichser", "hurensohn", "hurentochter",
]

# Reine Zahlencodes - nur in beschreibung geprüft (siehe Docstring oben).
_NUMERIC_CODES = ["88", "18", "1488", "14/88", "444", "168"]

_WORD_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(t) for t in _WORD_TERMS) + r")\b",
    re.IGNORECASE,
)
_NUMERIC_PATTERN = re.compile(
    r"(?<!\d)(" + "|".join(re.escape(c) for c in _NUMERIC_CODES) + r")(?!\d)"
)


def contains_blocked_content(text: str | None, *, check_numeric_codes: bool = False) -> bool:
    if not text:
        return False
    if _WORD_PATTERN.search(text):
        return True
    return bool(check_numeric_codes and _NUMERIC_PATTERN.search(text))
