-- 047: for the admin account (chizikchizik@gmail.com), the generic
-- "Витамины" supplement is being replaced from 2026-06-01 onward by three
-- specific ones (prescribed by her gynecologist): Витамин D, Калия Йодид,
-- Фолиевая кислота. Pre-June history stays attached to the old generic
-- "Витамины" medication row untouched — only new day is on ('kind'
-- reasoning). The old row is NOT closed (ended_at stays null): once the
-- backfill below removes 'Витамины' from June+ daily_log rows, its own
-- heatmap simply goes quiet from June onward, which is exactly the
-- intended before/after split.
INSERT INTO medication (id, name, note, when_label, is_as_needed, is_supplement, kind, habit_key, sort, started_at, app_user_id)
SELECT v.id, v.name, 'гинеколог', 'утро', false, true, 'supplement', v.name, v.sort, '2026-06-01', u.id
FROM app_user u
CROSS JOIN (VALUES
  ('vitamin_d',         'Витамин D',         4),
  ('potassium_iodide',  'Калия Йодид',       5),
  ('folic_acid',        'Фолиевая кислота',  6)
) AS v(id, name, sort)
WHERE u.email = 'chizikchizik@gmail.com'
ON CONFLICT (id) DO NOTHING;

-- Backfill: everywhere the generic 'Витамины' habit was marked from
-- 2026-06-01 onward, replace it with all three specific ones — she takes
-- them together as one daily regimen, so a single "Витамины" tick from
-- that period means all three were taken.
UPDATE daily_log
SET habits_done = array_cat(
  array_remove(habits_done, 'Витамины'),
  ARRAY['Витамин D', 'Калия Йодид', 'Фолиевая кислота']
)
WHERE app_user_id = (SELECT id FROM app_user WHERE email = 'chizikchizik@gmail.com')
  AND log_date >= '2026-06-01'
  AND habits_done @> ARRAY['Витамины'];
