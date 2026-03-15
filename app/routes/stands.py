from collections import defaultdict
from time import time

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.auth import require_admin_auth, require_api_auth
from app.database import get_pool
from app.geocode import geocode

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
    email: str | None = None
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
    return dict(row)


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
