-- 050: same gap as migration 049 (Эксенза) — "Делмигрен" already had a
-- detection pattern (MED_PATTERNS/DISPLAY_PATTERNS in med-calendar.tsx)
-- but no real medication row behind it, so detectMedIds() never linked
-- those MigreBot diary days to the combined "по факту мигрени" heatmap.
INSERT INTO medication (id, name, is_as_needed, kind, habit_key, sort, app_user_id)
SELECT 'delmigren', 'Делмигрен', true, 'as_needed', 'Делмигрен', 12, u.id
FROM app_user u
WHERE u.email = 'chizikchizik@gmail.com'
ON CONFLICT (id) DO NOTHING;
