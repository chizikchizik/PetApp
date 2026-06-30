-- Заменяем поле "ощущение 1-5" на процент усталости после тренировки.
-- Run in Supabase → SQL Editor.

ALTER TABLE workout_log
  ADD COLUMN IF NOT EXISTS fatigue_pct int CHECK (fatigue_pct BETWEEN 0 AND 100);
