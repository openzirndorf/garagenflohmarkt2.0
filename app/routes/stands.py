import logging

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from app.audit import log_action
from app.auth import require_admin_auth, require_admin_session_auth, require_api_auth
from app.database import get_pool
from app.email import (
    send_deactivation_email,
    send_deactivation_reply_email,
    send_login_email,
    send_report_email,
    smtp_configured,
    smtp_debug_info,
)
from app.geocode import geocode
from app.jobs.stands_artifact import regenerate_stands_artifact
from app.moderation import contains_blocked_content
from app.nicknames import generate_unique_nickname, is_valid_nickname
from app.public_fields import (
    PUBLIC_GEOJSON_COLUMNS,
    PUBLIC_LIST_COLUMNS,
    PUBLIC_STANDS_FILTER,
    rows_to_geojson,
)
from app.rate_limit import check_rate_limit
from app.tokens import (
    LOGIN_REQUEST_TTL,
    REGISTRATION_LOGIN_TTL,
    generate_code,
    hash_token,
    new_login_code,
    new_session_token,
    normalize_code,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_RATE_WINDOW_SECONDS = 3600  # 1 Stunde
_RATE_MAX = 3  # max. Einreichungen pro IP pro Zeitfenster
_LOGIN_REQUEST_RATE_MAX = 5  # max. "Zugang anfordern"-Versuche pro IP pro Zeitfenster
_REDEEM_CODE_RATE_MAX = 10  # max. Code-Einlöseversuche pro IP pro Zeitfenster
_DEACTIVATION_REPLY_RATE_MAX = 5  # max. Antworten auf eine Deaktivierung pro IP pro Zeitfenster
_REPORT_RATE_MAX = 5  # max. Meldungen pro IP pro Zeitfenster

# Feste Werteliste statt Freitext - anders als kategorien (rein deko) hat ein
# falsch geschriebener Zahlungsart-Wert echte Verwechslungsgefahr auf der
# öffentlichen Karte, deshalb serverseitig validiert (siehe
# _reject_if_invalid_zahlungsarten).
_VALID_ZAHLUNGSARTEN = {"PayPal", "Wero", "Barzahlung"}

# Begrenzt, damit ein einzelner Stand nicht praktisch alle Kategorien auf
# einmal markiert (macht die Kategorie-Badges in Liste/Karte unübersichtlich
# und die Kategorie-Filter im Panel nutzlos, wenn die meisten Stände ohnehin
# überall auftauchen).
_MAX_KATEGORIEN = 5

# Verhindert, dass eine einzelne Beschreibung Standkarte/Popup optisch
# sprengt (lief zuvor unbegrenzt aus dem Rahmen). Muss mit
# MAX_BESCHREIBUNG_LENGTH in frontend/src/components/stand-form.tsx
# übereinstimmen.
_MAX_BESCHREIBUNG_LENGTH = 100

# Felder, die der Stand-Inhaber über seine Session zu sehen bekommt.
# Bewusst ohne E-Mail und ohne irgendein Token.
_OWNER_COLUMNS = (
    "id, nickname, adresse, lat, lng, beschreibung, kategorien, zahlungsarten, status, "
    "created_at, deactivated, deactivation_message, address_consent_at"
)

# Admin sieht zusätzlich E-Mail und den Ablauf eines evtl. offenen
# Login-Links, aber nie Token-Hashes oder Klartext-Tokens.
_ADMIN_COLUMNS = (
    "id, nickname, adresse, lat, lng, beschreibung, email, kategorien, zahlungsarten, "
    "status, created_at, login_token_expires_at, session_token_expires_at, "
    "deactivated, deactivation_message, deactivation_reply_message, "
    "deactivation_reply_created_at, address_consent_at"
)


def _reject_if_blocked_content(adresse: str | None, beschreibung: str | None) -> None:
    if contains_blocked_content(adresse) or contains_blocked_content(
        beschreibung, check_numeric_codes=True
    ):
        raise HTTPException(
            status_code=400,
            detail="Adresse oder Beschreibung enthält nicht erlaubte Inhalte. "
            "Bitte überarbeite den Text.",
        )


def _reject_if_invalid_zahlungsarten(values: list[str] | None) -> None:
    if values and not set(values) <= _VALID_ZAHLUNGSARTEN:
        raise HTTPException(status_code=400, detail="Ungültige Zahlungsart")


def _reject_if_too_many_kategorien(values: list[str] | None) -> None:
    if values and len(values) > _MAX_KATEGORIEN:
        raise HTTPException(
            status_code=400,
            detail=f"Höchstens {_MAX_KATEGORIEN} Kategorien pro Stand",
        )


def _reject_if_too_long_beschreibung(value: str | None) -> None:
    if value and len(value) > _MAX_BESCHREIBUNG_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Beschreibung darf höchstens {_MAX_BESCHREIBUNG_LENGTH} Zeichen lang sein",
        )


