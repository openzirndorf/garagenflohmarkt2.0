"""Baut die statischen Karten-Artefakte (stands.json, stands.geojson) aus
der Datenbank und lädt sie auf Scaleway Object Storage hoch.

Der öffentliche Kartenaufruf soll die Datenbank am Veranstaltungstag gar
nicht mehr erreichen: das Frontend liest diese Dateien direkt vom
Storage/CDN (siehe VITE_STATIC_BASE_URL), nicht mehr vom Backend. Wird
sowohl inline nach jeder Änderung (Approve/Edit/Delete, siehe
app/routes/stands.py) als auch per Cron als Sicherheitsnetz aufgerufen
(siehe infra/main.tf, Serverless Job) - der Cron-Lauf fängt den Fall ab,
dass der Container zwischen Trigger und Hochladen herunterskaliert.
"""

import asyncio
import hashlib
import json
import logging
import os
from datetime import UTC, datetime

import boto3

from app.database import get_pool
from app.public_fields import (
    PUBLIC_GEOJSON_COLUMNS,
    PUBLIC_LIST_COLUMNS,
    PUBLIC_STANDS_FILTER,
    rows_to_geojson,
)

logger = logging.getLogger(__name__)

_BUCKET = os.environ.get("STANDS_BUCKET", "")

# Versionierte Dateien sind unveränderlich (Inhalt steckt im Dateinamen) und
# dürfen dauerhaft gecacht werden; manifest.json/status.json ändern sich bei
# jeder Regenerierung und müssen kurz gecacht sein, damit Leser sie zeitnah
# neu abrufen.
_IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"
_MANIFEST_CACHE_CONTROL = "public, max-age=30"


def _json_default(value):
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(f"Objekt vom Typ {type(value)} ist nicht JSON-serialisierbar")


def _content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16]


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ["S3_ENDPOINT"],
        region_name=os.environ.get("S3_REGION", "fr-par"),
        aws_access_key_id=os.environ["S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["S3_SECRET_KEY"],
    )


def _upload(list_json: bytes, geojson: bytes, generated_at: str, stand_count: int) -> None:
    """Synchron (boto3 ist blockierend) - wird über asyncio.to_thread aufgerufen,
    damit ein Upload nicht die Event-Loop blockiert (analog zu app/email.py)."""
    s3 = _s3_client()

    list_key = f"stands/{_content_hash(list_json)}.json"
    geo_key = f"stands/{_content_hash(geojson)}.geojson"

    s3.put_object(
        Bucket=_BUCKET, Key=list_key, Body=list_json,
        ContentType="application/json", CacheControl=_IMMUTABLE_CACHE_CONTROL,
    )
    s3.put_object(
        Bucket=_BUCKET, Key=geo_key, Body=geojson,
        ContentType="application/geo+json", CacheControl=_IMMUTABLE_CACHE_CONTROL,
    )

    manifest = json.dumps({
        "list_url": list_key, "geojson_url": geo_key, "generated_at": generated_at,
    }).encode("utf-8")
    status = json.dumps({
        "last_generated_at": generated_at, "stand_count": stand_count,
    }).encode("utf-8")

    s3.put_object(
        Bucket=_BUCKET, Key="stands/manifest.json", Body=manifest,
        ContentType="application/json", CacheControl=_MANIFEST_CACHE_CONTROL,
    )
    s3.put_object(
        Bucket=_BUCKET, Key="stands/status.json", Body=status,
        ContentType="application/json", CacheControl=_MANIFEST_CACHE_CONTROL,
    )


async def regenerate_stands_artifact() -> None:
    """Liest freigegebene Stände und lädt list/geojson + manifest hoch. Tut
    nichts, wenn kein Bucket konfiguriert ist (z.B. lokale Entwicklung ohne
    Object Storage) - Fehler hier dürfen nie eine Anfrage scheitern lassen,
    siehe Aufrufer in app/routes/stands.py (FastAPI BackgroundTasks)."""
    if not _BUCKET:
        logger.info("STANDS_BUCKET nicht gesetzt - überspringe Artefakt-Regenerierung")
        return

    pool = await get_pool()
    list_rows = await pool.fetch(
        f"SELECT {PUBLIC_LIST_COLUMNS} FROM stands WHERE {PUBLIC_STANDS_FILTER} ORDER BY created_at DESC"
    )
    geo_rows = await pool.fetch(
        f"SELECT {PUBLIC_GEOJSON_COLUMNS} FROM stands "
        f"WHERE {PUBLIC_STANDS_FILTER} AND lat IS NOT NULL AND lng IS NOT NULL"
    )

    list_json = json.dumps(
        [dict(r) for r in list_rows], default=_json_default, ensure_ascii=False
    ).encode("utf-8")
    geojson = json.dumps(
        rows_to_geojson(geo_rows), default=_json_default, ensure_ascii=False
    ).encode("utf-8")
    generated_at = datetime.now(UTC).isoformat()

    await asyncio.to_thread(_upload, list_json, geojson, generated_at, len(list_rows))
    logger.info("Stands-Artefakt regeneriert (%s Stände)", len(list_rows))


if __name__ == "__main__":
    # Einstiegspunkt für den periodischen Scaleway Serverless Job
    # (Sicherheitsnetz, falls ein inline BackgroundTask verloren geht - siehe
    # infra/main.tf). Aufruf: python -m app.jobs.stands_artifact
    from app.database import close_pool

    async def _main() -> None:
        try:
            await regenerate_stands_artifact()
        finally:
            await close_pool()

    asyncio.run(_main())
