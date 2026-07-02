-- 038: user-configurable yearly workout goal, was hardcoded GOAL=150 in
-- app/(app)/training/page.tsx.
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS workout_year_goal int;
