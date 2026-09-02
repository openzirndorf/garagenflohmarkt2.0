-- Stand deaktivieren (von der Karte/Liste nehmen), unabhängig von der
-- bestehenden Adress-/Beschreibungs-Sperre (content_locked, siehe
-- migrations/0006_content_moderation.sql) - dort bleibt der Stand
-- sichtbar, hier nicht. Der bestehende Antwort-Mechanismus
-- (lock_reply_message/lock_reply_created_at, POST .../lock-reply) wird
-- für beide Fälle gemeinsam genutzt statt dupliziert, siehe
-- app/routes/stands.py reply_to_lock.
ALTER TABLE stands ADD COLUMN deactivated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE stands ADD COLUMN deactivation_message TEXT;
