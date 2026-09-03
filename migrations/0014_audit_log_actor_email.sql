-- Ergänzt admin_audit_log um die E-Mail-Adresse des Admins, der eine
-- Aktion ausgelöst hat (siehe app/audit.py) - bisher stand dort nur der
-- grobe Auslöser "admin", nicht welcher der (wenigen, im Roster
-- eingetragenen) Admins konkret bearbeitet/gelöscht/deaktiviert hat.
-- Bewusst NULL für owner/besucher-Aktionen: das betrifft die
-- datenschutzrechtlich sensiblere Standbetreiber-/Besucher-E-Mail, die wie
-- bisher nicht ins Audit-Log soll (siehe test_audit_log_endpoint_never_
-- contains_stand_owner_email) - nur die Admin-eigene, ohnehin fürs Login
-- bekannte Adresse wird jetzt zusätzlich mitgeloggt.
ALTER TABLE admin_audit_log ADD COLUMN actor_email TEXT;
