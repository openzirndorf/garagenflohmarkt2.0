import os
import secrets
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBearer, HTTPAuthorizationCredentials

# --- Basic Auth für Frontend-Endpunkte (POST /stands) ---

_basic = HTTPBasic()

_API_USERNAME = os.environ.get("API_USERNAME", "")
_API_PASSWORD = os.environ.get("API_PASSWORD", "")


def require_api_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_basic),
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
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> None:
    if not secrets.compare_digest(credentials.credentials.encode(), _ADMIN_TOKEN.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiger Admin-Token",
        )
