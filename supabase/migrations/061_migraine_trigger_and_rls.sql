-- 061: таблица триггеров мигрени (миграция 034 в проде не применялась —
-- список триггеров в шторке приступа был пустым) + RLS на всех таблицах.
--
-- Приложение работает только через service_role, который обходит RLS, поэтому
-- включение RLS без политик ничего в приложении не меняет, но закрывает чтение
-- по публичному anon-ключу (на 2026-11-23 по нему читалась balance_assessment).
-- Все команды идемпотентны: повторный запуск безопасен.

CREATE TABLE IF NOT EXISTS migraine_trigger (
  id           serial PRIMARY KEY,
  app_user_id  uuid REFERENCES app_user(id),
  name         text NOT NULL,
  sort         int  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS migraine_trigger_user_idx ON migraine_trigger (app_user_id, sort);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_user','daily_log','medication','medication_intake','migraine_event','migraine_trigger',
    'cycle_start','weight_entry','workout_log','workout_exercise','workout_template',
    'weekly_schedule','calendar_event','sport_type','habit','balance_assessment','balance_sector',
    'medical_record','import_log','sleep_log','daily_pressure','bp_reading'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
