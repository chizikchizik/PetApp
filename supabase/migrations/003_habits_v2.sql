-- Sync habits with paper monthly trackers (Jan–Jun 2026).
-- Run in Supabase → SQL Editor.

-- 1. Archive habits not found in any monthly photo
UPDATE habit
SET active = false
WHERE name IN (
  'Без муки',      -- не в бумагах
  'Медитация',     -- не в бумагах
  'Вода 1500+',    -- не в месячных фото
  'Без алкоголя',  -- не в месячных фото
  'Растяжка',      -- не в месячных фото
  'Без сахара',    -- не в месячных фото
  'Шаги 12500'     -- заменяем ниже на «Шаги»
);

-- 2. Обновляем сортировку активных привычек
UPDATE habit SET sort = 1 WHERE name = 'Спорт';
UPDATE habit SET sort = 2 WHERE name = 'АД';
UPDATE habit SET sort = 3 WHERE name = 'Глицин';
UPDATE habit SET sort = 4 WHERE name = 'Витамины';
UPDATE habit SET sort = 5 WHERE name = 'Сон до 00:00';
UPDATE habit SET sort = 6 WHERE name = 'Дефицит ккал';

-- 3. Добавляем привычки из бумаг которых не было в БД
INSERT INTO habit (name, sort, active) VALUES
  ('Бег',                  7,  true),   -- Май–Июнь
  ('Читать',               8,  true),   -- Апр–Июн
  ('Прогулка',             9,  true),   -- Фев–Апр
  ('Без соцсетей',         10, true),   -- Апрель
  ('Магний',               11, false),  -- только Март → архив
  ('Шаги',                 12, false),  -- Янв–Фев → архив
  ('Таблетки от мигрени',  13, false)   -- только Февраль → архив
ON CONFLICT (name) DO NOTHING;
