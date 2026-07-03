-- 043: migration 040 renamed the "АД" habit row and medication.habit_key
-- to "Амитриптилин", but my check for existing daily_log.habits_done
-- entries referencing "АД" used a query that silently capped at Supabase's
-- default 1000-row limit and never actually reached her real (2026) data —
-- it reported 0 matches when there were actually 144 rows (2026-02-08
-- through the present), every single one of them. Since the rename, the
-- /habits matrix showed "Амитриптилин" with zero history because nothing
-- in habits_done matched the new key anymore. Backfill: replace "АД" with
-- "Амитриптилин" everywhere it appears in habits_done, for her account.
UPDATE daily_log
SET habits_done = array_replace(habits_done, 'АД', 'Амитриптилин')
WHERE app_user_id = (SELECT id FROM app_user WHERE email = 'chizikchizik@gmail.com')
  AND habits_done @> ARRAY['АД'];
