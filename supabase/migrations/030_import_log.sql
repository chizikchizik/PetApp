-- Migration 030: track import history
CREATE TABLE IF NOT EXISTS import_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id  uuid REFERENCES app_user(id),
  source       text NOT NULL DEFAULT 'migrebot',
  file_name    text,
  imported_at  timestamptz NOT NULL DEFAULT now(),
  total_rows   int,
  migraine_rows int,
  date_from    date,
  date_to      date
);

CREATE INDEX IF NOT EXISTS import_log_user_idx ON import_log (app_user_id, imported_at DESC);
