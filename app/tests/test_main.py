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


# robots.txt/sitemap.xml liegen in frontend/public/ (von Vite unverändert
# nach dist/ kopiert) - landeten vorher live als 200 OK, aber mit dem HTML
# der SPA statt echtem Inhalt, weil sie sonst nirgends passten und deshalb
# in der Catch-all-Route oben endeten (die bei fehlendem candidate.is_file()
# auf index.html zurückfällt). Google/andere Crawler bekamen dadurch keine
# echte robots.txt/sitemap.xml zu sehen - siehe Konversation. _DIST_DIR
# hier gemockt, da lokal (anders als im Docker-Build) kein dist/ existiert.
async def test_robots_txt_is_served_as_a_real_static_file(client, monkeypatch, tmp_path):
    (tmp_path / "robots.txt").write_text("User-agent: *\nAllow: /\n")
    monkeypatch.setattr("app.main._DIST_DIR", tmp_path)

    resp = await client.get("/robots.txt")
    assert resp.status_code == 200
    assert "User-agent: *" in resp.text
    assert not resp.headers["content-type"].startswith("text/html")


# Live gemeldet: Google Search Console meldete beim Einreichen der Sitemap
# "Vorübergehender Verarbeitungsfehler" - Ursache war ein HEAD auf
# sitemap.xml (über dieselbe Catch-all-Route wie robots.txt oben), das mit
# 405 beantwortet wurde. FastAPI/Starlette fügt einem @app.get()-Endpunkt
# HEAD NICHT automatisch hinzu (lokal reproduziert) - die Route braucht
# @app.api_route(methods=["GET", "HEAD"]).
async def test_sitemap_xml_responds_to_head_requests(client, monkeypatch, tmp_path):
    (tmp_path / "sitemap.xml").write_text(
        '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
    )
    monkeypatch.setattr("app.main._DIST_DIR", tmp_path)

    resp = await client.head("/sitemap.xml")
    assert resp.status_code == 200


# Sicherheitslücke (live gefunden): die Catch-all-Route lieferte per
# "/%2e%2e/..." Dateien außerhalb von dist/ aus (u.a. wäre /proc/self/environ
# mit allen Container-Secrets erreichbar gewesen). Fix: Pfad auflösen und
# prüfen, dass er innerhalb von dist/ liegt, sonst index.html.
async def test_path_traversal_does_not_leak_files_outside_dist(client, monkeypatch, tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>INDEX</html>")
    (tmp_path / "secret.txt").write_text("GEHEIM")
    monkeypatch.setattr("app.main._DIST_DIR", dist)

    for path in ["/%2e%2e/secret.txt", "/..%2fsecret.txt", "/%2e%2e%2fsecret.txt", "/a/../../secret.txt"]:
        resp = await client.get(path)
        assert "GEHEIM" not in resp.text, path
        assert resp.status_code == 200
        assert "INDEX" in resp.text, path


async def test_path_with_null_byte_falls_back_to_index(client, monkeypatch, tmp_path):
    (tmp_path / "index.html").write_text("<html>INDEX</html>")
    monkeypatch.setattr("app.main._DIST_DIR", tmp_path)

    resp = await client.get("/foo%00bar")
    assert resp.status_code == 200
    assert "INDEX" in resp.text


# Vorkomprimierte Frontend-Dateien (frontend/scripts/precompress.mjs, beim
# Docker-Build): je nach Accept-Encoding .br/.gz statt der Originaldatei -
# ohne das lieferte der Container das ~1,4 MB große JS-Bundle unkomprimiert.
def _dist_with_compressed_variants(tmp_path):
    import gzip

    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>INDEX</html>")
    original = b"console.log('hallo');" * 200
    (dist / "app.js").write_bytes(original)
    (dist / "app.js.gz").write_bytes(gzip.compress(original))
    (dist / "app.js.br").write_bytes(b"BROTLI-BYTES")
    (dist / "logo.png").write_bytes(b"PNG")
    return dist, original


async def _raw(client, path, accept_encoding, method="GET"):
    async with client.stream(method, path, headers={"Accept-Encoding": accept_encoding}) as resp:
        body = b"".join([chunk async for chunk in resp.aiter_raw()])
        return resp, body


async def test_brotli_variant_is_served_when_accepted(client, monkeypatch, tmp_path):
    dist, _ = _dist_with_compressed_variants(tmp_path)
    monkeypatch.setattr("app.main._DIST_DIR", dist)

    resp, body = await _raw(client, "/app.js", "gzip, deflate, br")
    assert resp.status_code == 200
    assert resp.headers["content-encoding"] == "br"
    assert resp.headers["vary"] == "Accept-Encoding"
    assert resp.headers["content-type"].startswith("text/javascript")
    assert body == b"BROTLI-BYTES"


async def test_gzip_variant_is_served_when_brotli_is_not_accepted(client, monkeypatch, tmp_path):
    dist, original = _dist_with_compressed_variants(tmp_path)
    monkeypatch.setattr("app.main._DIST_DIR", dist)

    resp = await client.get("/app.js", headers={"Accept-Encoding": "gzip"})
    assert resp.headers["content-encoding"] == "gzip"
    assert resp.content == original


async def test_quality_zero_excludes_an_encoding(client, monkeypatch, tmp_path):
    dist, _ = _dist_with_compressed_variants(tmp_path)
    monkeypatch.setattr("app.main._DIST_DIR", dist)

    resp, _ = await _raw(client, "/app.js", "br;q=0, gzip")
    assert resp.headers["content-encoding"] == "gzip"


async def test_original_is_served_without_accepted_compression(client, monkeypatch, tmp_path):
    dist, original = _dist_with_compressed_variants(tmp_path)
    monkeypatch.setattr("app.main._DIST_DIR", dist)

    resp, body = await _raw(client, "/app.js", "identity")
    assert "content-encoding" not in resp.headers
    assert resp.headers["vary"] == "Accept-Encoding"
    assert body == original


async def test_file_without_variants_has_no_encoding_or_vary(client, monkeypatch, tmp_path):
    dist, _ = _dist_with_compressed_variants(tmp_path)
    monkeypatch.setattr("app.main._DIST_DIR", dist)

    resp, body = await _raw(client, "/logo.png", "gzip, br")
    assert "content-encoding" not in resp.headers
    assert "vary" not in resp.headers
    assert body == b"PNG"


async def test_head_request_returns_encoding_headers_without_body(client, monkeypatch, tmp_path):
    dist, _ = _dist_with_compressed_variants(tmp_path)
    monkeypatch.setattr("app.main._DIST_DIR", dist)

    resp, body = await _raw(client, "/app.js", "br", method="HEAD")
    assert resp.status_code == 200
    assert resp.headers["content-encoding"] == "br"
    assert body == b""
