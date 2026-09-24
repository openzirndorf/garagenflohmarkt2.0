import asyncio

from app import database


# Viele gleichzeitige Erst-Requests auf einer frisch gestarteten Instanz
# (Hochskalieren unter Last) dürfen nur EINEN Pool anlegen - sonst blieben
# überzählige Pools offen und würden max_connections der DB aufbrauchen.
async def test_get_pool_creates_only_one_pool_under_concurrency(monkeypatch):
    calls = 0

    async def fake_create_pool(*args, **kwargs):
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.05)
        return object()

    monkeypatch.setattr(database, "_pool", None)
    monkeypatch.setattr(database.asyncpg, "create_pool", fake_create_pool)

    pools = await asyncio.gather(*(database.get_pool() for _ in range(30)))

    assert calls == 1
    assert len({id(p) for p in pools}) == 1
