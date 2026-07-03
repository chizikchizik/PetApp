-- 046: Iteration 1 of the medication model rework (Timofey/Natasha/Ilya
-- reviewed). Purely additive — does not touch is_as_needed, is_supplement,
-- meds_taken, or habits_done, so nothing existing (dashboard, МИГБ counter,
-- habits matrix) can break from this migration alone.
--
-- 1. medication.kind: a computed, backward-compatible label ('regular' /
--    'as_needed' / 'supplement') derived from the existing boolean flags.
--    Not authoritative yet — is_as_needed/is_supplement remain the source
--    of truth until a later iteration's read-cutover (per Ilya's audit).
--    Used for now only to reorder the meds list in the UI.
ALTER TABLE medication ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'regular';

UPDATE medication
SET kind = CASE
  WHEN is_supplement THEN 'supplement'
  WHEN is_as_needed  THEN 'as_needed'
  ELSE 'regular'
END;

-- 2. medication_intake: single source of truth for NEW "quick log" entries —
-- one-off, occasional-pain logging (e.g. stomach ache, took ibuprofen) that
-- should be visible in history but must never feed the МИГБ risk counter or
-- adherence stats unless purpose='migraine_relief'. Existing meds_taken/
-- habits_done paths are untouched; this table is not read by any stat
-- function yet — it only backs the new quick-log UI in this iteration.
CREATE TABLE IF NOT EXISTS medication_intake (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id   uuid REFERENCES app_user(id),
  medication_id text REFERENCES medication(id),
  log_date      date NOT NULL,
  purpose       text NOT NULL CHECK (purpose IN ('migraine_relief', 'pain_other', 'other')),
  pain_location text,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS medication_intake_user_date_idx
  ON medication_intake (app_user_id, log_date);
