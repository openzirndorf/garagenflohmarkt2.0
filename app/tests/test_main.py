async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


async def test_security_headers_are_set_on_every_response(client):
    resp = await client.get("/health")
    assert resp.headers["Content-Security-Policy"]
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert resp.headers["X-Frame-Options"] == "DENY"
    # Bewusst ohne includeSubDomains/preload, siehe Kommentar in main.py.
    assert resp.headers["Strict-Transport-Security"] == "max-age=31536000"


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


# Regression: die SPA-Catch-all-Route in main.py (liefert das mitgebaute
# Frontend aus, siehe Dockerfile) matcht "/stands" ohne Slash, bevor
# Starlettes automatischer redirect_slashes zu "/stands/" greifen kann -
# der Redirect passiert nur, wenn sich sonst KEIN Match findet. Ohne die
# zusätzliche "" -Route auf list_stands (app/routes/stands.py) lieferte
# GET /stands live index.html statt der Standliste aus - die öffentliche
# Liste war leer, obwohl Stände existierten (die Karte zeigte trotzdem
# Stände, weil GET /stands/geojson als eigener, distinkter Pfad davon
# nicht betroffen war). Die Catch-all-Route ist in main.py deshalb bewusst
# IMMER registriert (nicht nur wenn dist/ existiert) - genau damit dieser
# Test die reale Routing-Topologie prüft, auch ohne echten Docker-Build.
async def test_get_stands_without_trailing_slash_hits_the_real_endpoint(client):
    resp = await client.get("/stands")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/json")
    assert isinstance(resp.json(), list)
