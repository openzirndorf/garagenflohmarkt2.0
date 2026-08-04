async def _register(client, api_auth, email="mod@example.com", **overrides):
    body = {"adresse": "Musterstraße 1, Zirndorf", "email": email, "kategorien": []}
    body.update(overrides)
    return await client.post("/stands/", json=body, auth=api_auth)


async def _login(client, login_code) -> str:
    resp = await client.post("/stands/redeem-code", json={"code": login_code})
    assert resp.status_code == 200
    return resp.json()["session_token"]


async def test_registration_rejects_blocked_beschreibung(client, api_auth):
    resp = await _register(client, api_auth, beschreibung="Nazi-Krempel zu verkaufen")
    assert resp.status_code == 400


async def test_registration_rejects_blocked_adresse(client, api_auth):
    resp = await _register(client, api_auth, adresse="ACAB-Weg 1, Zirndorf")
    assert resp.status_code == 400


async def test_registration_allows_harmless_content(client, api_auth):
    resp = await _register(client, api_auth, beschreibung="Gut erhaltene Bücher und Spielzeug")
    assert resp.status_code == 201


async def test_owner_edit_rejects_blocked_beschreibung(client, api_auth, captured_emails):
    reg = await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    resp = await client.patch(
        f"/stands/by-session/{session_token}", json={"beschreibung": "88 grüße"}
    )
    assert resp.status_code == 400
    assert reg.status_code == 201  # nur zur Klarheit genutzt


async def test_owner_edit_of_other_fields_unaffected_by_blocklist(client, api_auth, captured_emails):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    resp = await client.patch(f"/stands/by-session/{session_token}", json={"kategorien": ["Bücher"]})
    assert resp.status_code == 200


async def test_admin_can_lock_content_and_owner_edit_is_then_blocked(
    client, api_auth, admin_headers, captured_emails
):
    stand = (await _register(client, api_auth)).json()
    session_token = await _login(client, captured_emails[0]["login_code"])

    locked = await client.patch(
        f"/stands/{stand['id']}",
        json={
            "beschreibung": "Von Admin bereinigt",
            "content_locked": True,
            "content_lock_message": "Bitte wende dich an das Team, um dies zu ändern.",
        },
        headers=admin_headers,
    )
    assert locked.status_code == 200
    assert locked.json()["content_locked"] is True

    owner_attempt = await client.patch(
        f"/stands/by-session/{session_token}", json={"beschreibung": "Wieder was anderes"}
    )
    assert owner_attempt.status_code == 403
    assert "Team" in owner_attempt.json()["detail"]


async def test_content_lock_does_not_block_unrelated_field_edits(
    client, api_auth, admin_headers, captured_emails
):
    stand = (await _register(client, api_auth)).json()
    session_token = await _login(client, captured_emails[0]["login_code"])

    await client.patch(
        f"/stands/{stand['id']}", json={"content_locked": True}, headers=admin_headers
    )

    resp = await client.patch(f"/stands/by-session/{session_token}", json={"kategorien": ["Möbel"]})
    assert resp.status_code == 200


async def test_admin_is_exempt_from_blocklist(client, api_auth, admin_headers):
    stand = (await _register(client, api_auth)).json()
    resp = await client.patch(
        f"/stands/{stand['id']}", json={"beschreibung": "nazi-referenz zu Dokumentationszwecken"},
        headers=admin_headers,
    )
    assert resp.status_code == 200


async def test_owner_view_includes_lock_state(client, api_auth, admin_headers, captured_emails):
    stand = (await _register(client, api_auth)).json()
    session_token = await _login(client, captured_emails[0]["login_code"])

    await client.patch(
        f"/stands/{stand['id']}",
        json={"content_locked": True, "content_lock_message": "Testnachricht"},
        headers=admin_headers,
    )

    owner_view = await client.get(f"/stands/by-session/{session_token}")
    assert owner_view.json()["content_locked"] is True
    assert owner_view.json()["content_lock_message"] == "Testnachricht"


async def test_lock_reply_requires_the_stand_to_be_locked(client, api_auth, captured_emails):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    resp = await client.post(
        f"/stands/by-session/{session_token}/lock-reply", json={"message": "Warum gesperrt?"}
    )
    assert resp.status_code == 400


async def test_lock_reply_succeeds_when_locked_and_is_audit_logged(
    client, api_auth, admin_headers, captured_emails, pool
):
    stand = (await _register(client, api_auth)).json()
    session_token = await _login(client, captured_emails[0]["login_code"])

    await client.patch(
        f"/stands/{stand['id']}", json={"content_locked": True}, headers=admin_headers
    )

    resp = await client.post(
        f"/stands/by-session/{session_token}/lock-reply",
        json={"message": "Bitte um Überprüfung, das war ein Missverständnis."},
    )
    assert resp.status_code == 200

    entries = await pool.fetch(
        "SELECT action, actor FROM admin_audit_log WHERE stand_id = $1", stand["id"]
    )
    assert any(r["action"] == "REPLIED" and r["actor"] == "owner" for r in entries)


async def test_lock_reply_rejects_empty_message(client, api_auth, admin_headers, captured_emails):
    stand = (await _register(client, api_auth)).json()
    session_token = await _login(client, captured_emails[0]["login_code"])
    await client.patch(
        f"/stands/{stand['id']}", json={"content_locked": True}, headers=admin_headers
    )

    resp = await client.post(
        f"/stands/by-session/{session_token}/lock-reply", json={"message": "   "}
    )
    assert resp.status_code == 400


async def test_lock_reply_never_stores_message_content(
    client, api_auth, admin_headers, captured_emails, pool
):
    stand = (await _register(client, api_auth)).json()
    session_token = await _login(client, captured_emails[0]["login_code"])
    await client.patch(
        f"/stands/{stand['id']}", json={"content_locked": True}, headers=admin_headers
    )

    secret_message = "darf-nirgendwo-gespeichert-werden"
    await client.post(
        f"/stands/by-session/{session_token}/lock-reply", json={"message": secret_message}
    )

    row = await pool.fetchrow(
        "SELECT action, actor, stand_id FROM admin_audit_log WHERE stand_id = $1 "
        "AND action = 'REPLIED'",
        stand["id"],
    )
    assert secret_message not in str(dict(row))
