-- 024: Add app_user_id to workout_template and weekly_schedule
ALTER TABLE workout_template  ADD COLUMN IF NOT EXISTS app_user_id uuid REFERENCES app_user(id);
ALTER TABLE weekly_schedule   ADD COLUMN IF NOT EXISTS app_user_id uuid REFERENCES app_user(id);

-- Assign Marina's existing rows to her account
DO $$
DECLARE first_user_id uuid;
BEGIN
  SELECT id INTO first_user_id FROM app_user ORDER BY created_at LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE workout_template SET app_user_id = first_user_id WHERE app_user_id IS NULL;
    UPDATE weekly_schedule  SET app_user_id = first_user_id WHERE app_user_id IS NULL;
  END IF;
END $$;
