-- Protokolliert Lebenszyklus-Aktionen (nie personenbezogene Daten - nur
-- Aktion, Stand-ID, wer sie ausgelöst hat und wann) für Nachvollziehbarkeit
-- im Admin-Panel. Bewusst ohne Fremdschlüssel auf stands: die Zeile soll
-- auch nach dem Löschen des Standes (z.B. durch DELETE) bestehen bleiben,
-- ohne ON-DELETE-Kaskaden-Sonderfälle. Wird zusammen mit den Stand-Daten
-- am 07.10.2026 von scripts/deletion_job.py geleert.
CREATE TABLE admin_audit_log (
  id         BIGSERIAL PRIMARY KEY,
  stand_id   INT NOT NULL,
  action     TEXT NOT NULL,  -- CREATED | APPROVED | EDITED | DELETED
  actor      TEXT NOT NULL,  -- owner | admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
