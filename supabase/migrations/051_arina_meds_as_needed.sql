-- 051: Арина added Эксенза and Суматриптан herself via the "+ Добавить"
-- form on /checkin but left them as regular (daily) meds instead of
-- as-needed/abortive — both are actually migraine relief medications,
-- per her own request to correct this.
UPDATE medication
SET is_as_needed = true, kind = 'as_needed'
WHERE app_user_id = (SELECT id FROM app_user WHERE email = 'arina.toldinova@mail.ru')
  AND id IN ('custom_1782994631298', 'custom_1782994615541');
