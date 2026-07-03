-- 049: "Спрей" in MigreBot diary notes was a generic placeholder label with
-- no real medication row behind it — detectMedIds() only links a legacy
-- note to the combined "по факту мигрени" heatmap if a real medication
-- row's name also matches the pattern, so these days never showed up
-- there (only in the raw diary list, via detectLabels()). Renamed to the
-- actual brand name, Эксенза, and giving it a real medication row so its
-- history now counts on the heatmap like Суматриптан/Нурофен already do.
INSERT INTO medication (id, name, is_as_needed, kind, habit_key, sort, app_user_id)
SELECT 'exenza', 'Эксенза', true, 'as_needed', 'Эксенза', 11, u.id
FROM app_user u
WHERE u.email = 'chizikchizik@gmail.com'
ON CONFLICT (id) DO NOTHING;
