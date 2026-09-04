"""Schreibt Einträge ins Admin-Audit-Log (siehe migrations/0005_admin_audit_log.sql).

Bewusst nur Aktion + Stand-ID + Zeitstempel + grober Auslöser (owner/admin)
und, seit migrations/0014_audit_log_actor_email.sql, bei actor="admin"
zusätzlich die E-Mail des konkret handelnden Admins - für owner/besucher
weiterhin kein Personenbezug (siehe
test_audit_log_endpoint_never_contains_stand_owner_email): das würde die
datenschutzrechtlich sensiblere Standbetreiber-E-Mail betreffen, nicht die
ohnehin fürs Admin-Login bekannte. Seit migrations/0017_audit_log_report_
detail.sql zusätzlich ein optionales, auf 80 Zeichen begrenztes "detail"-
Freitextfeld - bisher nur für den Grund einer Besucher-Meldung (REPORTED,
siehe report_stand in app/routes/stands.py) genutzt, damit Admins den Grund
im Panel nachlesen können statt nur in der Benachrichtigungs-Mail. Für alle
anderen Aktionen bleibt detail NULL - kein allgemeines Freitextfeld für
owner/admin-Aktionen. Fehler beim Loggen dürfen die eigentliche Aktion nie
blockieren, deshalb wird hier nichts geworfen, das nicht schon vom Aufruf
selbst kommt.

stand_id ist optional (seit migrations/0016_audit_log_settings_actions.sql)
- globale Einstellungsänderungen (app/routes/settings.py) gehören zu
keinem Stand."""


async def log_action(
    pool,
    stand_id: int | None,
    action: str,
    actor: str,
    actor_email: str | None = None,
    detail: str | None = None,
) -> None:
    await pool.execute(
        "INSERT INTO admin_audit_log (stand_id, action, actor, actor_email, detail) "
        "VALUES ($1, $2, $3, $4, $5)",
        stand_id, action, actor, actor_email, detail,
    )
