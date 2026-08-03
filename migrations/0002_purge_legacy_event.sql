-- Löscht Anmeldedaten des vorherigen Events (April 2026). Es gab nie einen
-- Löschjob, diese personenbezogenen Daten (Name, E-Mail, Adresse) haben ihre
-- eigene Aufbewahrungsfrist bereits überschritten. Volle Tabelle statt
-- Datums-Filter, da die Datenbank ausschließlich für Einzel-Events existiert
-- und zwischen Events ohnehin komplett geleert werden soll.
DELETE FROM stands;
