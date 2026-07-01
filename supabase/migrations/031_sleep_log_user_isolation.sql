-- Migration 031: sleep_log had no app_user_id — every user could see the same
-- (Marina's) RingConn sleep history. Add the column and backfill existing rows.
ALTER TABLE sleep_log ADD COLUMN IF NOT EXISTS app_user_id uuid REFERENCES app_user(id);

DO $$
DECLARE first_user_id uuid;
BEGIN
  SELECT id INTO first_user_id FROM app_user ORDER BY created_at ASC LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE sleep_log SET app_user_id = first_user_id WHERE app_user_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sleep_log_user_date_idx ON sleep_log (app_user_id, log_date);
