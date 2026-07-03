-- 048: clear "Витамины" from May 2026 for the admin account — these 29
-- entries were flagged as suspicious (all daily_log rows for May carried
-- one of just two updated_at timestamps, both in late June/early July,
-- meaning they were written in a retroactive bulk pass rather than day by
-- day in May itself). User confirmed she doesn't believe she actually took
-- vitamins on most of those days and asked for the May data to be cleared.
UPDATE daily_log
SET habits_done = array_remove(habits_done, 'Витамины'),
    updated_at = now()
WHERE app_user_id = (SELECT id FROM app_user WHERE email = 'chizikchizik@gmail.com')
  AND log_date >= '2026-05-01' AND log_date <= '2026-05-31'
  AND habits_done @> ARRAY['Витамины'];
