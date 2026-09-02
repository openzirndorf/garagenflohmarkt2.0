import os
import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBasic, HTTPBearer

from app.database import get_pool
from app.tokens import hash_token

# --- Basic Auth für Frontend-Endpunkte (POST /stands) ---

_basic = HTTPBasic()

_API_USERNAME = os.environ.get("API_USERNAME", "")
_API_PASSWORD = os.environ.get("API_PASSWORD", "")


def require_api_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_basic),  # noqa: B008 - FastAPI-Idiom
) -> None:
    """Timing-sicherer Vergleich verhindert Timing-Angriffe."""
    username_ok = secrets.compare_digest(
        credentials.username.encode(), _API_USERNAME.encode()
    )
    password_ok = secrets.compare_digest(
        credentials.password.encode(), _API_PASSWORD.encode()
    )
    if not (username_ok and password_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültige Zugangsdaten",
            headers={"WWW-Authenticate": "Basic"},
        )


# --- Bearer Token für Admin-Endpunkte (nie im Frontend verwenden) ---

_bearer = HTTPBearer()

_ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")


def require_admin_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),  # noqa: B008 - FastAPI-Idiom
) -> None:
    """Statischer Master-Token - bewusst nur noch für die Roster-Verwaltung
    (app/routes/admins.py: wer zählt als Admin) verwendet, nicht mehr für
    die alltäglichen Admin-Endpunkte (siehe require_admin_session_auth
    unten). Löst das Henne-Ei-Problem beim allerersten Admin-Eintrag, ohne
    ein eigenes Bootstrap-Skript zu brauchen."""
    if not secrets.compare_digest(credentials.credentials.encode(), _ADMIN_TOKEN.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiger Admin-Token",
        )


async def require_admin_session_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),  # noqa: B008 - FastAPI-Idiom
) -> None:
    """Für die alltäglichen Admin-Endpunkte (Standliste, Freigabe,
    Bearbeiten, Löschen, Audit-Log) - Bearer-Token ist hier ein per E-Mail-
    Code eingelöster Session-Token (siehe app/routes/admins.py), keine
    statische Env-Var mehr. Gleicher Transportweg wie bisher
    (Authorization: Bearer ...), damit sich am Frontend nur der Token-WERT
    ändert, nicht die Art der Übertragung."""
    pool = await get_pool()
    valid = await pool.fetchval(
        "SELECT EXISTS(SELECT 1 FROM admins "
        "WHERE session_token_hash = $1 AND session_token_expires_at > now())",
        hash_token(credentials.credentials),
    )
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sitzung abgelaufen oder ungültig",
        )
