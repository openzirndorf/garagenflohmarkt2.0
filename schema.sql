CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS stands (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  adresse       TEXT NOT NULL,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  beschreibung  TEXT,
  email         TEXT NOT NULL,
  kategorien    TEXT[] NOT NULL DEFAULT '{}',
  uhrzeit       TEXT,
  status        TEXT NOT NULL DEFAULT 'PENDING',
  edit_token    UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stands_status_idx ON stands(status);

-- Migration für bestehende Datenbanken (einmalig ausführen):
-- ALTER TABLE stands ALTER COLUMN email SET NOT NULL;
-- ALTER TABLE stands ADD COLUMN IF NOT EXISTS kategorien TEXT[] NOT NULL DEFAULT '{}';
-- ALTER TABLE stands ADD COLUMN IF NOT EXISTS uhrzeit TEXT;
