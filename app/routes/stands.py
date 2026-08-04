import logging

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr

from app.auth import require_admin_auth, require_api_auth
from app.database import get_pool
from app.email import FRONTEND_URL, send_login_email, smtp_configured, smtp_debug_info
from app.geocode import geocode
from app.jobs.stands_artifact import regenerate_stands_artifact
from app.nicknames import generate_unique_nickname, is_valid_nickname
from app.public_fields import PUBLIC_GEOJSON_COLUMNS, PUBLIC_LIST_COLUMNS, rows_to_geojson
from app.rate_limit import check_rate_limit
from app.tokens import (
    LOGIN_REQUEST_TTL,
    REGISTRATION_LOGIN_TTL,
    generate_token,
    hash_token,
    new_login_token,
    new_session_token,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_RATE_WINDOW_SECONDS = 3600  # 1 Stunde
_RATE_MAX = 3  # max. Einreichungen pro IP pro Zeitfenster
_LOGIN_REQUEST_RATE_MAX = 5  # max. "Zugang anfordern"-Versuche pro IP pro Zeitfenster

# Felder, die der Stand-Inhaber über seine Session zu sehen bekommt.
# Bewusst ohne E-Mail und ohne irgendein Token.
_OWNER_COLUMNS = (
    "id, nickname, adresse, lat, lng, beschreibung, kategorien, uhrzeit, status, created_at"
)

# Admin sieht zusätzlich E-Mail und den Ablauf eines evtl. offenen
# Login-Links, aber nie Token-Hashes oder Klartext-Tokens.
_ADMIN_COLUMNS = (
    "id, nickname, adresse, lat, lng, beschreibung, email, kategorien, uhrzeit, "
    "status, created_at, login_token_expires_at, session_token_expires_at"
)


class StandIn(BaseModel):
    adresse: str
    beschreibung: str | None = None
    email: EmailStr  # Pflichtfeld - einziges Login-Merkmal, ein Stand pro E-Mail
    kategorien: list[str] = []
    uhrzeit: str | None = None
    # Honeypot: muss leer bleiben; Bots füllen versteckte Felder aus
    website: str | None = None


class StandPatch(BaseModel):
    adresse: str | None = None
    beschreibung: str | None = None
    kategorien: list[str] | None = None
    uhrzeit: str | None = None
    # Nur einer der vom Server vorgeschlagenen Namen (siehe
    # POST .../nickname-suggestions), nie Freitext - is_valid_nickname()
    # unten erzwingt das serverseitig, unabhängig vom Frontend.
    nickname: str | None = None


class LoginRequestIn(BaseModel):
    email: EmailStr


async def _nickname_exists(pool, candidate: str) -> bool:
    return bool(await pool.fetchval("SELECT EXISTS(SELECT 1 FROM stands WHERE nickname = $1)", candidate))


# GET /stands - öffentlich (Karte ist public)
@router.get("/")
async def list_stands():
    pool = await get_pool()
    rows = await pool.fetch(
        f"SELECT {PUBLIC_LIST_COLUMNS} FROM stands WHERE status = 'APPROVED' ORDER BY created_at DESC"
    )
    return [dict(r) for r in rows]


# GET /stands/geojson - öffentlich
@router.get("/geojson")
async def stands_geojson():
    pool = await get_pool()
    rows = await pool.fetch(
        f"SELECT {PUBLIC_GEOJSON_COLUMNS} FROM stands "
        "WHERE status = 'APPROVED' AND lat IS NOT NULL AND lng IS NOT NULL"
    )
    return rows_to_geojson(rows)


# POST /stands - Basic Auth (Credentials im Frontend via Vite-Env, verhindert Spam)
@router.post("/", status_code=201, dependencies=[Depends(require_api_auth)])
async def create_stand(body: StandIn, request: Request):
    # Honeypot: wenn ausgefüllt → Bot
    if body.website:
        raise HTTPException(status_code=400, detail="Ungültige Einreichung")

    pool = await get_pool()

    client_ip = request.client.host if request.client else "unknown"
    allowed = await check_rate_limit(pool, f"create-stand:{client_ip}", _RATE_WINDOW_SECONDS, _RATE_MAX)
    if not allowed:
        raise HTTPException(status_code=429, detail="Zu viele Einreichungen. Bitte später erneut versuchen.")

    coords = await geocode(body.adresse)
    lat, lng = (coords[0], coords[1]) if coords else (None, None)

    nickname = await generate_unique_nickname(lambda c: _nickname_exists(pool, c))
    login_token, login_token_hash, login_token_expires_at = new_login_token(REGISTRATION_LOGIN_TTL)

    try:
        row = await pool.fetchrow(
            "INSERT INTO stands (nickname, adresse, lat, lng, beschreibung, email, kategorien, uhrzeit, "
            "login_token_hash, login_token_expires_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) "
            f"RETURNING {_OWNER_COLUMNS}",
            nickname, body.adresse, lat, lng, body.beschreibung, body.email,
            body.kategorien, body.uhrzeit, login_token_hash, login_token_expires_at,
        )
    except asyncpg.UniqueViolationError as exc:
        if "email" in str(exc):
            raise HTTPException(
                status_code=409,
                detail="Für diese E-Mail-Adresse existiert bereits ein Stand. "
                "Nutze 'Zugang anfordern', um ihn zu verwalten.",
            ) from exc
        raise

    result = dict(row)

    # Login-Mail versenden (Fehler hier dürfen die Anmeldung nicht blockieren)
    try:
        await send_login_email(body.email, nickname, login_token, first_time=True)
    except Exception as exc:  # noqa: BLE001 - Mailversand darf Anmeldung nie blockieren
        # Nur Exception-Typ loggen, nie die Nachricht - SMTP-Exceptions
        # betten häufig die Empfängeradresse in ihre Fehlermeldung ein.
        logger.error("E-Mail-Versand fehlgeschlagen für Stand %s (%s)", result["id"], type(exc).__name__)

    result["login_email_sent"] = smtp_configured()
    return result


# POST /stands/request-login - Basic Auth, fordert einen neuen Magic-Link an
@router.post("/request-login", dependencies=[Depends(require_api_auth)])
async def request_login(body: LoginRequestIn, request: Request):
    pool = await get_pool()

    client_ip = request.client.host if request.client else "unknown"
    allowed = await check_rate_limit(
        pool, f"request-login:{client_ip}", _RATE_WINDOW_SECONDS, _LOGIN_REQUEST_RATE_MAX
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="Zu viele Anfragen. Bitte später erneut versuchen.")

    row = await pool.fetchrow("SELECT id, nickname FROM stands WHERE email = $1", body.email)
    if row:
        login_token, login_token_hash, login_token_expires_at = new_login_token(LOGIN_REQUEST_TTL)
        await pool.execute(
            "UPDATE stands SET login_token_hash = $1, login_token_expires_at = $2 WHERE id = $3",
            login_token_hash, login_token_expires_at, row["id"],
        )
        try:
            await send_login_email(body.email, row["nickname"], login_token, first_time=False)
        except Exception as exc:  # noqa: BLE001 - Mailversand darf die Anfrage nie fehlschlagen lassen
            logger.error("Login-Mail fehlgeschlagen für Stand %s (%s)", row["id"], type(exc).__name__)

    # Immer dieselbe Antwort - unabhängig davon, ob die E-Mail existiert
    # (verhindert, dass sich über diesen Endpunkt erraten lässt, welche
    # E-Mail-Adressen registriert sind).
    return {
        "message": "Falls diese E-Mail-Adresse bei einem Stand hinterlegt ist, "
        "wurde gerade ein Anmeldelink verschickt."
    }


# GET /stands/session/{login_token} - Bestätigungsseite aus der Mail.
# Löst den Token bewusst NICHT ein (siehe POST unten) - automatische
# Link-Scanner in E-Mail-Gateways würden sonst den einmalig gültigen Token
# verbrauchen, bevor die Person selbst klickt.
@router.get("/session/{login_token}", response_class=HTMLResponse)
async def session_confirm_page(login_token: str):
    return HTMLResponse(_login_confirm_html(login_token))


# POST /stands/session/{login_token} - löst den Login-Link tatsächlich ein
@router.post("/session/{login_token}", response_class=HTMLResponse)
async def session_login(login_token: str, background_tasks: BackgroundTasks):
    pool = await get_pool()
    token_hash = hash_token(login_token)

    session_token, session_token_hash, session_token_expires_at = new_session_token()

    # `old.status` erfasst den Stand VOR dem Update - nur so lässt sich
    # unterscheiden, ob dieser Login gerade erst PENDING→APPROVED
    # freigeschaltet hat, oder ob es ein Wiederkehrer-Login war.
    row = await pool.fetchrow(
        """
        WITH old AS (
            SELECT id, status FROM stands
            WHERE login_token_hash = $1 AND login_token_expires_at > now()
        )
        UPDATE stands SET
            login_token_hash = NULL, login_token_expires_at = NULL,
            session_token_hash = $2, session_token_expires_at = $3,
            status = CASE WHEN old.status = 'PENDING' THEN 'APPROVED' ELSE old.status END
        FROM old
        WHERE stands.id = old.id
        RETURNING stands.id, stands.nickname, old.status AS previous_status
        """,
        token_hash, session_token_hash, session_token_expires_at,
    )

    if not row:
        # Einmalig verwendbar: nach erfolgreichem Login wird der Hash
        # gelöscht. Ein zweiter Aufruf desselben Links kann daher nicht
        # mehr zwischen "schon benutzt", "abgelaufen" und "ungültig"
        # unterscheiden - das ist beabsichtigt.
        return HTMLResponse(_confirmation_html(
            title="Link ungültig",
            heading="Dieser Link ist nicht mehr gültig.",
            message="Er wurde entweder bereits verwendet, ist abgelaufen, oder der Stand wurde zurückgezogen. "
            "Du kannst dir jederzeit einen neuen Anmeldelink schicken lassen.",
            link=f"{FRONTEND_URL}#mein-stand",
            link_label="Neuen Link anfordern",
            success=False,
        ), status_code=404)

    manage_url = f"{FRONTEND_URL}#mein-stand/session/{session_token}"
    was_pending = row["previous_status"] == "PENDING"
    if was_pending:
        # Stand ist gerade erst öffentlich geworden (PENDING→APPROVED).
        background_tasks.add_task(regenerate_stands_artifact)
    return HTMLResponse(_confirmation_html(
        title="Eingeloggt",
        heading=(
            f"Dein Stand ist jetzt online, {row['nickname']}!"
            if was_pending
            else f"Willkommen zurück, {row['nickname']}!"
        ),
        message="Du kannst deinen Stand jetzt für diese Sitzung bearbeiten oder zurückziehen.",
        link=manage_url,
        link_label="Zu meinem Stand",
        success=True,
    ))


def _login_confirm_html(login_token: str) -> str:
    return f"""\
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Anmeldung bestätigen – Garagenflohmarkt Zirndorf</title>
  <style>
    body {{font-family:sans-serif;display:flex;align-items:center;justify-content:center;
          min-height:100vh;margin:0;background:#f9fafb}}
    .card {{background:#fff;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,.1);
            padding:40px 48px;max-width:480px;text-align:center}}
    h1 {{font-size:1.5rem;margin:.5rem 0 1rem;color:#111827}}
    p {{color:#374151;line-height:1.6}}
    button {{margin-top:24px;background:#2563eb;color:#fff;border:none;cursor:pointer;
             padding:12px 28px;border-radius:8px;font-weight:bold;font-size:1rem}}
    button:hover {{opacity:.9}}
  </style>
</head>
<body>
  <div class="card">
    <h1>Bist du das?</h1>
    <p>Klicke den Knopf, um dich für deinen Garagenflohmarkt-Stand einzuloggen.</p>
    <form method="post" action="/stands/session/{login_token}">
      <button type="submit">Ja, einloggen</button>
    </form>
  </div>
</body>
</html>
"""


def _confirmation_html(
    title: str, heading: str, message: str, link: str, link_label: str, success: bool
) -> str:
    color = "#16a34a" if success else "#dc2626"
    icon = "✓" if success else "✗"
    return f"""\
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title} – Garagenflohmarkt Zirndorf</title>
  <style>
    body {{font-family:sans-serif;display:flex;align-items:center;justify-content:center;
          min-height:100vh;margin:0;background:#f9fafb}}
    .card {{background:#fff;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,.1);
            padding:40px 48px;max-width:480px;text-align:center}}
    .icon {{font-size:3rem;color:{color}}}
    h1 {{color:{color};font-size:1.5rem;margin:.5rem 0 1rem}}
    p {{color:#374151;line-height:1.6}}
    a.btn {{display:inline-block;margin-top:24px;background:{color};color:#fff;
            padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold}}
    a.btn:hover {{opacity:.9}}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">{icon}</div>
    <h1>{heading}</h1>
    <p>{message}</p>
    <a class="btn" href="{link}">{link_label}</a>
  </div>
</body>
</html>
"""


# GET /stands/by-session/{session_token} - eigenen Stand abrufen
@router.get("/by-session/{session_token}")
async def get_stand_by_session(session_token: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        f"SELECT {_OWNER_COLUMNS} FROM stands "
        "WHERE session_token_hash = $1 AND session_token_expires_at > now()",
        hash_token(session_token),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Sitzung abgelaufen oder ungültig")
    return dict(row)


# GET /stands/by-session/{session_token}/export - Art. 15 DSGVO Auskunft
@router.get("/by-session/{session_token}/export")
async def export_stand_by_session(session_token: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        f"SELECT {_OWNER_COLUMNS}, email FROM stands "
        "WHERE session_token_hash = $1 AND session_token_expires_at > now()",
        hash_token(session_token),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Sitzung abgelaufen oder ungültig")
    return dict(row)


# PATCH /stands/by-session/{session_token} - eigenen Stand bearbeiten
@router.patch("/by-session/{session_token}")
async def update_stand(session_token: str, body: StandPatch, background_tasks: BackgroundTasks):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")

    if "nickname" in updates and not is_valid_nickname(updates["nickname"]):
        raise HTTPException(status_code=400, detail="Ungültiger Standname")

    if "adresse" in updates:
        coords = await geocode(updates["adresse"])
        updates["lat"], updates["lng"] = (coords[0], coords[1]) if coords else (None, None)

    set_clause = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(updates))
    values = list(updates.values())

    pool = await get_pool()
    try:
        row = await pool.fetchrow(
            f"UPDATE stands SET {set_clause} "
            "WHERE session_token_hash = $1 AND session_token_expires_at > now() "
            f"RETURNING {_OWNER_COLUMNS}",
            hash_token(session_token), *values,
        )
    except asyncpg.UniqueViolationError as exc:
        if "nickname" in str(exc):
            raise HTTPException(
                status_code=409,
                detail="Dieser Standname ist inzwischen vergeben. Bitte neu würfeln.",
            ) from exc
        raise
    if not row:
        raise HTTPException(status_code=404, detail="Sitzung abgelaufen oder ungültig")
    if row["status"] == "APPROVED":
        background_tasks.add_task(regenerate_stands_artifact)
    return dict(row)


# POST /stands/by-session/{session_token}/nickname-suggestions - würfelt
# 3 alternative Standnamen zur Auswahl, ohne sie zu reservieren (reine
# Vorschau; erst PATCH mit dem gewählten Namen schreibt in die DB).
@router.post("/by-session/{session_token}/nickname-suggestions")
async def suggest_nicknames(session_token: str):
    pool = await get_pool()
    session_valid = await pool.fetchval(
        "SELECT EXISTS(SELECT 1 FROM stands "
        "WHERE session_token_hash = $1 AND session_token_expires_at > now())",
        hash_token(session_token),
    )
    if not session_valid:
        raise HTTPException(status_code=404, detail="Sitzung abgelaufen oder ungültig")

    batch: set[str] = set()

    async def taken(candidate: str) -> bool:
        return candidate in batch or await _nickname_exists(pool, candidate)

    for _ in range(3):
        candidate = await generate_unique_nickname(taken)
        batch.add(candidate)

    return {"suggestions": sorted(batch)}


# DELETE /stands/by-session/{session_token} - eigenen Stand zurückziehen
@router.delete("/by-session/{session_token}", status_code=204)
async def cancel_stand(session_token: str, background_tasks: BackgroundTasks):
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM stands WHERE session_token_hash = $1 AND session_token_expires_at > now()",
        hash_token(session_token),
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Sitzung abgelaufen oder ungültig")
    background_tasks.add_task(regenerate_stands_artifact)


# POST /stands/test-email - Bearer Token, sendet Test-Mail und gibt Ergebnis zurück
@router.post("/test-email", dependencies=[Depends(require_admin_auth)])
async def test_email(to: str):
    info = smtp_debug_info()
    if not info["configured"]:
        return {"ok": False, "config": info, "error": "SMTP nicht vollständig konfiguriert"}
    try:
        await send_login_email(to, "Testnutzer", generate_token(), first_time=True)
        return {"ok": True, "config": info}
    except Exception as exc:  # noqa: BLE001 - Admin-Diagnose-Endpunkt, soll jeden SMTP-Fehler anzeigen
        return {"ok": False, "config": info, "error": str(exc)}


# GET /stands/admin - Bearer Token, NIE im Frontend verwenden
@router.get("/admin", dependencies=[Depends(require_admin_auth)])
async def admin_list():
    pool = await get_pool()
    rows = await pool.fetch(f"SELECT {_ADMIN_COLUMNS} FROM stands ORDER BY created_at DESC")
    return [dict(r) for r in rows]


# PATCH /stands/{id} - Bearer Token (Admin bearbeitet Stand)
@router.patch("/{stand_id}", dependencies=[Depends(require_admin_auth)])
async def update_stand_admin(stand_id: int, body: StandPatch, background_tasks: BackgroundTasks):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")

    if "adresse" in updates:
        coords = await geocode(updates["adresse"])
        updates["lat"], updates["lng"] = (coords[0], coords[1]) if coords else (None, None)

    set_clause = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(updates))
    values = list(updates.values())

    pool = await get_pool()
    row = await pool.fetchrow(
        f"UPDATE stands SET {set_clause} WHERE id = $1 "
        f"RETURNING {_ADMIN_COLUMNS}",
        stand_id, *values,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Stand nicht gefunden")
    if row["status"] == "APPROVED":
        background_tasks.add_task(regenerate_stands_artifact)
    return dict(row)


# DELETE /stands/{id} - Bearer Token (Admin löscht Stand)
@router.delete("/{stand_id}", status_code=204, dependencies=[Depends(require_admin_auth)])
async def delete_stand_admin(stand_id: int, background_tasks: BackgroundTasks):
    pool = await get_pool()
    result = await pool.execute("DELETE FROM stands WHERE id = $1", stand_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Stand nicht gefunden")
    background_tasks.add_task(regenerate_stands_artifact)


# POST /stands/{id}/approve - Bearer Token (manuelle Freigabe, z.B. falls die
# Login-Mail nie ankommt und Admin und Person sich direkt abstimmen)
@router.post("/{stand_id}/approve", dependencies=[Depends(require_admin_auth)])
async def approve_stand(stand_id: int, background_tasks: BackgroundTasks):
    pool = await get_pool()
    row = await pool.fetchrow(
        "UPDATE stands SET status = 'APPROVED' WHERE id = $1 RETURNING id, nickname, status",
        stand_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Stand nicht gefunden")
    background_tasks.add_task(regenerate_stands_artifact)
    return dict(row)
