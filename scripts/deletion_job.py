"""Löscht alle Anmeldedaten nach dem Event-Cutoff - automatisiert, nicht als
Kalendererinnerung für einen Menschen.

Läuft täglich per Scaleway Serverless Job (siehe infra/main.tf) statt
einmalig: ein einmaliger Trigger ist ein stiller Single Point of Failure,
falls der eine Lauf fehlschlägt. Das Skript ist idempotent - nach dem ersten
erfolgreichen Lauf sind die Tabellen leer, jeder weitere Lauf tut nichts mehr
außer erneut (folgenlos) die Storage-Objekte zu prüfen.

Löscht bewusst nicht die Kartenkacheln (tiles/-Präfix) - reine Kartografie
ohne Personenbezug, siehe app/jobs/stands_artifact.py.
"""

import asyncio
import logging
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import asyncpg

from app.jobs.stands_artifact import purge_all_stand_objects

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TIMEZONE = ZoneInfo("Europe/Berlin")
CUTOFF = datetime(2026, 10, 7, 0, 0, tzinfo=TIMEZONE)


async def run(now: datetime | None = None) -> None:
    now = now or datetime.now(TIMEZONE)
    if now < CUTOFF:
        logger.info("Löschtermin (%s) noch nicht erreicht - kein Vorgang.", CUTOFF.isoformat())
        return

    database_url = os.environ["DATABASE_URL"]
    conn = await asyncpg.connect(database_url)
    try:
        stands_deleted = await conn.fetchval(
            "WITH deleted AS (DELETE FROM stands RETURNING 1) SELECT count(*) FROM deleted"
        )
        # Audit-Log enthält keine PII, gehört aber zu denselben Event-Daten -
        # wird bewusst mitgelöscht statt separat aufbewahrt (siehe
        # migrations/0005_admin_audit_log.sql).
        audit_deleted = await conn.fetchval(
            "WITH deleted AS (DELETE FROM admin_audit_log RETURNING 1) SELECT count(*) FROM deleted"
        )
    finally:
        await conn.close()

    objects_deleted = purge_all_stand_objects()

    # Nur Zahlen loggen - keine Nicknamen, E-Mails oder sonstige Inhalte.
    logger.info(
        "Löschjob ausgeführt: %s Stände, %s Audit-Log-Einträge aus der DB gelöscht, "
        "%s Storage-Objekte gelöscht.",
        stands_deleted, audit_deleted, objects_deleted,
    )


if __name__ == "__main__":
    asyncio.run(run())
