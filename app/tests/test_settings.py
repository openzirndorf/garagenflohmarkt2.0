async def _register(client, api_auth, email="settings@example.com", **overrides):
    body = {
        "adresse": "Musterstraße 1, Zirndorf",
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
    return resp.json()


async def test_settings_default_values(client):
    resp = await client.get("/settings")
    assert resp.status_code == 200
    assert resp.json() == {"require_manual_approval": False, "beschreibung_enabled": True}


async def test_settings_endpoint_without_trailing_slash_also_works(client):
    # Wie GET /stands - die SPA-Catch-all-Route würde einen bloß mit "/"
    # registrierten Endpunkt sonst stillschweigend abfangen (siehe
    # app/routes/settings.py).
    resp = await client.get("/settings")
    assert resp.status_code == 200


async def test_patch_settings_requires_admin_auth(client):
    resp = await client.patch("/settings", json={"require_manual_approval": True})
    assert resp.status_code in (401, 403)


async def test_patch_settings_persists(client, admin_headers):
    resp = await client.patch(
        "/settings", json={"require_manual_approval": True}, headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json() == {"require_manual_approval": True, "beschreibung_enabled": True}

    resp = await client.get("/settings")
    assert resp.json()["require_manual_approval"] is True


async def test_require_manual_approval_keeps_new_stand_pending_after_login(
    client, api_auth, admin_headers, captured_emails, pool
):
    await client.patch("/settings", json={"require_manual_approval": True}, headers=admin_headers)

    stand = (await _register(client, api_auth)).json()
    result = await _login(client, captured_emails[0]["login_code"])
    assert result["was_pending"] is True  # war PENDING - nur eben nicht automatisch freigeschaltet

    entries = await pool.fetch(
        "SELECT status FROM stands WHERE id = $1", stand["id"]
    )
    assert entries[0]["status"] == "PENDING"

    log = await pool.fetch(
        "SELECT action FROM admin_audit_log WHERE stand_id = $1", stand["id"]
    )
    assert "APPROVED" not in [r["action"] for r in log]

    # Admin kann trotzdem manuell freigeben.
    resp = await client.post(f"/stands/{stand['id']}/approve", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "APPROVED"


async def test_require_manual_approval_does_not_affect_already_approved_stands(
    client, api_auth, admin_headers, captured_emails, pool
):
    # Erst normal registrieren+einloggen (Flag noch aus) ...
    stand = (await _register(client, api_auth)).json()
    await _login(client, captured_emails[0]["login_code"])

    # ... dann das Flag an - betrifft laut Vorgabe nur künftige, neue Stände.
    await client.patch("/settings", json={"require_manual_approval": True}, headers=admin_headers)

    row = await pool.fetchrow("SELECT status FROM stands WHERE id = $1", stand["id"])
    assert row["status"] == "APPROVED"


async def test_beschreibung_enabled_false_strips_beschreibung_on_registration(
    client, api_auth, admin_headers
):
    await client.patch("/settings", json={"beschreibung_enabled": False}, headers=admin_headers)

    resp = await _register(client, api_auth, beschreibung="Ich verkaufe tolle Sachen")
    assert resp.status_code == 201
    assert resp.json()["beschreibung"] is None


async def test_patch_settings_is_audit_logged_with_admin_email_and_no_stand_id(
    client, admin_headers, pool
):
    resp = await client.patch(
        "/settings", json={"require_manual_approval": True}, headers=admin_headers
    )
    assert resp.status_code == 200

    row = await pool.fetchrow(
        "SELECT stand_id, actor, actor_email FROM admin_audit_log "
        "WHERE action = 'SETTINGS_MANUAL_APPROVAL_ON'"
    )
    assert row is not None
    assert row["stand_id"] is None
    assert row["actor"] == "admin"
    assert row["actor_email"] == "test-admin@example.com"


async def test_toggling_beschreibung_enabled_off_and_on_logs_distinct_actions(
    client, admin_headers, pool
):
    await client.patch("/settings", json={"beschreibung_enabled": False}, headers=admin_headers)
    await client.patch("/settings", json={"beschreibung_enabled": True}, headers=admin_headers)

    entries = await pool.fetch(
        "SELECT action FROM admin_audit_log WHERE action LIKE 'SETTINGS_BESCHREIBUNG_%' "
        "ORDER BY created_at"
    )
    actions = [r["action"] for r in entries]
    assert actions == ["SETTINGS_BESCHREIBUNG_OFF", "SETTINGS_BESCHREIBUNG_ON"]


async def test_patch_settings_with_no_actual_change_still_logs(client, admin_headers, pool):
    # exclude_unset greift auf den mitgeschickten Body, nicht auf einen
    # Vergleich mit dem aktuellen Wert - ein PATCH mit dem schon aktuellen
    # Wert loggt bewusst trotzdem (anders als bei stands: hier gibt es
    # keine Nebenwirkung wie eine Mail, die das unerwünscht macht).
    resp = await client.patch(
        "/settings", json={"beschreibung_enabled": True}, headers=admin_headers
    )
    assert resp.status_code == 200

    row = await pool.fetchrow(
        "SELECT id FROM admin_audit_log WHERE action = 'SETTINGS_BESCHREIBUNG_ON'"
    )
    assert row is not None
