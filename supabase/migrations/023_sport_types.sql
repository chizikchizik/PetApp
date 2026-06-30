-- 023: Per-user sport types
CREATE TABLE IF NOT EXISTS sport_type (
  id           serial PRIMARY KEY,
  app_user_id  uuid REFERENCES app_user(id),
  name         text NOT NULL,
  sort         int  NOT NULL DEFAULT 0
);

-- Seed Marina's existing sport types
INSERT INTO sport_type (app_user_id, name, sort)
SELECT u.id, v.name, v.sort
FROM app_user u
CROSS JOIN (VALUES
  ('Силовая',       0),
  ('Функциональная',1),
  ('Бег',           2),
  ('Волейбол',      3),
  ('Скайдайв',      4),
  ('Сноуборд',      5),
  ('Скалодром',     6),
  ('Групповая',     7)
) AS v(name, sort)
WHERE u.email = 'chizikchizik@gmail.com'
ON CONFLICT DO NOTHING;
