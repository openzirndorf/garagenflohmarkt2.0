"""Öffentliche Kennung eines Standes.

War früher ein zufällig gewürfelter Name (fränkischer Adjektiv+Rolle-Mix,
z.B. "Gscheide Kellerkönig") - bewusst umgestellt auf die Adresse selbst,
da sie ohnehin öffentlich sichtbar ist (siehe Datenschutzerklärung) und als
Kennung beim Wiederfinden auf der Karte/in der Liste deutlich nützlicher
ist als ein Fantasiename. Bei mehreren Ständen an derselben Adresse (z.B.
Mehrfamilienhaus) wird ein Zähler angehängt: "Musterstraße 1, Zirndorf",
"Musterstraße 1, Zirndorf #2", ...

Die DB-Spalte heißt weiterhin `nickname` (und im JSON entsprechend), um
nicht noch zusätzlich Backend-Response-Felder, Frontend-Typen und den
"#suche=<nickname>"-Teilen-Deep-Link (siehe frontend/src/lib/share.ts)
anfassen zu müssen - nur die Bedeutung des Werts ändert sich.
"""

import secrets
from collections.abc import Awaitable, Callable


async def generate_unique_identifier(
    adresse: str, exists: Callable[[str], Awaitable[bool]], max_attempts: int = 20
) -> str:
    """Erste Kollisionsprüfung ohne Suffix, danach ' #2', ' #3', ... - exists
    prüft z.B. gegen alle Stände außer dem gerade bearbeiteten (siehe
    app/routes/stands.py)."""
    for n in range(1, max_attempts + 1):
        candidate = adresse if n == 1 else f"{adresse} #{n}"
        if not await exists(candidate):
            return candidate
    # Sehr unwahrscheinlicher Fallback, falls #1..#20 alle belegt sind.
    return f"{adresse} #{secrets.randbelow(9000) + 1000}"
