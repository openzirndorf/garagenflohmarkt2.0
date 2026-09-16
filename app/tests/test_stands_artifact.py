import json

import pytest

from app.jobs import stands_artifact


async def test_noop_without_bucket(monkeypatch):
    monkeypatch.setattr(stands_artifact, "_BUCKET", "")
    # Darf nicht crashen, obwohl keine S3-Umgebungsvariablen gesetzt sind.
    await stands_artifact.regenerate_stands_artifact()


# Live wiederholt an einem intermittierenden DNS-Fehler beim S3-Upload
# gescheitert (siehe Kommentar bei _upload_with_retry) - deckt den
# Retry-Mechanismus selbst ab, unabhängig von boto3.
async def test_upload_retries_after_transient_failures_and_succeeds(monkeypatch):
    monkeypatch.setattr(stands_artifact, "_BUCKET", "test-bucket")
    sleeps = []
    async def _fake_sleep(s):
        sleeps.append(s)

    monkeypatch.setattr(stands_artifact.asyncio, "sleep", _fake_sleep)

    calls = []

    def flaky_upload(list_json, geojson, generated_at, stand_count):
        calls.append(1)
        if len(calls) < 3:
            raise ConnectionError("Temporary failure in name resolution")

    monkeypatch.setattr(stands_artifact, "_upload", flaky_upload)

    await stands_artifact._upload_with_retry(b"[]", b"{}", "2026-01-01T00:00:00", 0)

    assert len(calls) == 3
    assert sleeps == [5, 10]


async def test_upload_gives_up_after_exhausting_retries(monkeypatch):
    monkeypatch.setattr(stands_artifact, "_BUCKET", "test-bucket")

    async def _fake_sleep(s):
        pass

    monkeypatch.setattr(stands_artifact.asyncio, "sleep", _fake_sleep)

    def always_fails(list_json, geojson, generated_at, stand_count):
        raise ConnectionError("Temporary failure in name resolution")

    monkeypatch.setattr(stands_artifact, "_upload", always_fails)

    with pytest.raises(ConnectionError):
        await stands_artifact._upload_with_retry(b"[]", b"{}", "2026-01-01T00:00:00", 0)


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
        json={"adresse": "Musterstraße 1, Zirndorf", "email": "artefakt-a@example.com", "datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": []},
        auth=api_auth,
    )
    stand = approved.json()
    await client.post(f"/stands/{stand['id']}/approve", headers=admin_headers)

    # Bleibt PENDING - darf nicht im Artefakt landen
    await client.post(
        "/stands/",
        json={"adresse": "Musterstraße 2, Zirndorf", "email": "artefakt-b@example.com", "datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": []},
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


async def test_artifact_excludes_deactivated_stands(client, api_auth, admin_headers, monkeypatch):
    monkeypatch.setattr(stands_artifact, "_BUCKET", "test-bucket")
    captured = {}

    def fake_upload(list_json, geojson, generated_at, stand_count):
        captured["list"] = json.loads(list_json)
        captured["geojson"] = json.loads(geojson)

    monkeypatch.setattr(stands_artifact, "_upload", fake_upload)

    resp = await client.post(
        "/stands/",
        json={"adresse": "Musterstraße 1, Zirndorf", "email": "deaktiviert@example.com", "datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": []},
        auth=api_auth,
    )
    stand = resp.json()
    await client.post(f"/stands/{stand['id']}/approve", headers=admin_headers)
    await client.patch(
        f"/stands/{stand['id']}", json={"deactivated": True}, headers=admin_headers
    )

    await stands_artifact.regenerate_stands_artifact()

    assert captured["list"] == []
    assert captured["geojson"]["features"] == []


async def test_approve_triggers_artifact_regeneration(client, api_auth, admin_headers, monkeypatch):
    calls = []

    async def fake_regenerate():
        calls.append(True)

    monkeypatch.setattr("app.routes.stands.regenerate_stands_artifact", fake_regenerate)

    resp = await client.post(
        "/stands/",
        json={"adresse": "Musterstraße 1, Zirndorf", "email": "trigger@example.com", "datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": []},
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
        json={"adresse": "Musterstraße 1, Zirndorf", "email": "trigger2@example.com", "datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": []},
        auth=api_auth,
    )
    login_code = captured_emails[0]["login_code"]

    login_resp = await client.post("/stands/redeem-code", json={"code": login_code})
    session_token = login_resp.json()["session_token"]
    calls.clear()  # der Login selbst hat schon einmal ausgelöst (PENDING→APPROVED)

    await client.delete("/stands/by-session", headers={"Authorization": f"Bearer {session_token}"})
    assert calls == [True]
