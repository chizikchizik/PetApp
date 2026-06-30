-- 021: User isolation — scope all data to app_user_id
-- After this migration: each row belongs to a specific user (not global).
-- Run AFTER registering the first user (Marina) via /register, so legacy data
-- gets assigned to her UUID. Then log out and log back in with email/password.

-- 1. Add app_user_id to tables that predate migration 008
ALTER TABLE habit              ADD COLUMN IF NOT EXISTS app_user_id uuid REFERENCES app_user(id);
ALTER TABLE medication         ADD COLUMN IF NOT EXISTS app_user_id uuid REFERENCES app_user(id);
ALTER TABLE balance_assessment ADD COLUMN IF NOT EXISTS app_user_id uuid REFERENCES app_user(id);

-- 2. Migrate all legacy (NULL) rows to the first registered user
DO $$
DECLARE first_user_id uuid;
BEGIN
  SELECT id INTO first_user_id FROM app_user ORDER BY created_at LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE daily_log           SET app_user_id = first_user_id WHERE app_user_id IS NULL;
    UPDATE cycle_start         SET app_user_id = first_user_id WHERE app_user_id IS NULL;
    UPDATE weight_entry        SET app_user_id = first_user_id WHERE app_user_id IS NULL;
    UPDATE migraine_event      SET app_user_id = first_user_id WHERE app_user_id IS NULL;
    UPDATE workout_log         SET app_user_id = first_user_id WHERE app_user_id IS NULL;
    UPDATE habit               SET app_user_id = first_user_id WHERE app_user_id IS NULL;
    UPDATE medication          SET app_user_id = first_user_id WHERE app_user_id IS NULL;
    UPDATE balance_assessment  SET app_user_id = first_user_id WHERE app_user_id IS NULL;
  END IF;
END $$;

-- 3. Fix unique constraints for multi-user

-- daily_log: was UNIQUE(log_date), now UNIQUE(app_user_id, log_date)
ALTER TABLE daily_log DROP CONSTRAINT IF EXISTS daily_log_log_date_key;
ALTER TABLE daily_log ADD CONSTRAINT daily_log_user_date_key UNIQUE (app_user_id, log_date);

-- cycle_start: was UNIQUE(start_date), now UNIQUE(app_user_id, start_date)
ALTER TABLE cycle_start DROP CONSTRAINT IF EXISTS cycle_start_start_date_key;
ALTER TABLE cycle_start ADD CONSTRAINT cycle_start_user_date_key UNIQUE (app_user_id, start_date);

-- weight_entry: entry_date was PRIMARY KEY — replace with uuid id + composite unique
ALTER TABLE weight_entry ADD COLUMN IF NOT EXISTS id uuid;
UPDATE weight_entry SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE weight_entry ALTER COLUMN id SET NOT NULL;
ALTER TABLE weight_entry ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE weight_entry DROP CONSTRAINT weight_entry_pkey;
ALTER TABLE weight_entry ADD PRIMARY KEY (id);
ALTER TABLE weight_entry ADD CONSTRAINT weight_entry_user_date_key UNIQUE (app_user_id, entry_date);
