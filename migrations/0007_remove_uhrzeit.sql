-- Uhrzeit-Feld pro Stand entfernt - das Event hat eine feste, fürs ganze
-- Gebiet geltende Uhrzeit (siehe Banner auf der Startseite), ein
-- zusätzliches Freitextfeld pro Stand hat mehr verwirrt als geholfen.
ALTER TABLE stands DROP COLUMN uhrzeit;
