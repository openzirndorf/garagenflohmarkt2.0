-- Speichert die Antwort eines gesperrten Standinhabers an den Admin
-- (siehe POST /stands/by-session/{token}/lock-reply) zusätzlich zur
-- Mail-Benachrichtigung, damit der Admin sie auch im Admin-Panel sieht.
-- Wird beim Entsperren automatisch wieder gelöscht (siehe
-- update_stand_admin in app/routes/stands.py).
ALTER TABLE stands ADD COLUMN lock_reply_message TEXT;
ALTER TABLE stands ADD COLUMN lock_reply_created_at TIMESTAMPTZ;
