import logging
from collections import defaultdict
from time import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr
from app.auth import require_admin_auth, require_api_auth
from app.database import get_pool
from app.email import FRONTEND_URL, send_confirmation_email, smtp_configured
from app.geocode import geocode

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Einfacher In-Memory Rate-Limiter (pro IP, max 3 Einreichungen pro Stunde)
# ---------------------------------------------------------------------------
_ip_requests: dict[str, list[float]] = defaultdict(list)
_RATE_WINDOW = 3600  # Sekunden
_RATE_MAX = 3


def _check_rate_limit(ip: str) -> bool:
    now = time()
    _ip_requests[ip] = [t for t in _ip_requests[ip] if now - t < _RATE_WINDOW]
    if len(_ip_requests[ip]) >= _RATE_MAX:
        return False
    _ip_requests[ip].append(now)
    return True


class StandIn(BaseModel):
    name: str
    adresse: str
    beschreibung: str | None = None
    email: EmailStr  # Pflichtfeld – wird für E-Mail-Bestätigung benötigt
    # Honeypot: muss leer bleiben; Bots füllen versteckte Felder aus
    website: str | None = None


# GET /stands – öffentlich (Karte ist public)
@router.get("/")
async def list_stands():
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, name, adresse, lat, lng, beschreibung, created_at "
        "FROM stands WHERE status = 'APPROVED' ORDER BY created_at DESC"
    )
    return [dict(r) for r in rows]


# GET /stands/geojson – öffentlich
@router.get("/geojson")
async def stands_geojson():
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, name, adresse, lat, lng, beschreibung FROM stands "
        "WHERE status = 'APPROVED' AND lat IS NOT NULL AND lng IS NOT NULL"
    )
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r["lng"], r["lat"]]},
                "properties": {
                    "id": r["id"],
                    "name": r["name"],
                    "adresse": r["adresse"],
                    "beschreibung": r["beschreibung"],
                },
            }
            for r in rows
        ],
    }


# POST /stands – Basic Auth (Credentials im Frontend via Vite-Env, verhindert Spam)
@router.post("/", status_code=201, dependencies=[Depends(require_api_auth)])
async def create_stand(body: StandIn, request: Request):
    # Honeypot: wenn ausgefüllt → Bot
    if body.website:
        raise HTTPException(status_code=400, detail="Ungültige Einreichung")

    # Rate-Limit: max 3 Einreichungen pro IP pro Stunde
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Zu viele Einreichungen. Bitte später erneut versuchen.")

    coords = await geocode(body.adresse)
    lat, lng = (coords[0], coords[1]) if coords else (None, None)

    pool = await get_pool()
    row = await pool.fetchrow(
        "INSERT INTO stands (name, adresse, lat, lng, beschreibung, email) "
        "VALUES ($1,$2,$3,$4,$5,$6) "
        "RETURNING id, name, adresse, lat, lng, beschreibung, status, edit_token, created_at",
        body.name, body.adresse, lat, lng, body.beschreibung, body.email,
    )
    result = dict(row)

    # Bestätigungsmail versenden (Fehler hier dürfen die Anmeldung nicht blockieren)
    try:
        await send_confirmation_email(body.email, body.name, str(result["edit_token"]))
    except Exception:
        logger.exception("E-Mail-Versand fehlgeschlagen für Stand %s", result["id"])

    result["email_confirmation_sent"] = smtp_configured()
    return result


# GET /stands/confirm/{edit_token} – E-Mail-Bestätigung (Link aus der Mail)
@router.get("/confirm/{edit_token}", response_class=HTMLResponse)
async def confirm_stand(edit_token: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "UPDATE stands SET status = 'APPROVED' "
        "WHERE edit_token = $1 AND status = 'PENDING' "
        "RETURNING id, name",
        edit_token,
    )

    manage_url = f"{FRONTEND_URL}#mein-stand/{edit_token}"

    if row:
        return HTMLResponse(_confirmation_html(
            title="Stand freigeschaltet!",
            heading="Dein Stand ist jetzt online.",
            message=f"<strong>{row['name']}</strong> ist nun auf der Karte sichtbar.",
            link=manage_url,
            link_label="Stand verwalten",
            success=True,
        ))

    # Bereits freigeschalten oder Token ungültig → trotzdem freundliche Antwort
    already = await pool.fetchrow(
        "SELECT id, name FROM stands WHERE edit_token = $1 AND status = 'APPROVED'",
        edit_token,
    )
    if already:
        return HTMLResponse(_confirmation_html(
            title="Bereits freigeschaltet",
            heading="Dein Stand ist bereits online.",
            message=f"<strong>{already['name']}</strong> ist schon auf der Karte sichtbar.",
            link=manage_url,
            link_label="Stand verwalten",
            success=True,
        ))

    return HTMLResponse(_confirmation_html(
        title="Link ungültig",
        heading="Dieser Link ist nicht mehr gültig.",
        message="Möglicherweise wurde der Stand bereits zurückgezogen.",
        link=FRONTEND_URL,
        link_label="Zur Startseite",
        success=False,
    ), status_code=404)


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


# GET /stands/by-token/{edit_token} – eigenen Stand abrufen (Token = Auth)
@router.get("/by-token/{edit_token}")
async def get_stand_by_token(edit_token: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id, name, adresse, lat, lng, beschreibung, status, edit_token, created_at "
        "FROM stands WHERE edit_token = $1",
        edit_token,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Stand nicht gefunden")
    return dict(row)


# DELETE /stands/by-token/{edit_token} – eigenen Stand zurückziehen
@router.delete("/by-token/{edit_token}", status_code=204)
async def cancel_stand(edit_token: str):
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM stands WHERE edit_token = $1",
        edit_token,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Stand nicht gefunden")


# GET /stands/admin – Bearer Token, NIE im Frontend verwenden
@router.get("/admin", dependencies=[Depends(require_admin_auth)])
async def admin_list():
    pool = await get_pool()
    rows = await pool.fetch("SELECT * FROM stands ORDER BY created_at DESC")
    return [dict(r) for r in rows]


# POST /stands/{id}/approve – Bearer Token
@router.post("/{stand_id}/approve", dependencies=[Depends(require_admin_auth)])
async def approve_stand(stand_id: int):
    pool = await get_pool()
    row = await pool.fetchrow(
        "UPDATE stands SET status = 'APPROVED' WHERE id = $1 RETURNING id, name, status",
        stand_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Stand nicht gefunden")
    return dict(row)
