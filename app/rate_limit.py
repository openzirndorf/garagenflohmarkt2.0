"""DB-gestütztes Ratelimiting.

Ersetzt das bisherige In-Memory-Dict, das weder einen Neustart noch mehrere
parallele Container-Instanzen übersteht (relevant, sobald der Container am
Veranstaltungstag über min_scale=0 hinaus hochskaliert). Festes Zeitfenster
statt Sliding Window - einfacher, für einen Anti-Spam-Zweck ausreichend.
"""

from datetime import UTC, datetime

import asyncpg


def _window_start(now: datetime, window_seconds: int) -> datetime:
    bucket = int(now.timestamp() // window_seconds) * window_seconds
    return datetime.fromtimestamp(bucket, tz=UTC)


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
    return count <= max_count
