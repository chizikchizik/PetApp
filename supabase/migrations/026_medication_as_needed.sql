-- 026: Add is_as_needed flag to medication
-- Regular meds (daily schedule) vs as-needed meds (taken when symptoms occur)

ALTER TABLE medication ADD COLUMN IF NOT EXISTS is_as_needed boolean NOT NULL DEFAULT false;

-- Суматриптан — триптан, принимается при мигрени
UPDATE medication
SET is_as_needed = true
WHERE name ILIKE '%суматриптан%'
   OR name ILIKE '%triptan%'
   OR name ILIKE '%rizatriptan%'
   OR name ILIKE '%zolmitriptan%';
