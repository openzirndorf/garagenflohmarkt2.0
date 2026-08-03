"""Serverseitig generierte Nicknamen.

Es gibt bewusst kein Freitext-Namensfeld in irgendeinem Request-Body -
ein Klarname kann dadurch technisch nicht ins System gelangen. Der
Nickname ist sowohl die öffentliche Kennung auf der Karte (statt eines
echten Namens) als auch der Vorzeige-Nachweis bei Gewinn-Drop-
Reservierungen.
"""

import secrets
from collections.abc import Awaitable, Callable

# Durchgehend fränkischer Dialekteinschlag statt generischer Standard-
# adjektive - alle mit schwacher Femininum-Endung "-e" (siehe NOMEN unten).
ADJEKTIVE = [
    "Gscheide", "Schaffige", "Guade", "Herzensguade", "Liawe", "Gmiadliche",
    "Herzige", "Gwitzde", "Zwetschgasüße", "Allmächdige", "Kernige",
    "Quirlige", "Fleißige", "Rassige", "Allerbeste", "Kerwafeste",
]

# Fränkische Spezialitäten/Kerwa-Kultur statt generischer Tiere - alle Nomen
# bewusst feminin ("die X"), damit die schwache Adjektivendung "-e"
# grammatisch stimmt (z.B. "Gscheide Bratwurst", nicht "Gscheider Bratwurst").
NOMEN = [
    "Bratwurst", "Rostbratwurst", "Zwetschge", "Kerwa", "Kerwazeit",
    "Brotzeit", "Kirchweih", "Fasenacht", "Blaskapelle", "Zwiebel",
    "Wurstsemmel", "Bierbank", "Kerwamusik", "Gred", "Schoppenrunde",
    "Lebkuchenzeit",
]


def generate_nickname() -> str:
    return f"{secrets.choice(ADJEKTIVE)} {secrets.choice(NOMEN)}"


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
