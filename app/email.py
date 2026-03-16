"""E-Mail-Versand für Bestätigungsmails.

Priorität:
  1. Scaleway Transactional Email (TEM) – empfohlen für Scaleway-Deployments
  2. Brevo HTTP-API – kostenloser Fallback
  3. SMTP – nur für lokale Entwicklung

Benötigte Umgebungsvariablen (eine der folgenden Optionen):

  Option 1 – Scaleway TEM:
    SCW_SECRET_KEY    – Scaleway Secret Key (IAM)
    SCW_PROJECT_ID    – Scaleway Project ID
    SCW_TEM_REGION    – Region des TEM-Projekts (Standard: fr-par)
    SMTP_FROM         – Verifizierte Absenderadresse in Scaleway TEM

  Option 2 – Brevo:
    BREVO_API_KEY     – API-Key von app.brevo.com
    SMTP_FROM         – Verifizierte Absenderadresse

  Option 3 – SMTP (lokal):
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM

  Immer benötigt:
    BACKEND_URL       – öffentliche Backend-URL
    FRONTEND_URL      – öffentliche Frontend-URL
"""

import asyncio
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
SCW_TEM_API_URL = "https://api.scaleway.com/transactional-email/v1alpha1/regions/{region}/emails"

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

BACKEND_URL = os.getenv("BACKEND_URL", "").rstrip("/")
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "https://openzirndorf.github.io/garagenflohmarkt2.0",
).rstrip("/")


def _get_sender() -> str:
    return os.getenv("SMTP_FROM", os.getenv("SMTP_USER", SMTP_USER))


def smtp_configured() -> bool:
    scw = os.getenv("SCW_SECRET_KEY", "") and os.getenv("SCW_PROJECT_ID", "")
    brevo = os.getenv("BREVO_API_KEY", "")
    smtp = os.getenv("SMTP_HOST", SMTP_HOST) and os.getenv("SMTP_USER", SMTP_USER) and os.getenv("SMTP_PASSWORD", SMTP_PASSWORD)
    backend = os.getenv("BACKEND_URL", BACKEND_URL)
    return bool((scw or brevo or smtp) and backend)


def smtp_debug_info() -> dict:
    scw_key = os.getenv("SCW_SECRET_KEY", "")
    scw_project = os.getenv("SCW_PROJECT_ID", "")
    scw_region = os.getenv("SCW_TEM_REGION", "fr-par")
    brevo_key = os.getenv("BREVO_API_KEY", "")
    host = os.getenv("SMTP_HOST", SMTP_HOST)
    port = int(os.getenv("SMTP_PORT", str(SMTP_PORT)))
    pw = os.getenv("SMTP_PASSWORD", SMTP_PASSWORD)
    backend = os.getenv("BACKEND_URL", BACKEND_URL)
    if scw_key and scw_project:
        provider = "scaleway-tem"
    elif brevo_key:
        provider = "brevo"
    elif host and pw:
        provider = "smtp"
    else:
        provider = "none"
    return {
        "provider": provider,
        "scw_secret_key_set": bool(scw_key),
        "scw_project_id": scw_project or "(nicht gesetzt)",
        "scw_tem_region": scw_region,
        "brevo_api_key_set": bool(brevo_key),
        "smtp_host": host or "(nicht gesetzt)",
        "smtp_port": port,
        "smtp_password_set": bool(pw),
        "sender": _get_sender() or "(nicht gesetzt)",
        "backend_url": backend or "(nicht gesetzt)",
        "configured": smtp_configured(),
    }


async def _send_via_scaleway_tem(
    secret_key: str, project_id: str, region: str,
    to: str, subject: str, body_text: str, body_html: str,
) -> None:
    sender = _get_sender()
    payload = {
        "project_id": project_id,
        "from": {"email": sender, "name": "Garagenflohmarkt Zirndorf"},
        "to": [{"email": to}],
        "subject": subject,
        "text": body_text,
        "html": body_html,
    }
    url = SCW_TEM_API_URL.format(region=region)
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            url,
            json=payload,
            headers={"X-Auth-Token": secret_key, "Content-Type": "application/json"},
        )
        resp.raise_for_status()


