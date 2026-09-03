from app.geocode import GeocodeResult


async def _register(client, api_auth, email="geo@example.com", **overrides):
    body = {
        "adresse": "Musterstraße 1",
        "email": email,
        "datenschutz_zustimmung": True,
        "mindestalter_bestaetigt": True,
        "kategorien": [],
    }
    body.update(overrides)
    return await client.post("/stands/", json=body, auth=api_auth)


async def _login(client, login_code) -> str:
    resp = await client.post("/stands/redeem-code", json={"code": login_code})
    assert resp.status_code == 200
    return resp.json()["session_token"]


def _patch_geocode(monkeypatch, result):
    async def _fake(adresse: str):
        return result

    monkeypatch.setattr("app.routes.stands.geocode", _fake)


async def test_registration_uses_formatted_address_from_geocoding(client, api_auth):
    # Der Standard-Fake in conftest.py (_no_real_geocoding) liefert bereits
    # eine formatted_adresse - die Roheingabe wird dadurch ersetzt.
    resp = await _register(client, api_auth, adresse="musterstr 1 zirndorf")
    assert resp.status_code == 201
    assert resp.json()["adresse"] == "Musterstraße 1, 90513 Zirndorf"


async def test_registration_keeps_raw_address_when_geocoding_result_is_incomplete(
    client, api_auth, monkeypatch
):
    _patch_geocode(
        monkeypatch,
        GeocodeResult(lat=49.44, lng=10.95, postcode="90513", formatted_adresse=None),
    )
    resp = await _register(client, api_auth, adresse="Musterstraße 1, Hinterhof")
    assert resp.status_code == 201
    assert resp.json()["adresse"] == "Musterstraße 1, Hinterhof"


async def test_registration_rejects_address_outside_zirndorf(client, api_auth, monkeypatch):
    _patch_geocode(
        monkeypatch,
        GeocodeResult(
            lat=49.45, lng=11.07, postcode="90402",
            formatted_adresse="Hauptmarkt 1, 90402 Nürnberg",
        ),
    )
    resp = await _register(client, api_auth, adresse="Hauptmarkt 1, Nürnberg")
    assert resp.status_code == 400
    assert "Zirndorf" in resp.json()["detail"]


async def test_registration_allows_failed_geocoding_without_coordinates(
    client, api_auth, monkeypatch
):
    # Kein Ergebnis (z.B. API-Ausfall oder unbekannte Adresse) darf die
    # Anmeldung nicht blockieren - anders als eine erfolgreich außerhalb
    # Zirndorfs aufgelöste Adresse.
    async def _fake_none(adresse: str):
        return None

    monkeypatch.setattr("app.routes.stands.geocode", _fake_none)
    resp = await _register(client, api_auth, adresse="Irgendeine Adresse")
    assert resp.status_code == 201
    body = resp.json()
    assert body["lat"] is None
    assert body["lng"] is None
    assert body["adresse"] == "Irgendeine Adresse"


async def test_owner_edit_rejects_address_outside_zirndorf(
    client, api_auth, captured_emails, monkeypatch
):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    _patch_geocode(
        monkeypatch,
        GeocodeResult(
            lat=49.45, lng=11.07, postcode="90402",
            formatted_adresse="Hauptmarkt 1, 90402 Nürnberg",
        ),
    )
    resp = await client.patch(
        f"/stands/by-session/{session_token}", json={"adresse": "Hauptmarkt 1, Nürnberg"}
    )
    assert resp.status_code == 400
    assert "Zirndorf" in resp.json()["detail"]


async def test_admin_edit_rejects_address_outside_zirndorf(
    client, api_auth, admin_headers, monkeypatch
):
    stand = (await _register(client, api_auth)).json()

    _patch_geocode(
        monkeypatch,
        GeocodeResult(
            lat=49.45, lng=11.07, postcode="90402",
            formatted_adresse="Hauptmarkt 1, 90402 Nürnberg",
        ),
    )
    resp = await client.patch(
        f"/stands/{stand['id']}", json={"adresse": "Hauptmarkt 1, Nürnberg"}, headers=admin_headers
    )
    assert resp.status_code == 400
    assert "Zirndorf" in resp.json()["detail"]
