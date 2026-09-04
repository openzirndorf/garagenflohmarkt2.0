"""DB-gestütztes Ratelimiting.

Ersetzt das bisherige In-Memory-Dict, das weder einen Neustart noch mehrere
parallele Container-Instanzen übersteht (relevant, sobald der Container am
Veranstaltungstag über min_scale=0 hinaus hochskaliert). Festes Zeitfenster
statt Sliding Window - einfacher, für einen Anti-Spam-Zweck ausreichend.

bucket_key enthält die anfragende IP-Adresse im Klartext (siehe die
jeweiligen _RATE_MAX-Konstanten in app/routes/stands.py, app/routes/
admins.py, app/auth.py) - abgelaufene Zeitfenster werden deshalb hier aktiv
aufgeräumt (siehe check_rate_limit unten), statt sie unbegrenzt in der DB
zu sammeln.
"""

from datetime import UTC, datetime, timedelta

import asyncpg


def _window_start(now: datetime, window_seconds: int) -> datetime:
    bucket = int(now.timestamp() // window_seconds) * window_seconds
    return datetime.fromtimestamp(bucket, tz=UTC)


# Fester globaler Cutoff statt vom window_seconds des jeweiligen Aufrufs
# abgeleitet: die Aufräum-DELETE unten kennt nur window_start, nicht zu
# welchem window_seconds eine Zeile ursprünglich gehörte, und würde sonst
# bei einem künftigen, längeren Rate-Limit-Fenster versehentlich noch
# gültige Zeilen eines ANDEREN, kürzeren Fensters zu früh oder - umgekehrt -
# Zeilen des neuen längeren Fensters zu spät löschen. Alle aktuell
# genutzten Fenster (app/routes/stands.py, app/routes/admins.py,
# app/auth.py) sind 3600s (1 Stunde) - 24 Stunden sind hier bewusst
# großzügig. Bei einem künftigen Rate-Limit mit einem noch längeren Fenster
# diesen Wert entsprechend anheben.
_CLEANUP_CUTOFF = timedelta(hours=24)


async def check_rate_limit(
    pool: asyncpg.Pool, bucket_key: str, window_seconds: int, max_count: int
) -> bool:
    """Zählt eine Anfrage im aktuellen Zeitfenster und gibt zurück, ob sie
    noch innerhalb des Limits liegt. Zählt auch Anfragen, die das Limit
    bereits überschreiten (verhindert, dass wiederholtes Anfragen den
    Zähler umgeht)."""
    window_start = _window_start(datetime.now(UTC), window_seconds)
    count = await pool.fetchval(
        """
        INSERT INTO rate_limit_buckets (bucket_key, window_start, count)
        VALUES ($1, $2, 1)
        ON CONFLICT (bucket_key, window_start)
        DO UPDATE SET count = rate_limit_buckets.count + 1
        RETURNING count
        """,
        bucket_key,
        window_start,
    )

    # Räumt bei jedem Aufruf abgelaufene Zeitfenster auf (siehe
    # _CLEANUP_CUTOFF oben) - läuft inline statt über einen eigenen
    # Cron-Job/eine eigene Infra-Ressource, weil das erwartete Volumen
    # winzig ist (~100 Anmeldungen fürs ganze Event, siehe README) und ein
    # DELETE auf dieser kleinen Tabelle trivial billig ist.
    await pool.execute(
        "DELETE FROM rate_limit_buckets WHERE window_start < $1",
        datetime.now(UTC) - _CLEANUP_CUTOFF,
    )

    return count <= max_count
