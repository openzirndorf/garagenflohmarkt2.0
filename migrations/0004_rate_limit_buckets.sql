-- DB-gestütztes Ratelimiting statt In-Memory-Dict: überlebt Neustarts und
-- mehrere parallele Container-Instanzen (wichtig, sobald der Container am
-- Veranstaltungstag über min_scale=0 hinaus skaliert).
CREATE TABLE rate_limit_buckets (
  bucket_key   TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INT NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key, window_start)
);
