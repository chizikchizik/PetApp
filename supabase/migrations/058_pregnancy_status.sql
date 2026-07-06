-- 058: pregnancy status (Elena's review, no veto). Deliberately minimal:
-- a binary status with system-set dates, NOT the last-menstrual-period date
-- — the app must not compute obstetric weeks/trimesters or due dates
-- (that's the obstetrician's job; wrong dating in a tracker → wrong
-- advice). pregnant_since = when the status was turned on;
-- pregnant_until = when it was turned off (kept so the window can be
-- excluded from cycle correlations afterwards). Currently pregnant =
-- pregnant_since IS NOT NULL AND pregnant_until IS NULL.
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS pregnant_since date;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS pregnant_until date;
