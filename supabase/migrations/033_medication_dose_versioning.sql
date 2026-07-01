-- Migration 033: track dose changes as new versions instead of editing in place.
-- Existing rows are treated as "started at some point in the past, still active".
ALTER TABLE medication ADD COLUMN IF NOT EXISTS started_at date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE medication ADD COLUMN IF NOT EXISTS ended_at   date;

CREATE INDEX IF NOT EXISTS medication_active_idx ON medication (app_user_id, ended_at);
