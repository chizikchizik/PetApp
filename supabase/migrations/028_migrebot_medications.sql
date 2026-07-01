-- Migration 028: add all migraine-relief medications found in MigreBot history
-- суматриптан already exists; add everything else with is_as_needed = true

INSERT INTO medication (id, name, note, when_label, sort, habit_key, is_as_needed) VALUES
  ('nurofen',     'Нурофен',          'купирование мигрени', NULL, 10, 'Нурофен',     true),
  ('nasal_spray', 'Назальный спрей',  'купирование мигрени', NULL, 11, 'Спрей',       true),
  ('spazmalgon',  'Спазмалгон',       'купирование мигрени', NULL, 12, 'Спазмалгон',  true),
  ('pentalgin',   'Пенталгин',        'купирование мигрени', NULL, 13, 'Пенталгин',   true),
  ('triptadjik',  'Триптаджик',       'купирование мигрени', NULL, 14, 'Триптаджик',  true),
  ('delmigren',   'Делмигрен',        'купирование мигрени', NULL, 15, 'Делмигрен',   true),
  ('kaporiza',    'Капориза',         'купирование мигрени', NULL, 16, 'Капориза',    true),
  ('relpax',      'Релпакс',          'купирование мигрени', NULL, 17, 'Релпакс',     true),
  ('ascofene',    'Аскофен',          'купирование мигрени', NULL, 18, 'Аскофен',     true)
ON CONFLICT (id) DO UPDATE SET
  note       = EXCLUDED.note,
  is_as_needed = true;
