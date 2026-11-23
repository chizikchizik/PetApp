-- 062: миграция 010 создала на balance_assessment политику «service role all»
-- с using (true) / with check (true) без TO-роли — она действует для PUBLIC,
-- то есть и для anon-ключа: таблица читалась и изменялась по публичному ключу
-- даже после включения RLS (061). Приложению политика не нужна: service_role
-- обходит RLS. Без политик RLS закрывает доступ всем, кроме service_role.
DROP POLICY IF EXISTS "service role all" ON balance_assessment;
