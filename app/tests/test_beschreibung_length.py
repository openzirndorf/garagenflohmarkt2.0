"""Beschreibung: max. _MAX_BESCHREIBUNG_LENGTH Zeichen (siehe
app/routes/stands.py), damit eine einzelne Beschreibung nicht optisch aus
der Standkarte/dem Kartenpopup läuft."""

_MAX = 100  # muss mit _MAX_BESCHREIBUNG_LENGTH in app/routes/stands.py übereinstimmen


async def _register(client, api_auth, email="beschreibung@example.com", **overrides):
    body = {"adresse": "Musterstraße 1, Zirndorf", "email": email, "datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": []}
    body.update(overrides)
    return await client.post("/stands/", json=body, auth=api_auth)


async def _login(client, login_code) -> str:
    resp = await client.post("/stands/redeem-code", json={"code": login_code})
    assert resp.status_code == 200
    return resp.json()["session_token"]


async def test_registration_accepts_beschreibung_up_to_max_length(client, api_auth):
    resp = await _register(client, api_auth, beschreibung="x" * _MAX)
    assert resp.status_code == 201
    assert len(resp.json()["beschreibung"]) == _MAX


async def test_registration_rejects_too_long_beschreibung(client, api_auth):
    resp = await _register(client, api_auth, beschreibung="x" * (_MAX + 1))
    assert resp.status_code == 400


async def test_owner_update_rejects_too_long_beschreibung(client, api_auth, captured_emails):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    resp = await client.patch(
        f"/stands/by-session/{session_token}", json={"beschreibung": "x" * (_MAX + 1)}
    )
    assert resp.status_code == 400


async def test_admin_update_rejects_too_long_beschreibung(client, api_auth, admin_headers):
    stand = (await _register(client, api_auth)).json()
    resp = await client.patch(
        f"/stands/{stand['id']}", json={"beschreibung": "x" * (_MAX + 1)}, headers=admin_headers
    )
    assert resp.status_code == 400
