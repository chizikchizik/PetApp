-- 057: "Давление и мигрень" — visual comparison of atmospheric pressure vs
-- migraine days on /insights (approved mockup: chart-first, a verdict block
-- appears ONLY when the auto-search actually finds a pattern; Elena's
-- thresholds — ≥8 attacks, ≥60 days span — gate the verdict, not the chart).
--
-- City is asked once (text input, geocoded via Open-Meteo); pressure is
-- daily mean sea-level pressure (hPa) from the Open-Meteo archive API,
-- lazily cached per user per day. Cache is per-user rather than per-city on
-- purpose: user isolation is the project's standing priority, and a shared
-- location-keyed cache would be a cross-user surface for no real win at
-- this scale (5 users).
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS pressure_city text;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS pressure_lat double precision;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS pressure_lon double precision;

CREATE TABLE IF NOT EXISTS daily_pressure (
  app_user_id   uuid REFERENCES app_user(id),
  pressure_date date NOT NULL,
  pressure_hpa  real NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Needed both as the upsert conflict target and as the lookup index.
-- (NULL app_user_id rows — the legacy pre-multiuser path — are not
-- deduplicated by this index; every real user has a uuid, so acceptable.)
CREATE UNIQUE INDEX IF NOT EXISTS daily_pressure_user_date_idx
  ON daily_pressure (app_user_id, pressure_date);
