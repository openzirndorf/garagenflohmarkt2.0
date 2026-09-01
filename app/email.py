"""E-Mail-Versand für Bestätigungsmails via Scaleway Transactional Email (SMTP).

Umgebungsvariablen (werden per Terraform gesetzt):
  SMTP_HOST          – smtp.tem.scaleway.com
  SMTP_PORT          – 465
  SMTP_USER          – Scaleway Project ID
  SMTP_PASSWORD      – Scaleway Secret Key
  SMTP_FROM          – noreply@automail.openzirndorf.de
  BACKEND_URL        – öffentliche Backend-URL
  FRONTEND_URL       – öffentliche Frontend-URL
  ADMIN_CONTACT_EMAIL – Ziel für Antworten auf eine Inhalts-Sperre (Default:
                         derselbe Kontakt wie in Datenschutz/Impressum)
"""

import asyncio
import html
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

BACKEND_URL = os.getenv("BACKEND_URL", "").rstrip("/")
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "https://openzirndorf.github.io/garagenflohmarkt2.0",
).rstrip("/")
ADMIN_CONTACT_EMAIL = os.getenv("ADMIN_CONTACT_EMAIL", "team@openzirndorf.de")

# Muss zu UNLOCK_PARAM/UNLOCK_VALUE in frontend/src/lib/preview-unlock.ts
# passen. Vor dem offiziellen Start (siehe /launch-config, app/main.py)
# zeigt die Domain sonst nur die Platzhalterseite - ein per Mail
# verschickter Bestätigungscode/Admin-Link soll trotzdem funktionieren,
# statt dort hängen zu bleiben.
_PREVIEW_UNLOCK_QUERY = "?vorschau=zirndorf2026"


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


async def send_login_email(email: str, nickname: str, login_code: str, *, first_time: bool) -> None:
    """Schickt einen eintippbaren Login-Code. Tut nichts wenn SMTP nicht
    konfiguriert.

    Bewusst kein klickbarer Link mehr: die App ist als PWA installierbar,
    und ein Mail-Link öffnet dabei typischerweise nicht das installierte
    PWA-Fenster (v.a. iOS Safari kennt das grundsätzlich nicht) - der Code
    wird stattdessen manuell unter "Mein Stand" eingetippt. Beim ersten
    Einlösen wird der Stand automatisch freigeschaltet.
    """
    if not smtp_configured():
        return

    frontend_url = os.getenv("FRONTEND_URL", FRONTEND_URL).rstrip("/")
    mein_stand_url = f"{frontend_url}/{_PREVIEW_UNLOCK_QUERY}#mein-stand"

    if first_time:
        subject = "Garagenflohmarkt Zirndorf – Dein Bestätigungscode"
        intro = "vielen Dank für deine Anmeldung zum Garagenflohmarkt Zirndorf!"
        action_text = (
            "Gib diesen Code unter „Mein Stand\" ein, damit dein Stand auf der Karte erscheint:"
        )
    else:
        subject = "Garagenflohmarkt Zirndorf – Dein Zugangscode"
        intro = "du hast einen Zugangscode für deinen Stand angefordert."
        action_text = 'Gib diesen Code unter „Mein Stand" ein, um deinen Stand zu verwalten:'

    validity = "24 Stunden" if first_time else "30 Minuten"

    body_text = f"""\
Hallo {nickname},

{intro}

{action_text}

  {login_code}

Öffne dazu {mein_stand_url} und tippe den Code dort ein.

Der Code ist {validity} lang gültig und nur einmal verwendbar. Falls du ihn
verlierst oder er abläuft, kannst du dir jederzeit einen neuen über
"Zugang anfordern" schicken lassen.

Viele Grüße
Das Garagenflohmarkt-Team
"""

    body_html = f"""\
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:auto;color:#222">
  <h2 style="color:#009a00">Garagenflohmarkt Zirndorf</h2>
  <p>Hallo <strong>{nickname}</strong>,</p>
  <p>{intro}</p>
  <p>{action_text}</p>
  <p style="margin:24px 0;text-align:center">
    <span style="display:inline-block;background:#f3f4f6;color:#111;padding:16px 28px;
                 border-radius:8px;font-weight:bold;font-size:1.5rem;letter-spacing:0.15em;
                 font-family:monospace">
      {login_code}
    </span>
  </p>
  <p style="font-size:0.9em;color:#444">
    Öffne dazu <a href="{mein_stand_url}">{mein_stand_url}</a> und tippe den Code dort ein.
  </p>
  <p style="font-size:0.8em;color:#999">
    Gültig für {validity}, nur einmal verwendbar.
  </p>
</body>
</html>
"""

    await asyncio.to_thread(_send_sync, email, subject, body_text, body_html)


