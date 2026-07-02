-- 036: Configurable per-user balance-wheel sectors (was a hardcoded 8-sector
-- list shared by everyone in balance/actions.ts, balance-form.tsx, wheel-svg.tsx).
CREATE TABLE IF NOT EXISTS balance_sector (
  id           serial PRIMARY KEY,
  app_user_id  uuid REFERENCES app_user(id),
  label        text NOT NULL,
  description  text,
  sort         int  NOT NULL DEFAULT 0
);

-- Seed Marina's existing hardcoded 8 sectors, same order as before.
INSERT INTO balance_sector (app_user_id, label, description, sort)
SELECT u.id, v.label, v.description, v.sort
FROM app_user u
CROSS JOIN (VALUES
  ('Семья и любовь',      'Близкие отношения, партнёр, родные, тепло дома',      0),
  ('Работа и реализация', 'Смысл, признание, карьера, реализация потенциала',    1),
  ('Отдых и развлечения', 'Время для себя, хобби, развлечения, восстановление',  2),
  ('Здоровье и красота',  'Тело, питание, сон, внешность и самоощущение',        3),
  ('Дружба и общение',    'Круг общения, близкие друзья, социальная жизнь',      4),
  ('Деньги и имущество',  'Финансы, стабильность, собственность, достаток',      5),
  ('Духовность',          'Смыслы, ценности, внутренний мир, опора на себя',     6),
  ('Личностный рост',     'Развитие, знания, навыки, кто ты через год',          7)
) AS v(label, description, sort)
WHERE u.email = 'chizikchizik@gmail.com'
ON CONFLICT DO NOTHING;

-- Re-key existing assessments from the old hardcoded English keys to the
-- new sectors' real ids, so past history stays attached to the right sphere.
UPDATE balance_assessment ba
SET scores = (
  SELECT jsonb_object_agg(bs.id::text, ba.scores -> old.key)
  FROM (VALUES
    ('family',0), ('work',1), ('rest',2), ('health',3),
    ('friends',4), ('money',5), ('spirit',6), ('growth',7)
  ) AS old(key, sort)
  JOIN balance_sector bs ON bs.app_user_id = ba.app_user_id AND bs.sort = old.sort
  WHERE ba.scores ? old.key
)
WHERE ba.scores IS NOT NULL
  AND ba.scores ?| ARRAY['family','work','rest','health','friends','money','spirit','growth'];
