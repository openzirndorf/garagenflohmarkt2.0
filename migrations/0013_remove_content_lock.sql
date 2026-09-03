-- Entfernt die "Sperre" (content_locked/content_lock_message, siehe
-- migrations/0006_content_moderation.sql) - fühlte sich in der Praxis
-- doppelt mit der Deaktivierung (migrations/0012) an und blockierte nur
-- die Bearbeitung, ohne den Stand tatsächlich von Karte/Liste zu nehmen.
-- Deaktivierung deckt den eigentlichen Bedarf ab und bleibt als einzige
-- Aktion bestehen. Die geteilte Antwort-Spalte wird passend umbenannt,
-- jetzt eindeutig nur noch für die Deaktivierung.
ALTER TABLE stands DROP COLUMN content_locked;
ALTER TABLE stands DROP COLUMN content_lock_message;
ALTER TABLE stands RENAME COLUMN lock_reply_message TO deactivation_reply_message;
ALTER TABLE stands RENAME COLUMN lock_reply_created_at TO deactivation_reply_created_at;
