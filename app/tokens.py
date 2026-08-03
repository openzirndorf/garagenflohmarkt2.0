"""Kryptografische Tokens: Erzeugung, Hashing, Ablauf.

Tokens sind bereits 256 Bit zufällig (secrets.token_urlsafe) - ein
langsamer Passwort-KDF wie bcrypt/argon2 verteidigt gegen Brute-Force auf
*geratene* Geheimnisse (z.B. Passwörter), was hier nicht der Bedrohungsfall
ist. Ein einfacher SHA-256-Hash reicht aus und erlaubt zusätzlich einen
indizierten `WHERE token_hash = $1`-Lookup statt eines Vergleichs über
jede Zeile.

Echte Magic-Links statt eines permanenten Edit-Tokens: ein login_token
wird per Mail verschickt (einmalig verwendbar, befristet), ein Klick
darauf tauscht ihn gegen ein session_token ein, das für die Dauer der
Bearbeitung gilt. Nichts davon verlässt den Server außer per E-Mail-Link.
"""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

# Registrierungs-Aktivierungslink: großzügig befristet, da Formular-
# Ausfüllende E-Mails nicht immer sofort checken und ein PENDING-Stand
# noch nicht öffentlich sichtbar ist - kein Risiko durch die längere Frist.
REGISTRATION_LOGIN_TTL = timedelta(hours=24)

# "Zugang anfordern"-Link für eine spätere Anmeldung: kurz befristet, da
# hier eine aktiv wartende Person den Link typischerweise sofort anklickt.
LOGIN_REQUEST_TTL = timedelta(minutes=30)

# Session-Token nach dem Login: reicht für eine Bearbeitungssitzung.
SESSION_TOKEN_TTL = timedelta(minutes=60)


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def token_matches(token: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_token(token), stored_hash)


def new_login_token(ttl: timedelta) -> tuple[str, str, datetime]:
    """Gibt (Klartext-Token, Hash, Ablaufzeitpunkt) zurück."""
    token = generate_token()
    expires_at = datetime.now(UTC) + ttl
    return token, hash_token(token), expires_at


def new_session_token() -> tuple[str, str, datetime]:
    """Gibt (Klartext-Token, Hash, Ablaufzeitpunkt) zurück."""
    token = generate_token()
    expires_at = datetime.now(UTC) + SESSION_TOKEN_TTL
    return token, hash_token(token), expires_at
