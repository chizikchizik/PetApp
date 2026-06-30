-- Добавляем habit_key — ключ по которому препарат фиксируется в habits_done
ALTER TABLE medication ADD COLUMN IF NOT EXISTS habit_key text;

-- Привязываем существующие препараты к их habit-ключам (совпадают с тем что было в HABIT_MEDS)
UPDATE medication SET habit_key = 'АД'       WHERE id = 'amitriptyline';
UPDATE medication SET habit_key = 'Витамины' WHERE id = 'vitamins';

-- Добавляем Глицин (был захардкожен во фронте, теперь в БД)
INSERT INTO medication (id, name, when_label, sort, habit_key)
  VALUES ('glycine', 'Глицин', null, 3, 'Глицин')
ON CONFLICT (id) DO NOTHING;
