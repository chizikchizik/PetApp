-- 039: migration 028 inserted MigreBot-derived as-needed medications
-- (Нурофен, Назальный спрей, Спазмалгон, Пенталгин, Триптаджик, Делмигрен,
-- Капориза, Релпакс, Аскофен) without app_user_id — getMeds() filters by
-- app_user_id = uid for real users, so these 9 rows were invisible in the
-- actual check-in "Приём препаратов" list even though med-calendar.tsx's
-- regex detection already recognized them in historical MigreBot notes.
-- Same backfill pattern as migration 021_user_isolation.sql.
DO $$
DECLARE first_user_id uuid;
BEGIN
  SELECT id INTO first_user_id FROM app_user ORDER BY created_at ASC LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE medication SET app_user_id = first_user_id WHERE app_user_id IS NULL;
  END IF;
END $$;
