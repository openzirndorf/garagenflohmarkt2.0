-- Admin-Roster + Login-Tokens für den neuen E-Mail+Code-Login (ersetzt für
-- die alltäglichen Admin-Endpunkte den bisher geteilten Bearer-Token, siehe
-- app/routes/admins.py). Spiegelt die Token-Spalten von "stands", ohne die
-- standspezifischen Felder - dieselbe Login-Code-dann-Session-Token-
-- Mechanik wie dort (app/tokens.py ist bereits generisch gehalten).
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    login_token_hash TEXT,
    login_token_expires_at TIMESTAMPTZ,
    session_token_hash TEXT,
    session_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Für den Login-Code- bzw. Session-Token-Lookup (WHERE ...hash = $1 AND
-- ...expires_at > now()) - ohne Index würde jede Anfrage einen Sequential
-- Scan über die komplette Tabelle machen. UNIQUE + WHERE ... IS NOT NULL
-- wie bei stands (migrations/0003_stands_privacy.sql): erzwingt nebenbei,
-- dass kein aktiver Token doppelt vergeben ist, ohne NULL-Zeilen (kein
-- Token gerade aktiv) mitzuindizieren.
CREATE UNIQUE INDEX admins_login_token_hash_idx ON admins (login_token_hash)
  WHERE login_token_hash IS NOT NULL;
CREATE UNIQUE INDEX admins_session_token_hash_idx ON admins (session_token_hash)
  WHERE session_token_hash IS NOT NULL;
