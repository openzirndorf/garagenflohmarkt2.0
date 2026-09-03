-- Einstellungsänderungen (siehe app/routes/settings.py) sollen künftig
-- ebenfalls im Verlauf auftauchen, gehören aber zu keinem Stand - stand_id
-- war bisher NOT NULL, weil jede bisherige Aktion an genau einen Stand
-- gebunden war.
ALTER TABLE admin_audit_log ALTER COLUMN stand_id DROP NOT NULL;
