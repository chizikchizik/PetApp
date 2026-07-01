-- Migration 032: store user-reported average cycle length from onboarding.
-- Used as the fallback for getCurrentCycle() before enough real cycle_start
-- history exists to compute a real average (previously hardcoded to 28).
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS avg_cycle_length int;
