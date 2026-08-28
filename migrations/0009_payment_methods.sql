-- Erlaubt Standbetreibern anzugeben, ob sie Zahlung per PayPal und/oder
-- Wero anbieten (app/routes/stands.py validiert gegen eine feste
-- Werteliste, siehe _VALID_ZAHLUNGSARTEN) - öffentlich sichtbar und
-- filterbar wie kategorien.
ALTER TABLE stands ADD COLUMN zahlungsarten TEXT[] NOT NULL DEFAULT '{}';
