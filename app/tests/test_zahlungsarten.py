"""Zahlungsarten: fixe Werteliste (PayPal/Wero/Barzahlung, siehe
_VALID_ZAHLUNGSARTEN in app/routes/stands.py), öffentlich sichtbar und
filterbar wie kategorien - anders als kategorien aber serverseitig gegen
Freitext validiert, da falsche Werte hier echte Verwechslungsgefahr auf
der öffentlichen Karte bedeuten."""


async def _register(client, api_auth, email="zahlung@example.com", **overrides):
    body = {"adresse": "Musterstraße 1, Zirndorf", "email": email, "datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": []}
    body.update(overrides)
    return await client.post("/stands/", json=body, auth=api_auth)


async def _login(client, login_code) -> str:
    resp = await client.post("/stands/redeem-code", json={"code": login_code})
    assert resp.status_code == 200
    return resp.json()["session_token"]


async def test_registration_accepts_valid_zahlungsarten(client, api_auth):
    resp = await _register(client, api_auth, zahlungsarten=["PayPal", "Wero", "Barzahlung"])
    assert resp.status_code == 201
    assert set(resp.json()["zahlungsarten"]) == {"PayPal", "Wero", "Barzahlung"}


async def test_registration_rejects_unknown_zahlungsart(client, api_auth):
    resp = await _register(client, api_auth, zahlungsarten=["Bitcoin"])
    assert resp.status_code == 400


async def test_owner_can_update_zahlungsarten(client, api_auth, captured_emails):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    resp = await client.patch(
        f"/stands/by-session/{session_token}", json={"zahlungsarten": ["PayPal"]}
    )
    assert resp.status_code == 200
    assert resp.json()["zahlungsarten"] == ["PayPal"]


async def test_owner_update_rejects_unknown_zahlungsart(client, api_auth, captured_emails):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    resp = await client.patch(
        f"/stands/by-session/{session_token}", json={"zahlungsarten": ["Bargeld"]}
    )
    assert resp.status_code == 400



async def test_admin_update_rejects_unknown_zahlungsart(client, api_auth, admin_headers):
    stand = (await _register(client, api_auth)).json()
    resp = await client.patch(
        f"/stands/{stand['id']}", json={"zahlungsarten": ["Klarna"]}, headers=admin_headers
    )
    assert resp.status_code == 400


async def test_public_list_and_geojson_include_zahlungsarten(client, admin_headers, api_auth):
    stand = (await _register(client, api_auth, zahlungsarten=["PayPal"])).json()
    resp = await client.post(f"/stands/{stand['id']}/approve", headers=admin_headers)
    assert resp.status_code == 200

    listed = await client.get("/stands")
    assert listed.json()[0]["zahlungsarten"] == ["PayPal"]

    geojson = await client.get("/stands/geojson")
    assert geojson.json()["features"][0]["properties"]["zahlungsarten"] == ["PayPal"]
