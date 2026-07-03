-- 044: "Магний" existed only as a plain `habit` row (id 22), tracked like
-- any generic habit, invisible in the Препараты matrix/check-in medication
-- section and not distinguished from "Витамины" (which IS a medication row,
-- note='гинеколог'). Bring it into the medication system as its own entry
-- so it shows up alongside Витамины, clearly separate (distinct name/note),
-- same as any other supplement.
--
-- habit_key matches the EXISTING habit name exactly ("Магний", no rename) —
-- daily_log.habits_done already has 50 historical rows using this string,
-- so history links up immediately with no backfill needed (unlike the
-- АД→Амитриптилин rename in migration 040, which required migration 043
-- specifically because the string itself changed).
INSERT INTO medication (id, app_user_id, name, note, when_label, is_as_needed, habit_key, sort)
SELECT 'magnesium', u.id, 'Магний', null, null, false, 'Магний', 3
FROM app_user u
WHERE u.email = 'chizikchizik@gmail.com'
ON CONFLICT (id) DO NOTHING;
