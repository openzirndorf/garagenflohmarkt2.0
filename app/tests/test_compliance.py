"""Deckt die im Registrierungsprozess neu hinzugekommenen Pflichten ab:
Einwilligung zur Adressveröffentlichung (Art. 6 Abs. 1 lit. a DSGVO) mit
Zeitstempel, Mindestalter-Bestätigung (Art. 8 DSGVO), und die öffentliche
Meldefunktion (POST /stands/{id}/report)."""


def _base_body(**overrides):
    body = {
        "adresse": "Musterstraße 1, Zirndorf",
        "email": "compliance@example.com",
        "kategorien": [],
        "datenschutz_zustimmung": True,
        "mindestalter_bestaetigt": True,
    }
    body.update(overrides)
    return body


async def test_registration_requires_datenschutz_zustimmung(client, api_auth):
    resp = await client.post(
        "/stands/", json=_base_body(datenschutz_zustimmung=False), auth=api_auth
    )
    assert resp.status_code == 400


async def test_registration_requires_mindestalter_bestaetigt(client, api_auth):
    resp = await client.post(
        "/stands/", json=_base_body(mindestalter_bestaetigt=False), auth=api_auth
    )
    assert resp.status_code == 400


async def test_registration_without_either_flag_is_rejected(client, api_auth):
    body = {
        "adresse": "Musterstraße 1, Zirndorf",
        "email": "ohne-einwilligung@example.com",
        "kategorien": [],
    }
    resp = await client.post("/stands/", json=body, auth=api_auth)
    assert resp.status_code == 400


async def test_registration_stores_address_consent_timestamp(client, api_auth):
    resp = await client.post("/stands/", json=_base_body(), auth=api_auth)
    assert resp.status_code == 201
    assert resp.json()["address_consent_at"] is not None


async def test_report_stand_succeeds_and_is_audit_logged(client, api_auth, admin_headers, pool):
    stand = (await client.post("/stands/", json=_base_body(), auth=api_auth)).json()

    resp = await client.post(f"/stands/{stand['id']}/report", json={"grund": "Testgrund"})
    assert resp.status_code == 200

    entries = await pool.fetch(
        "SELECT action, actor FROM admin_audit_log WHERE stand_id = $1", stand["id"]
    )
    assert any(r["action"] == "REPORTED" and r["actor"] == "besucher" for r in entries)


async def test_report_stand_never_stores_reason_content(client, api_auth, pool):
    stand = (await client.post("/stands/", json=_base_body(), auth=api_auth)).json()

    secret_reason = "darf-nicht-im-audit-log-landen"
    await client.post(f"/stands/{stand['id']}/report", json={"grund": secret_reason})

    row = await pool.fetchrow(
        "SELECT action, actor, stand_id FROM admin_audit_log WHERE stand_id = $1 "
        "AND action = 'REPORTED'",
        stand["id"],
    )
    assert secret_reason not in str(dict(row))


async def test_report_unknown_stand_returns_404(client):
    resp = await client.post("/stands/999999/report", json={})
    assert resp.status_code == 404


async def test_report_stand_is_rate_limited(client, api_auth):
    stand = (await client.post("/stands/", json=_base_body(), auth=api_auth)).json()

    for _ in range(5):
        resp = await client.post(f"/stands/{stand['id']}/report", json={})
        assert resp.status_code == 200

    sixth = await client.post(f"/stands/{stand['id']}/report", json={})
    assert sixth.status_code == 429
