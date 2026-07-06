-- 059: blood pressure tracking (артериальное давление) — manual
-- morning/evening readings, the standard home-monitoring pattern
-- (requested for a pregnant user; ties into the preeclampsia red flag
-- from Elena's pregnancy review). One row per user/date/slot — a
-- re-entry for the same slot overwrites (upsert), matching how a home
-- BP diary works.
CREATE TABLE IF NOT EXISTS bp_reading (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id  uuid REFERENCES app_user(id),
  reading_date date NOT NULL,
  slot         text NOT NULL CHECK (slot IN ('morning', 'evening')),
  systolic     int  NOT NULL,
  diastolic    int  NOT NULL,
  pulse        int,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bp_reading_user_date_slot_idx
  ON bp_reading (app_user_id, reading_date, slot);
