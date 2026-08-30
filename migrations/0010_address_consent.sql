-- Zeitstempel der Einwilligung zur öffentlichen Anzeige der Adresse
-- (Art. 6 Abs. 1 lit. a DSGVO statt berechtigtem Interesse) - die
-- Nachweispflicht für eine Einwilligung liegt beim Verantwortlichen
-- (Art. 7 Abs. 1 DSGVO), daher hier serverseitig gespeichert statt nur
-- clientseitig als Checkbox abgefragt und danach verworfen.
-- DEFAULT now() greift nur rückwirkend für Zeilen vor dieser Migration;
-- app/routes/stands.py setzt den echten Zeitpunkt explizit bei jeder
-- neuen Anmeldung.
ALTER TABLE stands ADD COLUMN address_consent_at TIMESTAMPTZ NOT NULL DEFAULT now();
