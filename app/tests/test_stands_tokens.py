async def _register(client, api_auth, email="test@example.com"):
    resp = await client.post(
        "/stands/",
        json={
            "adresse": "Musterstraße 1, Zirndorf",
            "email": email,
            "kategorien": [],
        },
        auth=api_auth,
    )
    assert resp.status_code == 201
    return resp.json()


async def _login(client, login_token) -> str:
    """Simuliert den echten Login-Flow: GET zeigt nur die Bestätigungsseite
    (verbraucht den Token nicht), POST löst ihn ein und liefert eine
    HTML-Seite mit dem session_token im Link-Text zurück."""
    confirm_page = await client.get(f"/stands/session/{login_token}")
    assert confirm_page.status_code == 200
    assert f'action="/stands/session/{login_token}"' in confirm_page.text

    login_resp = await client.post(f"/stands/session/{login_token}")
    assert login_resp.status_code == 200
    # session_token steckt im Link-href der Erfolgsseite
    marker = "#mein-stand/session/"
    start = login_resp.text.index(marker) + len(marker)
    end = login_resp.text.index('"', start)
    return login_resp.text[start:end]


async def test_registration_returns_no_token_at_all(client, api_auth):
    stand = await _register(client, api_auth)
    assert "login_token" not in stand
    assert "session_token" not in stand
    assert "edit_token" not in stand


async def test_login_token_is_stored_only_as_hash(client, api_auth, pool):
    await _register(client, api_auth)
    row = await pool.fetchrow("SELECT login_token_hash FROM stands")
    assert row["login_token_hash"] is not None
    assert len(row["login_token_hash"]) == 64  # SHA-256 Hexdigest


async def test_get_session_page_does_not_consume_the_login_token(client, api_auth, captured_emails, pool):
    """Simuliert einen automatischen Link-Scanner: ein reines GET darf den
    einmalig gültigen Token nicht verbrauchen, sonst würde der echte Login
    danach fehlschlagen."""
    await _register(client, api_auth)
    login_token = captured_emails[0]["login_token"]

    await client.get(f"/stands/session/{login_token}")
    await client.get(f"/stands/session/{login_token}")  # mehrfach, wie ein Scanner es tun könnte

    row = await pool.fetchrow("SELECT login_token_hash FROM stands")
    assert row["login_token_hash"] is not None  # weiterhin vorhanden - noch nicht verbraucht

    # Der eigentliche Login (POST) funktioniert danach trotzdem noch:
    session_token = await _login(client, login_token)
    assert session_token


async def test_login_token_is_single_use(client, api_auth, captured_emails):
    await _register(client, api_auth)
    login_token = captured_emails[0]["login_token"]

    first = await client.post(f"/stands/session/{login_token}")
    assert first.status_code == 200

    second = await client.post(f"/stands/session/{login_token}")
    assert second.status_code == 404


async def test_first_login_approves_the_stand(client, api_auth, captured_emails):
    stand = await _register(client, api_auth)
    login_token = captured_emails[0]["login_token"]
    await _login(client, login_token)

    listed = await client.get("/stands")
    assert any(s["id"] == stand["id"] for s in listed.json())


async def test_expired_login_token_is_rejected(client, api_auth, captured_emails, pool):
    await _register(client, api_auth)
    login_token = captured_emails[0]["login_token"]

    await pool.execute("UPDATE stands SET login_token_expires_at = now() - interval '1 hour'")

    resp = await client.post(f"/stands/session/{login_token}")
    assert resp.status_code == 404


async def test_wrong_session_token_is_rejected(client, api_auth):
    await _register(client, api_auth)
    resp = await client.get("/stands/by-session/definitiv-falscher-token")
    assert resp.status_code == 404


async def test_session_token_survives_multiple_requests(client, api_auth, captured_emails):
    """Anders als der Login-Token ist das Session-Token innerhalb seiner
    Gültigkeit mehrfach verwendbar (eine Bearbeitungssitzung besteht meist
    aus mehreren Requests: laden, ändern, evtl. exportieren)."""
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_token"])

    first = await client.get(f"/stands/by-session/{session_token}")
    second = await client.get(f"/stands/by-session/{session_token}")
    assert first.status_code == 200
    assert second.status_code == 200


