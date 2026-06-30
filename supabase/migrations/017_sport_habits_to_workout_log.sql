-- Migration 017: backfill workout_log from habits_done = 'Спорт'
-- Inserts one entry per day where Спорт is checked in habits but no workout is logged yet.
INSERT INTO workout_log (workout_date, type)
SELECT dl.log_date, 'Спорт'
FROM daily_log dl
WHERE 'Спорт' = ANY(dl.habits_done)
  AND NOT EXISTS (
    SELECT 1 FROM workout_log wl
    WHERE wl.workout_date = dl.log_date
  )
ORDER BY dl.log_date;
