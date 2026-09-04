"""Kryptografische Tokens: Erzeugung, Hashing, Ablauf.

Tokens sind bereits 256 Bit zufällig (secrets.token_urlsafe) - ein
langsamer Passwort-KDF wie bcrypt/argon2 verteidigt gegen Brute-Force auf
*geratene* Geheimnisse (z.B. Passwörter), was hier nicht der Bedrohungsfall
ist. Ein einfacher SHA-256-Hash reicht aus und erlaubt zusätzlich einen
indizierten `WHERE token_hash = $1`-Lookup statt eines Vergleichs über
jede Zeile.

Kein Magic-Link mehr, sondern ein eintippbarer Login-Code: die App ist als
PWA installierbar, und ein Link aus der Mail-App öffnet dort typischerweise
NICHT das installierte PWA-Fenster (v.a. iOS Safari unterstützt das
grundsätzlich nicht) - der Code umgeht das, da nichts angeklickt werden
muss. Kürzer als der frühere 256-Bit-Token, daher zusätzlich per
Rate-Limiting gegen Erraten abgesichert (siehe app/routes/stands.py).
"""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

# Registrierungs-Bestätigungscode: großzügig befristet, da Formular-
# Ausfüllende E-Mails nicht immer sofort checken und ein PENDING-Stand
# noch nicht öffentlich sichtbar ist - kein Risiko durch die längere Frist.
REGISTRATION_LOGIN_TTL = timedelta(hours=24)

# "Zugang anfordern"-Code für eine spätere Anmeldung: kurz befristet, da
# hier eine aktiv wartende Person den Code typischerweise sofort eintippt.
LOGIN_REQUEST_TTL = timedelta(minutes=30)

# Session-Token nach dem Login: großzügig befristet (deutlich über die
# Zeitspanne zwischen Anmeldung und Event hinaus) - wird im Frontend
# in localStorage abgelegt (siehe mein-stand.tsx), überlebt also ein
# Schließen der Seite/App. War ursprünglich 60 Minuten, kombiniert mit
# sessionStorage (pro Tab, weg beim Schließen) führte das dazu, dass sich
# Standbetreiber quasi bei jedem erneuten Öffnen neu einloggen mussten.
SESSION_TOKEN_TTL = timedelta(days=45)


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def token_matches(token: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_token(token), stored_hash)


# Ohne 0/O, 1/I/L - leicht zu verwechseln, wenn von Hand aus einer Mail
# abgetippt. 8 Zeichen aus 30-Zeichen-Alphabet ≈ 39 Bit Entropie - kombiniert
# mit Ablauf + Rate-Limiting ausreichend für diese Bedrohungslage (schlimmster
# Fall: jemand bearbeitet/löscht einen fremden Flohmarkt-Stand).
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8


def normalize_code(code: str) -> str:
    """Großschreibung + Whitespace vereinheitlichen, bevor gehasht/verglichen
    wird - Nutzer tippen Codes unterschiedlich ab (Leerzeichen, Kleinschreibung)."""
    return code.strip().upper().replace(" ", "")


def generate_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(CODE_LENGTH))


def new_login_code(ttl: timedelta) -> tuple[str, str, datetime]:
    """Gibt (Klartext-Code, Hash, Ablaufzeitpunkt) zurück."""
    code = generate_code()
    expires_at = datetime.now(UTC) + ttl
    return code, hash_token(code), expires_at


def new_session_token(ttl: timedelta = SESSION_TOKEN_TTL) -> tuple[str, str, datetime]:
    """Gibt (Klartext-Token, Hash, Ablaufzeitpunkt) zurück. Optionales ttl
    für Sitzungen mit anderer Lebensdauer als die einer Stand-Bearbeitung
    (siehe ADMIN_SESSION_TTL in app/routes/admins.py)."""
    token = generate_token()
    expires_at = datetime.now(UTC) + ttl
    return token, hash_token(token), expires_at
