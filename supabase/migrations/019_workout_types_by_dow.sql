-- Помечаем тренировки 2026 года по дню недели:
-- Вторник (DOW=2) и Четверг (DOW=4) → Волейбол
-- Суббота (DOW=6) → Зал

UPDATE workout_log
SET type = 'Волейбол'
WHERE EXTRACT(YEAR FROM workout_date) = 2026
  AND EXTRACT(DOW  FROM workout_date) IN (2, 4);

UPDATE workout_log
SET type = 'Зал'
WHERE EXTRACT(YEAR FROM workout_date) = 2026
  AND EXTRACT(DOW  FROM workout_date) = 6;
