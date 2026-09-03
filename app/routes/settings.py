"""Zwei globale Verhaltens-Schalter fürs Admin-Panel (siehe
migrations/0015_app_settings.sql) - eine Singleton-Zeile statt einer
generischen Key-Value-Tabelle, weil es bisher nur diese zwei Booleans gibt:

- require_manual_approval: wenn true, schaltet der E-Mail-Code-Login
  (POST /stands/redeem-code) einen frisch bestätigten Stand NICHT mehr
  automatisch frei - er bleibt PENDING, bis ein Admin ihn manuell
  freigibt (POST /stands/{id}/approve). Wirkt nur auf künftige Logins,
  ändert nichts an bereits freigeschalteten Ständen.
- beschreibung_enabled: wenn false, blendet das Anmeldeformular das
  Freitextfeld "Was gibt es zu kaufen?" aus, und die Registrierung
  speichert keine Beschreibung (siehe create_stand in app/routes/stands.py).

GET ist bewusst ohne Auth: das öffentliche Anmeldeformular muss
beschreibung_enabled kennen, BEVOR sich jemand einloggt.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import require_admin_session_auth
from app.database import get_pool

router = APIRouter()


class SettingsOut(BaseModel):
    require_manual_approval: bool
    beschreibung_enabled: bool


class SettingsPatch(BaseModel):
    require_manual_approval: bool | None = None
    beschreibung_enabled: bool | None = None


# GET /settings - öffentlich. Dual "" + "/" registriert, aus demselben
# Grund wie GET /stands (siehe dort): die immer registrierte SPA-Catch-
# all-Route in app/main.py würde eine bloß mit "/" registrierte Route bei
# Aufruf ohne Slash sonst stillschweigend abfangen.
@router.get("", response_model=SettingsOut)
@router.get("/", response_model=SettingsOut)
async def get_settings():
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT require_manual_approval, beschreibung_enabled FROM app_settings"
    )
    return dict(row)


# PATCH /settings - Bearer Token (Admin-Session)
@router.patch("", dependencies=[Depends(require_admin_session_auth)], response_model=SettingsOut)
@router.patch("/", dependencies=[Depends(require_admin_session_auth)], response_model=SettingsOut)
async def update_settings(body: SettingsPatch):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")

    pool = await get_pool()
    set_clause = ", ".join(f"{k} = ${i + 1}" for i, k in enumerate(updates))
    values = list(updates.values())
    row = await pool.fetchrow(
        f"UPDATE app_settings SET {set_clause}, updated_at = now() "
        f"RETURNING require_manual_approval, beschreibung_enabled",
        *values,
    )
    return dict(row)
