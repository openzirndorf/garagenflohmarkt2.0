"""E-Mail-Versand für Bestätigungsmails via Scaleway Transactional Email (SMTP).

Umgebungsvariablen (werden per Terraform gesetzt):
  SMTP_HOST     – smtp.tem.scaleway.com
  SMTP_PORT     – 465
  SMTP_USER     – Scaleway Project ID
  SMTP_PASSWORD – Scaleway Secret Key
  SMTP_FROM     – noreply@automail.openzirndorf.de
  BACKEND_URL   – öffentliche Backend-URL
  FRONTEND_URL  – öffentliche Frontend-URL
"""

import asyncio
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

BACKEND_URL = os.getenv("BACKEND_URL", "").rstrip("/")
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "https://openzirndorf.github.io/garagenflohmarkt2.0",
).rstrip("/")


def smtp_configured() -> bool:
    return bool(
        os.getenv("SMTP_HOST")
        and os.getenv("SMTP_USER")
        and os.getenv("SMTP_PASSWORD")
        and os.getenv("BACKEND_URL")
    )


def smtp_debug_info() -> dict:
    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "465"))
    user = os.getenv("SMTP_USER", "")
    pw = os.getenv("SMTP_PASSWORD", "")
    sender = os.getenv("SMTP_FROM", "")
    backend = os.getenv("BACKEND_URL", "")
    use_ssl = port == 465
    return {
        "smtp_host": host or "(nicht gesetzt)",
        "smtp_port": port,
        "smtp_user": user or "(nicht gesetzt)",
        "smtp_password_set": bool(pw),
        "smtp_ssl": use_ssl,
        "sender": sender or "(nicht gesetzt)",
        "backend_url": backend or "(nicht gesetzt)",
        "configured": smtp_configured(),
    }


def _send_sync(to: str, subject: str, body_text: str, body_html: str) -> None:
    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "465"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    sender = os.getenv("SMTP_FROM", user)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=15) as smtp:
            smtp.login(user, password)
            smtp.sendmail(sender, [to], msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.sendmail(sender, [to], msg.as_string())


async def send_confirmation_email(email: str, name: str, edit_token: str) -> None:
    """Schickt eine Bestätigungsmail. Tut nichts wenn SMTP nicht konfiguriert."""
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

    await asyncio.to_thread(_send_sync, email, subject, body_text, body_html)
