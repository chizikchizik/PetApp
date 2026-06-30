-- Обновление таблицы привычек: active-флаг + корректный список Марины.
-- Запусти в Supabase → SQL Editor.

-- 1. Добавляем active-флаг для архивирования
ALTER TABLE habit ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- 2. Переименовываем "Амитриптилин" → "АД" (как в тетради)
UPDATE habit SET name = 'АД', sort = 3 WHERE name = 'Амитриптилин';

-- 3. Обновляем порядок сортировки существующих
UPDATE habit SET sort = 2  WHERE name = 'Сон до 00:00';
UPDATE habit SET sort = 4  WHERE name = 'Витамины';
UPDATE habit SET sort = 6  WHERE name = 'Вода 1500+';
UPDATE habit SET sort = 7  WHERE name = 'Дефицит ккал';
UPDATE habit SET sort = 8  WHERE name = 'Шаги 12500';
UPDATE habit SET sort = 9  WHERE name = 'Без сахара';
UPDATE habit SET sort = 11 WHERE name = 'Без алкоголя';
UPDATE habit SET sort = 12 WHERE name = 'Растяжка';

-- 4. Добавляем новые привычки из тетради
INSERT INTO habit (name, sort, active) VALUES
  ('Спорт',     1,  true),
  ('Глицин',    5,  true),
  ('Без муки',  10, true),
  ('Медитация', 13, true)
ON CONFLICT (name) DO NOTHING;

-- 5. Обновляем ссылки в daily_log (если "Амитриптилин" уже записан)
UPDATE daily_log
SET habits_done = array_replace(habits_done, 'Амитриптилин', 'АД')
WHERE 'Амитриптилин' = ANY(habits_done);
