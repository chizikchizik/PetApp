-- 041: classify medications by drug class so triptan-overuse (МИГБ, ICHD-3
-- 8.2.2, ≥10 days/mo) can be counted separately from other analgesic classes
-- (which have different thresholds — see Elena's review, memory notes).
-- Default 'unclassified' — never silently treated as "not a triptan" in
-- counting logic; only medications explicitly marked 'triptan' count.
ALTER TABLE medication ADD COLUMN IF NOT EXISTS drug_class text NOT NULL DEFAULT 'unclassified';

-- Only unambiguous INN-backed classifications (pharmacological fact, not a
-- name guess) — Elena explicitly flagged brand names like "Спрей",
-- "Делмигрен", "Капориза", "Триптаджик" as too uncertain to auto-classify.
UPDATE medication SET drug_class = 'triptan'               WHERE name ILIKE '%суматриптан%' OR name ILIKE '%sumatriptan%';
UPDATE medication SET drug_class = 'triptan'               WHERE id = 'relpax'; -- Relpax = elетриптан, established triptan
UPDATE medication SET drug_class = 'nsaid'                 WHERE id = 'nurofen'; -- ibuprofen
UPDATE medication SET drug_class = 'combination_analgesic' WHERE id IN ('spazmalgon', 'pentalgin', 'ascofene');
