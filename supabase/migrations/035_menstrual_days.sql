-- Migration 035: store user-configurable menstrual phase length.
-- Used by phaseForDay()/getCurrentCycle() instead of the hardcoded
-- MENSTRUAL_DAYS=5 constant in lib/cycle.ts.
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS menstrual_days int;
