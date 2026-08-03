"""Wendet ausstehende Migrationen aus migrations/ auf DATABASE_URL an.

Bewusst kein Alembic/ORM-Migrationstool: bei einer Handvoll Schema-
Änderungen für ein Einmal-Event ist eine eigene Abstraktionsschicht
unverhältnismäßig. Wird manuell vom Maintainer ausgeführt, nicht
automatisch aus CI gegen die Produktionsdatenbank.

Aufruf:
    DATABASE_URL=postgresql://... python -m scripts.migrate
"""

import asyncio
import os
from pathlib import Path

import asyncpg

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


async def main() -> None:
    database_url = os.environ["DATABASE_URL"]
    conn = await asyncpg.connect(database_url)
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename   TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        applied = {
            r["filename"] for r in await conn.fetch("SELECT filename FROM schema_migrations")
        }
        pending = sorted(
            p for p in MIGRATIONS_DIR.glob("*.sql") if p.name not in applied
        )

        if not pending:
            print("Keine ausstehenden Migrationen.")
            return

        for path in pending:
            print(f"Wende {path.name} an ...")
            async with conn.transaction():
                await conn.execute(path.read_text())
                await conn.execute(
                    "INSERT INTO schema_migrations (filename) VALUES ($1)", path.name
                )
            print(f"  ok: {path.name}")

        print(f"{len(pending)} Migration(en) angewendet.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
