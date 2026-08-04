"""Serverseitig generierte Nicknamen.

Es gibt bewusst kein Freitext-Namensfeld in irgendeinem Request-Body -
ein Klarname kann dadurch technisch nicht ins System gelangen. Der
Nickname ist sowohl die öffentliche Kennung auf der Karte (statt eines
echten Namens) als auch der Vorzeige-Nachweis bei Gewinn-Drop-
Reservierungen.
"""

import re
import secrets
from collections.abc import Awaitable, Callable

# Durchgehend fränkischer Dialekteinschlag statt generischer Standard-
# adjektive - alle in der schwachen Deklinationsendung "-e" (siehe NOMEN
# unten, Nominativ Singular nach implizitem Artikel).
ADJEKTIVE = [
    "Gscheide",
    "Ehrliche",
    "Feilschende",
    "Flinke",
    "Handelsfreudige",
    "Marktfrische",
    "Kernige",
    "Schlaue",
    "Sparsame",
    "Gewitzde",
    "Lohnende",
    "Goldige",
    "Gwiefde",
    "Bassende",
    "Tüchtiche",
]

# Flohmarkt-Rollen statt generischer Tiere - schwache Adjektivendung "-e"
# stimmt in der Nominativ-Kombination unabhängig vom Genus des Nomens
# (z.B. "Gscheide Kellerkönig", nicht "Gscheider Kellerkönig").
NOMEN = [
    "Kellerkönig",
    "Dachbodenheld",
    "Schnäppchenjäger",
    "Garagenräumer",
    "Krempelretter",
    "Schatzfinder",
    "Flohmarktfuchs",
    "Nachbarschatz",
    "Kruschtlkönig",
    "Wühlmeister",
]


def generate_nickname() -> str:
    return f"{secrets.choice(ADJEKTIVE)} {secrets.choice(NOMEN)}"


# Erlaubt zusätzlich das Zahlensuffix aus dem max_attempts-Fallback unten
# (z.B. "Gscheide Kellerkönig-4213"). Serverseitig gegen Direktaufrufe der
# API geprüft, nicht nur im Frontend - ein Klarname kann so selbst bei
# einer manuellen PATCH-Anfrage nicht ins System gelangen.
_NICKNAME_PATTERN = re.compile(
    "^(" + "|".join(re.escape(a) for a in ADJEKTIVE) + ") ("
    + "|".join(re.escape(n) for n in NOMEN) + r")(-\d{4})?$"
)


def is_valid_nickname(candidate: str) -> bool:
    return bool(_NICKNAME_PATTERN.fullmatch(candidate))


async def generate_unique_nickname(
    exists: Callable[[str], Awaitable[bool]], max_attempts: int = 5
) -> str:
    """Erzeugt einen Nicknamen und prüft ihn über `exists` auf Kollision
    (z.B. global unter allen Ständen, oder unter aktiven Reservierungen
    eines Drops). Nach `max_attempts` Kollisionen wird ein zusätzliches
    Zahlensuffix angehängt, um garantiert zu terminieren."""
    for _ in range(max_attempts):
        candidate = generate_nickname()
        if not await exists(candidate):
            return candidate
    return f"{generate_nickname()}-{secrets.randbelow(9000) + 1000}"
