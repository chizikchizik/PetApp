-- Migration 016: June 2026 migraine events (from Migrebot screenshot)
-- 5 migraines: 3, 8, 10, 17, 24 June — all with sumatriptan, no aura
INSERT INTO migraine_event (event_date, aura, triptan, meds, intensity) VALUES
  ('2026-06-03', false, true, 'суматриптан 100, Помогло', null),
  ('2026-06-08', false, true, 'суматриптан 100, Немного помогло', null),
  ('2026-06-10', false, true, 'суматриптан 100, Помогло', null),
  ('2026-06-17', false, true, 'суматриптан 100, Помогло', null),
  ('2026-06-24', false, true, 'суматриптан 100, Помогло', null)
ON CONFLICT (event_date) DO NOTHING;
