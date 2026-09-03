-- Zwei globale, im Admin-Panel umschaltbare Verhaltens-Schalter (siehe
-- app/routes/settings.py). Singleton-Tabelle statt einer generischen
-- Key-Value-Tabelle - für zwei Booleans reicht das, ohne
-- String-Kodierung/-Dekodierung. "id BOOLEAN PRIMARY KEY DEFAULT true
-- CHECK (id)" erzwingt genau eine Zeile: id muss true sein (CHECK) und
-- ist PRIMARY KEY (also eindeutig), eine zweite Zeile mit id=true wäre
-- ein Constraint-Verstoß, id=false scheitert am CHECK.
CREATE TABLE app_settings (
    id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
    -- Wenn true: POST /stands/redeem-code schaltet einen frisch per
    -- E-Mail-Code bestätigten Stand nicht mehr automatisch frei, er
    -- bleibt PENDING bis ein Admin ihn manuell freigibt. Wirkt nur auf
    -- künftige Logins, ändert nichts an bereits freigeschalteten Ständen.
    require_manual_approval BOOLEAN NOT NULL DEFAULT false,
    -- Wenn false: das Anmeldeformular blendet das Freitextfeld "Was gibt
    -- es zu kaufen?" aus, POST /stands/ speichert keine Beschreibung.
    beschreibung_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (id) VALUES (true);
