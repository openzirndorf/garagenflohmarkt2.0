"""Admin-Login (E-Mail + Code, siehe app/routes/admins.py) und die
Roster-Verwaltung (wer zählt als Admin, weiterhin hinter dem statischen
ADMIN_TOKEN, siehe app/auth.py require_admin_auth)."""


async def _add_admin(client, master_admin_headers, email="admin@example.com"):
    resp = await client.post("/admins", json={"email": email}, headers=master_admin_headers)
    assert resp.status_code == 201
    return resp.json()


async def test_request_login_gives_same_response_for_known_and_unknown_email(
    client, master_admin_headers, api_auth, captured_admin_emails
):
    await _add_admin(client, master_admin_headers)

    known = await client.post(
        "/admins/request-login", json={"email": "admin@example.com"}, auth=api_auth
    )
    unknown = await client.post(
        "/admins/request-login", json={"email": "nobody@example.com"}, auth=api_auth
    )

    assert known.status_code == 200
    assert unknown.status_code == 200
    assert known.json() == unknown.json()
    # Nur für die bekannte E-Mail wurde tatsächlich eine Mail "verschickt".
    assert len(captured_admin_emails) == 1
    assert captured_admin_emails[0]["email"] == "admin@example.com"


async def test_redeem_code_returns_a_working_session_token(
    client, master_admin_headers, api_auth, captured_admin_emails
):
    await _add_admin(client, master_admin_headers)
    await client.post(
        "/admins/request-login", json={"email": "admin@example.com"}, auth=api_auth
    )
    code = captured_admin_emails[0]["login_code"]

    resp = await client.post("/admins/redeem-code", json={"code": code})
    assert resp.status_code == 200
    session_token = resp.json()["session_token"]

    stands_resp = await client.get(
        "/stands/admin", headers={"Authorization": f"Bearer {session_token}"}
    )
    assert stands_resp.status_code == 200


async def test_redeem_code_is_single_use(
    client, master_admin_headers, api_auth, captured_admin_emails
):
    await _add_admin(client, master_admin_headers)
    await client.post(
        "/admins/request-login", json={"email": "admin@example.com"}, auth=api_auth
    )
    code = captured_admin_emails[0]["login_code"]

    first = await client.post("/admins/redeem-code", json={"code": code})
    assert first.status_code == 200
    second = await client.post("/admins/redeem-code", json={"code": code})
    assert second.status_code == 404


async def test_redeem_code_rejects_unknown_code(client):
    resp = await client.post("/admins/redeem-code", json={"code": "NOTAREALCODE"})
    assert resp.status_code == 404


async def test_master_token_no_longer_works_on_everyday_admin_endpoints(
    client, master_admin_headers
):
    # Bewusster Bruch: der alte, geteilte Bearer-Token gilt seit
    # require_admin_session_auth nicht mehr für die alltäglichen
    # Admin-Endpunkte, nur noch für die Roster-Verwaltung.
    resp = await client.get("/stands/admin", headers=master_admin_headers)
    assert resp.status_code == 401


async def test_admin_session_token_does_not_work_on_roster_endpoints(client, admin_headers):
    # Umgekehrt: eine normale Admin-Session darf nicht selbst weitere
    # Admins anlegen können (siehe app/routes/admins.py Kommentar zu
    # require_admin_auth) - dafür bleibt der Master-Token nötig.
    resp = await client.post("/admins", json={"email": "neu@example.com"}, headers=admin_headers)
    assert resp.status_code == 401


async def test_roster_management_requires_master_token(client):
    resp = await client.get("/admins")
    assert resp.status_code in (401, 403)

    resp = await client.post("/admins", json={"email": "x@example.com"})
    assert resp.status_code in (401, 403)


async def test_add_admin_rejects_duplicate_email(client, master_admin_headers):
    await _add_admin(client, master_admin_headers, email="doppelt@example.com")
    resp = await client.post(
        "/admins", json={"email": "doppelt@example.com"}, headers=master_admin_headers
    )
    assert resp.status_code == 409


async def test_remove_admin_revokes_access(
    client, master_admin_headers, api_auth, captured_admin_emails
):
    admin = await _add_admin(client, master_admin_headers)
    await client.post(
        "/admins/request-login", json={"email": "admin@example.com"}, auth=api_auth
    )
    code = captured_admin_emails[0]["login_code"]
    session_token = (await client.post("/admins/redeem-code", json={"code": code})).json()[
        "session_token"
    ]

    delete_resp = await client.delete(f"/admins/{admin['id']}", headers=master_admin_headers)
    assert delete_resp.status_code == 204

    resp = await client.get(
        "/stands/admin", headers={"Authorization": f"Bearer {session_token}"}
    )
    assert resp.status_code == 401


async def test_list_admins_never_returns_token_hashes(client, master_admin_headers):
    await _add_admin(client, master_admin_headers)
    resp = await client.get("/admins", headers=master_admin_headers)
    assert resp.status_code == 200
    body = str(resp.json())
    assert "token" not in body.lower()


async def test_get_admins_without_trailing_slash_hits_the_real_endpoint(
    client, master_admin_headers
):
    # Regression: dieselbe Catch-all-Falle wie bei GET /stands (siehe
    # app/main.py, app/tests/test_main.py) - "" zusätzlich zu "/"
    # registriert, damit "/admins" ohne Slash nicht auf der
    # Frontend-Catch-all-Route landet.
    resp = await client.get("/admins", headers=master_admin_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/json")


async def test_wrong_master_token_is_rejected(client):
    resp = await client.get("/admins", headers={"Authorization": "Bearer falsch"})
    assert resp.status_code == 401


async def test_wrong_master_token_is_rate_limited_after_repeated_attempts(client):
    # _ADMIN_TOKEN_RATE_MAX in app/auth.py = 10 pro Stunde pro IP.
    for _ in range(10):
        resp = await client.get("/admins", headers={"Authorization": "Bearer falsch"})
        assert resp.status_code == 401

    resp = await client.get("/admins", headers={"Authorization": "Bearer falsch"})
    assert resp.status_code == 429


async def test_correct_master_token_still_works_after_rate_limit_was_triggered(
    client, master_admin_headers
):
    # Kritisch: das Rate-Limit darf NIE korrekte Zugangsdaten blockieren,
    # auch nicht nachdem zuvor viele falsche Versuche von derselben IP
    # kamen (siehe Kommentar in app/auth.py require_admin_auth - genau
    # dieser Fehler ist in einem verwandten Projekt einmal live passiert).
    for _ in range(15):
        await client.get("/admins", headers={"Authorization": "Bearer falsch"})

    resp = await client.get("/admins", headers=master_admin_headers)
    assert resp.status_code == 200
