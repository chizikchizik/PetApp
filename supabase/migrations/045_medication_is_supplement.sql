-- 045: quick, targeted fix — Магний and Витамины should visually group as
-- "витамины/добавки", not get lumped under the same "по назначению" label
-- as prescribed regular medication (Амитриптилин). Timofey's fuller
-- kind/purpose redesign (see product research) will likely replace this
-- with a proper `kind` enum later — this is a minimal stand-in so the
-- immediate complaint is fixed now without waiting on the bigger rework.
ALTER TABLE medication ADD COLUMN IF NOT EXISTS is_supplement boolean NOT NULL DEFAULT false;

UPDATE medication SET is_supplement = true WHERE id IN ('vitamins', 'magnesium');
