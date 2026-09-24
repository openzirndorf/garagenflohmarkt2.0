# asyncpg – plain SQL, kein ORM (analog zu postgres.js im Node-Backend)
import asyncio
import os

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]

_pool: asyncpg.Pool | None = None
_pool_lock = asyncio.Lock()

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        # Lock, damit viele gleichzeitige Erst-Requests auf einer frisch
        # gestarteten Instanz (Hochskalieren unter Last) nicht jeweils einen
        # eigenen Pool anlegen - die überzähligen blieben offen und würden
        # max_connections der DB aufbrauchen.
        async with _pool_lock:
            if _pool is None:
                _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    return _pool

async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
