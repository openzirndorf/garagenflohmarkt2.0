async def _register(client, api_auth, email="audit@example.com"):
    resp = await client.post(
        "/stands/",
        json={"adresse": "Musterstraße 1, Zirndorf", "email": email, "kategorien": []},
        auth=api_auth,
    )
    assert resp.status_code == 201
    return resp.json()


async def _login(client, login_token) -> str:
    login_resp = await client.post(f"/stands/session/{login_token}")
    assert login_resp.status_code == 200
    marker = "#mein-stand/session/"
    start = login_resp.text.index(marker) + len(marker)
    end = login_resp.text.index('"', start)
    return login_resp.text[start:end]


async def _log_entries(pool, stand_id):
    rows = await pool.fetch(
        "SELECT action, actor FROM admin_audit_log WHERE stand_id = $1 ORDER BY id", stand_id
    )
    return [(r["action"], r["actor"]) for r in rows]


async def test_registration_and_first_login_log_created_and_approved(
    client, api_auth, captured_emails, pool
):
    stand = await _register(client, api_auth)
    await _login(client, captured_emails[0]["login_token"])

    assert await _log_entries(pool, stand["id"]) == [
        ("CREATED", "owner"),
        ("APPROVED", "owner"),
    ]


async def test_second_login_does_not_log_another_approval(client, api_auth, captured_emails, pool):
    stand = await _register(client, api_auth)
    first_session = await _login(client, captured_emails[0]["login_token"])
    captured_emails.clear()

    await client.post("/stands/request-login", json={"email": "audit@example.com"}, auth=api_auth)
    await _login(client, captured_emails[0]["login_token"])

    entries = await _log_entries(pool, stand["id"])
    assert entries.count(("APPROVED", "owner")) == 1
    assert first_session  # nur zur Klarheit genutzt


async def test_owner_edit_and_delete_are_logged(client, api_auth, captured_emails, pool):
    stand = await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_token"])

    await client.patch(f"/stands/by-session/{session_token}", json={"uhrzeit": "10-15 Uhr"})
    await client.delete(f"/stands/by-session/{session_token}")

    entries = await _log_entries(pool, stand["id"])
    assert ("EDITED", "owner") in entries
    assert ("DELETED", "owner") in entries


async def test_admin_actions_are_logged_with_admin_actor(client, api_auth, admin_headers, pool):
    stand = await _register(client, api_auth)

    await client.post(f"/stands/{stand['id']}/approve", headers=admin_headers)
    await client.patch(
        f"/stands/{stand['id']}", json={"uhrzeit": "9-14 Uhr"}, headers=admin_headers
    )
    await client.delete(f"/stands/{stand['id']}", headers=admin_headers)

    entries = await _log_entries(pool, stand["id"])
    assert ("APPROVED", "admin") in entries
    assert ("EDITED", "admin") in entries
    assert ("DELETED", "admin") in entries


async def test_audit_log_endpoint_requires_admin_auth(client, api_auth):
    await _register(client, api_auth)
    resp = await client.get("/stands/admin/audit-log")
    assert resp.status_code in (401, 403)


async def test_audit_log_endpoint_never_contains_nickname_or_email(
    client, api_auth, admin_headers, captured_emails
):
    await _register(client, api_auth, email="darf-nicht-im-log@example.com")
    await _login(client, captured_emails[0]["login_token"])

    resp = await client.get("/stands/admin/audit-log", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.text
    assert "darf-nicht-im-log@example.com" not in body
    for entry in resp.json():
        assert set(entry.keys()) == {"id", "stand_id", "action", "actor", "created_at"}
