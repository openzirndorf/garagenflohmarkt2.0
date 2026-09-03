async def _register(client, api_auth, email="mod@example.com", **overrides):
    body = {"adresse": "Musterstraße 1, Zirndorf", "email": email, "datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": []}
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

    resp = await client.patch(f"/stands/by-session/{session_token}", json={"datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": ["Bücher"]})
    assert resp.status_code == 200


async def test_admin_is_exempt_from_blocklist(client, api_auth, admin_headers):
    stand = (await _register(client, api_auth)).json()
    resp = await client.patch(
        f"/stands/{stand['id']}", json={"beschreibung": "nazi-referenz zu Dokumentationszwecken"},
        headers=admin_headers,
    )
    assert resp.status_code == 200


# --- Deaktivierung (nimmt den Stand komplett von Karte/Liste; ersetzt eine
# frühere, separate "Sperre", die nur die Bearbeitung blockierte - fühlte
# sich neben der Deaktivierung redundant an und wurde entfernt) ---


async def test_deactivated_stand_is_removed_from_public_endpoints_but_stays_in_admin_view(
    client, api_auth, admin_headers
):
    stand = (await _register(client, api_auth)).json()
    await client.post(f"/stands/{stand['id']}/approve", headers=admin_headers)

    assert any(s["id"] == stand["id"] for s in (await client.get("/stands")).json())
    geo = (await client.get("/stands/geojson")).json()
    assert any(f["properties"]["id"] == stand["id"] for f in geo["features"])

    await client.patch(
        f"/stands/{stand['id']}",
        json={"deactivated": True, "deactivation_message": "Adresse existiert nicht."},
        headers=admin_headers,
    )

    assert all(s["id"] != stand["id"] for s in (await client.get("/stands")).json())
    geo = (await client.get("/stands/geojson")).json()
    assert all(f["properties"]["id"] != stand["id"] for f in geo["features"])

    admin_view = (await client.get("/stands/admin", headers=admin_headers)).json()
    entry = next(s for s in admin_view if s["id"] == stand["id"])
    assert entry["deactivated"] is True
    assert entry["deactivation_message"] == "Adresse existiert nicht."


async def test_owner_edit_still_works_while_deactivated(client, api_auth, admin_headers, captured_emails):
    stand = (await _register(client, api_auth)).json()
    session_token = await _login(client, captured_emails[0]["login_code"])
    await client.patch(
        f"/stands/{stand['id']}", json={"deactivated": True}, headers=admin_headers
    )

    # Anders als die frühere Sperre blockiert die Deaktivierung nicht die
    # Bearbeitung - nur die Sichtbarkeit ändert sich.
    resp = await client.patch(
        f"/stands/by-session/{session_token}", json={"beschreibung": "Neue Beschreibung"}
    )
    assert resp.status_code == 200


async def test_deactivating_a_stand_emails_the_owner_with_the_reason(
    client, api_auth, admin_headers, captured_deactivation_emails
):
    stand = (await _register(client, api_auth, email="wird-deaktiviert@example.com")).json()

    resp = await client.patch(
        f"/stands/{stand['id']}",
        json={"deactivated": True, "deactivation_message": "Adresse existiert nicht."},
        headers=admin_headers,
    )
    assert resp.status_code == 200

    assert len(captured_deactivation_emails) == 1
    mail = captured_deactivation_emails[0]
    assert mail["email"] == "wird-deaktiviert@example.com"
    assert mail["stand_id"] == stand["id"]
    assert mail["message"] == "Adresse existiert nicht."


