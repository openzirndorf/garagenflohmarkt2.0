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


async def _login(client, login_code) -> str:
    """Simuliert den echten Login-Flow: der Code wird eingetippt (POST
    /stands/redeem-code), kein Link-Klick mehr nötig."""
    resp = await client.post("/stands/redeem-code", json={"code": login_code})
    assert resp.status_code == 200
    return resp.json()["session_token"]


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


async def test_login_code_is_single_use(client, api_auth, captured_emails):
    await _register(client, api_auth)
    login_code = captured_emails[0]["login_code"]

    first = await client.post("/stands/redeem-code", json={"code": login_code})
    assert first.status_code == 200

    second = await client.post("/stands/redeem-code", json={"code": login_code})
    assert second.status_code == 404


async def test_wrong_code_is_rejected(client, api_auth):
    await _register(client, api_auth)
    resp = await client.post("/stands/redeem-code", json={"code": "FALSCH12"})
    assert resp.status_code == 404


async def test_code_redemption_is_case_and_whitespace_insensitive(client, api_auth, captured_emails):
    await _register(client, api_auth)
    login_code = captured_emails[0]["login_code"]

    resp = await client.post(
        "/stands/redeem-code", json={"code": f" {login_code.lower()} "}
    )
    assert resp.status_code == 200


async def test_first_login_approves_the_stand(client, api_auth, captured_emails):
    stand = await _register(client, api_auth)
    login_code = captured_emails[0]["login_code"]
    await _login(client, login_code)

    listed = await client.get("/stands")
    assert any(s["id"] == stand["id"] for s in listed.json())


async def test_expired_login_code_is_rejected(client, api_auth, captured_emails, pool):
    await _register(client, api_auth)
    login_code = captured_emails[0]["login_code"]

    await pool.execute("UPDATE stands SET login_token_expires_at = now() - interval '1 hour'")

    resp = await client.post("/stands/redeem-code", json={"code": login_code})
    assert resp.status_code == 404


async def test_wrong_session_token_is_rejected(client, api_auth):
    await _register(client, api_auth)
    resp = await client.get("/stands/by-session/definitiv-falscher-token")
    assert resp.status_code == 404


async def test_session_token_survives_multiple_requests(client, api_auth, captured_emails):
    """Anders als der Login-Code ist das Session-Token innerhalb seiner
    Gültigkeit mehrfach verwendbar (eine Bearbeitungssitzung besteht meist
    aus mehreren Requests: laden, ändern, evtl. exportieren)."""
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    first = await client.get(f"/stands/by-session/{session_token}")
    second = await client.get(f"/stands/by-session/{session_token}")
    assert first.status_code == 200
    assert second.status_code == 200


async def test_expired_session_token_is_rejected(client, api_auth, captured_emails, pool):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    await pool.execute("UPDATE stands SET session_token_expires_at = now() - interval '1 hour'")

    resp = await client.get(f"/stands/by-session/{session_token}")
    assert resp.status_code == 404


async def test_owner_can_update_and_delete_own_stand(client, api_auth, captured_emails):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    patched = await client.patch(f"/stands/by-session/{session_token}", json={"uhrzeit": "10-15 Uhr"})
    assert patched.status_code == 200
    assert patched.json()["uhrzeit"] == "10-15 Uhr"

    deleted = await client.delete(f"/stands/by-session/{session_token}")
    assert deleted.status_code == 204

    gone = await client.get(f"/stands/by-session/{session_token}")
    assert gone.status_code == 404


async def test_gdpr_export_includes_email_but_owner_view_does_not(client, api_auth, captured_emails):
    await _register(client, api_auth, email="auskunft@example.com")
    session_token = await _login(client, captured_emails[0]["login_code"])

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


async def test_request_login_sends_code_for_existing_email(client, api_auth, captured_emails):
    await _register(client, api_auth, email="wiederkehrer@example.com")
    captured_emails.clear()

    resp = await client.post(
        "/stands/request-login", json={"email": "wiederkehrer@example.com"}, auth=api_auth
    )
    assert resp.status_code == 200
    assert len(captured_emails) == 1
    assert captured_emails[0]["first_time"] is False

    session_token = await _login(client, captured_emails[0]["login_code"])
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


async def test_nickname_suggestions_returns_three_distinct_valid_names(client, api_auth, captured_emails):
    from app.nicknames import is_valid_nickname

    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    resp = await client.post(f"/stands/by-session/{session_token}/nickname-suggestions")
    assert resp.status_code == 200
    suggestions = resp.json()["suggestions"]
    assert len(suggestions) == 3
    assert len(set(suggestions)) == 3
    assert all(is_valid_nickname(n) for n in suggestions)


async def test_owner_can_change_nickname_to_a_valid_suggestion(client, api_auth, captured_emails):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    suggestions = (
        await client.post(f"/stands/by-session/{session_token}/nickname-suggestions")
    ).json()["suggestions"]
    chosen = suggestions[0]

    patched = await client.patch(f"/stands/by-session/{session_token}", json={"nickname": chosen})
    assert patched.status_code == 200
    assert patched.json()["nickname"] == chosen


async def test_nickname_change_rejects_freetext(client, api_auth, captured_emails):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    patched = await client.patch(
        f"/stands/by-session/{session_token}", json={"nickname": "Max Mustermann"}
    )
    assert patched.status_code == 400


async def test_nickname_change_rejects_collision_with_other_stand(client, api_auth, captured_emails):
    await _register(client, api_auth, email="erster@example.com")
    first_session = await _login(client, captured_emails[0]["login_code"])
    first_nickname = (await client.get(f"/stands/by-session/{first_session}")).json()["nickname"]
    captured_emails.clear()

    await _register(client, api_auth, email="zweiter@example.com")
    second_session = await _login(client, captured_emails[0]["login_code"])

    patched = await client.patch(
        f"/stands/by-session/{second_session}", json={"nickname": first_nickname}
    )
    assert patched.status_code == 409


async def test_request_login_is_rate_limited(client, api_auth):
    for _ in range(5):
        resp = await client.post(
            "/stands/request-login", json={"email": "spam@example.com"}, auth=api_auth
        )
        assert resp.status_code == 200

    sixth = await client.post("/stands/request-login", json={"email": "spam@example.com"}, auth=api_auth)
    assert sixth.status_code == 429


async def test_redeem_code_is_rate_limited(client, api_auth):
    for _ in range(10):
        resp = await client.post("/stands/redeem-code", json={"code": "WRONGCOD"})
        assert resp.status_code == 404

    eleventh = await client.post("/stands/redeem-code", json={"code": "WRONGCOD"})
    assert eleventh.status_code == 429
