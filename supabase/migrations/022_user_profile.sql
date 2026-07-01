-- 022: User profile fields — weight goal, onboarding flag
-- display_name already exists from migration 008

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS weight_goal_kg  numeric;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS weight_start_kg numeric;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS onboarding_done boolean NOT NULL DEFAULT false;

-- Marina already completed onboarding — mark her as done and set her goals
UPDATE app_user SET
  weight_goal_kg  = 54,
  weight_start_kg = 74.2,
  onboarding_done = true
WHERE email = 'chizikchizik@gmail.com';