# Zirndorfs einzige Postleitzahl - der Garagenflohmarkt findet nur hier statt.
_ZIRNDORF_POSTCODE = "90513"


def _reject_if_outside_zirndorf(postcode: str | None) -> None:
    # Nur ablehnen, wenn das Geocoding tatsächlich eine PLZ geliefert hat -
    # ein genereller Geocoding-Fehlschlag (postcode=None, z.B. API-Ausfall
    # oder unbekannte Adresse) bleibt weiterhin ohne Koordinaten erlaubt,
    # statt fälschlich als "nicht Zirndorf" geblockt zu werden (siehe
    # geocode()-Docstring: Geocoding-Fehler dürfen nie blockieren).
    if postcode is not None and postcode != _ZIRNDORF_POSTCODE:
        raise HTTPException(
            status_code=400,
            detail="Der Garagenflohmarkt findet nur in Zirndorf statt. Diese Adresse liegt laut "
            f"Geocoding außerhalb (PLZ {postcode}).",
        )


class StandIn(BaseModel):
    adresse: str
    beschreibung: str | None = None
    email: EmailStr  # Pflichtfeld - einziges Login-Merkmal, ein Stand pro E-Mail
    kategorien: list[str] = []
    zahlungsarten: list[str] = []
    # Eigene Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) statt berechtigtem
    # Interesse, weil eine Privatadresse öffentlich auf einer Karte landet -
    # muss vom Frontend aktiv angehakt worden sein, wird serverseitig
    # erzwungen (siehe create_stand), nicht nur als UI-Hinweis behandelt.
    datenschutz_zustimmung: bool = False
    # Art. 8 DSGVO: Einwilligung von Kindern unter 16 ist ohne
    # Erziehungsberechtigte nicht wirksam - Deutschland hat die nationale
    # Öffnungsklausel nicht auf ein niedrigeres Alter abgesenkt.
    mindestalter_bestaetigt: bool = False
    # Honeypot: muss leer bleiben; Bots füllen versteckte Felder aus
    website: str | None = None


class StandPatch(BaseModel):
    adresse: str | None = None
    beschreibung: str | None = None
    kategorien: list[str] | None = None
    zahlungsarten: list[str] | None = None
    # Nur einer der vom Server vorgeschlagenen Namen (siehe
    # POST .../nickname-suggestions), nie Freitext - is_valid_nickname()
    # unten erzwingt das serverseitig, unabhängig vom Frontend.
    nickname: str | None = None


class AdminStandPatch(StandPatch):
    # Nur über den Admin-Endpunkt setzbar (siehe update_stand_admin) - der
    # Inhaber kann sich damit nicht selbst deaktivieren/reaktivieren. Nimmt
    # den Stand komplett von Karte/Liste (siehe PUBLIC_STANDS_FILTER).
    deactivated: bool | None = None
    deactivation_message: str | None = None


class LoginRequestIn(BaseModel):
    email: EmailStr


async def _nickname_exists(pool, candidate: str) -> bool:
    return bool(await pool.fetchval("SELECT EXISTS(SELECT 1 FROM stands WHERE nickname = $1)", candidate))


# GET /stands - öffentlich (Karte ist public). Zusätzlich auf "" (ohne
# Slash) registriert: seit app/main.py eine Catch-all-Route für das
# mitgebaute Frontend hat (siehe dort), matcht "/stands" ohne Slash sonst
# diese Catch-all-Route statt zu "/stands/" umzuleiten (Starlettes
# automatischer redirect_slashes greift nur, wenn sich sonst KEIN Match
# findet) - lieferte dann index.html statt der Standliste aus. Live
# beobachtet: fetchStands()' Fallback-Pfad in api.ts ruft bewusst ohne
# Slash auf.
@router.get("")
@router.get("/")
async def list_stands():
    pool = await get_pool()
    rows = await pool.fetch(
        f"SELECT {PUBLIC_LIST_COLUMNS} FROM stands WHERE {PUBLIC_STANDS_FILTER} ORDER BY created_at DESC"
    )
    return [dict(r) for r in rows]