async def _send_via_brevo(api_key: str, to: str, subject: str, body_text: str, body_html: str) -> None:
    sender = _get_sender()
    payload = {
        "sender": {"name": "Garagenflohmarkt Zirndorf", "email": sender},
        "to": [{"email": to}],
        "subject": subject,
        "textContent": body_text,
        "htmlContent": body_html,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            BREVO_API_URL,
            json=payload,
            headers={"api-key": api_key, "Content-Type": "application/json"},
        )
        resp.raise_for_status()


def _send_via_smtp(to: str, subject: str, body_text: str, body_html: str) -> None:
    host = os.getenv("SMTP_HOST", SMTP_HOST)
    port = int(os.getenv("SMTP_PORT", str(SMTP_PORT)))
    user = os.getenv("SMTP_USER", SMTP_USER)
    password = os.getenv("SMTP_PASSWORD", SMTP_PASSWORD)
    sender = _get_sender()
    ssl_env = os.getenv("SMTP_SSL", "").lower()
    use_ssl = ssl_env == "true" if ssl_env else port == 465

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    if use_ssl:
        with smtplib.SMTP_SSL(host, port, timeout=15) as smtp:
            smtp.login(user, password)
            smtp.sendmail(sender, [to], msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.sendmail(sender, [to], msg.as_string())


async def send_confirmation_email(email: str, name: str, edit_token: str) -> None:
    """Schickt eine Bestätigungsmail. Nutzt Brevo API falls konfiguriert, sonst SMTP."""
    if not smtp_configured():
        return

    backend_url = os.getenv("BACKEND_URL", BACKEND_URL).rstrip("/")
    frontend_url = os.getenv("FRONTEND_URL", FRONTEND_URL).rstrip("/")
    confirm_url = f"{backend_url}/stands/confirm/{edit_token}"
    manage_url = f"{frontend_url}#mein-stand/{edit_token}"

    subject = "Garagenflohmarkt Zirndorf – Bitte bestätige dein Inserat"

    body_text = f"""\
Hallo {name},

vielen Dank für deine Anmeldung zum Garagenflohmarkt Zirndorf!

Bitte bestätige deine E-Mail-Adresse, damit dein Stand auf der Karte erscheint:

  {confirm_url}

Nach dem Klick wird dein Stand automatisch freigeschaltet.

Mit diesem Link kannst du deinen Stand jederzeit verwalten oder zurückziehen:

  {manage_url}

Viele Grüße
Das Garagenflohmarkt-Team
"""

    body_html = f"""\
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:auto;color:#222">
  <h2 style="color:#2563eb">Garagenflohmarkt Zirndorf</h2>
  <p>Hallo <strong>{name}</strong>,</p>
  <p>vielen Dank für deine Anmeldung zum Garagenflohmarkt Zirndorf!</p>
  <p>Bitte bestätige deine E-Mail-Adresse, damit dein Stand auf der Karte erscheint:</p>
  <p style="margin:24px 0">
    <a href="{confirm_url}"
       style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
      E-Mail bestätigen &amp; Stand freischalten
    </a>
  </p>
  <p style="font-size:0.85em;color:#666">
    Oder kopiere diesen Link in deinen Browser:<br>
    <a href="{confirm_url}">{confirm_url}</a>
  </p>
  <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
  <p style="font-size:0.85em;color:#666">
    Stand verwalten / zurückziehen:<br>
    <a href="{manage_url}">{manage_url}</a>
  </p>
</body>
</html>
"""

    scw_key = os.getenv("SCW_SECRET_KEY", "")
    scw_project = os.getenv("SCW_PROJECT_ID", "")
    scw_region = os.getenv("SCW_TEM_REGION", "fr-par")
    brevo_key = os.getenv("BREVO_API_KEY", "")

    if scw_key and scw_project:
        await _send_via_scaleway_tem(scw_key, scw_project, scw_region, email, subject, body_text, body_html)
    elif brevo_key:
        await _send_via_brevo(brevo_key, email, subject, body_text, body_html)
    else:
        await asyncio.to_thread(_send_via_smtp, email, subject, body_text, body_html)
