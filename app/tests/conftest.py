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
            "AND tablename IN ('stands', 'rate_limit_buckets', 'admin_audit_log')"
        )
        if tables:
            names = ", ".join(r["tablename"] for r in tables)
            await conn.execute(f"TRUNCATE {names} RESTART IDENTITY CASCADE")


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
    still no-open. Tests brauchen den Klartext-login_token trotzdem, um
    den Login-Flow zu Ende zu testen (genau wie eine echte Person ihn nur
    per Mail bekommt, nie über eine API-Antwort)."""
    sent: list[dict] = []

    async def _fake_send_login_email(email, nickname, login_token, *, first_time):
        sent.append({
            "email": email,
            "nickname": nickname,
            "login_token": login_token,
            "first_time": first_time,
        })

    monkeypatch.setattr("app.routes.stands.send_login_email", _fake_send_login_email)
    return sent


@pytest.fixture
def admin_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture
def api_auth():
    return (API_USERNAME, API_PASSWORD)


@pytest_asyncio.fixture(autouse=True)
def _no_real_geocoding(monkeypatch):
    """Verhindert echte Nominatim-Aufrufe in Tests (Netzwerk, OSM-Rate-Limit)."""

    async def _fake_geocode(adresse: str):
        return (49.4436, 10.9563)

    monkeypatch.setattr("app.geocode.geocode", _fake_geocode)
    monkeypatch.setattr("app.routes.stands.geocode", _fake_geocode)