# GET /stands/geojson - öffentlich
@router.get("/geojson")
async def stands_geojson():
    pool = await get_pool()
    rows = await pool.fetch(
        f"SELECT {PUBLIC_GEOJSON_COLUMNS} FROM stands "
        f"WHERE {PUBLIC_STANDS_FILTER} AND lat IS NOT NULL AND lng IS NOT NULL"
    )
    return rows_to_geojson(rows)


# POST /stands - Basic Auth (Credentials im Frontend via Vite-Env, verhindert Spam)
@router.post("/", status_code=201, dependencies=[Depends(require_api_auth)])
async def create_stand(body: StandIn, request: Request):
    # Honeypot: wenn ausgefüllt → Bot
    if body.website:
        raise HTTPException(status_code=400, detail="Ungültige Einreichung")

    if not body.datenschutz_zustimmung:
        raise HTTPException(
            status_code=400,
            detail="Bitte bestätige, dass deine Adresse öffentlich sichtbar wird.",
        )
    if not body.mindestalter_bestaetigt:
        raise HTTPException(status_code=400, detail="Bitte bestätige das Mindestalter von 16 Jahren.")

    _reject_if_blocked_content(body.adresse, body.beschreibung)
    _reject_if_invalid_zahlungsarten(body.zahlungsarten)
    _reject_if_too_many_kategorien(body.kategorien)
    _reject_if_too_long_beschreibung(body.beschreibung)

    pool = await get_pool()

    client_ip = request.client.host if request.client else "unknown"
    allowed = await check_rate_limit(pool, f"create-stand:{client_ip}", _RATE_WINDOW_SECONDS, _RATE_MAX)
    if not allowed:
        raise HTTPException(status_code=429, detail="Zu viele Einreichungen. Bitte später erneut versuchen.")

    geo = await geocode(body.adresse)
    if geo:
        _reject_if_outside_zirndorf(geo.postcode)
    lat, lng = (geo.lat, geo.lng) if geo else (None, None)
    # Einheitlich formatierte Adresse aus dem Geocoding-Ergebnis statt der
    # frei getippten Eingabe ("Straße Hausnummer, PLZ Ort") - fällt bei
    # fehlgeschlagenem Geocoding oder unvollständigen Bestandteilen auf die
    # Roheingabe zurück (siehe geocode()/_format_adresse).
    adresse = geo.formatted_adresse if geo and geo.formatted_adresse else body.adresse

    # beschreibung_enabled (siehe app/routes/settings.py) blendet das
    # Freitextfeld im Anmeldeformular aus - hier serverseitig noch mal
    # durchgesetzt, statt dem Frontend allein zu vertrauen, falls jemand
    # trotzdem direkt gegen die API postet.
    settings_row = await pool.fetchrow("SELECT beschreibung_enabled FROM app_settings")
    beschreibung = body.beschreibung if (not settings_row or settings_row["beschreibung_enabled"]) else None

    nickname = await generate_unique_nickname(lambda c: _nickname_exists(pool, c))
    login_code, login_token_hash, login_token_expires_at = new_login_code(REGISTRATION_LOGIN_TTL)

    try:
        row = await pool.fetchrow(
            "INSERT INTO stands (nickname, adresse, lat, lng, beschreibung, email, kategorien, "
            "zahlungsarten, login_token_hash, login_token_expires_at, address_consent_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()) "
            f"RETURNING {_OWNER_COLUMNS}",
            nickname, adresse, lat, lng, beschreibung, body.email,
            body.kategorien, body.zahlungsarten, login_token_hash, login_token_expires_at,
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
    await log_action(pool, result["id"], "CREATED", "owner")

    # Login-Mail versenden (Fehler hier dürfen die Anmeldung nicht blockieren)
    try:
        await send_login_email(body.email, login_code, first_time=True)
    except Exception as exc:  # noqa: BLE001 - Mailversand darf Anmeldung nie blockieren
        # Nur Exception-Typ loggen, nie die Nachricht - SMTP-Exceptions
        # betten häufig die Empfängeradresse in ihre Fehlermeldung ein.
        logger.error("E-Mail-Versand fehlgeschlagen für Stand %s (%s)", result["id"], type(exc).__name__)

    result["login_email_sent"] = smtp_configured()
    return result


# POST /stands/request-login - Basic Auth, fordert einen neuen Login-Code an
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
        login_code, login_token_hash, login_token_expires_at = new_login_code(LOGIN_REQUEST_TTL)
        await pool.execute(
            "UPDATE stands SET login_token_hash = $1, login_token_expires_at = $2 WHERE id = $3",
            login_token_hash, login_token_expires_at, row["id"],
        )
        try:
            await send_login_email(body.email, login_code, first_time=False)
        except Exception as exc:  # noqa: BLE001 - Mailversand darf die Anfrage nie fehlschlagen lassen
            logger.error("Login-Mail fehlgeschlagen für Stand %s (%s)", row["id"], type(exc).__name__)

    # Immer dieselbe Antwort - unabhängig davon, ob die E-Mail existiert
    # (verhindert, dass sich über diesen Endpunkt erraten lässt, welche
    # E-Mail-Adressen registriert sind).
    return {
        "message": "Falls diese E-Mail-Adresse bei einem Stand hinterlegt ist, "
        "wurde gerade ein Zugangscode verschickt."
    }


class RedeemCodeIn(BaseModel):
    code: str


# POST /stands/redeem-code - tauscht den per Mail verschickten Code gegen ein
# session_token ein. Bewusst reines JSON statt HTML-Seiten: ohne Klick auf
# einen Link (siehe app/tokens.py) entfällt auch die Link-Scanner-Problematik,
# die zuvor den zweistufigen GET/POST-Bestätigungsflow nötig gemacht hat.
@router.post("/redeem-code")
async def redeem_code(body: RedeemCodeIn, request: Request, background_tasks: BackgroundTasks):
    pool = await get_pool()

    client_ip = request.client.host if request.client else "unknown"
    allowed = await check_rate_limit(
        pool, f"redeem-code:{client_ip}", _RATE_WINDOW_SECONDS, _REDEEM_CODE_RATE_MAX
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="Zu viele Versuche. Bitte später erneut versuchen.")

    token_hash = hash_token(normalize_code(body.code))
    session_token, session_token_hash, session_token_expires_at = new_session_token()

    # require_manual_approval (siehe app/routes/settings.py): wenn an,
    # bleibt ein frisch bestätigter Stand PENDING statt automatisch
    # freigeschaltet zu werden - der Login selbst (Token einlösen,
    # Session ausstellen) funktioniert unverändert, nur der Status wechselt
    # dann nicht mehr von selbst.
    settings_row = await pool.fetchrow("SELECT require_manual_approval FROM app_settings")
    require_manual_approval = bool(settings_row and settings_row["require_manual_approval"])
    new_status_sql = (
        "old.status"
        if require_manual_approval
        else "CASE WHEN old.status = 'PENDING' THEN 'APPROVED' ELSE old.status END"
    )

    # `old.status` erfasst den Stand VOR dem Update - nur so lässt sich
    # unterscheiden, ob dieser Login gerade erst PENDING→APPROVED
    # freigeschaltet hat, oder ob es ein Wiederkehrer-Login war.
    row = await pool.fetchrow(
        f"""
        WITH old AS (
            SELECT id, status FROM stands
            WHERE login_token_hash = $1 AND login_token_expires_at > now()
        )
        UPDATE stands SET
            login_token_hash = NULL, login_token_expires_at = NULL,
            session_token_hash = $2, session_token_expires_at = $3,
            status = {new_status_sql}
        FROM old
        WHERE stands.id = old.id
        RETURNING stands.id, stands.nickname, old.status AS previous_status
        """,
        token_hash, session_token_hash, session_token_expires_at,
    )

    if not row:
        # Einmalig verwendbar: nach erfolgreichem Einlösen wird der Hash
        # gelöscht. Ein zweiter Versuch mit demselben Code kann daher nicht
        # mehr zwischen "schon benutzt", "abgelaufen" und "falsch"
        # unterscheiden - das ist beabsichtigt.
        raise HTTPException(
            status_code=404,
            detail="Code ungültig, abgelaufen oder bereits verwendet. "
            "Du kannst dir jederzeit einen neuen über 'Zugang anfordern' schicken lassen.",
        )

    was_pending = row["previous_status"] == "PENDING"
    if was_pending and not require_manual_approval:
        # Stand ist gerade erst öffentlich geworden (PENDING→APPROVED).
        background_tasks.add_task(regenerate_stands_artifact)
        await log_action(pool, row["id"], "APPROVED", "owner")

    return {
        "session_token": session_token,
        "nickname": row["nickname"],
        "was_pending": was_pending,
    }


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
    if "zahlungsarten" in updates:
        _reject_if_invalid_zahlungsarten(updates["zahlungsarten"])
    if "kategorien" in updates:
        _reject_if_too_many_kategorien(updates["kategorien"])
    if "beschreibung" in updates:
        _reject_if_too_long_beschreibung(updates["beschreibung"])

    pool = await get_pool()

    if "adresse" in updates or "beschreibung" in updates:
        _reject_if_blocked_content(updates.get("adresse"), updates.get("beschreibung"))

    if "adresse" in updates:
        geo = await geocode(updates["adresse"])
        if geo:
            _reject_if_outside_zirndorf(geo.postcode)
        updates["lat"], updates["lng"] = (geo.lat, geo.lng) if geo else (None, None)
        if geo and geo.formatted_adresse:
            updates["adresse"] = geo.formatted_adresse

    set_clause = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(updates))
    values = list(updates.values())

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
    await log_action(pool, row["id"], "EDITED", "owner")
    if row["status"] == "APPROVED":
        background_tasks.add_task(regenerate_stands_artifact)
    return dict(row)


