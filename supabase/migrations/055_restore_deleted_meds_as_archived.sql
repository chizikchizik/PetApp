-- 055: the user hard-deleted 9 as-needed medications via the UI (before
-- migration 054 made "delete" a soft archive) specifically because she
-- didn't want them offered for logging anymore — not to erase their
-- history. Restoring them with archived_at already set: invisible to
-- getMeds() (won't be offered again), but visible via getAllMeds() on
-- the heatmap/report, matching what she actually wanted.
INSERT INTO medication (id, name, is_as_needed, kind, habit_key, sort, app_user_id, archived_at)
SELECT v.id, v.name, true, 'as_needed', v.name, v.sort, u.id, now()
FROM app_user u
CROSS JOIN (VALUES
  ('nurofen',      'Нурофен',      10),
  ('exenza',       'Эксенза',      11),
  ('delmigren',    'Делмигрен',    12),
  ('spazmalgon',   'Спазмалгон',   13),
  ('pentalgin',    'Пенталгин',    14),
  ('triptadzhik',  'Триптаджик',   15),
  ('kaporiza',     'Капориза',     16),
  ('relpaks',      'Релпакс',      17),
  ('askofen',       'Аскофен',      18)
) AS v(id, name, sort)
WHERE u.email = 'chizikchizik@gmail.com'
ON CONFLICT (id) DO NOTHING;
