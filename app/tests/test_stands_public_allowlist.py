"""Positivliste statt Negativliste: prüft, dass die öffentlichen Endpunkte
GENAU die erlaubten Felder zurückgeben - nicht, dass bestimmte verbotene
Felder fehlen. Ein künftiges SELECT * oder ein neues Modellfeld lässt
diesen Test fehlschlagen, auch wenn niemand explizit an "email" oder
"token" gedacht hat.
"""

PUBLIC_LIST_FIELDS = {
    "id", "nickname", "adresse", "lat", "lng", "beschreibung", "kategorien", "created_at",
}
PUBLIC_GEOJSON_PROPERTY_FIELDS = {
    "id", "nickname", "adresse", "beschreibung", "kategorien",
}


async def _create_and_approve(client, admin_headers, api_auth, email="besucher@example.com"):
    resp = await client.post(
        "/stands/",
        json={
            "adresse": "Musterstraße 1, Zirndorf",
            "beschreibung": "Alte Bücher und Spielzeug",
            "email": email,
            "kategorien": ["Bücher"],
        },
        auth=api_auth,
    )
    assert resp.status_code == 201
    stand = resp.json()
    resp2 = await client.post(f"/stands/{stand['id']}/approve", headers=admin_headers)
    assert resp2.status_code == 200
    return stand


async def test_public_list_returns_exactly_the_allowed_fields(client, admin_headers, api_auth):
    await _create_and_approve(client, admin_headers, api_auth)
    resp = await client.get("/stands")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert set(body[0].keys()) == PUBLIC_LIST_FIELDS


async def test_public_geojson_returns_exactly_the_allowed_fields(client, admin_headers, api_auth):
    await _create_and_approve(client, admin_headers, api_auth)
    resp = await client.get("/stands/geojson")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["features"]) == 1
    feature = body["features"][0]
    assert set(feature.keys()) == {"type", "geometry", "properties"}
    assert set(feature["properties"].keys()) == PUBLIC_GEOJSON_PROPERTY_FIELDS


async def test_public_endpoints_never_contain_email_or_tokens(client, admin_headers, api_auth):
    email = "geheim@example.com"
    await _create_and_approve(client, admin_headers, api_auth, email=email)
    for path in ("/stands", "/stands/geojson"):
        resp = await client.get(path)
        assert email not in resp.text
        assert "login_token" not in resp.text
        assert "session_token" not in resp.text


async def test_pending_stands_are_not_public(client, api_auth):
    resp = await client.post(
        "/stands/",
        json={
            "adresse": "Nichtöffentliche Straße 2, Zirndorf",
            "email": "pending@example.com",
            "kategorien": [],
        },
        auth=api_auth,
    )
    assert resp.status_code == 201

    listed = await client.get("/stands")
    assert listed.json() == []

    geojson = await client.get("/stands/geojson")
    assert geojson.json()["features"] == []


async def test_no_real_name_field_can_be_submitted(client, admin_headers, api_auth):
    """Es gibt kein Namensfeld im Request-Body - selbst wenn jemand ein
    'name'-Feld mitschickt, darf es nirgendwo ankommen (weder gespeichert
    noch zurückgegeben)."""
    resp = await client.post(
        "/stands/",
        json={
            "name": "Erika Musterfrau",
            "adresse": "Testweg 3, Zirndorf",
            "email": "erika@example.com",
            "kategorien": [],
        },
        auth=api_auth,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "name" not in body
    assert "Erika Musterfrau" not in str(body)

    admin_resp = await client.get("/stands/admin", headers=admin_headers)
    assert "Erika Musterfrau" not in admin_resp.text
