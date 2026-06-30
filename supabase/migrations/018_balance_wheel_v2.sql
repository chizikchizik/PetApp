-- Колесо баланса v2: переходим на JSONB вместо отдельных колонок
-- Одна колонка scores хранит все сферы — не зависит от их количества
ALTER TABLE balance_assessment ADD COLUMN IF NOT EXISTS scores jsonb;

-- Переносим старые оценки в scores (для сохранения истории если есть)
UPDATE balance_assessment
SET scores = jsonb_build_object(
  'rest',         COALESCE(rest, 5),
  'intellectual', COALESCE(intellectual, 5),
  'nutrition',    COALESCE(nutrition, 5),
  'fitness',      COALESCE(fitness, 5),
  'social',       COALESCE(social, 5),
  'sleep',        COALESCE(sleep, 5)
)
WHERE scores IS NULL;
