import logging
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


async def test_no_pii_in_application_logs_across_full_cycle(
    client, api_auth, admin_headers, captured_emails, caplog
):
    """Erfasst alle Python-Log-Ausgaben über einen vollständigen
    Anmelden→Einloggen→Bearbeiten→Löschen-Zyklus und stellt sicher, dass
    weder die E-Mail-Adresse noch einer der beiden Klartext-Tokens darin
    auftaucht. Uvicorns Access-Log selbst wird hier nicht mitgetestet (das
    läuft nur im echten ASGI-Server, nicht über den Test-Client) - dafür
    sorgt --no-access-log im Dockerfile, siehe test_dockerfile_disables_default_access_log.
    """
    caplog.set_level(logging.DEBUG)

    email = "logtest@example.com"
    created = await client.post(
        "/stands/",
        json={"adresse": "Musterstraße 1, Zirndorf", "email": email, "datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": []},
        auth=api_auth,
    )
    assert created.status_code == 201
    login_code = captured_emails[0]["login_code"]

    login_resp = await client.post("/stands/redeem-code", json={"code": login_code})
    session_token = login_resp.json()["session_token"]

    await client.get(f"/stands/by-session/{session_token}")
    await client.patch(f"/stands/by-session/{session_token}", json={"datenschutz_zustimmung": True, "mindestalter_bestaetigt": True, "kategorien": ["Bücher"]})
    await client.get("/stands/admin", headers=admin_headers)
    await client.delete(f"/stands/by-session/{session_token}")

    # Nur die Logger unserer eigenen App betrachten - httpx (der Test-Client
    # selbst) loggt die aufgerufene URL client-seitig zu Debug-Zwecken, das
    # ist kein Verhalten des produktiven Servers und nicht Gegenstand
    # dieses Tests.
    app_records = [r for r in caplog.records if r.name.startswith("app.")]
    log_text = "\n".join(record.getMessage() for record in app_records)
    assert email not in log_text
    assert login_code not in log_text
    assert session_token not in log_text


def test_dockerfile_disables_default_access_log():
    """Uvicorns Standard-Access-Log würde Tokens, die als URL-Pfadsegment
    übertragen werden (z.B. /stands/confirm/{token}), im Klartext in die
    Container-Logs schreiben. --no-access-log verhindert das."""
    dockerfile = (REPO_ROOT / "Dockerfile").read_text(encoding="utf-8")
    assert "--no-access-log" in dockerfile
