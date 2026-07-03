-- 052: same gap as 049/050 — these MigreBot diary labels already had
-- detection patterns in med-calendar.tsx but no real medication row, so
-- their history never counted on the combined "по факту мигрени" heatmap,
-- only appearing in the raw diary list. Found by cross-checking every
-- DISPLAY_PATTERNS label against the migraine_event.meds text and the
-- user's real medication rows.
INSERT INTO medication (id, name, is_as_needed, kind, habit_key, sort, app_user_id)
SELECT v.id, v.name, true, 'as_needed', v.name, v.sort, u.id
FROM app_user u
CROSS JOIN (VALUES
  ('spazmalgon', 'Спазмалгон',  13),
  ('pentalgin',  'Пенталгин',   14),
  ('triptadzhik','Триптаджик',  15),
  ('kaporiza',   'Капориза',    16),
  ('relpaks',    'Релпакс',     17),
  ('askofen',    'Аскофен',     18)
) AS v(id, name, sort)
WHERE u.email = 'chizikchizik@gmail.com'
ON CONFLICT (id) DO NOTHING;