async def test_expired_session_token_is_rejected(client, api_auth, captured_emails, pool):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_token"])

    await pool.execute("UPDATE stands SET session_token_expires_at = now() - interval '1 hour'")

    resp = await client.get(f"/stands/by-session/{session_token}")
    assert resp.status_code == 404


async def test_owner_can_update_and_delete_own_stand(client, api_auth, captured_emails):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_token"])

    patched = await client.patch(f"/stands/by-session/{session_token}", json={"uhrzeit": "10-15 Uhr"})
    assert patched.status_code == 200
    assert patched.json()["uhrzeit"] == "10-15 Uhr"

    deleted = await client.delete(f"/stands/by-session/{session_token}")
    assert deleted.status_code == 204

    gone = await client.get(f"/stands/by-session/{session_token}")
    assert gone.status_code == 404


async def test_gdpr_export_includes_email_but_owner_view_does_not(client, api_auth, captured_emails):
    await _register(client, api_auth, email="auskunft@example.com")
    session_token = await _login(client, captured_emails[0]["login_token"])

    owner_view = await client.get(f"/stands/by-session/{session_token}")
    assert "email" not in owner_view.json()

    export = await client.get(f"/stands/by-session/{session_token}/export")
    assert export.status_code == 200
    assert export.json()["email"] == "auskunft@example.com"


async def test_admin_endpoint_never_returns_token_hashes(client, api_auth, admin_headers):
    await _register(client, api_auth)
    resp = await client.get("/stands/admin", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert "login_token_hash" not in body[0]
    assert "session_token_hash" not in body[0]


async def test_one_email_one_stand(client, api_auth):
    await _register(client, api_auth, email="doppelt@example.com")
    second = await client.post(
        "/stands/",
        json={"adresse": "Andere Straße 5, Zirndorf", "email": "doppelt@example.com", "kategorien": []},
        auth=api_auth,
    )
    assert second.status_code == 409


async def test_request_login_sends_link_for_existing_email(client, api_auth, captured_emails):
    await _register(client, api_auth, email="wiederkehrer@example.com")
    captured_emails.clear()

    resp = await client.post(
        "/stands/request-login", json={"email": "wiederkehrer@example.com"}, auth=api_auth
    )
    assert resp.status_code == 200
    assert len(captured_emails) == 1
    assert captured_emails[0]["first_time"] is False

    session_token = await _login(client, captured_emails[0]["login_token"])
    resp2 = await client.get(f"/stands/by-session/{session_token}")
    assert resp2.status_code == 200


async def test_request_login_gives_same_response_for_unknown_email(client, api_auth, captured_emails):
    """Verhindert E-Mail-Enumeration: die Antwort darf nicht verraten, ob
    die E-Mail-Adresse überhaupt registriert ist."""
    known = await client.post(
        "/stands/request-login", json={"email": "existiert-nicht@example.com"}, auth=api_auth
    )
    await _register(client, api_auth, email="existiert-doch@example.com")
    captured_emails.clear()  # Registrierungsmail ausblenden, nur request-login zählen
    unknown = await client.post(
        "/stands/request-login", json={"email": "existiert-doch@example.com"}, auth=api_auth
    )
    assert known.status_code == unknown.status_code
    assert known.json() == unknown.json()
    # Aber nur für die tatsächlich existierende Adresse wurde eine Mail "verschickt"
    assert len(captured_emails) == 1


async def test_request_login_is_rate_limited(client, api_auth):
    for _ in range(5):
        resp = await client.post(
            "/stands/request-login", json={"email": "spam@example.com"}, auth=api_auth
        )
        assert resp.status_code == 200

    sixth = await client.post("/stands/request-login", json={"email": "spam@example.com"}, auth=api_auth)
    assert sixth.status_code == 429
