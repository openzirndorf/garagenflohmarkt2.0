-- Protokolliert Lebenszyklus-Aktionen (nie personenbezogene Daten - nur
-- Aktion, Stand-ID, wer sie ausgelöst hat und wann) für Nachvollziehbarkeit
-- im Admin-Panel. Bewusst ohne Fremdschlüssel auf stands: die Zeile soll
-- auch nach dem Löschen des Standes (z.B. durch DELETE) bestehen bleiben,
-- ohne ON-DELETE-Kaskaden-Sonderfälle. Es gibt keinen automatisierten
-- Löschjob mehr, der diese Tabelle leert (siehe datenschutz.tsx
-- Abschnitt 6) - Standbetreiber löschen ihre Daten selbst, verbleibende
-- Einträge löschen wir nach der Veranstaltung bei Bedarf manuell.
--
-- stand_id ist seit migrations/0016_audit_log_settings_actions.sql
-- nullable (globale Einstellungsänderungen, siehe unten, gehören zu
-- keinem Stand) - hier nur als Hinweis für Leser dieser Datei, die
-- eigentliche ALTER COLUMN steht bewusst in der neuen Migration, nicht
-- rückwirkend hier. Seit migrations/0017_audit_log_report_detail.sql
-- zusätzlich ein optionales "detail"-Freitextfeld, bisher nur für den
-- (auf 80 Zeichen begrenzten) Grund einer Besucher-Meldung (REPORTED)
-- genutzt.
CREATE TABLE admin_audit_log (
  id         BIGSERIAL PRIMARY KEY,
  stand_id   INT NOT NULL,
  action     TEXT NOT NULL,  -- CREATED | APPROVED | EDITED | DELETED | REPLIED | REPORTED | DEACTIVATED | REACTIVATED | SETTINGS_MANUAL_APPROVAL_ON | SETTINGS_MANUAL_APPROVAL_OFF | SETTINGS_BESCHREIBUNG_ON | SETTINGS_BESCHREIBUNG_OFF
  actor      TEXT NOT NULL,  -- owner | admin | besucher
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
