async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


async def test_launch_config_defaults_to_null(client, monkeypatch):
    # LAUNCH_AT ist nicht gesetzt (siehe conftest.py) - "Datum steht noch
    # nicht fest", Frontend zeigt dann den allgemeinen Platzhalter statt
    # eines Countdowns.
    monkeypatch.delenv("LAUNCH_AT", raising=False)
    resp = await client.get("/launch-config")
    assert resp.status_code == 200
    assert resp.json() == {"launch_at": None}


async def test_launch_config_returns_configured_date(client, monkeypatch):
    monkeypatch.setenv("LAUNCH_AT", "2026-09-01T00:00:00+02:00")
    resp = await client.get("/launch-config")
    assert resp.status_code == 200
    assert resp.json() == {"launch_at": "2026-09-01T00:00:00+02:00"}