async def test_editing_an_already_deactivated_stand_does_not_resend_the_email(
    client, api_auth, admin_headers, captured_deactivation_emails
):
    stand = (await _register(client, api_auth)).json()
    await client.patch(f"/stands/{stand['id']}", json={"deactivated": True}, headers=admin_headers)
    assert len(captured_deactivation_emails) == 1

    # Admin-Panel schickt "deactivated" bei jedem Speichern mit (siehe
    # admin-panel.tsx EditFormState) - unverändert True darf keine zweite
    # Mail und keinen zweiten DEACTIVATED-Eintrag auslösen.
    resp = await client.patch(
        f"/stands/{stand['id']}",
        json={"beschreibung": "Korrigierte Beschreibung", "deactivated": True},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert len(captured_deactivation_emails) == 1


async def test_unrelated_edit_with_unchanged_deactivated_false_is_logged_as_edited(
    client, api_auth, admin_headers, pool, captured_deactivation_emails
):
    stand = (await _register(client, api_auth)).json()

    # Simuliert exakt, was das Admin-Panel bei jedem "Speichern" schickt:
    # deactivated=False ist immer Teil des Formulars, auch wenn der Stand
    # nie deaktiviert war.
    resp = await client.patch(
        f"/stands/{stand['id']}",
        json={"beschreibung": "Korrigierte Beschreibung", "deactivated": False},
        headers=admin_headers,
    )
    assert resp.status_code == 200

    entries = await pool.fetch(
        "SELECT action FROM admin_audit_log WHERE stand_id = $1", stand["id"]
    )
    actions = [r["action"] for r in entries]
    assert "EDITED" in actions
    assert "REACTIVATED" not in actions
    assert not captured_deactivation_emails


async def test_owner_view_includes_deactivation_state(client, api_auth, admin_headers, captured_emails):
    stand = (await _register(client, api_auth)).json()
    session_token = await _login(client, captured_emails[0]["login_code"])

    await client.patch(
        f"/stands/{stand['id']}",
        json={"deactivated": True, "deactivation_message": "Bitte melde dich beim Team."},
        headers=admin_headers,
    )

    owner_view = (await client.get(f"/stands/by-session/{session_token}")).json()
    assert owner_view["deactivated"] is True
    assert owner_view["deactivation_message"] == "Bitte melde dich beim Team."


async def test_deactivation_reply_requires_the_stand_to_be_deactivated(client, api_auth, captured_emails):
    await _register(client, api_auth)
    session_token = await _login(client, captured_emails[0]["login_code"])

    resp = await client.post(
        f"/stands/by-session/{session_token}/deactivation-reply",
        json={"message": "Warum deaktiviert?"},
    )
    assert resp.status_code == 400


async def test_deactivation_reply_succeeds_and_is_audit_logged(
    client, api_auth, admin_headers, captured_emails, pool
):
    stand = (await _register(client, api_auth)).json()
    session_token = await _login(client, captured_emails[0]["login_code"])

    await client.patch(
        f"/stands/{stand['id']}", json={"deactivated": True}, headers=admin_headers
    )

    resp = await client.post(
        f"/stands/by-session/{session_token}/deactivation-reply",
        json={"message": "Bitte um Überprüfung, das war ein Missverständnis."},
    )
    assert resp.status_code == 200

    entries = await pool.fetch(
        "SELECT action, actor FROM admin_audit_log WHERE stand_id = $1", stand["id"]
    )
    assert any(r["action"] == "REPLIED" and r["actor"] == "owner" for r in entries)


async def test_deactivation_reply_rejects_empty_message(client, api_auth, admin_headers, captured_emails):
    stand = (await _register(client, api_auth)).json()
    session_token = await _login(client, captured_emails[0]["login_code"])
    await client.patch(
        f"/stands/{stand['id']}", json={"deactivated": True}, headers=admin_headers
    )

    resp = await client.post(
        f"/stands/by-session/{session_token}/deactivation-reply", json={"message": "   "}
    )
    assert resp.status_code == 400


async def test_deactivation_reply_message_not_stored_in_audit_log(
    client, api_auth, admin_headers, captured_emails, pool
):
    stand = (await _register(client, api_auth)).json()
    session_token = await _login(client, captured_emails[0]["login_code"])
    await client.patch(
        f"/stands/{stand['id']}", json={"deactivated": True}, headers=admin_headers
    )

    secret_message = "darf-nicht-im-audit-log-landen"
    await client.post(
        f"/stands/by-session/{session_token}/deactivation-reply", json={"message": secret_message}
    )

    row = await pool.fetchrow(
        "SELECT action, actor, stand_id FROM admin_audit_log WHERE stand_id = $1 "
        "AND action = 'REPLIED'",
        stand["id"],
    )
    assert secret_message not in str(dict(row))


async def test_deactivation_reply_visible_to_admin_and_cleared_on_reactivation(
    client, api_auth, admin_headers, captured_emails
):
    stand = (await _register(client, api_auth)).json()
    session_token = await _login(client, captured_emails[0]["login_code"])
    await client.patch(
        f"/stands/{stand['id']}", json={"deactivated": True}, headers=admin_headers
    )

    reply_message = "Bitte um Überprüfung, das war ein Missverständnis."
    await client.post(
        f"/stands/by-session/{session_token}/deactivation-reply", json={"message": reply_message}
    )

    admin_view = (await client.get("/stands/admin", headers=admin_headers)).json()
    entry = next(s for s in admin_view if s["id"] == stand["id"])
    assert entry["deactivation_reply_message"] == reply_message
    assert entry["deactivation_reply_created_at"] is not None

    await client.patch(
        f"/stands/{stand['id']}", json={"deactivated": False}, headers=admin_headers
    )

    admin_view = (await client.get("/stands/admin", headers=admin_headers)).json()
    entry = next(s for s in admin_view if s["id"] == stand["id"])
    assert entry["deactivation_reply_message"] is None
    assert entry["deactivation_reply_created_at"] is None


async def test_deactivation_is_audit_logged_distinctly(client, api_auth, admin_headers, pool):
    stand = (await _register(client, api_auth)).json()

    await client.patch(
        f"/stands/{stand['id']}", json={"deactivated": True}, headers=admin_headers
    )
    await client.patch(
        f"/stands/{stand['id']}", json={"deactivated": False}, headers=admin_headers
    )

    entries = await pool.fetch(
        "SELECT action FROM admin_audit_log WHERE stand_id = $1 ORDER BY created_at", stand["id"]
    )
    actions = [r["action"] for r in entries]
    assert "DEACTIVATED" in actions
    assert "REACTIVATED" in actions
    assert "EDITED" not in actions
