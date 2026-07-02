-- 037: close a race in balance_sector's "materialize defaults on first edit"
-- logic — QA (Ilya) found that ensureSectorsExist()'s SELECT-then-INSERT is
-- not atomic, so two near-simultaneous edits on a fresh user (e.g. blurring
-- one rename field while tapping another) could each insert their own copy
-- of the 8 defaults, leaving 16 duplicated rows. This constraint lets the
-- app switch to an upsert ... ON CONFLICT (app_user_id, sort) DO NOTHING,
-- which Postgres guarantees is race-safe regardless of app-level timing.
ALTER TABLE balance_sector
  ADD CONSTRAINT balance_sector_user_sort_unique UNIQUE (app_user_id, sort);
