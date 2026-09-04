import asyncio

from app.rate_limit import check_rate_limit


async def test_rate_limit_allows_up_to_max(pool):
    results = [await check_rate_limit(pool, "bucket-a", window_seconds=3600, max_count=3) for _ in range(3)]
    assert results == [True, True, True]


async def test_rate_limit_rejects_beyond_max(pool):
    for _ in range(3):
        await check_rate_limit(pool, "bucket-b", window_seconds=3600, max_count=3)
    fourth = await check_rate_limit(pool, "bucket-b", window_seconds=3600, max_count=3)
    assert fourth is False


async def test_rate_limit_buckets_are_independent_per_key(pool):
    for _ in range(3):
        await check_rate_limit(pool, "bucket-c", window_seconds=3600, max_count=3)
    # Ein anderer Key (z.B. andere IP) ist von bucket-c's Limit unberührt.
    other = await check_rate_limit(pool, "bucket-d", window_seconds=3600, max_count=3)
    assert other is True


async def test_rate_limit_survives_concurrent_requests(pool):
    """Nebenläufige Anfragen gegen denselben Bucket dürfen das Limit nicht
    durch eine Race Condition umgehen (atomarer DB-Upsert statt In-Memory-Dict,
    das je Container-Instanz getrennt zählen würde)."""
    results = await asyncio.gather(
        *[check_rate_limit(pool, "bucket-race", window_seconds=3600, max_count=5) for _ in range(10)]
    )
    assert sum(1 for r in results if r) == 5
    assert sum(1 for r in results if not r) == 5


async def test_create_stand_endpoint_is_rate_limited(client, api_auth):
    # _RATE_MAX in app/routes/stands.py - 10, nicht mehr das ursprüngliche 3
    # (zu knapp für mehrere echte Anmeldungen aus derselben Nachbarschaft
    # hinter einer gemeinsamen Mobilfunk-IP, siehe Kommentar dort).
    for i in range(10):
        resp = await client.post(
            "/stands/",
            json={"adresse": f"Straße {i}, Zirndorf", "email": f"limit{i}@example.com", "datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": []},
            auth=api_auth,
        )
        assert resp.status_code == 201

    eleventh = await client.post(
        "/stands/",
        json={"adresse": "Straße 11, Zirndorf", "email": "limit11@example.com", "datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": []},
        auth=api_auth,
    )
    assert eleventh.status_code == 429
