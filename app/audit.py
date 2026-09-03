"""Schreibt Einträge ins Admin-Audit-Log (siehe migrations/0005_admin_audit_log.sql).

Bewusst nur Aktion + Stand-ID + Zeitstempel + grober Auslöser (owner/admin)
und, seit migrations/0014_audit_log_actor_email.sql, bei actor="admin"
zusätzlich die E-Mail des konkret handelnden Admins - kein Freitext, und
für owner/besucher weiterhin kein Personenbezug (siehe
test_audit_log_endpoint_never_contains_stand_owner_email): das würde die
datenschutzrechtlich sensiblere Standbetreiber-E-Mail betreffen, nicht die
ohnehin fürs Admin-Login bekannte. Fehler beim Loggen dürfen die
eigentliche Aktion nie blockieren, deshalb wird hier nichts geworfen, das
nicht schon vom Aufruf selbst kommt.
"""


async def log_action(
    pool, stand_id: int, action: str, actor: str, actor_email: str | None = None
) -> None:
    await pool.execute(
        "INSERT INTO admin_audit_log (stand_id, action, actor, actor_email) "
        "VALUES ($1, $2, $3, $4)",
        stand_id, action, actor, actor_email,
    )