class DeactivationReplyIn(BaseModel):
    message: str


# POST /stands/by-session/{session_token}/deactivation-reply - einzige
# Möglichkeit für einen deaktivierten Inhaber, den Admin zu erreichen (z.B.
# um die Deaktivierung zu erklären oder ihre Aufhebung zu bitten). Wird
# sowohl per Mail an den Admin geschickt als auch auf
# deactivation_reply_message gespeichert, damit sie im Admin-Panel sichtbar
# ist - nicht im Audit-Log, das weiterhin nie Inhalte speichert (siehe
# app/audit.py). Wird beim Reaktivieren automatisch wieder gelöscht (siehe
# update_stand_admin).
@router.post("/by-session/{session_token}/deactivation-reply")
async def reply_to_deactivation(session_token: str, body: DeactivationReplyIn, request: Request):
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Nachricht darf nicht leer sein")

    pool = await get_pool()

    client_ip = request.client.host if request.client else "unknown"
    allowed = await check_rate_limit(
        pool, f"deactivation-reply:{client_ip}", _RATE_WINDOW_SECONDS, _DEACTIVATION_REPLY_RATE_MAX
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="Zu viele Nachrichten. Bitte später erneut versuchen.")

    row = await pool.fetchrow(
        "SELECT id, nickname, deactivated FROM stands "
        "WHERE session_token_hash = $1 AND session_token_expires_at > now()",
        hash_token(session_token),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Sitzung abgelaufen oder ungültig")
    if not row["deactivated"]:
        raise HTTPException(status_code=400, detail="Dein Stand ist nicht deaktiviert")

    await pool.execute(
        "UPDATE stands SET deactivation_reply_message = $1, deactivation_reply_created_at = now() "
        "WHERE id = $2",
        message, row["id"],
    )

    try:
        await send_deactivation_reply_email(row["id"], row["nickname"], message)
    except Exception as exc:  # noqa: BLE001 - Mailversand darf die Anfrage nie fehlschlagen lassen
        logger.error("Deaktivierungs-Antwort-Mail fehlgeschlagen für Stand %s (%s)", row["id"], type(exc).__name__)

    await log_action(pool, row["id"], "REPLIED", "owner")
    return {"message": "Deine Nachricht wurde an das Team geschickt."}


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


# DELETE /stands/by-session/{session_token} - eigenen Stand vollständig löschen
@router.delete("/by-session/{session_token}", status_code=204)
async def cancel_stand(session_token: str, background_tasks: BackgroundTasks):
    pool = await get_pool()
    row = await pool.fetchrow(
        "DELETE FROM stands WHERE session_token_hash = $1 AND session_token_expires_at > now() "
        "RETURNING id",
        hash_token(session_token),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Sitzung abgelaufen oder ungültig")
    await log_action(pool, row["id"], "DELETED", "owner")
    background_tasks.add_task(regenerate_stands_artifact)


class ReportStandIn(BaseModel):
    grund: str


# POST /stands/{id}/report - öffentlich, Meldefunktion für Besucher (falsche
# oder fremde Einträge). Grund ist Pflicht (serverseitig erzwungen, nicht
# nur im Frontend) - eine grundlose Meldung wäre für den Admin nicht
# einordenbar. Bewusst kein neuer Kontaktweg mit sichtbarer E-Mail-Adresse
# zum Abschöpfen durch Bots - stattdessen wie bei deactivation-reply nur eine Mail
# an den Admin-Kontakt, der Grund wird nicht gespeichert, nur die Aktion
# selbst (kein Freitext im Audit-Log).
@router.post("/{stand_id}/report")
async def report_stand(stand_id: int, body: ReportStandIn, request: Request):
    if not body.grund.strip():
        raise HTTPException(status_code=400, detail="Bitte gib einen Grund für die Meldung an.")

    pool = await get_pool()

    client_ip = request.client.host if request.client else "unknown"
    allowed = await check_rate_limit(pool, f"report:{client_ip}", _RATE_WINDOW_SECONDS, _REPORT_RATE_MAX)
    if not allowed:
        raise HTTPException(status_code=429, detail="Zu viele Meldungen. Bitte später erneut versuchen.")

    row = await pool.fetchrow("SELECT id, nickname FROM stands WHERE id = $1", stand_id)
    if not row:
        raise HTTPException(status_code=404, detail="Stand nicht gefunden")

    try:
        await send_report_email(row["id"], row["nickname"], body.grund.strip())
    except Exception as exc:  # noqa: BLE001 - Mailversand darf die Meldung nie fehlschlagen lassen
        logger.error("Melde-Mail fehlgeschlagen für Stand %s (%s)", row["id"], type(exc).__name__)

    await log_action(pool, row["id"], "REPORTED", "besucher")
    return {"message": "Danke, wir haben die Meldung erhalten."}


# POST /stands/test-email - Bearer Token, sendet Test-Mail und gibt Ergebnis zurück
@router.post("/test-email", dependencies=[Depends(require_admin_auth)])
async def test_email(to: str):
    info = smtp_debug_info()
    if not info["configured"]:
        return {"ok": False, "config": info, "error": "SMTP nicht vollständig konfiguriert"}
    try:
        await send_login_email(to, generate_code(), first_time=True)
        return {"ok": True, "config": info}
    except Exception as exc:  # noqa: BLE001 - Admin-Diagnose-Endpunkt, soll jeden SMTP-Fehler anzeigen
        return {"ok": False, "config": info, "error": str(exc)}


# GET /stands/admin - Bearer Token (Admin-Session, siehe app/routes/admins.py), NIE im Frontend verwenden
@router.get("/admin", dependencies=[Depends(require_admin_session_auth)])
async def admin_list():
    pool = await get_pool()
    rows = await pool.fetch(f"SELECT {_ADMIN_COLUMNS} FROM stands ORDER BY created_at DESC")
    return [dict(r) for r in rows]


# GET /stands/admin/audit-log - Bearer Token, letzte Aktionen (actor_email
# nur bei actor="admin" gesetzt, siehe app/audit.py - kein Personenbezug
# zum Standinhaber/Besucher)
@router.get("/admin/audit-log", dependencies=[Depends(require_admin_session_auth)])
async def admin_audit_log():
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, stand_id, action, actor, actor_email, created_at FROM admin_audit_log "
        "ORDER BY created_at DESC LIMIT 200"
    )
    return [dict(r) for r in rows]


# PATCH /stands/{id} - Bearer Token (Admin bearbeitet Stand). Nutzt
# AdminStandPatch statt StandPatch: nur der Admin darf deactivated setzen,
# und ist selbst von der Blockliste ausgenommen (muss z.B. einen
# problematischen Text sehen/korrigieren können, statt selbst geblockt zu
# werden).
@router.patch("/{stand_id}")
async def update_stand_admin(
    stand_id: int,
    body: AdminStandPatch,
    background_tasks: BackgroundTasks,
    admin_email: str = Depends(require_admin_session_auth),
):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")
    if "zahlungsarten" in updates:
        _reject_if_invalid_zahlungsarten(updates["zahlungsarten"])
    if "kategorien" in updates:
        _reject_if_too_many_kategorien(updates["kategorien"])
    if "beschreibung" in updates:
        _reject_if_too_long_beschreibung(updates["beschreibung"])

    pool = await get_pool()

    # Das Admin-Panel schickt "deactivated" bei JEDEM Speichern mit (Teil
    # des EditForm-Zustands, siehe admin-panel.tsx), auch wenn nur z.B. die
    # Adresse geändert wurde. Ohne diesen Vergleich mit dem aktuellen Wert
    # würde JEDE Bearbeitung fälschlich als DEACTIVATED/REACTIVATED statt
    # EDITED geloggt und bei einem bereits deaktivierten Stand bei jeder
    # Bearbeitung erneut eine Deaktivierungs-Mail auslösen.
    previous_deactivated = await pool.fetchval(
        "SELECT deactivated FROM stands WHERE id = $1", stand_id
    )
    if previous_deactivated is None:
        raise HTTPException(status_code=404, detail="Stand nicht gefunden")
    deactivation_changed = (
        "deactivated" in updates and updates["deactivated"] != previous_deactivated
    )

    # Reaktivieren gilt als "Antwort gelesen/erledigt" - räumt die
    # gespeicherte Antwort mit auf, statt sie unbegrenzt stehen zu lassen.
    if deactivation_changed and updates["deactivated"] is False:
        updates["deactivation_reply_message"] = None
        updates["deactivation_reply_created_at"] = None

    if "adresse" in updates:
        geo = await geocode(updates["adresse"])
        if geo:
            _reject_if_outside_zirndorf(geo.postcode)
        updates["lat"], updates["lng"] = (geo.lat, geo.lng) if geo else (None, None)
        if geo and geo.formatted_adresse:
            updates["adresse"] = geo.formatted_adresse

    set_clause = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(updates))
    values = list(updates.values())

    row = await pool.fetchrow(
        f"UPDATE stands SET {set_clause} WHERE id = $1 "
        f"RETURNING {_ADMIN_COLUMNS}",
        stand_id, *values,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Stand nicht gefunden")
    # Eigene Audit-Aktion statt des generischen EDITED, wenn sich die
    # Sichtbarkeit tatsächlich ändert - klarerer Verlauf im Admin-Panel,
    # analog zur bestehenden Trennung APPROVED/EDITED/DELETED.
    if deactivation_changed:
        action = "DEACTIVATED" if updates["deactivated"] else "REACTIVATED"
        await log_action(pool, stand_id, action, "admin", admin_email)
        if updates["deactivated"]:
            background_tasks.add_task(
                send_deactivation_email,
                row["email"], stand_id, row["deactivation_message"],
            )
    else:
        await log_action(pool, stand_id, "EDITED", "admin", admin_email)
    if row["status"] == "APPROVED":
        background_tasks.add_task(regenerate_stands_artifact)
    return dict(row)


# DELETE /stands/{id} - Bearer Token (Admin löscht Stand)
@router.delete("/{stand_id}", status_code=204)
async def delete_stand_admin(
    stand_id: int,
    background_tasks: BackgroundTasks,
    admin_email: str = Depends(require_admin_session_auth),
):
    pool = await get_pool()
    result = await pool.execute("DELETE FROM stands WHERE id = $1", stand_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Stand nicht gefunden")
    await log_action(pool, stand_id, "DELETED", "admin", admin_email)
    background_tasks.add_task(regenerate_stands_artifact)


# POST /stands/{id}/approve - Bearer Token (manuelle Freigabe, z.B. falls die
# Login-Mail nie ankommt und Admin und Person sich direkt abstimmen)
@router.post("/{stand_id}/approve")
async def approve_stand(
    stand_id: int,
    background_tasks: BackgroundTasks,
    admin_email: str = Depends(require_admin_session_auth),
):
    pool = await get_pool()
    row = await pool.fetchrow(
        "UPDATE stands SET status = 'APPROVED' WHERE id = $1 RETURNING id, nickname, status",
        stand_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Stand nicht gefunden")
    await log_action(pool, stand_id, "APPROVED", "admin", admin_email)
    background_tasks.add_task(regenerate_stands_artifact)
    return dict(row)
