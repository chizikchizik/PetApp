-- 056: user-configurable calorie balance point (maintenance/TDEE — the
-- breakeven level) and calorie goal (target intake, which can differ from
-- the balance point for a deficit/surplus plan). Used to color-code the
-- calorie bars on the /weight chart as deficit (green) vs surplus (red)
-- instead of a flat, meaning-free tint.
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS calorie_balance_kcal int;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS calorie_goal_kcal int;