async def send_lock_reply_email(stand_id: int, nickname: str, message: str) -> None:
    """Leitet die Antwort eines gesperrten Standinhabers an den Admin-Kontakt
    weiter. Bewusst ohne die E-Mail-Adresse des Inhabers im Mailtext - der
    Admin kann sie bei Bedarf über das Admin-Panel (Stand-ID) nachschlagen,
    statt sie hier unnötig ein zweites Mal zu verteilen."""
    if not smtp_configured():
        return

    subject = f"Garagenflohmarkt Zirndorf – Antwort zu gesperrtem Stand #{stand_id}"
    body_text = f"""\
Der Inhaber von Stand #{stand_id} ({nickname}) hat auf eine
Inhalts-Sperre geantwortet:

  {message}

Zum Bearbeiten: {FRONTEND_URL}/{_PREVIEW_UNLOCK_QUERY}#admin
"""
    body_html = f"""\
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:auto;color:#222">
  <h2 style="color:#009a00">Garagenflohmarkt Zirndorf</h2>
  <p>Der Inhaber von Stand <strong>#{stand_id}</strong> ({nickname}) hat auf eine
  Inhalts-Sperre geantwortet:</p>
  <blockquote style="border-left:3px solid #f59e0b;margin:16px 0;padding:8px 16px;
              background:#fffbeb;white-space:pre-wrap">{html.escape(message)}</blockquote>
  <p><a href="{FRONTEND_URL}/{_PREVIEW_UNLOCK_QUERY}#admin">Zum Admin-Panel</a></p>
</body>
</html>
"""
    await asyncio.to_thread(_send_sync, ADMIN_CONTACT_EMAIL, subject, body_text, body_html)


async def send_report_email(stand_id: int, nickname: str, grund: str) -> None:
    """Meldefunktion für Besucher (falsche/fremde Einträge, siehe
    POST /stands/{id}/report) - Grund ist Pflicht (siehe report_stand),
    wird nur per Mail weitergeleitet, nie in der DB gespeichert."""
    if not smtp_configured():
        return

    grund_text = grund
    subject = f"Garagenflohmarkt Zirndorf – Meldung zu Stand #{stand_id}"
    body_text = f"""\
Stand #{stand_id} ({nickname}) wurde von einem Besucher gemeldet:

  {grund_text}

Zum Bearbeiten: {FRONTEND_URL}/{_PREVIEW_UNLOCK_QUERY}#admin
"""
    body_html = f"""\
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:auto;color:#222">
  <h2 style="color:#009a00">Garagenflohmarkt Zirndorf</h2>
  <p>Stand <strong>#{stand_id}</strong> ({nickname}) wurde von einem Besucher gemeldet:</p>
  <blockquote style="border-left:3px solid #ea580c;margin:16px 0;padding:8px 16px;
              background:#fff7ed;white-space:pre-wrap">{html.escape(grund_text)}</blockquote>
  <p><a href="{FRONTEND_URL}/{_PREVIEW_UNLOCK_QUERY}#admin">Zum Admin-Panel</a></p>
</body>
</html>
"""
    await asyncio.to_thread(_send_sync, ADMIN_CONTACT_EMAIL, subject, body_text, body_html)
