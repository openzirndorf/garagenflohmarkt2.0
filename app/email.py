"""SMTP E-Mail-Versand für Bestätigungsmails.

Benötigte Umgebungsvariablen:
  SMTP_HOST       – z.B. smtp.mailbox.org
  SMTP_PORT       – Standard: 587
  SMTP_USER       – Benutzername / Absenderadresse
  SMTP_PASSWORD   – Passwort
  SMTP_FROM       – Absenderadresse (optional, Standard = SMTP_USER)
  SMTP_STARTTLS   – "true"/"false", Standard: true
  BACKEND_URL     – öffentliche Backend-URL, z.B. https://api.example.com
  FRONTEND_URL    – öffentliche Frontend-URL, z.B. https://example.com/flohmarkt
"""

import asyncio
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "") or SMTP_USER
# SMTP_SSL=true  → implicit TLS (Port 465)
# SMTP_SSL=false → STARTTLS (Port 587, Standard)
_smtp_ssl_env = os.getenv("SMTP_SSL", "").lower()
SMTP_SSL = _smtp_ssl_env == "true" if _smtp_ssl_env else SMTP_PORT == 465
SMTP_STARTTLS = not SMTP_SSL and os.getenv("SMTP_STARTTLS", "true").lower() != "false"

BACKEND_URL = os.getenv("BACKEND_URL", "").rstrip("/")
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "https://openzirndorf.github.io/garagenflohmarkt2.0",
).rstrip("/")


def smtp_configured() -> bool:
    # Env-Vars werden beim Import gelesen – zur Laufzeit noch mal prüfen falls nötig
    host = os.getenv("SMTP_HOST", SMTP_HOST)
    user = os.getenv("SMTP_USER", SMTP_USER)
    pw = os.getenv("SMTP_PASSWORD", SMTP_PASSWORD)
    bu = os.getenv("BACKEND_URL", BACKEND_URL)
    return bool(host and user and pw and bu)


def smtp_debug_info() -> dict:
    """Gibt aktuelle SMTP-Konfiguration zurück (ohne Passwort)."""
    host = os.getenv("SMTP_HOST", SMTP_HOST)
    port = int(os.getenv("SMTP_PORT", str(SMTP_PORT)))
    user = os.getenv("SMTP_USER", SMTP_USER)
    pw = os.getenv("SMTP_PASSWORD", SMTP_PASSWORD)
    backend = os.getenv("BACKEND_URL", BACKEND_URL)
    ssl_env = os.getenv("SMTP_SSL", "").lower()
    use_ssl = ssl_env == "true" if ssl_env else port == 465
    return {
        "smtp_host": host or "(nicht gesetzt)",
        "smtp_port": port,
        "smtp_user": user or "(nicht gesetzt)",
        "smtp_password_set": bool(pw),
        "smtp_ssl": use_ssl,
        "backend_url": backend or "(nicht gesetzt)",
        "configured": bool(host and user and pw and backend),
    }


def _send_sync(to: str, subject: str, body_text: str, body_html: str) -> None:
    # Env-Vars zur Laufzeit lesen (nicht gecacht vom Modulimport)
    host = os.getenv("SMTP_HOST", SMTP_HOST)
    port = int(os.getenv("SMTP_PORT", str(SMTP_PORT)))
    user = os.getenv("SMTP_USER", SMTP_USER)
    password = os.getenv("SMTP_PASSWORD", SMTP_PASSWORD)
    sender = os.getenv("SMTP_FROM", SMTP_FROM) or user
    ssl_env = os.getenv("SMTP_SSL", "").lower()
    use_ssl = ssl_env == "true" if ssl_env else port == 465
    use_starttls = not use_ssl

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
            if use_starttls:
                smtp.starttls()
            smtp.login(user, password)
            smtp.sendmail(sender, [to], msg.as_string())


async def send_confirmation_email(email: str, name: str, edit_token: str) -> None:
    """Schickt eine Bestätigungsmail. Bei nicht konfiguriertem SMTP wird nichts gesendet."""
    if not smtp_configured():
        return

    confirm_url = f"{BACKEND_URL}/stands/confirm/{edit_token}"
    manage_url = f"{FRONTEND_URL}#mein-stand/{edit_token}"

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
