-- 034: Configurable per-user migraine triggers (was a hardcoded list in checkin-form.tsx)
CREATE TABLE IF NOT EXISTS migraine_trigger (
  id           serial PRIMARY KEY,
  app_user_id  uuid REFERENCES app_user(id),
  name         text NOT NULL,
  sort         int  NOT NULL DEFAULT 0
);

-- Seed Marina's existing hardcoded list
INSERT INTO migraine_trigger (app_user_id, name, sort)
SELECT u.id, v.name, v.sort
FROM app_user u
CROSS JOIN (VALUES
  ('Цикл',         0),
  ('Сон',          1),
  ('Пропуск еды',  2),
  ('Стресс',       3),
  ('Экран',        4),
  ('Погода',       5),
  ('Алкоголь',     6)
) AS v(name, sort)
WHERE u.email = 'chizikchizik@gmail.com'
ON CONFLICT DO NOTHING;
