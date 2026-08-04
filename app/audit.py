"""Schreibt Einträge ins Admin-Audit-Log (siehe migrations/0005_admin_audit_log.sql).

Bewusst nur Aktion + Stand-ID + Zeitstempel + grober Auslöser (owner/admin) -
keine personenbezogenen Daten, kein Freitext. Fehler beim Loggen dürfen die
eigentliche Aktion nie blockieren, deshalb wird hier nichts geworfen, das
nicht schon vom Aufruf selbst kommt.
"""


async def log_action(pool, stand_id: int, action: str, actor: str) -> None:
    await pool.execute(
        "INSERT INTO admin_audit_log (stand_id, action, actor) VALUES ($1, $2, $3)",
        stand_id, action, actor,
    )
