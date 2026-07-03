-- 040: "АД" habit and "Амитриптилин" medication were the same underlying
-- tracked item (medication.habit_key = 'АД' for the amitriptyline row) but
-- displayed under two different names — the /habits matrix showed "АД"
-- (confusing, undocumented shorthand) while check-in showed "Амитриптилин".
-- No historical daily_log.habits_done rows reference "АД" yet, so this is a
-- pure rename, no backfill needed. "Витамины" habit/medication already match
-- (both literally "Витамины") — no change needed there.
UPDATE habit
SET name = 'Амитриптилин'
WHERE name = 'АД';

UPDATE medication
SET habit_key = 'Амитриптилин'
WHERE id = 'amitriptyline' AND habit_key = 'АД';
