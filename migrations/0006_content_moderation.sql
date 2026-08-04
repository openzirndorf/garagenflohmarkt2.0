-- Erlaubt Admins, Adresse/Beschreibung eines Standes gegen weitere
-- Bearbeitung durch den Inhaber zu sperren (z.B. nach manueller Korrektur
-- unangemessener Inhalte, siehe app/moderation.py), mit einer für den
-- Inhaber sichtbaren Begründung.
ALTER TABLE stands ADD COLUMN content_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE stands ADD COLUMN content_lock_message TEXT;
