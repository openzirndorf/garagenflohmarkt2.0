import logging
from datetime import timedelta

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from app.auth import require_admin_auth, require_api_auth
from app.database import get_pool
from app.email import send_admin_login_email
from app.rate_limit import check_rate_limit
from app.tokens import hash_token, new_login_code, new_session_token, normalize_code

logger = logging.getLogger(__name__)

router = APIRouter()

_RATE_WINDOW_SECONDS = 3600  # 1 Stunde
_LOGIN_REQUEST_RATE_MAX = 5  # max. "Code anfordern"-Versuche pro IP pro Zeitfenster
_REDEEM_CODE_RATE_MAX = 10  # max. Code-Einlöseversuche pro IP pro Zeitfenster

# Kurz wie stands' LOGIN_REQUEST_TTL - ein Admin, der gerade einen Code
# anfordert, tippt ihn typischerweise sofort ein.
_ADMIN_LOGIN_TTL = timedelta(minutes=30)
# Genauso großzügig wie stands' SESSION_TOKEN_TTL, aus demselben Grund:
# liegt in localStorage (siehe admin-panel.tsx), übersteht also ein
# Schließen der Seite/App, statt sich bei jedem erneuten Öffnen neu
# einloggen zu müssen. War ursprünglich 8 Stunden, kombiniert mit
# sessionStorage (pro Tab) faktisch trotzdem ein ständiges Neu-Einloggen.
_ADMIN_SESSION_TTL = timedelta(days=45)


class AdminLoginRequestIn(BaseModel):
    email: EmailStr


# POST /admins/request-login - Basic Auth wie stands' request-login
# (Credentials stecken im Frontend-Build, verhindert Spam von außerhalb
# der eigenen App). Immer dieselbe Antwort, unabhängig davon ob die
# E-Mail im Roster steht - verhindert, dass sich über diesen Endpunkt
# erraten lässt, wer Admin ist (Muster aus stands.py request_login).
@router.post("/request-login", dependencies=[Depends(require_api_auth)])
async def request_admin_login(body: AdminLoginRequestIn, request: Request):
    pool = await get_pool()

    client_ip = request.client.host if request.client else "unknown"
    allowed = await check_rate_limit(
        pool, f"admin-request-login:{client_ip}", _RATE_WINDOW_SECONDS, _LOGIN_REQUEST_RATE_MAX
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="Zu viele Anfragen. Bitte später erneut versuchen.")

    row = await pool.fetchrow("SELECT id FROM admins WHERE email = $1", body.email)
    if row:
        login_code, login_token_hash, login_token_expires_at = new_login_code(_ADMIN_LOGIN_TTL)
        await pool.execute(
            "UPDATE admins SET login_token_hash = $1, login_token_expires_at = $2 WHERE id = $3",
            login_token_hash, login_token_expires_at, row["id"],
        )
        try:
            await send_admin_login_email(body.email, login_code)
        except Exception as exc:  # noqa: BLE001 - Mailversand darf die Anfrage nie fehlschlagen lassen
            logger.error("Admin-Login-Mail fehlgeschlagen für %s (%s)", row["id"], type(exc).__name__)

    return {
        "message": "Falls diese E-Mail-Adresse als Admin hinterlegt ist, "
        "wurde gerade ein Zugangscode verschickt."
    }


class AdminRedeemCodeIn(BaseModel):
    code: str


# POST /admins/redeem-code - tauscht den per Mail verschickten Code gegen
# ein session_token ein (Muster aus stands.py redeem_code).
@router.post("/redeem-code")
async def redeem_admin_code(body: AdminRedeemCodeIn, request: Request):
    pool = await get_pool()

    client_ip = request.client.host if request.client else "unknown"
    allowed = await check_rate_limit(
        pool, f"admin-redeem-code:{client_ip}", _RATE_WINDOW_SECONDS, _REDEEM_CODE_RATE_MAX
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="Zu viele Versuche. Bitte später erneut versuchen.")

    token_hash = hash_token(normalize_code(body.code))
    session_token, session_token_hash, session_token_expires_at = new_session_token(_ADMIN_SESSION_TTL)

    row = await pool.fetchrow(
        """
        UPDATE admins SET
            login_token_hash = NULL, login_token_expires_at = NULL,
            session_token_hash = $2, session_token_expires_at = $3
        WHERE login_token_hash = $1 AND login_token_expires_at > now()
        RETURNING id
        """,
        token_hash, session_token_hash, session_token_expires_at,
    )

    if not row:
        # Einmalig verwendbar: siehe stands.py redeem_code - dieselbe
        # bewusste Unschärfe zwischen "schon benutzt", "abgelaufen", "falsch".
        raise HTTPException(
            status_code=404,
            detail="Code ungültig, abgelaufen oder bereits verwendet.",
        )

    return {"session_token": session_token}


class AdminRosterIn(BaseModel):
    email: EmailStr


# GET/POST /admins, DELETE /admins/{id} - Roster-Verwaltung (wer zählt als
# Admin). Bewusst weiterhin hinter dem statischen Master-Token
# (require_admin_auth), nicht hinter einer Admin-Session: löst das
# Henne-Ei-Problem beim allerersten Eintrag, ohne ein eigenes Bootstrap-
# Skript zu brauchen - der Master-Token existiert schon und ist nur dem
# Betreiber bekannt. Absichtlich kein Selbstbedienungs-Mechanismus, bei dem
# ein eingeloggter Admin weitere Admins anlegen könnte.
# Zusätzlich auf "" (ohne Slash) registriert - siehe app/main.py's
# Catch-all-Route für das mitgebaute Frontend: "/admins" ohne Slash würde
# sonst dort statt hier landen, bevor Starlettes redirect_slashes greifen
# kann (Details siehe Kommentar bei list_stands in app/routes/stands.py -
# live an genau dieser Stelle einmal aufgefallen). "dependencies=" gilt
# nur pro einzelner @router-Dekoration, nicht pro Funktion - deshalb auf
# BEIDEN Routen wiederholt, sonst wäre "/admins" ohne Slash unauthentifiziert
# erreichbar gewesen.
@router.get("", dependencies=[Depends(require_admin_auth)])
@router.get("/", dependencies=[Depends(require_admin_auth)])
async def list_admins():
    pool = await get_pool()
    rows = await pool.fetch("SELECT id, email, created_at FROM admins ORDER BY created_at")
    return [dict(r) for r in rows]


@router.post("", status_code=201, dependencies=[Depends(require_admin_auth)])
@router.post("/", status_code=201, dependencies=[Depends(require_admin_auth)])
async def add_admin(body: AdminRosterIn):
    pool = await get_pool()
    try:
        row = await pool.fetchrow(
            "INSERT INTO admins (email) VALUES ($1) RETURNING id, email, created_at",
            body.email,
        )
    except asyncpg.UniqueViolationError as exc:
        raise HTTPException(status_code=409, detail="E-Mail ist bereits Admin.") from exc
    return dict(row)


@router.delete("/{admin_id}", status_code=204, dependencies=[Depends(require_admin_auth)])
async def remove_admin(admin_id: int):
    pool = await get_pool()
    result = await pool.execute("DELETE FROM admins WHERE id = $1", admin_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Admin nicht gefunden")
