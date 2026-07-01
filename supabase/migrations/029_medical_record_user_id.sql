-- Migration 029: add app_user_id + catalog fields to medical_record
ALTER TABLE medical_record
  ADD COLUMN IF NOT EXISTS app_user_id  uuid REFERENCES app_user(id),
  ADD COLUMN IF NOT EXISTS subcategory  text,
  ADD COLUMN IF NOT EXISTS doctor       text,
  ADD COLUMN IF NOT EXISTS clinic       text;

-- Backfill: assign all legacy records to the first (admin) user
DO $$
DECLARE first_user_id uuid;
BEGIN
  SELECT id INTO first_user_id FROM app_user ORDER BY created_at ASC LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE medical_record SET app_user_id = first_user_id WHERE app_user_id IS NULL;
  END IF;
END $$;
