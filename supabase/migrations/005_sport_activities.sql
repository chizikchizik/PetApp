ALTER TABLE daily_log
  ADD COLUMN IF NOT EXISTS sport_activities text[] DEFAULT '{}';
