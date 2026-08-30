"""Kategorien: max. _MAX_KATEGORIEN pro Stand (siehe app/routes/stands.py),
damit ein einzelner Stand nicht praktisch die ganze Kategorienliste markiert
und dadurch Kategorie-Badges/-Filter unbrauchbar macht."""

_MAX = 5  # muss mit _MAX_KATEGORIEN in app/routes/stands.py übereinstimmen


async def _register(client, api_auth, email="kategorien@example.com", **overrides):
    body = {"adresse": "Musterstraße 1, Zirndorf", "email": email, "datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": []}
    body.update(overrides)
    return await client.post("/stands/", json=body, auth=api_auth)


async def _login(client, login_code) -> str:
    resp = await client.post("/stands/redeem-code", json={"code": login_code})
    assert resp.status_code == 200
    return resp.json()["session_token"]


async def test_registration_accepts_up_to_max_kategorien(client, api_auth):
    resp = await _register(client, api_auth, kategorien=["Bücher", "Möbel", "Deko"])
    assert resp.status_code == 201
    assert len(resp.json()["kategorien"]) == 3


async def test_registration_rejects_too_many_kategorien(client, api_auth):
    resp = await _register(
        client,
        api_auth,
        kategorien=["Bücher", "Möbel", "Deko", "Spielzeug", "Werkzeug", "Schmuck"],
    )
    assert resp.status_code == 400


async def test_owner_update_rejects_too_many_kategorien(client, api_auth, captured_emails):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    resp = await client.patch(
        f"/stands/by-session/{session_token}",
        json={"datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": ["a", "b", "c", "d", "e", "f"]},
    )
    assert resp.status_code == 400


async def test_admin_update_rejects_too_many_kategorien(client, api_auth, admin_headers):
    stand = (await _register(client, api_auth)).json()
    resp = await client.patch(
        f"/stands/{stand['id']}",
        json={"datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": ["a", "b", "c", "d", "e", "f"]},
        headers=admin_headers,
    )
    assert resp.status_code == 400
