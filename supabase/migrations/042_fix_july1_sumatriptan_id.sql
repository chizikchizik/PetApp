-- 042: one-off data fix, confirmed by the user. daily_log for 2026-07-01
-- had meds_taken referencing 'custom_1782887402819', a medication id that
-- no longer exists (she deleted and re-added Суматриптан at some point,
-- generating a new id 'custom_1782905573938'). User confirmed the July 1
-- entry was indeed Суматриптан — swap the stale id for the current one so
-- that day counts correctly toward the triptan/МИГБ threshold.
UPDATE daily_log
SET meds_taken = array_replace(meds_taken, 'custom_1782887402819', 'custom_1782905573938')
WHERE log_date = '2026-07-01'
  AND app_user_id = (SELECT id FROM app_user WHERE email = 'chizikchizik@gmail.com');
