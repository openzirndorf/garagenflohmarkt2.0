"""Test-Fixtures.

Setzt benötigte Umgebungsvariablen, BEVOR app.database/app.auth
importiert werden (die lesen os.environ beim Modul-Import). Tests
laufen gegen eine echte Postgres-Datenbank (TEST_DATABASE_URL) - die
App ist reines asyncpg-SQL ohne ORM, ein Mock würde am eigentlichen
Verhalten (Constraints, Transaktionen, Race Conditions) vorbeitesten.
"""

import os

os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL", "postgresql://flohmarkt:flohmarkt@localhost:5432/flohmarkt_test"
    ),
)
os.environ.setdefault("ADMIN_TOKEN", "test-admin-token")
os.environ.setdefault("API_USERNAME", "test-user")
os.environ.setdefault("API_PASSWORD", "test-pass")
os.environ.setdefault("FRONTEND_URL", "https://example.invalid/frontend")
os.environ.setdefault("BACKEND_URL", "https://example.invalid/backend")

from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent.parent / "migrations"

ADMIN_TOKEN = os.environ["ADMIN_TOKEN"]
API_USERNAME = os.environ["API_USERNAME"]
API_PASSWORD = os.environ["API_PASSWORD"]


async def _apply_migrations(conn: asyncpg.Connection) -> None:
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        await conn.execute(path.read_text())


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _migrated_db():
    # Schema bei jedem Testlauf sauber neu aufbauen, statt Migrationen wie
    # scripts/migrate.py inkrementell zu tracken - Migrationen wie 0003
    # (RENAME/DROP COLUMN) sind nicht idempotent und würden bei einer
    # wiederverwendeten lokalen Test-DB sonst beim zweiten Lauf fehlschlagen.
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        await conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        await _apply_migrations(conn)
    finally:
        await conn.close()
    yield


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables(_migrated_db):
    from app.database import get_pool

    pool = await get_pool()
    yield
    async with pool.acquire() as conn:
        tables = await conn.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' "
            "AND tablename IN ('stands', 'rate_limit_buckets', 'admin_audit_log', 'admins')"
        )
        if tables:
            names = ", ".join(r["tablename"] for r in tables)
            await conn.execute(f"TRUNCATE {names} RESTART IDENTITY CASCADE")
        # app_settings ist eine Singleton-Zeile (siehe migrations/0015) -
        # TRUNCATE würde sie löschen und die CHECK-Constraint verletzen,
        # deshalb hier stattdessen auf die Default-Werte zurücksetzen, statt
        # ihn wie die Tabellen oben aufzulisten.
        await conn.execute(
            "UPDATE app_settings SET require_manual_approval = false, beschreibung_enabled = true"
        )


@pytest_asyncio.fixture
async def pool():
    from app.database import get_pool

    return await get_pool()


@pytest_asyncio.fixture
async def client():
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as ac:
        yield ac


@pytest.fixture
def captured_emails(monkeypatch):
    """Fängt ausgehende Mails ab, statt sie über smtplib zu verschicken -
    SMTP ist in Tests nicht konfiguriert, send_login_email würde sonst
    still no-open. Tests brauchen den Klartext-login_code trotzdem, um
    den Login-Flow zu Ende zu testen (genau wie eine echte Person ihn nur
    per Mail bekommt, nie über eine API-Antwort)."""
    sent: list[dict] = []

    async def _fake_send_login_email(email, nickname, login_code, *, first_time):
        sent.append({
            "email": email,
            "nickname": nickname,
            "login_code": login_code,
            "first_time": first_time,
        })

    monkeypatch.setattr("app.routes.stands.send_login_email", _fake_send_login_email)
    return sent


@pytest.fixture
def captured_deactivation_emails(monkeypatch):
    """Wie captured_emails oben, für die Deaktivierungs-Mail an den
    Standinhaber (app/routes/stands.py update_stand_admin, Versand läuft
    über BackgroundTasks - direkt awaiten statt nur zu registrieren, damit
    Tests nicht auf den Background-Task warten müssen)."""
    sent: list[dict] = []

    async def _fake_send_deactivation_email(email, nickname, stand_id, message):
        sent.append(
            {"email": email, "nickname": nickname, "stand_id": stand_id, "message": message}
        )

    monkeypatch.setattr("app.routes.stands.send_deactivation_email", _fake_send_deactivation_email)
    return sent


@pytest.fixture
def captured_admin_emails(monkeypatch):
    """Wie captured_emails oben, für den Admin-Login-Flow (app/routes/admins.py)."""
    sent: list[dict] = []

    async def _fake_send_admin_login_email(email, login_code):
        sent.append({"email": email, "login_code": login_code})

    monkeypatch.setattr("app.routes.admins.send_admin_login_email", _fake_send_admin_login_email)
    return sent


@pytest_asyncio.fixture
async def admin_headers(pool):
    """Admin-Session-Token statt des statischen ADMIN_TOKEN - die
    alltäglichen Admin-Endpunkte verlangen seit require_admin_session_auth
    (app/auth.py) einen echten Roster-Eintrag mit gültiger Session, nicht
    mehr den Master-Token. Legt den Eintrag/die Session direkt in der DB
    an statt über den echten request-login/redeem-code-HTTP-Flow zu gehen
    (der bekommt eigene, dedizierte Tests in test_admin_auth.py) - hier
    soll die Fixture nur schnell gültige Headers liefern."""
    from app.tokens import new_session_token

    session_token, session_token_hash, session_token_expires_at = new_session_token()
    await pool.execute(
        """
        INSERT INTO admins (email, session_token_hash, session_token_expires_at)
        VALUES ('test-admin@example.com', $1, $2)
        ON CONFLICT (email) DO UPDATE SET
            session_token_hash = EXCLUDED.session_token_hash,
            session_token_expires_at = EXCLUDED.session_token_expires_at
        """,
        session_token_hash, session_token_expires_at,
    )
    return {"Authorization": f"Bearer {session_token}"}


@pytest.fixture
def master_admin_headers():
    """Der statische ADMIN_TOKEN - gilt nur noch für die Roster-Verwaltung
    (POST/GET/DELETE /admins) und den Diagnose-Endpunkt
    POST /stands/test-email, siehe app/auth.py require_admin_auth."""
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture
def api_auth():
    return (API_USERNAME, API_PASSWORD)


@pytest_asyncio.fixture(autouse=True)
def _no_real_geocoding(monkeypatch):
    """Verhindert echte Geocoding-Aufrufe (OpenCage/Nominatim) in Tests.

    Liefert standardmäßig eine Zirndorfer PLZ, damit bestehende Tests nicht
    an der Zirndorf-Prüfung (_reject_if_outside_zirndorf) scheitern - Tests,
    die gezielt eine Adresse außerhalb Zirndorfs simulieren wollen,
    überschreiben app.routes.stands.geocode lokal noch einmal per eigenem
    monkeypatch.setattr (wird nach dem Test automatisch zurückgesetzt)."""
    from app.geocode import GeocodeResult

    async def _fake_geocode(adresse: str):
        return GeocodeResult(
            lat=49.4436, lng=10.9563, postcode="90513",
            formatted_adresse="Musterstraße 1, 90513 Zirndorf",
        )

    monkeypatch.setattr("app.geocode.geocode", _fake_geocode)
    monkeypatch.setattr("app.routes.stands.geocode", _fake_geocode)
