-- Baseline: Stand der Datenbank vor dem Datenschutz-Umbau (entspricht dem
-- bisherigen schema.sql). Wird nur für frische Datenbanken gebraucht --
-- bestehende Produktionsdatenbanken haben dieses Schema bereits.

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
