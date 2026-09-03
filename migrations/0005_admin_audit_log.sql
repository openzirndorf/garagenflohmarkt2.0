-- Protokolliert Lebenszyklus-Aktionen (nie personenbezogene Daten - nur
-- Aktion, Stand-ID, wer sie ausgelöst hat und wann) für Nachvollziehbarkeit
-- im Admin-Panel. Bewusst ohne Fremdschlüssel auf stands: die Zeile soll
-- auch nach dem Löschen des Standes (z.B. durch DELETE) bestehen bleiben,
-- ohne ON-DELETE-Kaskaden-Sonderfälle. Wird zusammen mit den Stand-Daten
-- am 07.10.2026 von scripts/deletion_job.py geleert.
--
-- stand_id ist seit migrations/0016_audit_log_settings_actions.sql
-- nullable (globale Einstellungsänderungen, siehe unten, gehören zu
-- keinem Stand) - hier nur als Hinweis für Leser dieser Datei, die
-- eigentliche ALTER COLUMN steht bewusst in der neuen Migration, nicht
-- rückwirkend hier.
CREATE TABLE admin_audit_log (
  id         BIGSERIAL PRIMARY KEY,
  stand_id   INT NOT NULL,
  action     TEXT NOT NULL,  -- CREATED | APPROVED | EDITED | DELETED | REPLIED | REPORTED | DEACTIVATED | REACTIVATED | SETTINGS_MANUAL_APPROVAL_ON | SETTINGS_MANUAL_APPROVAL_OFF | SETTINGS_BESCHREIBUNG_ON | SETTINGS_BESCHREIBUNG_OFF
  actor      TEXT NOT NULL,  -- owner | admin | besucher
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
