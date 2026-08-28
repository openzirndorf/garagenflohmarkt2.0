import json

from app.jobs import stands_artifact


async def test_noop_without_bucket(monkeypatch):
    monkeypatch.setattr(stands_artifact, "_BUCKET", "")
    # Darf nicht crashen, obwohl keine S3-Umgebungsvariablen gesetzt sind.
    await stands_artifact.regenerate_stands_artifact()


async def test_artifact_contains_only_approved_stands_and_public_fields(
    client, api_auth, admin_headers, monkeypatch
):
    monkeypatch.setattr(stands_artifact, "_BUCKET", "test-bucket")
    captured = {}

    def fake_upload(list_json, geojson, generated_at, stand_count):
        captured["list"] = json.loads(list_json)
        captured["geojson"] = json.loads(geojson)
        captured["stand_count"] = stand_count
        captured["generated_at"] = generated_at

    monkeypatch.setattr(stands_artifact, "_upload", fake_upload)

    approved = await client.post(
        "/stands/",
        json={"adresse": "Musterstraße 1, Zirndorf", "email": "artefakt-a@example.com", "kategorien": []},
        auth=api_auth,
    )
    stand = approved.json()
    await client.post(f"/stands/{stand['id']}/approve", headers=admin_headers)

    # Bleibt PENDING - darf nicht im Artefakt landen
    await client.post(
        "/stands/",
        json={"adresse": "Musterstraße 2, Zirndorf", "email": "artefakt-b@example.com", "kategorien": []},
        auth=api_auth,
    )

    await stands_artifact.regenerate_stands_artifact()

    assert captured["stand_count"] == 1
    assert len(captured["list"]) == 1
    assert captured["list"][0]["nickname"] == stand["nickname"]
    assert set(captured["list"][0].keys()) == {
        "id", "nickname", "adresse", "lat", "lng", "beschreibung", "kategorien", "zahlungsarten",
        "created_at",
    }

    assert len(captured["geojson"]["features"]) == 1
    assert "email" not in json.dumps(captured["geojson"])
    assert "artefakt-a@example.com" not in json.dumps(captured)


async def test_approve_triggers_artifact_regeneration(client, api_auth, admin_headers, monkeypatch):
    calls = []

    async def fake_regenerate():
        calls.append(True)

    monkeypatch.setattr("app.routes.stands.regenerate_stands_artifact", fake_regenerate)

    resp = await client.post(
        "/stands/",
        json={"adresse": "Musterstraße 1, Zirndorf", "email": "trigger@example.com", "kategorien": []},
        auth=api_auth,
    )
    stand = resp.json()

    await client.post(f"/stands/{stand['id']}/approve", headers=admin_headers)
    assert calls == [True]


async def test_owner_delete_triggers_artifact_regeneration(client, api_auth, captured_emails, monkeypatch):
    calls = []

    async def fake_regenerate():
        calls.append(True)

    monkeypatch.setattr("app.routes.stands.regenerate_stands_artifact", fake_regenerate)

    await client.post(
        "/stands/",
        json={"adresse": "Musterstraße 1, Zirndorf", "email": "trigger2@example.com", "kategorien": []},
        auth=api_auth,
    )
    login_code = captured_emails[0]["login_code"]

    login_resp = await client.post("/stands/redeem-code", json={"code": login_code})
    session_token = login_resp.json()["session_token"]
    calls.clear()  # der Login selbst hat schon einmal ausgelöst (PENDING→APPROVED)

    await client.delete(f"/stands/by-session/{session_token}")
    assert calls == [True]
